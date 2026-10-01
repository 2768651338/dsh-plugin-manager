/**
 * 手写 Typert 远程工件（对齐 @deepseek-ai/dsh-typert-generator 的输出形态）：
 * 主机侧 PluginManagerGateway 用 SRC 标记（Remote 装饰器 + TypertRemoteService），
 * 浏览器侧靠这份贡献把 pluginManager 命名空间挂到 ctx.remote 上。
 * 参数/结果必须携带 strict codec（客户端 $mount 强制要求）；codec 为双形态对象
 * （`schema` 兼容 0.1.x 宿主，`create()` 兼容 0.2.0+ 宿主），见 strictCodec 注释。
 * @module dsh-plugin-manager/remote
 */

import { z } from 'zod'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { BackupExportResult, BackupImportResult, CatalogEditResult, PluginManagerSnapshot, SetEnabledResult } from '../types.ts'

const brandedString = z.intersection(z.string(), z.unknown()).readonly()

const fiberPhase$schema = z.union([
  z.literal(null),
  z.literal('pending'),
  z.literal('loading'),
  z.literal('active'),
  z.literal('failed'),
  z.literal('unloading'),
]).readonly()

const entry$schema = z.object({
  'entryId': brandedString,
  'moduleName': z.string().readonly(),
  'enabled': z.boolean().readonly(),
  'fiberPhase': fiberPhase$schema,
  'displayName': z.string().readonly(),
  'description': z.string().readonly(),
  'category': z.string().readonly(),
  'system': z.boolean().readonly(),
  'toggleable': z.boolean().readonly(),
  'toggleBlockReason': z.union([z.literal(null), z.literal('system'), z.literal('expression')]).readonly(),
  'hasOverride': z.boolean().readonly(),
})

const snapshot$schema = z.object({
  'patchFile': z.string(),
  'overridesFile': z.string(),
  'entryCount': z.number(),
  'enabledCount': z.number(),
  'entries': z.array(entry$schema).readonly(),
})

const catalogEditResult$schema = z.object({
  'accepted': z.boolean(),
  'reason': z.string().optional(),
  'message': z.string().optional(),
})

const setEnabledResult$schema = z.object({
  'accepted': z.boolean(),
  'reason': z.string().optional(),
  'message': z.string().optional(),
})

const backupDocument$schema = z.object({
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

const backupExportResult$schema = z.object({
  'accepted': z.boolean(),
  'reason': z.string().optional(),
  'message': z.string().optional(),
  'document': backupDocument$schema.optional(),
})

const backupRestoreDetail$schema = z.object({
  'overridesRestored': z.number(),
  'dependenciesRestored': z.number(),
  'bundlesRestored': z.number(),
  'patchRowsRestored': z.number(),
})

const backupImportResult$schema = z.object({
  'accepted': z.boolean(),
  'reason': z.string().optional(),
  'message': z.string().optional(),
  'detail': backupRestoreDetail$schema.optional(),
  'installCommand': z.string().optional(),
  'restartRequired': z.boolean().optional(),
})

const PACKAGE = '@2768651338/dsh-plugin-manager'

/**
 * 双形态 strict codec：0.1.x 宿主链路读 `schema` 字段（真 zod v4 实例），0.2.0 起的
 * typert-loader/registry 改读 `create()` 工厂。两代校验各读各的字段、忽略多余字段，
 * 同一对象携带两种形态即可同时通过两代宿主校验（与 typert-host.ts 的 strictCodec 镜像）。
 */
function strictCodec(typeSymbol: string, schema: z.ZodType) {
  return {
    mode: 'strict' as const,
    typeSymbol,
    schema,
    create: () => schema,
  }
}

/** 浏览器侧挂载贡献：客户端 apply 里 ctx.remote.$mount(TYPERT_REMOTE)。 */
export const TYPERT_REMOTE = {
  package: PACKAGE,
  descriptors: [
    {
      id: PACKAGE + '#pluginManager/list',
      service: 'pluginManager',
      namespace: 'pluginManager',
      method: 'list',
      invocation: { kind: 'direct' },
      parameters: [],
      result: strictCodec('@2768651338/dsh-plugin-manager/types#PluginManagerSnapshot', snapshot$schema),
      sourceLocation: { 'file': 'packages/external/dsh-plugin-manager/src/index.ts', 'line': 1, 'column': 1 },
    },
    {
      id: PACKAGE + '#pluginManager/setEnabled',
      service: 'pluginManager',
      namespace: 'pluginManager',
      method: 'setEnabled',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'entryId',
          wire: 'entryId',
          source: 'json',
          codec: strictCodec('string', brandedString),
        },
        {
          name: 'enabled',
          wire: 'enabled',
          source: 'json',
          codec: strictCodec('boolean', z.boolean()),
        },
      ],
      result: strictCodec('@2768651338/dsh-plugin-manager/types#SetEnabledResult', setEnabledResult$schema),
      sourceLocation: { 'file': 'packages/external/dsh-plugin-manager/src/index.ts', 'line': 2, 'column': 1 },
    },
    {
      id: PACKAGE + '#pluginManager/setOverride',
      service: 'pluginManager',
      namespace: 'pluginManager',
      method: 'setOverride',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'moduleName',
          wire: 'moduleName',
          source: 'json',
          codec: strictCodec('string', z.string()),
        },
        {
          name: 'name',
          wire: 'name',
          source: 'json',
          codec: strictCodec('string', z.string()),
        },
        {
          name: 'desc',
          wire: 'desc',
          source: 'json',
          codec: strictCodec('string', z.string()),
        },
      ],
      result: strictCodec('@2768651338/dsh-plugin-manager/types#CatalogEditResult', catalogEditResult$schema),
      sourceLocation: { 'file': 'packages/external/dsh-plugin-manager/src/index.ts', 'line': 3, 'column': 1 },
    },
    {
      id: PACKAGE + '#pluginManager/removeOverride',
      service: 'pluginManager',
      namespace: 'pluginManager',
      method: 'removeOverride',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'moduleName',
          wire: 'moduleName',
          source: 'json',
          codec: strictCodec('string', z.string()),
        },
      ],
      result: strictCodec('@2768651338/dsh-plugin-manager/types#CatalogEditResult', catalogEditResult$schema),
      sourceLocation: { 'file': 'packages/external/dsh-plugin-manager/src/index.ts', 'line': 4, 'column': 1 },
    },
    {
      id: PACKAGE + '#pluginManager/exportBackup',
      service: 'pluginManager',
      namespace: 'pluginManager',
      method: 'exportBackup',
      invocation: { kind: 'direct' },
      parameters: [],
      result: strictCodec('@2768651338/dsh-plugin-manager/types#BackupExportResult', backupExportResult$schema),
      sourceLocation: { 'file': 'packages/external/dsh-plugin-manager/src/index.ts', 'line': 5, 'column': 1 },
    },
    {
      id: PACKAGE + '#pluginManager/importBackup',
      service: 'pluginManager',
      namespace: 'pluginManager',
      method: 'importBackup',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'json',
          wire: 'json',
          source: 'json',
          codec: strictCodec('string', z.string()),
        },
      ],
      result: strictCodec('@2768651338/dsh-plugin-manager/types#BackupImportResult', backupImportResult$schema),
      sourceLocation: { 'file': 'packages/external/dsh-plugin-manager/src/index.ts', 'line': 6, 'column': 1 },
    },
  ],
} as const

export default TYPERT_REMOTE

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    /** 插件管家：主机插件管理远程服务。 */
    pluginManager: {
      list(): Promise<RemoteResult<PluginManagerSnapshot>>
      setEnabled(entryId: string, enabled: boolean): Promise<RemoteResult<SetEnabledResult>>
      setOverride(moduleName: string, name: string, desc: string): Promise<RemoteResult<CatalogEditResult>>
      removeOverride(moduleName: string): Promise<RemoteResult<CatalogEditResult>>
      exportBackup(): Promise<RemoteResult<BackupExportResult>>
      importBackup(json: string): Promise<RemoteResult<BackupImportResult>>
    }
  }
}