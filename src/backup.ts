/**
 * 备份/恢复的纯数据逻辑：校验、组装、合并。不触碰文件系统，
 * 便于独立单测，也把「格式契约」集中在一处（主机/浏览器两侧共享）。
 * @module dsh-plugin-manager/backup
 */

import type { BackupDocument, CatalogOverrides } from './types.ts'

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

/** 合并备注覆盖：备份条目覆盖当前，保留当前独有的条目。返回合并结果与变更条数。 */
export function mergeOverrides(
  current: CatalogOverrides,
  incoming: CatalogOverrides,
): { merged: CatalogOverrides; changed: number } {
  const merged: CatalogOverrides = { ...current }
  let changed = 0
  for (const [key, entry] of Object.entries(incoming)) {
    merged[key] = { ...entry }
    changed += 1
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
