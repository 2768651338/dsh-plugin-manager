/**
 * 备份/恢复的纯数据逻辑：校验、组装、合并。不触碰文件系统，
 * 便于独立单测，也把「格式契约」集中在一处（主机/浏览器两侧共享）。
 * @module dsh-plugin-manager/backup
 */

import type { BackupDocument, BackupPreview, BackupPreviewDependency, BackupPreviewOverride, CatalogOverrides } from './types.ts'
import { initialPatchFile, isExpression, parsePatchFile, setRowDisabled } from './patch-file.ts'
import { assertWritablePatchYaml } from './patch-yaml.ts'

/** 备份格式标识（写入 document.format）。 */
export const BACKUP_FORMAT = 'dsh-plugin-manager-backup' as const

/** 当前备份格式版本（不兼容时拒绝恢复）。 */
export const BACKUP_VERSION = 1 as const

/** 校验结果：要么是合法文档，要么给出拒绝原因。 */
export type BackupValidation =
  | { readonly ok: true; readonly document: BackupDocument }
  | { readonly ok: false; readonly reason: string }

/** 校验未知值是否为合法的备份文档（不抛异常）。 */
export function validateBackupDocument(value: unknown): BackupValidation {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, reason: '备份文件不是 JSON 对象' }
  }
  const doc = value as Record<string, unknown>
  if (doc.format !== BACKUP_FORMAT) {
    return { ok: false, reason: `格式标识不是 ${BACKUP_FORMAT}（得到 ${String(doc.format)}）` }
  }
  if (doc.version !== BACKUP_VERSION) {
    return { ok: false, reason: `不支持的备份版本 ${String(doc.version)}（当前支持 ${BACKUP_VERSION}）` }
  }
  if (typeof doc.createdAt !== 'string') return { ok: false, reason: '缺少 createdAt' }
  if (typeof doc.profile !== 'string') return { ok: false, reason: '缺少 profile' }

  const overrides = doc.overrides
  if (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return { ok: false, reason: 'overrides 必须是对象' }
  }
  for (const [key, entry] of Object.entries(overrides as Record<string, unknown>)) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false, reason: `overrides.${key} 必须是对象` }
    }
    const fields = entry as Record<string, unknown>
    for (const field of ['name', 'desc']) {
      if (fields[field] !== undefined && typeof fields[field] !== 'string') {
        return { ok: false, reason: `overrides.${key}.${field} 必须是字符串` }
      }
    }
  }

  const dependencies = doc.dependencies
  if (dependencies === null || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
    return { ok: false, reason: 'dependencies 必须是对象' }
  }
  for (const [key, spec] of Object.entries(dependencies as Record<string, unknown>)) {
    if (typeof spec !== 'string') {
      return { ok: false, reason: `dependencies.${key} 必须是字符串` }
    }
  }

  const bundles = doc.bundles
  if (!Array.isArray(bundles) || bundles.some(item => typeof item !== 'string')) {
    return { ok: false, reason: 'bundles 必须是字符串数组' }
  }

  if (doc.patchFile !== undefined && typeof doc.patchFile !== 'string') {
    return { ok: false, reason: 'patchFile 必须是字符串' }
  }

  return { ok: true, document: value as unknown as BackupDocument }
}

/** 组装一个备份文档（由主机侧读取现状后调用）。 */
export function buildBackupDocument(input: {
  profile: string
  overrides: CatalogOverrides
  dependencies: Record<string, string>
  bundles: readonly string[]
  patchFile?: string
}): BackupDocument {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    profile: input.profile,
    overrides: input.overrides,
    dependencies: input.dependencies,
    bundles: [...input.bundles],
    ...(input.patchFile === undefined ? {} : { patchFile: input.patchFile }),
  }
}

/** 合并备注覆盖：备份条目覆盖当前，保留当前独有的条目。仅统计真正发生变化的条数。 */
export function mergeOverrides(
  current: CatalogOverrides,
  incoming: CatalogOverrides,
): { merged: CatalogOverrides; changed: number } {
  const merged: CatalogOverrides = { ...current }
  let changed = 0
  for (const [key, entry] of Object.entries(incoming)) {
    const existing = merged[key]
    if (existing === undefined || existing.name !== entry.name || existing.desc !== entry.desc) {
      changed += 1
    }
    merged[key] = { ...entry }
  }
  return { merged, changed }
}

/** 合并依赖：备份 spec 覆盖当前同名字段，保留当前独有依赖。 */
export function mergeDependencies(
  current: Record<string, string>,
  incoming: Record<string, string>,
): { merged: Record<string, string>; changed: number } {
  const merged: Record<string, string> = { ...current }
  let changed = 0
  for (const [key, spec] of Object.entries(incoming)) {
    if (merged[key] !== spec) changed += 1
    merged[key] = spec
  }
  return { merged, changed }
}

/** 一条待用户确认的非常规依赖（模块名 + 安装 spec）。 */
export interface PendingSpecEntry {
  readonly name: string
  readonly spec: string
}

/**
 * 分类一个依赖 spec（评估 P0-3）：false=registry 风格（semver/版本范围/dist-tag），
 * true=非常规来源（git / file / link / npm 别名 / workspace / http(tarball) / scp 路径 /
 * GitHub shorthand（user/repo#ref）/ 本地路径），必须经用户逐项确认才允许写入。
 *
 * 判据说明：registry 风格 spec 的合法字符集中不含冒号，出现冒号即代表某种协议形态；
 * 其余只补路径与 shorthand 两类形态。
 */
export function isNonRegistrySpec(spec: string): boolean {
  const value = spec.trim()
  if (value.length === 0 || value === '*' || value === 'latest') return false
  if (value.includes(':')) return true
  if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../')
    || value.startsWith('~/') || value.startsWith('\\') || value === '.' || value === '..') {
    return true
  }
  if (/^[a-zA-Z][a-zA-Z0-9._-]*\/[a-zA-Z0-9._-]+(?:#.*)?$/.test(value)) return true
  return false
}

/**
 * 审计备份依赖（评估 P0-3）：把依赖拆为「可直接合并」与「待确认」两组。
 * - allowNonRegistrySpecs 为 null：首次调用（用户尚未决策），全部非常规 spec 进 pending。
 * - 传确认清单：用户已勾选的非常规 spec 进入 writable，未勾选的留在 pending（执行时跳过）。
 */
export function auditDependencySpecs(
  dependencies: Record<string, string>,
  allowNonRegistrySpecs: readonly string[] | null,
): { writable: Record<string, string>; pending: readonly PendingSpecEntry[] } {
  const allowed = allowNonRegistrySpecs === null ? null : new Set(allowNonRegistrySpecs)
  const writable: Record<string, string> = {}
  const pending: PendingSpecEntry[] = []
  for (const [name, spec] of Object.entries(dependencies)) {
    if (!isNonRegistrySpec(spec) || (allowed !== null && allowed.has(spec))) {
      writable[name] = spec
      continue
    }
    pending.push({ name, spec })
  }
  return { writable, pending }
}

/** 合并 bundles：去重并保持当前顺序，备份里缺失的按备份顺序追加。 */
export function mergeBundles(
  current: readonly string[],
  incoming: readonly string[],
): { merged: string[]; changed: number } {
  const merged: string[] = [...current]
  const seen = new Set(merged)
  let changed = 0
  for (const name of incoming) {
    if (!seen.has(name)) {
      merged.push(name)
      seen.add(name)
      changed += 1
    }
  }
  return { merged, changed }
}

/**
 * 把备份里的启停行逐条合并进当前补丁内容（评估 P1-3）。
 * 预览与真正导入共用本函数，保证「将要改什么」和「实际改了什么」一致。
 * 返回编辑后的内容与每一条实际翻转的行（含目标状态）；表达式行/无法识别的行跳过。
 * 有行需要写入时先做 YAML 回读校验——当前补丁文件损坏（如手写成映射）时，
 * 预览与导入会得到同一个明确错误，而不是预览说能改、导入时报错。
 */
export function mergePatchRows(
  currentContent: string,
  backupPatchFile: string,
): { content: string; rows: readonly { id: string; enabled: boolean }[] } {
  let content = currentContent
  const rows: { id: string; enabled: boolean }[] = []
  for (const row of parsePatchFile(backupPatchFile)) {
    if (row.id === null || row.disabledValue === null) continue
    if (isExpression(row.disabledValue)) continue
    const enabled = row.disabledValue !== 'true'
    const edited = setRowDisabled(content, row.id, enabled)
    if (edited.blocked !== null || !edited.changed) continue
    content = edited.content
    rows.push({ id: row.id, enabled })
  }
  if (rows.length > 0) assertWritablePatchYaml(content)
  return { content, rows }
}

/**
 * 组装导入预览（评估 P1-3）：把备份文档与当前状态逐项比对，只读、不写任何文件。
 * 当前补丁文件缺失时按 initialPatchFile() 的空形态比对，与导入行为一致。
 */
export function buildBackupPreview(input: {
  currentOverrides: CatalogOverrides
  currentDependencies: Record<string, string>
  currentBundles: readonly string[]
  currentPatchFile?: string
  document: BackupDocument
}): BackupPreview {
  const doc = input.document
  const overrides: BackupPreviewOverride[] = []
  for (const [name, entry] of Object.entries(doc.overrides)) {
    const existing = input.currentOverrides[name]
    if (existing !== undefined && existing.name === entry.name && existing.desc === entry.desc) continue
    overrides.push({
      name,
      ...(entry.name === undefined ? {} : { nextName: entry.name }),
      ...(entry.desc === undefined ? {} : { nextDesc: entry.desc }),
      kind: existing === undefined ? 'add' as const : 'update' as const,
    })
  }
  const dependencies: BackupPreviewDependency[] = []
  for (const [name, spec] of Object.entries(doc.dependencies)) {
    const existing = input.currentDependencies[name]
    if (existing === spec) continue
    dependencies.push({ name, spec, kind: existing === undefined ? 'add' as const : 'update' as const, nonRegistry: isNonRegistrySpec(spec) })
  }
  const bundlesAdded = doc.bundles.filter(name => !input.currentBundles.includes(name))
  const pendingNonRegistrySpecs = dependencies
    .filter(dep => dep.nonRegistry)
    .map(dep => ({ name: dep.name, spec: dep.spec }))
  const patchRows = doc.patchFile === undefined
    ? []
    : mergePatchRows(input.currentPatchFile ?? initialPatchFile(), doc.patchFile).rows
  return {
    backupProfile: doc.profile,
    backupCreatedAt: doc.createdAt,
    overrides,
    dependencies,
    bundlesAdded,
    patchRows,
    pendingNonRegistrySpecs,
  }
}
