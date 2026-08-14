/**
 * 手写 Typert 主机工件（对齐 @deepseek-ai/dsh-typert-generator 输出形态）。
 *
 * 为什么需要它：真实部署以 tsx 源码模式启动（DeepSeekHarness.exe --import tsx/esm），
 * 网关与源码树共享一份 dsh-typert-protocol，而本插件从打包产物解析到另一份——
 * Remote 装饰器标记写进本插件的协议实例，网关（另一实例）看不见，SRC 端点声明失败（404）。
 * 通过 exports["./typert"] 交给 typert-loader 注册为严格定义后，端点走注册表声明，
 * 完全绕开装饰器标记与模块实例身份问题。
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

const PACKAGE = '@dsh-external/dsh-plugin-manager'

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
      result: {
        mode: 'strict',
        typeSymbol: '@dsh-external/dsh-plugin-manager/types#PluginManagerSnapshot',
        schema: snapshot$schema,
      },
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
          codec: { mode: 'strict', typeSymbol: 'string', schema: brandedString },
        },
        {
          name: 'enabled',
          wire: 'enabled',
          source: 'json',
          codec: { mode: 'strict', typeSymbol: 'boolean', schema: z.boolean() },
        },
      ],
      result: {
        mode: 'strict',
        typeSymbol: '@dsh-external/dsh-plugin-manager/types#SetEnabledResult',
        schema: setEnabledResult$schema,
      },
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
          codec: { mode: 'strict', typeSymbol: 'string', schema: z.string() },
        },
        {
          name: 'name',
          wire: 'name',
          source: 'json',
          codec: { mode: 'strict', typeSymbol: 'string', schema: z.string() },
        },
        {
          name: 'desc',
          wire: 'desc',
          source: 'json',
          codec: { mode: 'strict', typeSymbol: 'string', schema: z.string() },
        },
      ],
      result: {
        mode: 'strict',
        typeSymbol: '@dsh-external/dsh-plugin-manager/types#CatalogEditResult',
        schema: catalogEditResult$schema,
      },
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
          codec: { mode: 'strict', typeSymbol: 'string', schema: z.string() },
        },
      ],
      result: {
        mode: 'strict',
        typeSymbol: '@dsh-external/dsh-plugin-manager/types#CatalogEditResult',
        schema: catalogEditResult$schema,
      },
      sourceLocation: { file: 'packages/external/dsh-plugin-manager/src/index.ts', line: 4, column: 1 },
    },
  ],
  model: {
    services: [],
    events: [],
    objects: [],
  },
}

export default TYPERT