/**
 * 手写 Typert 远程工件（对齐 @deepseek-ai/dsh-typert-generator 的输出形态）：
 * 主机侧 PluginManagerGateway 用 SRC 标记（Remote 装饰器 + TypertRemoteService），
 * 浏览器侧靠这份贡献把 pluginManager 命名空间挂到 ctx.remote 上。
 * 参数/结果必须携带 strict codec（客户端 $mount 强制要求）；codec 为双形态对象
 * （`schema` 兼容 0.1.x 宿主，`create()` 兼容 0.2.0+ 宿主）。
 * schema 与 strictCodec 统一从 ../schemas.ts 导入（评估 P2-2），本文件只保留
 * descriptor 壳——与 typert-host.ts 共享同一份定义，避免双份漂移。
 * @module dsh-plugin-manager/remote
 */

import { z } from 'zod'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { BackupExportResult, BackupImportResult, BackupPreviewResult, CatalogEditResult, CatalogRepairResult, PluginManagerSnapshot, SetEnabledResult } from '../types.ts'
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
} from '../schemas.ts'

const PACKAGE = '@txc2768651338/dsh-plugin-manager'

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
      result: strictCodec('@txc2768651338/dsh-plugin-manager/types#PluginManagerSnapshot', snapshot$schema),
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
      result: strictCodec('@txc2768651338/dsh-plugin-manager/types#SetEnabledResult', setEnabledResult$schema),
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
      result: strictCodec('@txc2768651338/dsh-plugin-manager/types#CatalogEditResult', catalogEditResult$schema),
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
      result: strictCodec('@txc2768651338/dsh-plugin-manager/types#CatalogEditResult', catalogEditResult$schema),
      sourceLocation: { 'file': 'packages/external/dsh-plugin-manager/src/index.ts', 'line': 4, 'column': 1 },
    },
    {
      id: PACKAGE + '#pluginManager/exportBackup',
      service: 'pluginManager',
      namespace: 'pluginManager',
      method: 'exportBackup',
      invocation: { kind: 'direct' },
      parameters: [],
      result: strictCodec('@txc2768651338/dsh-plugin-manager/types#BackupExportResult', backupExportResult$schema),
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
        {
          name: 'allowNonRegistrySpecs',
          wire: 'allowNonRegistrySpecs',
          source: 'json',
          codec: strictCodec('json', z.union([z.array(z.string()), z.null()])),
        },
      ],
      result: strictCodec('@txc2768651338/dsh-plugin-manager/types#BackupImportResult', backupImportResult$schema),
      sourceLocation: { 'file': 'packages/external/dsh-plugin-manager/src/index.ts', 'line': 6, 'column': 1 },
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
      sourceLocation: { 'file': 'packages/external/dsh-plugin-manager/src/index.ts', 'line': 7, 'column': 1 },
    },
    {
      id: PACKAGE + '#pluginManager/quarantineOverrides',
      service: 'pluginManager',
      namespace: 'pluginManager',
      method: 'quarantineOverrides',
      invocation: { kind: 'direct' },
      parameters: [],
      result: strictCodec('@txc2768651338/dsh-plugin-manager/types#CatalogRepairResult', catalogRepairResult$schema),
      sourceLocation: { 'file': 'packages/external/dsh-plugin-manager/src/index.ts', 'line': 8, 'column': 1 },
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
      importBackup(json: string, allowNonRegistrySpecs: readonly string[] | null): Promise<RemoteResult<BackupImportResult>>
      previewBackup(json: string): Promise<RemoteResult<BackupPreviewResult>>
      quarantineOverrides(): Promise<RemoteResult<CatalogRepairResult>>
    }
  }
}
