/**
 * 插件管家浏览器半的纯函数（评估 P2-4）：从组件里抽出，便于脱离 React 单测。
 * 只依赖纯输入，不触碰 DOM / 远程服务 / node:fs，node 可直跑导入（smoke 测试用）；
 * localStorage 仅在调用保存/读取函数时访问（浏览器运行期），模块顶层无副作用。
 * @module dsh-plugin-manager/client/util
 */

import type { PluginManagerEntry, PluginManagerFiberPhase } from '../types.ts'

/** 简单插值：{count} / {enabled} / {message} 等；缺失的键替换为空串。 */
export function format(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (_all, key: string) => String(values[key] ?? ''))
}

/** 文件名友好的时间戳（不含非法字符）：YYYY-MM-DD-HH-mm-ss。 */
export function dateStamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

/**
 * 搜索是否命中：空查询恒命中（短路）；否则按双语显示名/说明 + 模块名/行 id
 * 子串匹配（评估 P2-9：英文字段一并参与，英文用户搜英文名才有意义）。
 */
export function matches(entry: PluginManagerEntry, normalizedQuery: string): boolean {
  if (normalizedQuery.length === 0) return true
  return [
    entry.displayName,
    entry.description,
    entry.displayNameEn,
    entry.descriptionEn,
    entry.moduleName,
    entry.entryId,
  ]
    .some(value => value.toLocaleLowerCase().includes(normalizedQuery))
}

/**
 * Fiber 阶段是否已稳定（评估 P2-1）：轮询确认以稳态为终点——
 * active（已挂载）/ failed（挂载失败）/ null（未挂载）之外的阶段都还在过渡。
 */
export function fiberPhaseSettled(phase: PluginManagerFiberPhase): boolean {
  return phase === 'active' || phase === 'failed' || phase === null
}

/** 来源筛选键（issue #1）：命名视图而非分区——用户安装的社区插件同时命中「用户安装」与「社区」。 */
export type OriginFilterKey = 'all' | 'user' | 'builtin' | 'community'

/** 来源筛选的持久化键（issue #1：记住上次选择）。 */
export const ORIGIN_FILTER_STORAGE_KEY = 'dsh-plugin-manager:origin-filter'

/** 来源筛选的合法取值（读取持久化时校验，防呆：脏数据一律回退默认）。 */
const ORIGIN_FILTER_KEYS: readonly OriginFilterKey[] = ['all', 'user', 'builtin', 'community']

/** 读取持久化的来源筛选；不可访问（隐私模式等）或值非法时返回 undefined。 */
export function loadStoredOriginFilter(): OriginFilterKey | undefined {
  try {
    const raw = window.localStorage.getItem(ORIGIN_FILTER_STORAGE_KEY)
    return ORIGIN_FILTER_KEYS.includes(raw as OriginFilterKey) ? raw as OriginFilterKey : undefined
  } catch {
    return undefined
  }
}

/** 持久化来源筛选；不可访问时静默跳过（筛选仍是会话内可用的）。 */
export function storeOriginFilter(value: OriginFilterKey): void {
  try {
    window.localStorage.setItem(ORIGIN_FILTER_STORAGE_KEY, value)
  } catch {
    // 隐私模式 / 存储被禁时兜底：不持久化，不影响本次会话。
  }
}

/**
 * 快照是否携带来源字段（issue #1）：旧版主机的快照没有 declared/official，
 * 此时来源筛选整体退回「全部」，避免把全部行误标为社区或漏掉用户插件。
 */
export function hasOriginData(entries: readonly PluginManagerEntry[]): boolean {
  return entries.some(entry => entry.declared !== undefined || entry.official !== undefined)
}

/**
 * 来源筛选谓词（issue #1）：
 * - 用户安装：出现在 profile 依赖里，或以 file: 本地加载；
 * - 官方内置：官方 scope 且未被用户安装（用户安装的官方插件归入「用户安装」）；
 * - 社区：非官方 scope 且非本地文件（含用户安装的社区插件与运行时派生行）。
 * declared/official 缺失（旧主机）时按 false 兜底，由 hasOriginData 在外层整体降级。
 */
export function matchesOriginFilter(
  entry: Pick<PluginManagerEntry, 'local'> & Partial<Pick<PluginManagerEntry, 'declared' | 'official'>>,
  filter: OriginFilterKey,
): boolean {
  const declared = entry.declared ?? false
  const official = entry.official ?? false
  switch (filter) {
    case 'all': return true
    case 'user': return declared || entry.local
    case 'builtin': return official && !declared && !entry.local
    case 'community': return !official && !entry.local
  }
}

/**
 * 卡片来源徽标（issue #1）：官方 scope 未被用户安装 → 内置；被用户安装 → 官方/社区；
 * file: 本地模块沿用既有「本地」徽标，不重复发来源徽标；其余（非官方且未声明的
 * 运行时派生行）不发徽标。
 */
export function originBadge(
  entry: Pick<PluginManagerEntry, 'local'> & Partial<Pick<PluginManagerEntry, 'declared' | 'official'>>,
): 'builtin' | 'official' | 'community' | null {
  const declared = entry.declared ?? false
  const official = entry.official ?? false
  if (entry.local) return null
  if (official) return declared ? 'official' : 'builtin'
  return declared ? 'community' : null
}
