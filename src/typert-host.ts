/**
 * 手写 Typert 主机工件（对齐 @deepseek-ai/dsh-typert-generator 输出形态）。
 *
 * 为什么需要它：真实部署以 tsx 源码模式启动（DeepSeekHarness.exe --import tsx/esm），
 * 网关与源码树共享一份 dsh-typert-protocol，而本插件从打包产物解析到另一份——
 * Remote 装饰器标记写进本插件的协议实例，网关（另一实例）看不见，SRC 端点声明失败（404）。
 * 通过 exports["./typert"] 交给 typert-loader 注册为严格定义后，端点走注册表声明，
 * 完全绕开装饰器标记与模块实例身份问题。
 *
 * codec 形态：0.1.x 宿主要求 zod 实例（`schema` 字段），0.2.0 起要求 `create()` 工厂；
 * strictCodec() 产出同时携带两种形态的对象，兼容两代宿主（见函数注释）。
 * @module dsh-plugin-manager/typert-host
 */

import { z } from 'zod'

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

const setEnabledResult$schema = z.object({
  'accepted': z.boolean(),
  'reason': z.string().optional(),
  'message': z.string().optional(),
})

const catalogEditResult$schema = z.object({
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

const PACKAGE = '@txc2768651338/dsh-plugin-manager'

/**
 * 双形态 strict codec：0.1.x 的 typert-loader/registry 读 `schema` 字段（要求真 zod v4
 * 实例：`"_zod" in schema` 且 `schema.parse` 可调用），0.2.0 起改读 `create()` 工厂
 * （注册时只校验函数存在，调用时惰性物化）。两代校验各读各的字段、忽略多余字段，
 * 因此同一对象同时携带两种形态，即可同时通过 0.1.x 与 0.2.0 宿主的注册校验。
 */
function strictCodec(typeSymbol: string, schema: z.ZodType) {
  return {
    mode: 'strict' as const,
    typeSymbol,
    schema,
    create: () => schema,
  }
}

/** 主机面工件：typert-loader 自动注册（entry 的 package.json exports["./typert"]）。 */
export const TYPERT = {
  package: PACKAGE,
  face: 'host',
  schemas: [],
  invocations: [
    {
      id: PACKAGE + '#pluginManager/list',
      service: 'pluginManager',
      namespace: 'pluginManager',
      method: 'list',
      invocation: { kind: 'direct' },
      parameters: [],
      result: strictCodec('@txc2768651338/dsh-plugin-manager/types#PluginManagerSnapshot', snapshot$schema),
      sourceLocation: { file: 'packages/external/dsh-plugin-manager/src/index.ts', line: 1, column: 1 },
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
      result: strictCodec('@txc2768651338/dsh-plugin-manager/types#SetEnabledResult', setEnabledResult$schema),
      sourceLocation: { file: 'packages/external/dsh-plugin-manager/src/index.ts', line: 2, column: 1 },
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
      result: strictCodec('@txc2768651338/dsh-plugin-manager/types#CatalogEditResult', catalogEditResult$schema),
      sourceLocation: { file: 'packages/external/dsh-plugin-manager/src/index.ts', line: 3, column: 1 },
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
      result: strictCodec('@txc2768651338/dsh-plugin-manager/types#CatalogEditResult', catalogEditResult$schema),
      sourceLocation: { file: 'packages/external/dsh-plugin-manager/src/index.ts', line: 4, column: 1 },
    },
    {
      id: PACKAGE + '#pluginManager/exportBackup',
      service: 'pluginManager',
      namespace: 'pluginManager',
      method: 'exportBackup',
      invocation: { kind: 'direct' },
      parameters: [],
      result: strictCodec('@txc2768651338/dsh-plugin-manager/types#BackupExportResult', backupExportResult$schema),
      sourceLocation: { file: 'packages/external/dsh-plugin-manager/src/index.ts', line: 5, column: 1 },
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
      result: strictCodec('@txc2768651338/dsh-plugin-manager/types#BackupImportResult', backupImportResult$schema),
      sourceLocation: { file: 'packages/external/dsh-plugin-manager/src/index.ts', line: 6, column: 1 },
    },
  ],
  model: {
    services: [],
    events: [],
    objects: [],
  },
}

export default TYPERT