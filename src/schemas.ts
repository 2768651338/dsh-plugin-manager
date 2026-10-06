/**
 * 插件管家共享 schema（评估 P2-2）：remote.ts 与 typert-host.ts 两份手写工件此前
 * 各自维护一份几乎逐行相同的 zod schema 与 strictCodec，改任何类型都要同步两处，
 * 漏一处就是双宿主某一侧校验不一致且极难靠肉眼发现。现在两侧只保留各自的
 * descriptor/invocation 壳，schema 与 codec 一律从本模块导入。
 *
 * 形态约束不变：schema 与 @deepseek-ai/dsh-typert-generator 的输出形态对齐
 * （键名引号风格、readonly 修饰等）；若未来宿主要求工件可逐字节比对 generator
 * 输出，需要把 schema 拆回两份（目前没有这种要求）。
 * @module dsh-plugin-manager/schemas
 */

import { z } from 'zod'

export const brandedString = z.intersection(z.string(), z.unknown()).readonly()

export const fiberPhase$schema = z.union([
  z.literal(null),
  z.literal('pending'),
  z.literal('loading'),
  z.literal('active'),
  z.literal('failed'),
  z.literal('unloading'),
]).readonly()

export const entry$schema = z.object({
  'entryId': brandedString,
  'moduleName': z.string().readonly(),
  'enabled': z.boolean().readonly(),
  'fiberPhase': fiberPhase$schema,
  'displayName': z.string().readonly(),
  'description': z.string().readonly(),
  'displayNameEn': z.string().readonly(),
  'descriptionEn': z.string().readonly(),
  'category': z.string().readonly(),
  'system': z.boolean().readonly(),
  'toggleable': z.boolean().readonly(),
  'toggleBlockReason': z.union([z.literal(null), z.literal('system'), z.literal('expression')]).readonly(),
  'hasOverride': z.boolean().readonly(),
  'local': z.boolean().readonly(),
  'declared': z.boolean().readonly(),
  'official': z.boolean().readonly(),
})

export const snapshot$schema = z.object({
  'patchFile': z.string(),
  'overridesFile': z.string(),
  'entryCount': z.number(),
  'enabledCount': z.number(),
  'entries': z.array(entry$schema).readonly(),
  'categoryLabels': z.record(z.string(), z.object({
    'zh': z.string(),
    'en': z.string(),
  })),
  'overridesWarning': z.string().optional(),
  'compatibilityWarning': z.string().optional(),
})

export const catalogEditResult$schema = z.object({
  'accepted': z.boolean(),
  'reason': z.string().optional(),
  'message': z.string().optional(),
})

export const setEnabledResult$schema = z.object({
  'accepted': z.boolean(),
  'reason': z.string().optional(),
  'message': z.string().optional(),
})

export const backupDocument$schema = z.object({
  'format': z.literal('dsh-plugin-manager-backup'),
  'version': z.number(),
  'createdAt': z.string(),
  'profile': z.string(),
  'overrides': z.record(z.string(), z.object({
    'name': z.string().optional(),
    'desc': z.string().optional(),
  })),
  'dependencies': z.record(z.string(), z.string()),
  'bundles': z.array(z.string()).readonly(),
  'patchFile': z.string().optional(),
})

export const backupExportResult$schema = z.object({
  'accepted': z.boolean(),
  'reason': z.string().optional(),
  'message': z.string().optional(),
  'document': backupDocument$schema.optional(),
})

export const backupRestoreDetail$schema = z.object({
  'overridesRestored': z.number(),
  'dependenciesRestored': z.number(),
  'bundlesRestored': z.number(),
  'patchRowsRestored': z.number(),
  'nonRegistrySkipped': z.number().optional(),
})

export const backupImportResult$schema = z.object({
  'accepted': z.boolean(),
  'reason': z.string().optional(),
  'message': z.string().optional(),
  'detail': backupRestoreDetail$schema.optional(),
  'installCommand': z.string().optional(),
  'restartRequired': z.boolean().optional(),
  'pendingNonRegistrySpecs': z.array(z.object({
    'name': z.string(),
    'spec': z.string(),
  })).optional(),
})

export const backupPreviewOverride$schema = z.object({
  'name': z.string(),
  'nextName': z.string().optional(),
  'nextDesc': z.string().optional(),
  'kind': z.union([z.literal('add'), z.literal('update')]),
})

export const backupPreviewDependency$schema = z.object({
  'name': z.string(),
  'spec': z.string(),
  'kind': z.union([z.literal('add'), z.literal('update')]),
  'nonRegistry': z.boolean(),
})

export const backupPreviewPatchRow$schema = z.object({
  'id': z.string(),
  'enabled': z.boolean(),
})

export const backupPreview$schema = z.object({
  'backupProfile': z.string(),
  'backupCreatedAt': z.string(),
  'overrides': z.array(backupPreviewOverride$schema).readonly(),
  'dependencies': z.array(backupPreviewDependency$schema).readonly(),
  'bundlesAdded': z.array(z.string()).readonly(),
  'patchRows': z.array(backupPreviewPatchRow$schema).readonly(),
  'pendingNonRegistrySpecs': z.array(z.object({
    'name': z.string(),
    'spec': z.string(),
  })).readonly(),
})

export const backupPreviewResult$schema = z.object({
  'accepted': z.boolean(),
  'reason': z.string().optional(),
  'message': z.string().optional(),
  'preview': backupPreview$schema.optional(),
})

export const catalogRepairResult$schema = z.object({
  'accepted': z.boolean(),
  'reason': z.string().optional(),
  'message': z.string().optional(),
  'movedTo': z.string().optional(),
})

/**
 * 双形态 strict codec：0.1.x 宿主链路读 `schema` 字段（真 zod v4 实例：`"_zod" in
 * schema` 且 `schema.parse` 可调用），0.2.0 起的 typert-loader/registry 改读 `create()`
 * 工厂（注册时只校验函数存在，调用时惰性物化）。两代校验各读各的字段、忽略多余字段，
 * 同一对象携带两种形态即可同时通过两代宿主校验。
 */
export function strictCodec(typeSymbol: string, schema: z.ZodType) {
  return {
    mode: 'strict' as const,
    typeSymbol,
    schema,
    create: () => schema,
  }
}
