/**
 * 手写 Typert 主机工件（对齐 @deepseek-ai/dsh-typert-generator 输出形态）。
 *
 * 为什么需要它：真实部署以 tsx 源码模式启动（DeepSeekHarness.exe --import tsx/esm），
 * 网关与源码树共享一份 dsh-typert-protocol，而本插件从打包产物解析到另一份——
 * Remote 装饰器标记写进本插件的协议实例，网关（另一实例）看不见，SRC 端点声明失败（404）。
 * 通过 exports["./typert"] 交给 typert-loader 注册为严格定义后，端点走注册表声明，
 * 完全绕开装饰器标记与模块实例身份问题。
 *
 * codec 形态：0.1.x 宿主要求 zod 实例（`schema` 字段），0.2.0 起要求 `create()` 工厂。
 * schema 与 strictCodec 统一从 ../schemas.ts 导入（评估 P2-2），本文件只保留
 * invocation 壳——与 client/remote.ts 共享同一份定义，避免双份漂移。
 * @module dsh-plugin-manager/typert-host
 */

import { z } from 'zod'
import {
  backupExportResult$schema,
  backupImportResult$schema,
  backupPreviewResult$schema,
  brandedString,
  catalogEditResult$schema,
  catalogRepairResult$schema,
  setEnabledResult$schema,
  snapshot$schema,
  strictCodec,
} from './schemas.ts'

const PACKAGE = '@txc2768651338/dsh-plugin-manager'

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
        {
          name: 'allowNonRegistrySpecs',
          wire: 'allowNonRegistrySpecs',
          source: 'json',
          codec: strictCodec('json', z.union([z.array(z.string()), z.null()])),
        },
      ],
      result: strictCodec('@txc2768651338/dsh-plugin-manager/types#BackupImportResult', backupImportResult$schema),
      sourceLocation: { file: 'packages/external/dsh-plugin-manager/src/index.ts', line: 6, column: 1 },
    },
    {
      id: PACKAGE + '#pluginManager/previewBackup',
      service: 'pluginManager',
      namespace: 'pluginManager',
      method: 'previewBackup',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'json',
          wire: 'json',
          source: 'json',
          codec: strictCodec('string', z.string()),
        },
      ],
      result: strictCodec('@txc2768651338/dsh-plugin-manager/types#BackupPreviewResult', backupPreviewResult$schema),
      sourceLocation: { file: 'packages/external/dsh-plugin-manager/src/index.ts', line: 7, column: 1 },
    },
    {
      id: PACKAGE + '#pluginManager/quarantineOverrides',
      service: 'pluginManager',
      namespace: 'pluginManager',
      method: 'quarantineOverrides',
      invocation: { kind: 'direct' },
      parameters: [],
      result: strictCodec('@txc2768651338/dsh-plugin-manager/types#CatalogRepairResult', catalogRepairResult$schema),
      sourceLocation: { file: 'packages/external/dsh-plugin-manager/src/index.ts', line: 8, column: 1 },
    },
  ],
  model: {
    services: [],
    events: [],
    objects: [],
  },
}

export default TYPERT
