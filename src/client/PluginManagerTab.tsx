/** 插件管家标签页：中文目录 + 一键启停 + 搜索/分类过滤。 */

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { IconSearchOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { CatalogEditResult, PluginManagerEntry, PluginManagerSnapshot, SetEnabledResult } from '../types.ts'
import type { PluginManagerLocaleKey } from './locales.ts'
import css from './PluginManagerTab.module.css'

/** 注册侧注入面：远程服务已解包（unwrap RemoteResult）。 */
export interface PluginManagerTabInjected {
  list: () => Promise<PluginManagerSnapshot>
  setEnabled: (entryId: string, enabled: boolean) => Promise<SetEnabledResult>
  setOverride: (moduleName: string, name: string, desc: string) => Promise<CatalogEditResult>
  removeOverride: (moduleName: string) => Promise<CatalogEditResult>
}

/** 设置槽位渲染器组装的完整 props。 */
export type PluginManagerTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.pluginManager'>
  & InjectFace<PluginManagerTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message?: string }
  | { readonly status: 'ready'; readonly snapshot: PluginManagerSnapshot }

/** 分类中文标签（与主机 catalog 保持一致）。 */
const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  core: '核心服务',
  llm: '模型与网络',
  session: '会话',
  agent: '智能体',
  tool: '工具',
  skill: '技能',
  ui: '界面',
  web: 'Web 服务',
  sandbox: '沙箱与安全',
  storage: '存储',
  external: '第三方插件',
  other: '其它',
}

/** 简单插值：{count} / {enabled} / {message}。 */
function format(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (_all, key: string) => String(values[key] ?? ''))
}

/** 搜索是否命中。 */
function matches(entry: PluginManagerEntry, normalizedQuery: string): boolean {
  if (normalizedQuery.length === 0) return true
  return [entry.displayName, entry.description, entry.moduleName, entry.entryId]
    .some(value => value.toLocaleLowerCase().includes(normalizedQuery))
}

/** 自动刷新延迟：等待 HMR 重应用补丁。 */
const AUTO_REFRESH_MS = 900

/** 与主机 FALLBACK_DESC 一致的兜底说明；编辑时该文本预填为空。 */
const FALLBACK_DESC = '该插件暂无内置说明，可在覆盖文件中补充自定义说明。'

/** 渲染插件管家标签页。 */
export function PluginManagerTab({ list, setEnabled, setOverride, removeOverride, t }: PluginManagerTabProps): ReactNode {
  const [request, setRequest] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set())
  const [messages, setMessages] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const selectId = useId()

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => list()).then(
      (snapshot) => { if (current) setState({ status: 'ready', snapshot }) },
      (error: unknown) => {
        if (current) {
          setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
        }
      },
    )
    return () => { current = false }
  }, [list, request])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const entries = state.status === 'ready' ? state.snapshot.entries : []
  const categories = useMemo(
    () => ['all', ...new Set(entries.map(entry => entry.category))],
    [entries],
  )
  const filtered = useMemo(
    () => entries.filter(entry =>
      matches(entry, normalizedQuery)
      && (category === 'all' || entry.category === category)),
    [entries, normalizedQuery, category],
  )

  const retry = (): void => {
    setState({ status: 'loading' })
    setRequest(value => value + 1)
  }

  const scheduleReload = (entryId: string): void => {
    const existing = timers.current.get(entryId)
    if (existing !== undefined) clearTimeout(existing)
    const timer = setTimeout(() => {
      timers.current.delete(entryId)
      setMessages(current => {
        const next = new Map(current)
        next.delete(entryId)
        return next
      })
      setRequest(value => value + 1)
    }, AUTO_REFRESH_MS)
    timers.current.set(entryId, timer)
  }

  const toggle = async (entry: PluginManagerEntry): Promise<void> => {
    if (busy.has(entry.entryId)) return
    if (!entry.toggleable) {
      setMessages(current => new Map(current).set(
        entry.entryId,
        t(entry.toggleBlockReason === 'system' ? 'toggleBlockedSystem' : 'toggleBlockedExpression'),
      ))
      return
    }
    setBusy(current => new Set(current).add(entry.entryId))
    setMessages(current => {
      const next = new Map(current)
      next.delete(entry.entryId)
      return next
    })
    try {
      const result = await setEnabled(entry.entryId, !entry.enabled)
      if (result.accepted) {
        setMessages(current => new Map(current).set(entry.entryId, t('toggleSucceeded')))
        scheduleReload(entry.entryId)
      } else {
        setMessages(current => new Map(current).set(
          entry.entryId,
          format(t('toggleNotAccepted'), { message: result.message ?? result.reason ?? '' }),
        ))
      }
    } catch (error) {
      setMessages(current => new Map(current).set(
        entry.entryId,
        format(t('toggleFailed'), { message: error instanceof Error ? error.message : String(error) }),
      ))
    } finally {
      setBusy(current => {
        const next = new Set(current)
        next.delete(entry.entryId)
        return next
      })
    }
  }

  const startEdit = (entry: PluginManagerEntry): void => {
    setEditingId(entry.entryId)
    setDraftName(entry.displayName)
    setDraftDesc(entry.description === FALLBACK_DESC ? '' : entry.description)
  }

  const cancelEdit = (): void => {
    setEditingId(null)
    setDraftName('')
    setDraftDesc('')
  }

  const saveEdit = async (entry: PluginManagerEntry): Promise<void> => {
    if (busy.has(entry.entryId)) return
    setBusy(current => new Set(current).add(entry.entryId))
    setMessages(current => {
      const next = new Map(current)
      next.delete(entry.entryId)
      return next
    })
    try {
      const result = await setOverride(entry.moduleName, draftName, draftDesc)
      if (result.accepted) {
        cancelEdit()
        setMessages(current => new Map(current).set(entry.entryId, t('saveSucceeded')))
        scheduleReload(entry.entryId)
      } else {
        setMessages(current => new Map(current).set(
          entry.entryId,
          format(t('saveFailed'), { message: result.message ?? result.reason ?? '' }),
        ))
      }
    } catch (error) {
      setMessages(current => new Map(current).set(
        entry.entryId,
        format(t('saveFailed'), { message: error instanceof Error ? error.message : String(error) }),
      ))
    } finally {
      setBusy(current => {
        const next = new Set(current)
        next.delete(entry.entryId)
        return next
      })
    }
  }

  const restoreDefault = async (entry: PluginManagerEntry): Promise<void> => {
    if (busy.has(entry.entryId)) return
    setBusy(current => new Set(current).add(entry.entryId))
    try {
      const result = await removeOverride(entry.moduleName)
      if (result.accepted) {
        cancelEdit()
        setMessages(current => new Map(current).set(entry.entryId, t('removeSucceeded')))
        scheduleReload(entry.entryId)
      } else {
        setMessages(current => new Map(current).set(
          entry.entryId,
          format(t('saveFailed'), { message: result.message ?? result.reason ?? '' }),
        ))
      }
    } catch (error) {
      setMessages(current => new Map(current).set(
        entry.entryId,
        format(t('saveFailed'), { message: error instanceof Error ? error.message : String(error) }),
      ))
    } finally {
      setBusy(current => {
        const next = new Set(current)
        next.delete(entry.entryId)
        return next
      })
    }
  }

  return (
    <div className={css.section} aria-busy={state.status === 'loading'}>
      {state.status === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className={css.failure}>
          <p role="alert">{t('error')}</p>
          <button type="button" onClick={retry}>{t('retry')}</button>
          {state.message !== undefined ? (
            <code className={css.failureDetail}>{state.message}</code>
          ) : null}
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <div className={css.catalog}>
          <div className={css.toolbar}>
            <label className={css.search}>
              <IconSearchOutline16 aria-hidden="true" />
              <span className={css.visuallyHidden}>{t('search')}</span>
              <input
                type="search"
                value={query}
                placeholder={t('search')}
                aria-label={t('search')}
                onChange={(event) => { setQuery(event.currentTarget.value) }}
              />
            </label>
            <label className={css.category}>
              <span className={css.visuallyHidden}>{t('category')}</span>
              <select
                id={selectId}
                value={category}
                onChange={(event) => { setCategory(event.currentTarget.value) }}
              >
                {categories.map(item => (
                  <option key={item} value={item}>
                    {item === 'all' ? t('summaryAll') : CATEGORY_LABELS[item] ?? item}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className={css.refresh} onClick={retry}>
              {t('refresh')}
            </button>
          </div>

          <div className={css.catalogHeading}>
            <h3>{t('heading')}</h3>
            <span>
              {format(t('summary'), { count: state.snapshot.entryCount, enabled: state.snapshot.enabledCount })}
            </span>
          </div>
          <p className={css.intro}>{t('intro')}</p>

          {state.snapshot.entries.length === 0 ? <p className={css.status}>{t('empty')}</p> : null}
          {state.snapshot.entries.length > 0 && filtered.length === 0
            ? <p className={css.status}>{t('emptySearch')}</p>
            : null}

          {filtered.length > 0 ? (
            <ul className={css.cards}>
              {filtered.map((entry) => {
                const entryBusy = busy.has(entry.entryId)
                const message = messages.get(entry.entryId)
                const statusLabel = entry.fiberPhase === null ? t('statusNone')
                  : entry.fiberPhase === 'pending' ? t('statusPending')
                    : entry.fiberPhase === 'loading' ? t('statusLoading')
                      : entry.fiberPhase === 'active' ? t('statusActive')
                        : entry.fiberPhase === 'failed' ? t('statusFailed')
                          : t('statusUnloading')
                return (
                  <li
                    className={css.card}
                    key={entry.entryId}
                    data-plugin-entry={entry.entryId}
                    data-disabled={entry.enabled ? undefined : 'true'}
                  >
                    <div className={css.cardMain}>
                      <span
                        className={css.statusDot}
                        data-phase={entry.fiberPhase ?? 'unobserved'}
                        role="img"
                        aria-label={statusLabel}
                        title={statusLabel}
                      />
                      <div className={css.cardBody}>
                        <div className={css.cardTitleRow}>
                          <strong className={css.cardTitle} title={entry.moduleName}>
                            {entry.displayName}
                          </strong>
                          {entry.system ? <span className={css.badge} data-kind="system">{t('systemTag')}</span> : null}
                          {!entry.toggleable && !entry.system
                            ? <span className={css.badge} data-kind="expression">{t('expressionTag')}</span>
                            : null}
                          {entry.hasOverride ? <span className={css.badge} data-kind="override">{t('overrideTag')}</span> : null}
                          <span className={css.badge} data-kind="category">{CATEGORY_LABELS[entry.category] ?? entry.category}</span>
                        </div>
                        <code className={css.moduleName}>{entry.moduleName}</code>
                        <p className={css.description}>{entry.description}</p>
                        <p className={css.meta}>
                          {t('entryId')}: {entry.entryId} · {t('state')}: {statusLabel}
                        </p>
                        {message !== undefined ? (
                          <p className={css.message} data-kind={entryBusy ? 'busy' : 'result'} role="status">
                            {message}
                          </p>
                        ) : null}
                        {editingId === entry.entryId ? (
                          <div className={css.editPanel}>
                            <label className={css.editField}>
                              <span>{t('nameLabel')}</span>
                              <input
                                type="text"
                                value={draftName}
                                maxLength={60}
                                onChange={(event) => { setDraftName(event.currentTarget.value) }}
                              />
                            </label>
                            <label className={css.editField}>
                              <span>{t('descLabel')}</span>
                              <textarea
                                value={draftDesc}
                                rows={3}
                                maxLength={200}
                                placeholder={FALLBACK_DESC}
                                onChange={(event) => { setDraftDesc(event.currentTarget.value) }}
                              />
                            </label>
                            <div className={css.editActions}>
                              <button type="button" className={css.saveButton} disabled={entryBusy} onClick={() => { void saveEdit(entry) }}>
                                {entryBusy ? t('toggling') : t('save')}
                              </button>
                              <button type="button" className={css.cancelButton} disabled={entryBusy} onClick={cancelEdit}>
                                {t('cancel')}
                              </button>
                              {entry.hasOverride ? (
                                <button type="button" className={css.restoreButton} disabled={entryBusy} onClick={() => { void restoreDefault(entry) }}>
                                  {t('restoreDefault')}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className={css.cardTrailing}>
                        <span className={css.configTag} data-enabled={entry.enabled ? 'true' : 'false'}>
                          {entry.enabled ? t('enabledTag') : t('disabledTag')}
                        </span>
                        <button
                          type="button"
                          className={css.editButton}
                          disabled={entryBusy}
                          aria-expanded={editingId === entry.entryId}
                          aria-label={`${t('edit')} ${entry.displayName}`}
                          onClick={() => {
                            if (editingId === entry.entryId) cancelEdit()
                            else startEdit(entry)
                          }}
                        >
                          {editingId === entry.entryId ? t('cancel') : t('edit')}
                        </button>
                        {entry.toggleable ? (
                          <button
                            type="button"
                            className={css.toggle}
                            data-kind={entry.enabled ? 'off' : 'on'}
                            disabled={entryBusy}
                            aria-busy={entryBusy}
                            aria-label={entry.enabled
                              ? `${t('toggleOff')} ${entry.displayName}`
                              : `${t('toggleOn')} ${entry.displayName}`}
                            onClick={() => { void toggle(entry) }}
                          >
                            {entryBusy ? t('toggling') : entry.enabled ? t('toggleOff') : t('toggleOn')}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : null}

          <div className={css.footer}>
            <p className={css.hint}>{t('refreshHint')}</p>
            <dl className={css.paths}>
              <div>
                <dt>{t('patchFile')}</dt>
                <dd><code>{state.snapshot.patchFile}</code></dd>
              </div>
              <div>
                <dt>{t('overridesFile')}</dt>
                <dd><code>{state.snapshot.overridesFile}</code></dd>
              </div>
            </dl>
            <p className={css.hint}>{t('overridesHint')}</p>
            <p className={css.hint}>{t('reloadNote')}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** 插件管家标签页文案。 */
    'settings.pluginManager': PluginManagerLocaleKey
  }
}