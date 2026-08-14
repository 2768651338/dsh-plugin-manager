/**
 * 插件管家主机半：pluginManager 远程服务（list / setEnabled）。
 *
 * - list：把 Cordis Loader 的当前行投影给浏览器，并附上中文目录信息。
 * - setEnabled：手术式改写全局层启停补丁（~/.dsh/cordis.patch.yml）。
 *   该文件被 launcher 的 HMR 观察者（watchUserPatches）实时监听，写入即热生效。
 *
 * 系统行（引导/传输/插件管家自身）与 !!js 表达式控制的行不允许在界面停用。
 * @module dsh-plugin-manager
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import {
  CATALOG,
  FALLBACK_DESC,
  SYSTEM_MODULES,
  SYSTEM_ROW_IDS,
  type PluginCategory,
} from './catalog.ts'
import { initialPatchFile, setRowDisabled } from './patch-file.ts'
import type {
  CatalogEditResult,
  CatalogOverrides,
  PluginManagerEntry,
  PluginManagerFiberPhase,
  PluginManagerSnapshot,
  SetEnabledResult,
} from './types.ts'

export type * from './types.ts'

/** 与 dsh-home-paths 一致的 home 解析（避免额外运行时依赖）：$DSH_HOME > ~/.dsh。 */
function dshHome(): string {
  const fromEnv = process.env.DSH_HOME
  const selected = fromEnv !== undefined && fromEnv.trim().length > 0
    ? fromEnv.trim()
    : join(homedir(), '.dsh')
  const expanded = selected === '~' ? homedir()
    : selected.startsWith('~/') || selected.startsWith('~\\') ? join(homedir(), selected.slice(2))
      : selected
  return resolve(expanded)
}

/** 全局层启停补丁路径（与 launcher 的 homePatchPath 一致）。 */
function globalPatchPath(): string {
  return join(dshHome(), 'cordis.patch.yml')
}

/** 目录覆盖文件路径。 */
function overridesPath(): string {
  return join(dshHome(), 'plugin-manager', 'catalog.json')
}

/** 紧凑一个模块名（去掉作用域与常见前缀）。 */
function moduleShortName(moduleName: string): string {
  const unscoped = moduleName.startsWith('@') ? moduleName.slice(moduleName.indexOf('/') + 1) : moduleName
  return unscoped
    .replace(/^cordis:/, '')
    .replace(/^cordis-plugin-/, '')
    .replace(/^dsh-(?:host-|client-)?/, '')
}

/** FiberState 跨包常量枚举的运行时镜像。 */
const FIBER_STATE = {
  PENDING: 0,
  LOADING: 1,
  ACTIVE: 2,
  FAILED: 3,
  DISPOSED: 4,
  UNLOADING: 5,
} as const

const FIBER_PHASE: Readonly<Record<number, PluginManagerFiberPhase>> = {
  [FIBER_STATE.PENDING]: 'pending',
  [FIBER_STATE.LOADING]: 'loading',
  [FIBER_STATE.ACTIVE]: 'active',
  [FIBER_STATE.FAILED]: 'failed',
  [FIBER_STATE.DISPOSED]: null,
  [FIBER_STATE.UNLOADING]: 'unloading',
}

/** 读取目录覆盖文件；不存在或损坏时返回空表（防呆：不阻断列表）。 */
function readOverrides(): CatalogOverrides {
  try {
    const parsed: unknown = JSON.parse(readFileSync(overridesPath(), 'utf8'))
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as CatalogOverrides
    }
    return {}
  } catch {
    return {}
  }
}

/** 安全读文件：不存在返回 undefined，其它错误抛给调用方。 */
function tryRead(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

/** 目录缺失时的兜底分类。 */
const OTHER_CATEGORY = 'other' as PluginCategory

/**
 * 插件管家网关：注册为 cordis 服务 pluginManager，由 Typert 网关自动导出
 * （SRC 模式：参数名/返回值自动 JSON 编解码，方法参数必须保持简单形参名）。
 */
export class PluginManagerGateway extends TypertRemoteService {
  static inject = ['loader']

  /** 串行化补丁文件写操作，避免并发开关互相覆盖。 */
  private toggleQueue: Promise<void> = Promise.resolve()

  constructor(ctx: Context) {
    super(ctx, 'pluginManager')
  }

  /** 定位一个非分组行。 */
  private findEntry(entryId: string) {
    for (const entry of this.ctx.loader.entries()) {
      if (entry.options.group) continue
      if (entry.id === entryId) return entry
    }
    return undefined
  }

  /** 串行化覆盖文件写操作。 */
  private overrideQueue: Promise<void> = Promise.resolve()

  /** 把覆盖表原子化写入 catalog.json（目录缺失时创建）。 */
  private writeOverrides(overrides: CatalogOverrides): void {
    mkdirSync(dirname(overridesPath()), { recursive: true })
    writeFileSync(overridesPath(), JSON.stringify(overrides, null, 2) + '\n', 'utf8')
  }

  /** 保存一个模块的覆盖：空字段视为清除；两字段皆空则移除整条覆盖。 */
  @Remote('setOverride')
  setOverride(moduleName: string, name: string, desc: string): Promise<CatalogEditResult> {
    const run = async (): Promise<CatalogEditResult> => {
      try {
        if (typeof moduleName !== 'string' || moduleName.length === 0) {
          return { accepted: false, reason: 'invalid-input', message: '模块名不能为空' }
        }
        const overrides = readOverrides()
        const next: CatalogOverrides = { ...overrides }
        const entry: CatalogOverrides[string] = {}
        const trimmedName = (name ?? '').trim()
        const trimmedDesc = (desc ?? '').trim()
        if (trimmedName.length > 0) entry.name = trimmedName
        if (trimmedDesc.length > 0) entry.desc = trimmedDesc
        if (entry.name === undefined && entry.desc === undefined) {
          delete next[moduleName]
        } else {
          next[moduleName] = entry
        }
        this.writeOverrides(next)
        return { accepted: true }
      } catch (error) {
        return {
          accepted: false,
          reason: 'io-error',
          message: error instanceof Error ? error.message : String(error),
        }
      }
    }
    const queued = this.overrideQueue.then(run, run)
    this.overrideQueue = queued.then(() => {}, () => {})
    return queued
  }

  /** 移除一个模块的覆盖，恢复内置目录/短名。 */
  @Remote('removeOverride')
  removeOverride(moduleName: string): Promise<CatalogEditResult> {
    const run = async (): Promise<CatalogEditResult> => {
      try {
        if (typeof moduleName !== 'string' || moduleName.length === 0) {
          return { accepted: false, reason: 'invalid-input', message: '模块名不能为空' }
        }
        const overrides = readOverrides()
        if (!Object.prototype.hasOwnProperty.call(overrides, moduleName)) {
          return { accepted: true }
        }
        const next: CatalogOverrides = { ...overrides }
        delete next[moduleName]
        this.writeOverrides(next)
        return { accepted: true }
      } catch (error) {
        return {
          accepted: false,
          reason: 'io-error',
          message: error instanceof Error ? error.message : String(error),
        }
      }
    }
    const queued = this.overrideQueue.then(run, run)
    this.overrideQueue = queued.then(() => {}, () => {})
    return queued
  }

  /**
   * 运行时行 id 形如 include:<配置行 id>（include 子树的命名空间前缀），
   * 而补丁文件按配置行 id 定位——取最后一段作为补丁 id。
   */
  private patchIdOf(entryId: string): string {
    return entryId.slice(entryId.lastIndexOf(':') + 1)
  }

  /** 判断一行是否允许界面启停。 */
  private toggleGuard(entryId: string, moduleName: string): SetEnabledResult | undefined {
    const patchId = this.patchIdOf(entryId)
    if (patchId.length === 0) {
      return { accepted: false, reason: 'system', message: '引导行不允许启停' }
    }
    if (SYSTEM_MODULES.has(moduleName) || SYSTEM_ROW_IDS.has(entryId) || SYSTEM_ROW_IDS.has(patchId)) {
      return { accepted: false, reason: 'system', message: '系统插件：停用会导致应用或插件管家自身不可用' }
    }
    const entry = this.findEntry(entryId)
    if (entry === undefined) {
      return { accepted: false, reason: 'not-found', message: `插件行不存在：${entryId}` }
    }
    const raw = entry.options.disabled
    if (typeof raw !== 'boolean' && raw !== null && raw !== undefined) {
      return { accepted: false, reason: 'expression', message: '该插件由 !!js 表达式控制启停，请直接编辑配置文件' }
    }
    return undefined
  }

  /** 当前 Loader 行快照 + 目录信息。 */
  @Remote('list')
  list(): PluginManagerSnapshot {
    const overrides = readOverrides()
    const entries: PluginManagerEntry[] = []
    let enabledCount = 0
    for (const entry of this.ctx.loader.entries()) {
      if (entry.options.group) continue
      const moduleName = entry.options.name
      const enabled = !entry.disabled
      if (enabled) enabledCount += 1
      const catalog = CATALOG[moduleName]
      const override = overrides[moduleName]
      const system = SYSTEM_MODULES.has(moduleName) || SYSTEM_ROW_IDS.has(entry.id)
      const raw = entry.options.disabled
      const expressionManaged = typeof raw !== 'boolean' && raw !== null && raw !== undefined
      const fiberPhase: PluginManagerFiberPhase = entry.fiber === undefined
        ? null
        : FIBER_PHASE[entry.fiber.state as number] ?? null
      entries.push({
        entryId: entry.id,
        moduleName,
        enabled,
        fiberPhase,
        displayName: override?.name ?? catalog?.name ?? moduleShortName(moduleName),
        description: override?.desc ?? catalog?.desc ?? FALLBACK_DESC,
        category: catalog?.category ?? OTHER_CATEGORY,
        system,
        toggleable: !system && !expressionManaged,
        toggleBlockReason: system ? 'system' : expressionManaged ? 'expression' : null,
        hasOverride: override !== undefined,
      })
    }
    return {
      patchFile: globalPatchPath(),
      overridesFile: overridesPath(),
      entryCount: entries.length,
      enabledCount,
      entries,
    }
  }

  /** 启停一个插件：改写全局层补丁文件，由 HMR 观察者热应用。 */
  @Remote('setEnabled')
  setEnabled(entryId: string, enabled: boolean): Promise<SetEnabledResult> {
    const entry = this.findEntry(entryId)
    if (entry === undefined) {
      return Promise.resolve({ accepted: false, reason: 'not-found', message: `插件行不存在：${entryId}` })
    }
    const guarded = this.toggleGuard(entryId, entry.options.name)
    if (guarded !== undefined) return Promise.resolve(guarded)

    const patchId = this.patchIdOf(entryId)
    const run = async (): Promise<SetEnabledResult> => {
      const path = globalPatchPath()
      try {
        let content = tryRead(path) ?? initialPatchFile()
        let edited = setRowDisabled(content, patchId, enabled)
        if (edited.blocked === 'expression') {
          return { accepted: false, reason: 'expression', message: '该插件由 !!js 表达式控制启停，请直接编辑配置文件' }
        }
        if (edited.changed) {
          // 写前重读一次：外部手工编辑与我们并发时，在最新内容上重做合并，避免丢更新。
          const current = tryRead(path)
          if (current !== undefined && current !== content) {
            edited = setRowDisabled(current, patchId, enabled)
            if (edited.blocked === 'expression') {
              return { accepted: false, reason: 'expression', message: '该插件由 !!js 表达式控制启停，请直接编辑配置文件' }
            }
          }
          writeFileSync(path, edited.content, 'utf8')
        }
        return { accepted: true }
      } catch (error) {
        return {
          accepted: false,
          reason: 'io-error',
          message: error instanceof Error ? error.message : String(error),
        }
      }
    }

    const queued = this.toggleQueue.then(run, run)
    this.toggleQueue = queued.then(() => {}, () => {})
    return queued
  }
}

export default PluginManagerGateway

// 保证覆盖文件所在目录存在（只在需要时创建）。
try {
  mkdirSync(dirname(overridesPath()), { recursive: true })
} catch {
  // 目录不可创建时不阻断插件启动：覆盖功能降级为“无覆盖”。
}

// 供界面展示分类标签。
export { CATALOG, CATEGORY_LABELS, SYSTEM_MODULES } from './catalog.ts'