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