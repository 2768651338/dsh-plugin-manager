/**
 * 插件管家共享类型：主机与浏览器两侧通用的纯数据类型（无运行时依赖）。
 * @module dsh-plugin-manager/types
 */

/** 与 host/plugin-inventory 对齐的 Fiber 阶段投影。 */
export type PluginManagerFiberPhase =
  | 'pending'
  | 'loading'
  | 'active'
  | 'failed'
  | 'unloading'
  | null

/** 停用开关不可用的原因。 */
export type ToggleBlockReason = 'system' | 'expression' | null

/** 插件管家里的一条插件记录。 */
export interface PluginManagerEntry {
  /** Loader 树里的稳定行 id。 */
  readonly entryId: string
  /** 模块名（cordis 行的 name）。 */
  readonly moduleName: string
  /** 生效中的启停状态（含祖先分组与各补丁层）。 */
  readonly enabled: boolean
  /** 当前 Fiber 阶段；无 Fiber 时为 null。 */
  readonly fiberPhase: PluginManagerFiberPhase
  /** 显示名（覆盖 → 内置目录 → 英文短名）。 */
  readonly displayName: string
  /** 一句话中文说明（覆盖 → 内置目录 → 兜底文案）。 */
  readonly description: string
  /** 分类（分组展示用）。 */
  readonly category: string
  /** 系统保护行：不允许停用。 */
  readonly system: boolean
  /** 是否可以在界面里启停。 */
  readonly toggleable: boolean
  /** 不可启停的原因（system / expression / null）。 */
  readonly toggleBlockReason: ToggleBlockReason
  /** 该模块是否被覆盖文件自定义过。 */
  readonly hasOverride: boolean
}

/** 一次 list() 的快照。 */
export interface PluginManagerSnapshot {
  /** 启停补丁文件路径（界面展示用）。 */
  readonly patchFile: string
  /** 目录覆盖文件路径（界面展示用）。 */
  readonly overridesFile: string
  /** 插件总数。 */
  readonly entryCount: number
  /** 当前启用的插件数。 */
  readonly enabledCount: number
  readonly entries: readonly PluginManagerEntry[]
}

/** setEnabled 的业务结果（不抛异常，走返回值）。 */
export interface SetEnabledResult {
  readonly accepted: boolean
  /** 拒绝原因：not-found / system / expression / io-error。 */
  readonly reason?: string
  /** 供界面展示的补充信息。 */
  readonly message?: string
}

/** 目录编辑（保存/移除覆盖）的业务结果。 */
export interface CatalogEditResult {
  readonly accepted: boolean
  readonly reason?: string
  readonly message?: string
}

/** 目录覆盖文件的内容形态：模块名 → 自定义字段。 */
export interface CatalogOverrides {
  [moduleName: string]: {
    /** 覆盖中文名；省略则沿用内置/短名。 */
    name?: string
    /** 覆盖说明；省略则沿用内置/兜底。 */
    desc?: string
  }
}

/** 备份文档：一次导出备份的完整数据（可读 JSON，换机导入）。 */
export interface BackupDocument {
  /** 固定格式标识，用于区分非本插件的 JSON 文件。 */
  readonly format: 'dsh-plugin-manager-backup'
  /** 备份格式版本号。 */
  readonly version: number
  /** 导出时间（ISO 8601）。 */
  readonly createdAt: string
  /** 来源 profile 名（如 web）。 */
  readonly profile: string
  /** 备注覆盖表（catalog.json 的完整内容）。 */
  readonly overrides: CatalogOverrides
  /** profile 依赖：模块名 → 安装 spec（版本 / git / file）。 */
  readonly dependencies: Record<string, string>
  /** profile 的 dsh.profile.bundles 列表。 */
  readonly bundles: readonly string[]
  /** 全局启停补丁（cordis.patch.yml）的原始内容；缺省表示不备份启停状态。 */
  readonly patchFile?: string
}

/** exportBackup 的结果。 */
export interface BackupExportResult {
  readonly accepted: boolean
  /** 拒绝原因：profile-not-found / io-error。 */
  readonly reason?: string
  readonly message?: string
  /** 成功时的完整备份文档。 */
  readonly document?: BackupDocument
}

/** importBackup 恢复成功的明细计数。 */
export interface BackupRestoreDetail {
  /** 恢复的备注条数。 */
  readonly overridesRestored: number
  /** 恢复/变更的依赖条数。 */
  readonly dependenciesRestored: number
  /** 追加到 bundles 的条数。 */
  readonly bundlesRestored: number
  /** 应用回启停补丁的行数。 */
  readonly patchRowsRestored: number
}

/** importBackup 的结果。 */
export interface BackupImportResult {
  readonly accepted: boolean
  /** 拒绝原因：invalid-format / profile-not-found / io-error。 */
  readonly reason?: string
  readonly message?: string
  readonly detail?: BackupRestoreDetail
  /** 恢复插件清单后，用户应执行的安装命令（无需每次成功都给出）。 */
  readonly installCommand?: string
  /** 是否需要重启 DSH 使新 bundle 生效。 */
  readonly restartRequired?: boolean
}
