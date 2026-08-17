/**
 * 插件管家浏览器半：挂载 pluginManager 远程命名空间，并向“设置→插件”注册标签页。
 *
 * 关键点：
 * - 不在 dsh.client.inject 里声明 'remote.pluginManager'（挂载发生在 apply 内，
 *   注入会导致自身 fiber 永久 pending）——先 $mount 再通过 ctx.remote.pluginManager 访问。
 * - $mount 与标签页注册都在 apply 里完成；远程调用在注入面里解包 RemoteResult。
 * @module dsh-plugin-manager/client
 */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { RemoteResult, TypertRemoteNamespaceMap } from '@deepseek-ai/dsh-typert-protocol'
import type { BackupExportResult, BackupImportResult, CatalogEditResult, PluginManagerSnapshot, SetEnabledResult } from '../types.ts'
import { PluginManagerTab, type PluginManagerTabInjected } from './PluginManagerTab.tsx'
import { en, zh } from './locales.ts'
import { TYPERT_REMOTE } from './remote.ts'

export type { PluginManagerTabInjected, PluginManagerTabProps } from './PluginManagerTab.tsx'

/** 本插件拥有的文案命名空间。 */
export const NS = 'settings.pluginManager'

/** 所需服务（cordis 注入）。 */
export const inject = ['slots', 'locale', 'remote']

/** 挂载远程命名空间并注册设置标签页。 */
export async function apply(ctx: ClientContext): Promise<void> {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-plugin-manager: dictionaries')

  // 1) 挂载 pluginManager 命名空间（返回 disposer，随插件卸载自动清理）。
  await ctx.effect(async () => {
    const dispose = await ctx.remote.$mount(TYPERT_REMOTE)
    return dispose
  }, 'dsh-plugin-manager: remote mount')

  const t = ctx.locale.bind(NS)

  // 2) 注入面：解包 RemoteResult，抛错给界面层处理。
  // 不能把 remote.pluginManager 写进 inject（挂载发生在 apply 内，注入会让自身 fiber 永久 pending），
  // 也不能做 ctx.remote.pluginManager 属性访问（cordis 要求注入）；
  // 用免注入通道 ctx.get() 在挂载完成后取命名空间服务。
  type PluginManagerRemote = TypertRemoteNamespaceMap['pluginManager']
  const namespace = (): PluginManagerRemote => ctx.get('remote.pluginManager') as PluginManagerRemote

  const list: PluginManagerTabInjected['list'] = async () => {
    const result: RemoteResult<PluginManagerSnapshot> = await namespace().list()
    if (!result.ok) {
      throw new Error(`pluginManager.list failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const setEnabled: PluginManagerTabInjected['setEnabled'] = async (entryId, enabled) => {
    const result: RemoteResult<SetEnabledResult> = await namespace().setEnabled(entryId, enabled)
    if (!result.ok) {
      throw new Error(`pluginManager.setEnabled failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const setOverride: PluginManagerTabInjected['setOverride'] = async (moduleName, name, desc) => {
    const result: RemoteResult<CatalogEditResult> = await namespace().setOverride(moduleName, name, desc)
    if (!result.ok) {
      throw new Error(`pluginManager.setOverride failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const removeOverride: PluginManagerTabInjected['removeOverride'] = async (moduleName) => {
    const result: RemoteResult<CatalogEditResult> = await namespace().removeOverride(moduleName)
    if (!result.ok) {
      throw new Error(`pluginManager.removeOverride failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const exportBackup: PluginManagerTabInjected['exportBackup'] = async () => {
    const result: RemoteResult<BackupExportResult> = await namespace().exportBackup()
    if (!result.ok) {
      throw new Error(`pluginManager.exportBackup failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const importBackup: PluginManagerTabInjected['importBackup'] = async (json) => {
    const result: RemoteResult<BackupImportResult> = await namespace().importBackup(json)
    if (!result.ok) {
      throw new Error(`pluginManager.importBackup failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const injected = (): PluginManagerTabInjected => ({ list, setEnabled, setOverride, removeOverride, exportBackup, importBackup })

  // 3) 注册标签页（排在“插件列表”之后）。
  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'manager',
    order: 20,
    label: () => t('tab'),
    locale: NS,
    inject: injected,
  }, PluginManagerTab))
}