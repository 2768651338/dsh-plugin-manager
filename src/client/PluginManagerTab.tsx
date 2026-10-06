/** 插件管家标签页：中文目录 + 一键启停 + 搜索/分类过滤。 */

import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { BackupExportResult, BackupImportResult, BackupPreview, BackupPreviewResult, CatalogEditResult, CatalogRepairResult, PluginManagerEntry, PluginManagerSnapshot, SetEnabledResult } from '../types.ts'
import type { PluginManagerLocaleKey } from './locales.ts'
import { dateStamp, fiberPhaseSettled, format, hasOriginData, loadStoredOriginFilter, matches, matchesOriginFilter, originBadge, storeOriginFilter, type OriginFilterKey } from './util.ts'
import css from './PluginManagerTab.module.css'

/** 16px 搜索图标（内联 SVG）：0.2.0 的 ui-primitives 移除了通用图标族，
 * 且图标包不在宿主冻结模块表内（外部化会在浏览器端 require 失败），故自带。 */
function SearchIcon(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.6 10.6 14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

/** 注册侧注入面：远程服务已解包（unwrap RemoteResult）。 */
export interface PluginManagerTabInjected {
  list: () => Promise<PluginManagerSnapshot>
  setEnabled: (entryId: string, enabled: boolean) => Promise<SetEnabledResult>
  setOverride: (moduleName: string, name: string, desc: string) => Promise<CatalogEditResult>
  removeOverride: (moduleName: string) => Promise<CatalogEditResult>
  exportBackup: () => Promise<BackupExportResult>
  importBackup: (json: string, allowNonRegistrySpecs: readonly string[] | null) => Promise<BackupImportResult>
  previewBackup: (json: string) => Promise<BackupPreviewResult>
  quarantineOverrides: () => Promise<CatalogRepairResult>
  /** 当前界面语言（评估 P2-9）：'zh' 之外一律按英文渲染目录内容。 */
  localeLang: () => 'zh' | 'en'
}

/** 设置槽位渲染器组装的完整 props。 */
export type PluginManagerTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.dshPluginManager'>
  & InjectFace<PluginManagerTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message?: string }
  | { readonly status: 'ready'; readonly snapshot: PluginManagerSnapshot }

/** 触发浏览器下载一段文本（备份 JSON）。 */
function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/** 备注编辑等非启停操作后的常规刷新延迟。 */
const AUTO_REFRESH_MS = 900

/**
 * 启停后的轮询确认延迟（评估 P2-1）：不赌固定毫秒数，按梯度刷新（300ms / 900ms /
 * 2000ms），直到目标行 enabled 与请求一致且 Fiber 回到稳态才收尾；三次封顶、命中即停，
 * 不做无限重试（每次 list 都同步读覆盖文件，高频轮询在低端机上是负担）。
 */
const TOGGLE_REFRESH_DELAYS_MS: readonly number[] = [300, 900, 2000]

/** 撤销窗口（评估 P1-6）：停用后该时长内可一键撤销，超时自动收起。 */
const UNDO_WINDOW_MS = 9000

/** 与主机 catalog FALLBACK_DESC 一致的兜底说明；编辑时该文本预填为空（中文环境）。 */
const FALLBACK_DESC = '该插件暂无内置说明，可在覆盖文件中补充自定义说明。'

/** 英文环境的兜底说明（评估 P2-9，与主机 catalog FALLBACK_DESC_EN 保持一致）。 */
const FALLBACK_DESC_EN = 'No built-in description yet. Add a custom note in the override file.'

/** 渲染插件管家标签页。 */
export function PluginManagerTab({ list, setEnabled, setOverride, removeOverride, exportBackup, importBackup, previewBackup, quarantineOverrides, localeLang, t }: PluginManagerTabProps): ReactNode {
  const [request, setRequest] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  /** 来源筛选（issue #1）：默认「用户安装」，选择持久化；旧主机快照无来源字段时整体退回「全部」。 */
  const [origin, setOrigin] = useState<OriginFilterKey>(() => loadStoredOriginFilter() ?? 'user')
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set())
  const [messages, setMessages] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [backupMessage, setBackupMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  /** 导入预览（评估 P1-3）：json 为备份原文，确认后原样交给 importBackup；未确认前不写任何文件。 */
  const [importPreview, setImportPreview] = useState<{ json: string; preview: BackupPreview } | null>(null)
  /** 已勾选放行的非常规 spec 值集合（预览面板里逐项勾选）。 */
  const [approvedSpecs, setApprovedSpecs] = useState<ReadonlySet<string>>(() => new Set())
  /** 损坏覆盖文件「改名保存」失败的提示（评估 P1-2）。 */
  const [repairError, setRepairError] = useState<string | null>(null)
  /** 停用撤销（评估 P1-6）：最近一次停用的行与恢复目标，窗口期内可一键撤销。 */
  const [undoOffer, setUndoOffer] = useState<{ entryId: string; restoreTo: boolean } | null>(null)
  /**
   * 启停意图（评估 P1-4/P2-1）：entryId → 期望的 enabled 状态与已消耗的轮询次数。
   * 每次刷新后核对：一致且 Fiber 稳态即收尾；不一致按梯度再等一轮，耗尽后解释原因。
   */
  const pendingToggles = useRef(new Map<string, { enabled: boolean; attempts: number }>())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const selectId = useId()
  /** 当前界面语言（评估 P2-9）：渲染时读取，语言切换后的重渲染会取到新值。 */
  const lang = localeLang()
  const shownName = (entry: PluginManagerEntry): string => (lang === 'zh' ? entry.displayName : entry.displayNameEn)
  const shownDesc = (entry: PluginManagerEntry): string => (lang === 'zh' ? entry.description : entry.descriptionEn)
  /** 分类显示名（评估 P2-7）：标签随快照下发，按当前语言取用；未知分类回退裸 key。 */
  const categoryLabel = (key: string): string => state.status === 'ready'
    ? state.snapshot.categoryLabels[key]?.[lang] ?? key
    : key

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => list()).then(
      (snapshot) => {
        if (!current) return
        reconcileToggles(snapshot)
        setState({ status: 'ready', snapshot })
      },
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
  /** 快照携带来源字段才启用来源筛选（issue #1 防呆：旧主机快照退回「全部」）。 */
  const originReady = hasOriginData(entries)
  const effectiveOrigin: OriginFilterKey = originReady ? origin : 'all'
  const categories = useMemo(
    () => ['all', ...new Set(entries.map(entry => entry.category))],
    [entries],
  )
  const filtered = useMemo(
    () => entries.filter(entry =>
      matches(entry, normalizedQuery)
      && (category === 'all' || entry.category === category)
      && matchesOriginFilter(entry, effectiveOrigin)),
    [entries, normalizedQuery, category, effectiveOrigin],
  )

  /** 切换来源筛选（issue #1）：记住选择，下次打开保持。 */
  const changeOrigin = (value: OriginFilterKey): void => {
    setOrigin(value)
    storeOriginFilter(value)
  }

  /** 预览面板的非常规依赖按 spec 去重（同一 spec 可能对应多个模块；授权单位是 spec 本身）。 */
  const pendingGroups = useMemo(() => {
    if (importPreview === null) return []
    const groups = new Map<string, string[]>()
    for (const item of importPreview.preview.pendingNonRegistrySpecs) {
      const names = groups.get(item.spec) ?? []
      if (!names.includes(item.name)) names.push(item.name)
      groups.set(item.spec, names)
    }
    return [...groups].map(([spec, names]) => ({ spec, names }))
  }, [importPreview])

  /** 预览中将要发生的变更总数（0 且无待确认依赖时无需确认）。 */
  const previewTotal = importPreview === null
    ? 0
    : importPreview.preview.overrides.length
      + importPreview.preview.dependencies.length
      + importPreview.preview.bundlesAdded.length
      + importPreview.preview.patchRows.length

  const retry = (): void => {
    setState({ status: 'loading' })
    setRequest(value => value + 1)
  }

  const scheduleReload = (entryId: string, keepMessage = false, delay = AUTO_REFRESH_MS): void => {
    const existing = timers.current.get(entryId)
    if (existing !== undefined) clearTimeout(existing)
    const timer = setTimeout(() => {
      timers.current.delete(entryId)
      if (!keepMessage) {
        setMessages(current => {
          const next = new Map(current)
          next.delete(entryId)
          return next
        })
      }
      setRequest(value => value + 1)
    }, delay)
    timers.current.set(entryId, timer)
  }

  /**
   * 刷新后核对启停意图（评估 P1-4/P2-1）：状态一致且 Fiber 稳态就收尾清消息；
   * 不一致或仍在过渡（pending/loading/unloading）则按梯度再刷新一轮（300/900/2000ms）；
   * 轮询耗尽仍不一致时，把卡片消息替换为「为什么没生效」的解释。命中即停，不做无限重试。
   */
  const reconcileToggles = (snapshot: PluginManagerSnapshot): void => {
    if (pendingToggles.current.size === 0) return
    for (const [entryId, intent] of [...pendingToggles.current]) {
      const entry = snapshot.entries.find(item => item.entryId === entryId)
      if (entry === undefined) {
        pendingToggles.current.delete(entryId)
        continue
      }
      const confirmed = entry.enabled === intent.enabled
      const exhausted = intent.attempts >= TOGGLE_REFRESH_DELAYS_MS.length - 1
      if (confirmed && (fiberPhaseSettled(entry.fiberPhase) || exhausted)) {
        pendingToggles.current.delete(entryId)
        // 撤销窗口内的消息（带撤销按钮）由窗口到期清理，这里不动。
        if (!timers.current.has(`undo:${entryId}`)) {
          setMessages(current => {
            const next = new Map(current)
            next.delete(entryId)
            return next
          })
        }
        continue
      }
      if (!confirmed && exhausted) {
        pendingToggles.current.delete(entryId)
        setMessages(current => new Map(current).set(
          entryId,
          format(t('toggleIneffective'), { file: snapshot.patchFile }),
        ))
        continue
      }
      intent.attempts += 1
      scheduleReload(entryId, true, TOGGLE_REFRESH_DELAYS_MS[intent.attempts])
    }
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
      const disabling = entry.enabled
      const result = await setEnabled(entry.entryId, !entry.enabled)
      if (result.accepted) {
        pendingToggles.current.set(entry.entryId, { enabled: !entry.enabled, attempts: 0 })
        setMessages(current => new Map(current).set(entry.entryId, t('toggleSucceeded')))
        if (disabling) {
          // 停用（评估 P1-6）：开启撤销窗口；窗口内轮询刷新不清掉消息，保留撤销按钮。
          setUndoOffer({ entryId: entry.entryId, restoreTo: true })
          scheduleUndoExpiry(entry.entryId)
          scheduleReload(entry.entryId, true, TOGGLE_REFRESH_DELAYS_MS[0])
        } else {
          if (undoOffer !== null && undoOffer.entryId === entry.entryId) setUndoOffer(null)
          scheduleReload(entry.entryId, true, TOGGLE_REFRESH_DELAYS_MS[0])
        }
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

  /** 撤销窗口到期：收起撤销按钮并清理消息（评估 P1-6）。 */
  const scheduleUndoExpiry = (entryId: string): void => {
    const key = `undo:${entryId}`
    const existing = timers.current.get(key)
    if (existing !== undefined) clearTimeout(existing)
    const timer = setTimeout(() => {
      timers.current.delete(key)
      setUndoOffer(current => (current !== null && current.entryId === entryId ? null : current))
      setMessages(current => {
        const next = new Map(current)
        next.delete(entryId)
        return next
      })
    }, UNDO_WINDOW_MS)
    timers.current.set(key, timer)
  }

  /** 撤销最近一次停用：对同一行再调一次 setEnabled 取反（恢复的是配置，热加载后生效）。 */
  const undoToggle = async (): Promise<void> => {
    const offer = undoOffer
    if (offer === null || busy.has(offer.entryId)) return
    const undoTimer = timers.current.get(`undo:${offer.entryId}`)
    if (undoTimer !== undefined) clearTimeout(undoTimer)
    timers.current.delete(`undo:${offer.entryId}`)
    setUndoOffer(null)
    setBusy(current => new Set(current).add(offer.entryId))
    try {
      const result = await setEnabled(offer.entryId, offer.restoreTo)
      if (result.accepted) {
        pendingToggles.current.set(offer.entryId, { enabled: offer.restoreTo, attempts: 0 })
        setMessages(current => new Map(current).set(offer.entryId, t('toggleUndone')))
        scheduleReload(offer.entryId, true, TOGGLE_REFRESH_DELAYS_MS[0])
      } else {
        pendingToggles.current.delete(offer.entryId)
        setMessages(current => new Map(current).set(
          offer.entryId,
          format(t('toggleNotAccepted'), { message: result.message ?? result.reason ?? '' }),
        ))
      }
    } catch (error) {
      pendingToggles.current.delete(offer.entryId)
      setMessages(current => new Map(current).set(
        offer.entryId,
        format(t('toggleFailed'), { message: error instanceof Error ? error.message : String(error) }),
      ))
    } finally {
      setBusy(current => {
        const next = new Set(current)
        next.delete(offer.entryId)
        return next
      })
    }
  }

  const startEdit = (entry: PluginManagerEntry): void => {
    const fallback = lang === 'zh' ? FALLBACK_DESC : FALLBACK_DESC_EN
    setEditingId(entry.entryId)
    setDraftName(shownName(entry))
    const shown = shownDesc(entry)
    setDraftDesc(shown === fallback ? '' : shown)
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

  const doBackup = async (): Promise<void> => {
    if (backupBusy) return
    setBackupBusy(true)
    setBackupMessage(null)
    try {
      const result = await exportBackup()
      if (!result.accepted || result.document === undefined) {
        setBackupMessage({ kind: 'error', text: format(t('backupFailed'), { message: result.message ?? result.reason ?? '' }) })
        return
      }
      downloadJson(`dsh-plugin-manager-backup-${result.document.profile}-${dateStamp()}.json`, JSON.stringify(result.document, null, 2))
      setBackupMessage({ kind: 'success', text: t('backupSucceeded') })
    } catch (error) {
      setBackupMessage({ kind: 'error', text: format(t('backupFailed'), { message: error instanceof Error ? error.message : String(error) }) })
    } finally {
      setBackupBusy(false)
    }
  }

  /** 执行导入（评估 P1-3）：预览确认后调用；allow 为已勾选放行的非常规 spec。 */
  const runRestore = async (json: string, allow: readonly string[] | null): Promise<void> => {
    const result = await importBackup(json, allow)
    if (!result.accepted) {
      if (result.reason === 'confirmation-required' && result.pendingNonRegistrySpecs !== undefined) {
        // 兜底路径（版本错配等场景）：主机要求逐项确认时，重新拉取预览面板接管。
        setBackupMessage(null)
        setApprovedSpecs(new Set())
        const probe = await previewBackup(json)
        if (probe.accepted && probe.preview !== undefined) {
          setImportPreview({ json, preview: probe.preview })
        } else {
          setBackupMessage({ kind: 'error', text: format(t('restoreFailed'), { message: probe.message ?? probe.reason ?? result.message ?? '' }) })
        }
        return
      }
      setBackupMessage({ kind: 'error', text: format(t('restoreFailed'), { message: result.message ?? result.reason ?? '' }) })
      return
    }
    const detail = result.detail
    const changed = detail === undefined
      ? 0
      : detail.overridesRestored + detail.dependenciesRestored + detail.bundlesRestored + detail.patchRowsRestored
    if (detail === undefined || changed === 0) {
      // 全 0 计数不是失败：「什么都不用改」要说成自己的那句话（评估 P2-6）。
      setBackupMessage({ kind: 'success', text: t('restoreNoChange') })
    } else {
      const text = format(t('restoreSucceeded'), {
        overrides: detail.overridesRestored,
        dependencies: detail.dependenciesRestored,
        bundles: detail.bundlesRestored,
        patches: detail.patchRowsRestored,
        command: result.installCommand ?? '',
      })
      const skipped = detail.nonRegistrySkipped ?? 0
      setBackupMessage({ kind: 'success', text: skipped > 0 ? text + format(t('restoreSkippedNote'), { count: skipped }) : text })
    }
    setImportPreview(null)
    setApprovedSpecs(new Set())
    setRequest(value => value + 1)
  }

  /** 选择备份文件 → 只解析预览（评估 P1-3），不写任何文件。 */
  const handleRestoreFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file === undefined || restoreBusy) return
    setRestoreBusy(true)
    setBackupMessage(null)
    setImportPreview(null)
    setApprovedSpecs(new Set())
    try {
      const text = await file.text()
      const result = await previewBackup(text)
      if (!result.accepted || result.preview === undefined) {
        setBackupMessage({ kind: 'error', text: format(t('restoreFailed'), { message: result.message ?? result.reason ?? '' }) })
        return
      }
      setImportPreview({ json: text, preview: result.preview })
    } catch (error) {
      setBackupMessage({ kind: 'error', text: format(t('restoreFailed'), { message: error instanceof Error ? error.message : String(error) }) })
    } finally {
      setRestoreBusy(false)
    }
  }

  /** 预览确认 → 真正导入：清单外的非常规依赖被跳过（主机以 nonRegistrySkipped 报告）。 */
  const confirmImport = async (): Promise<void> => {
    if (importPreview === null || restoreBusy) return
    setRestoreBusy(true)
    try {
      await runRestore(importPreview.json, [...approvedSpecs])
    } catch (error) {
      setBackupMessage({ kind: 'error', text: format(t('restoreFailed'), { message: error instanceof Error ? error.message : String(error) }) })
    } finally {
      setRestoreBusy(false)
    }
  }

  const cancelPreview = (): void => {
    setImportPreview(null)
    setApprovedSpecs(new Set())
    setBackupMessage(null)
  }

  /** 把损坏的覆盖文件改名保存（评估 P1-2），成功后刷新列表（横幅随之消失）。 */
  const repairOverrides = async (): Promise<void> => {
    if (restoreBusy) return
    setRestoreBusy(true)
    setRepairError(null)
    try {
      const result = await quarantineOverrides()
      if (result.accepted) {
        setRequest(value => value + 1)
      } else {
        setRepairError(format(t('overridesRepairFailed'), { message: result.message ?? result.reason ?? '' }))
      }
    } catch (error) {
      setRepairError(format(t('overridesRepairFailed'), { message: error instanceof Error ? error.message : String(error) }))
    } finally {
      setRestoreBusy(false)
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
          {state.snapshot.compatibilityWarning !== undefined ? (
            <div className={css.banner} role="status">
              <p className={css.bannerText}>{t('compatWarning')}</p>
            </div>
          ) : null}
          {state.snapshot.overridesWarning !== undefined ? (
            <div className={css.banner} role="status">
              <p className={css.bannerText}>
                {format(t('overridesWarningBanner'), { file: state.snapshot.overridesFile, reason: state.snapshot.overridesWarning })}
              </p>
              <button type="button" className={css.bannerAction} disabled={restoreBusy} onClick={() => { void repairOverrides() }}>
                {t('overridesRepair')}
              </button>
              {repairError !== null ? <p className={css.bannerText} data-kind="error">{repairError}</p> : null}
            </div>
          ) : null}
          <div className={css.toolbar}>
            <label className={css.search}>
              <SearchIcon />
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
                    {item === 'all' ? t('summaryAll') : categoryLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className={css.origin}>
              <span className={css.visuallyHidden}>{t('origin')}</span>
              <select
                value={effectiveOrigin}
                onChange={(event) => { changeOrigin(event.currentTarget.value as OriginFilterKey) }}
              >
                <option value="all">{t('originAll')}</option>
                <option value="user">{t('originUser')}</option>
                <option value="builtin">{t('originBuiltin')}</option>
                <option value="community">{t('originCommunity')}</option>
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
          {state.snapshot.entries.length > 0 && filtered.length === 0 && !(normalizedQuery.length === 0 && effectiveOrigin !== 'all')
            ? <p className={css.status}>{t('emptySearch')}</p>
            : null}
          {/* 来源筛选为空时的兜底（issue #1）：一键回到「全部」，避免新用户看到空白页误以为坏了。 */}
          {state.snapshot.entries.length > 0 && filtered.length === 0 && normalizedQuery.length === 0 && effectiveOrigin !== 'all' ? (
            <div className={css.originEmpty}>
              <p className={css.status}>{t('originEmpty')}</p>
              <button
                type="button"
                className={css.originEmptyAction}
                onClick={() => { changeOrigin('all') }}
              >
                {format(t('originShowAll'), { count: state.snapshot.entryCount })}
              </button>
            </div>
          ) : null}

          {filtered.length > 0 ? (
            <ul className={css.cards}>
              {filtered.map((entry) => {
                const entryBusy = busy.has(entry.entryId)
                const message = messages.get(entry.entryId)
                const displayName = shownName(entry)
                const description = shownDesc(entry)
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
                            {displayName}
                          </strong>
                          {entry.system ? <span className={css.badge} data-kind="system">{t('systemTag')}</span> : null}
                          {!entry.toggleable && !entry.system
                            ? <span className={css.badge} data-kind="expression">{t('expressionTag')}</span>
                            : null}
                          {entry.local ? <span className={css.badge} data-kind="local">{t('localTag')}</span> : null}
                          {entry.hasOverride ? <span className={css.badge} data-kind="override">{t('overrideTag')}</span> : null}
                          {(() => {
                            const originTag = originBadge(entry)
                            if (originTag === null) return null
                            const label = originTag === 'builtin' ? t('originTagBuiltin')
                              : originTag === 'official' ? t('originTagOfficial')
                                : t('originTagCommunity')
                            return <span className={css.badge} data-kind={originTag}>{label}</span>
                          })()}
                          <span className={css.badge} data-kind="category">{categoryLabel(entry.category)}</span>
                        </div>
                        <code className={css.moduleName}>{entry.moduleName}</code>
                        <p className={css.description}>{description}</p>
                        <p className={css.meta}>
                          {t('entryId')}: {entry.entryId} · {t('state')}: {statusLabel}
                        </p>
                        {message !== undefined ? (
                          <div className={css.messageRow} role="status">
                            <p className={css.message} data-kind={entryBusy ? 'busy' : 'result'}>
                              {message}
                            </p>
                            {undoOffer !== null && undoOffer.entryId === entry.entryId ? (
                              <button
                                type="button"
                                className={css.undoButton}
                                disabled={entryBusy}
                                onClick={() => { void undoToggle() }}
                              >
                                {t('undo')}
                              </button>
                            ) : null}
                          </div>
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
                          aria-label={`${t('edit')} ${displayName}`}
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
                              ? `${t('toggleOff')} ${displayName}`
                              : `${t('toggleOn')} ${displayName}`}
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
            <div className={css.backupBar}>
              <h4>{t('backupHeading')}</h4>
              <p className={css.hint}>{t('backupIntro')}</p>
              <div className={css.backupActions}>
                <button type="button" className={css.backupButton} disabled={backupBusy} onClick={() => { void doBackup() }}>
                  {backupBusy ? t('backupBusy') : t('backup')}
                </button>
                <button type="button" className={css.importButton} disabled={restoreBusy} onClick={() => { fileInputRef.current?.click() }}>
                  {restoreBusy ? t('restoreBusy') : t('restore')}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className={css.visuallyHidden}
                  aria-label={t('restoreSelect')}
                  onChange={(event) => { void handleRestoreFile(event) }}
                />
              </div>
              {importPreview !== null ? (
                <div className={css.confirmPanel} role="group" aria-label={t('restorePreviewHeading')}>
                  <p className={css.confirmHeading}>{t('restorePreviewHeading')}</p>
                  <p className={css.hint}>
                    {format(t('restorePreviewMeta'), {
                      profile: importPreview.preview.backupProfile,
                      time: new Date(importPreview.preview.backupCreatedAt).toLocaleString(),
                    })}
                  </p>
                  {previewTotal === 0 && pendingGroups.length === 0 ? (
                    <p className={css.hint}>{t('restorePreviewNone')}</p>
                  ) : null}
                  {importPreview.preview.overrides.length > 0 ? (
                    <div className={css.previewSection}>
                      <p className={css.previewLabel}>
                        {format(t('restorePreviewOverrides'), { count: importPreview.preview.overrides.length })}
                      </p>
                      <ul className={css.previewList}>
                        {importPreview.preview.overrides.map(item => (
                          <li key={item.name} className={css.previewItem}>
                            <span className={css.previewKind} data-kind={item.kind}>
                              {item.kind === 'add' ? t('previewAdd') : t('previewUpdate')}
                            </span>
                            <code>{item.name}</code>
                            <span>{[item.nextName, item.nextDesc].filter(Boolean).join(' — ')}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {importPreview.preview.dependencies.length > 0 ? (
                    <div className={css.previewSection}>
                      <p className={css.previewLabel}>
                        {format(t('restorePreviewDependencies'), { count: importPreview.preview.dependencies.length })}
                      </p>
                      <ul className={css.previewList}>
                        {importPreview.preview.dependencies.map(item => (
                          <li key={item.name} className={css.previewItem}>
                            {item.nonRegistry ? (
                              <label className={css.confirmItem}>
                                <input
                                  type="checkbox"
                                  checked={approvedSpecs.has(item.spec)}
                                  onChange={(event) => {
                                    const checked = event.currentTarget.checked
                                    setApprovedSpecs(current => {
                                      const next = new Set(current)
                                      if (checked) next.add(item.spec)
                                      else next.delete(item.spec)
                                      return next
                                    })
                                  }}
                                />
                                <code>{item.name}</code>
                                <span>{item.spec}</span>
                              </label>
                            ) : (
                              <>
                                <span className={css.previewKind} data-kind={item.kind}>
                                  {item.kind === 'add' ? t('previewAdd') : t('previewUpdate')}
                                </span>
                                <code>{item.name}</code>
                                <span>{item.spec}</span>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                      {pendingGroups.length > 0 ? <p className={css.hint}>{t('restoreConfirmIntro')}</p> : null}
                    </div>
                  ) : null}
                  {importPreview.preview.bundlesAdded.length > 0 ? (
                    <div className={css.previewSection}>
                      <p className={css.previewLabel}>
                        {format(t('restorePreviewBundles'), { count: importPreview.preview.bundlesAdded.length })}
                      </p>
                      <ul className={css.previewList}>
                        {importPreview.preview.bundlesAdded.map(name => (
                          <li key={name} className={css.previewItem}>
                            <span className={css.previewKind} data-kind="add">{t('previewAdd')}</span>
                            <code>{name}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {importPreview.preview.patchRows.length > 0 ? (
                    <div className={css.previewSection}>
                      <p className={css.previewLabel}>
                        {format(t('restorePreviewPatches'), { count: importPreview.preview.patchRows.length })}
                      </p>
                      <ul className={css.previewList}>
                        {importPreview.preview.patchRows.map(row => (
                          <li key={row.id} className={css.previewItem}>
                            <span className={css.previewKind} data-kind="patch">
                              {row.enabled ? t('previewToEnable') : t('previewToDisable')}
                            </span>
                            <code>{row.id}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className={css.backupActions}>
                    <button
                      type="button"
                      className={css.backupButton}
                      disabled={restoreBusy || (previewTotal === 0 && pendingGroups.length === 0)}
                      onClick={() => { void confirmImport() }}
                    >
                      {restoreBusy ? t('restoreBusy') : t('restoreConfirmApply')}
                    </button>
                    <button type="button" className={css.importButton} disabled={restoreBusy} onClick={cancelPreview}>
                      {t('restoreConfirmCancel')}
                    </button>
                  </div>
                </div>
              ) : null}
              {backupMessage !== null ? (
                <p className={css.message} data-kind={backupMessage.kind === 'error' ? 'result' : undefined} role="status">
                  {backupMessage.text}
                </p>
              ) : null}
            </div>
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
            <p className={css.hint}>{t('securityHint')}</p>
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
    'settings.dshPluginManager': PluginManagerLocaleKey
  }
}