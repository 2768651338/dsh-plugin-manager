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
  /** 显示名（覆盖 → 内置目录 → 英文短名），中文环境使用。 */
  readonly displayName: string
  /** 一句话中文说明（覆盖 → 内置目录 → 兜底文案），中文环境使用。 */
  readonly description: string
  /** 英文环境的显示名（评估 P2-9）：覆盖 → 内置英文名 → 英文短名，恒有值。 */
  readonly displayNameEn: string
  /** 英文环境的一句话说明（评估 P2-9）：覆盖 → 内置英文说明 → 英文兜底，恒有值。 */
  readonly descriptionEn: string
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
  /** 是否以 file: 方式本地加载（评估 P2-5，界面加「本地」徽标）。 */
  readonly local: boolean
  /** 是否出现在 profile 依赖里（issue #1：用户主动安装的信号，含 file: 等非常规 spec）。 */
  readonly declared: boolean
  /** 是否官方 scope（issue #1：@deepseek-ai / @cordis；仅作官方/社区粗分，不参与「是否用户安装」判断）。 */
  readonly official: boolean
}

/** 分类的双语标签（评估 P2-7：由目录方随快照下发，界面按当前语言取用）。 */
export interface CategoryLabel {
  readonly zh: string
  readonly en: string
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
  /** 分类标签（评估 P2-7）：键为分类 key，界面按当前语言取 zh/en。 */
  readonly categoryLabels: Readonly<Record<string, CategoryLabel>>
  /** 覆盖文件读取失败的原因摘要（评估 P1-2）；缺省表示读取正常。 */
  readonly overridesWarning?: string
  /**
   * 兼容性警告代码（评估 P1-5）；缺省表示未检测到异常。
   * 目前唯一取值 'official-plugin-manager-coexists'：官方插件管理器行仍被加载，
   * 与本插件并存（本插件未按预期接管其行）。
   */
  readonly compatibilityWarning?: string
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
  /** 因未获用户确认而被跳过的非常规依赖条数（评估 P0-3）。 */
  readonly nonRegistrySkipped?: number
}

/** 一条待用户逐项确认的非常规依赖（评估 P0-3：git/file/URL 等非 registry 来源）。 */
export interface PendingNonRegistrySpec {
  /** 模块名。 */
  readonly name: string
  /** 安装 spec（原始字符串）。 */
  readonly spec: string
}

/** 导入预览：一条将变更的备注覆盖（评估 P1-3）。 */
export interface BackupPreviewOverride {
  /** 模块名。 */
  readonly name: string
  /** 将写入的中文名（缺省表示备份里没带）。 */
  readonly nextName?: string
  /** 将写入的说明（缺省表示备份里没带）。 */
  readonly nextDesc?: string
  /** add=当前无覆盖；update=覆盖现有覆盖。 */
  readonly kind: 'add' | 'update'
}

/** 导入预览：一条将变更的依赖（评估 P1-3）。 */
export interface BackupPreviewDependency {
  /** 模块名。 */
  readonly name: string
  /** 将写入的安装 spec。 */
  readonly spec: string
  /** add=当前没有该依赖；update=变更现有 spec。 */
  readonly kind: 'add' | 'update'
  /** 是否为非常规来源（git/file/URL 等，须逐项确认）。 */
  readonly nonRegistry: boolean
}

/** 导入预览：一条将翻转的启停行（评估 P1-3）。 */
export interface BackupPreviewPatchRow {
  /** 补丁行 id。 */
  readonly id: string
  /** 应用后的目标状态（true=启用）。 */
  readonly enabled: boolean
}

/** 导入预览：把备份与当前状态逐项比对的结果，不写任何文件（评估 P1-3）。 */
export interface BackupPreview {
  /** 备份来源 profile 名（如 web）。 */
  readonly backupProfile: string
  /** 备份导出时间（ISO 8601）。 */
  readonly backupCreatedAt: string
  /** 将新增/覆盖的备注覆盖。 */
  readonly overrides: readonly BackupPreviewOverride[]
  /** 将新增/变更的依赖（含全部非常规来源）。 */
  readonly dependencies: readonly BackupPreviewDependency[]
  /** 将追加到 bundles 的名字。 */
  readonly bundlesAdded: readonly string[]
  /** 将翻转的启停行。 */
  readonly patchRows: readonly BackupPreviewPatchRow[]
  /** 需逐项勾选确认的非常规依赖。 */
  readonly pendingNonRegistrySpecs: readonly PendingNonRegistrySpec[]
}

/** previewBackup 的结果（只读，不写任何文件）。 */
export interface BackupPreviewResult {
  readonly accepted: boolean
  /** 拒绝原因：invalid-format / too-large / profile-not-found / io-error。 */
  readonly reason?: string
  readonly message?: string
  /** 成功时的逐项预览。 */
  readonly preview?: BackupPreview
}

/** quarantineOverrides（把损坏的覆盖文件改名保存）的结果（评估 P1-2）。 */
export interface CatalogRepairResult {
  readonly accepted: boolean
  readonly reason?: string
  readonly message?: string
  /** 改名后的文件路径；文件本就不存在时缺省。 */
  readonly movedTo?: string
}

/** importBackup 的结果。 */
export interface BackupImportResult {
  readonly accepted: boolean
  /**
   * 拒绝原因：invalid-format / too-large / profile-not-found / io-error /
   * confirmation-required（备份含非常规依赖，等待用户逐项确认）。
   */
  readonly reason?: string
  readonly message?: string
  readonly detail?: BackupRestoreDetail
  /** 恢复插件清单后，用户应执行的安装命令（无需每次成功都给出）。 */
  readonly installCommand?: string
  /** 是否需要重启 DSH 使新 bundle 生效。 */
  readonly restartRequired?: boolean
  /** 待确认的非常规依赖清单；仅在 reason=confirmation-required 时给出，此时未写任何文件。 */
  readonly pendingNonRegistrySpecs?: readonly PendingNonRegistrySpec[]
}
