/**
 * 插件管家内置目录：模块名 → 中文名/说明/分类。
 * 仅作为“出厂默认”——用户可在覆盖文件（~/.dsh/plugin-manager/catalog.json）中
 * 为任意模块自定义 name/desc，未收录模块显示英文短名 + “暂无说明”。
 * @module dsh-plugin-manager/catalog
 */

/** 目录条目：显示名、一句话说明、分类。 */
export interface CatalogEntry {
  /** 中文显示名。 */
  readonly name: string
  /** 一句话用途说明（中文）。 */
  readonly desc: string
  /** 分组（用于界面分组展示）。 */
  readonly category: string
}

export type PluginCategory = 'core' | 'llm' | 'session' | 'agent' | 'tool' | 'skill' | 'ui' | 'web' | 'sandbox' | 'storage' | 'external' | 'other'

export const CATEGORY_LABELS: Record<PluginCategory, string> = {
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

/** 内置目录（键 = 模块名，即 cordis 行里的 name）。 */
export const CATALOG: Readonly<Record<string, CatalogEntry>> = {
  ["@deepseek-ai/cordis-plugin-timer"]: { name: "定时器服务", desc: "提供 delay 等定时基础能力，热加载与调度依赖它", category: "core" as PluginCategory },
  ["@deepseek-ai/cordis-plugin-hmr"]: { name: "热加载驱动", desc: "监听配置文件与插件变更并热重载（Web 端默认停用）", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-llm"]: { name: "大模型服务接口", desc: "统一的模型调用接口层，所有模型适配器都挂在它下面", category: "llm" as PluginCategory },
  ["@deepseek-ai/dsh-session"]: { name: "会话存储核心", desc: "事件溯源式会话数据核心，记录整个对话轨迹", category: "session" as PluginCategory },
  ["@deepseek-ai/dsh-typert-registry"]: { name: "类型反射注册表", desc: "运行时的包反射与 Zod 模式注册中心（RPC 依赖）", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-typert-loader"]: { name: "类型反射加载器", desc: "把生成的 Typert 包贡献加载进加载器", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-api-gateway"]: { name: "API 网关", desc: "远程调用（RPC）的主机分发与客户端接口", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-session-title"]: { name: "会话标题服务", desc: "基于会话记录生成标题的服务与提供者注册", category: "session" as PluginCategory },
  ["@deepseek-ai/dsh-session-title-first-prompt-llm"]: { name: "会话标题生成（LLM）", desc: "用第一条消息让大模型生成会话标题", category: "session" as PluginCategory },
  ["@deepseek-ai/dsh-user-questions"]: { name: "用户提问通道", desc: "向用户提问的抽象接口（Agent 运行中征求确认用）", category: "agent" as PluginCategory },
  ["@deepseek-ai/dsh-agent"]: { name: "智能体核心", desc: "Agent 接口、注册表与会话事件词汇", category: "agent" as PluginCategory },
  ["@deepseek-ai/dsh-agent-default-model"]: { name: "默认模型选择", desc: "Agent 入口共享的默认模型选择服务", category: "llm" as PluginCategory },
  ["@deepseek-ai/dsh-jobs-local"]: { name: "后台任务注册表", desc: "进程内后台任务（job）注册与管理", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-llm-retry"]: { name: "模型请求重试", desc: "按提供商路由的 LLM 请求重试策略", category: "llm" as PluginCategory },
  ["@deepseek-ai/dsh-settings-file"]: { name: "设置存储（文件）", desc: "把设置写入 settings.yaml 的文件后端", category: "storage" as PluginCategory },
  ["@deepseek-ai/dsh-credentials-local"]: { name: "凭据存储（本地）", desc: "本地凭据提供者（.credentials.yaml / .env）", category: "storage" as PluginCategory },
  ["@deepseek-ai/dsh-llm-pi-ai"]: { name: "pi-ai 模型适配器", desc: "基于 pi-ai 的多提供商模型适配（自定义 API 基址）", category: "llm" as PluginCategory },
  ["@deepseek-ai/dsh-session-persistence-jsonl"]: { name: "会话持久化（JSONL）", desc: "把会话记录以 JSONL 文件持久化保存", category: "session" as PluginCategory },
  ["@deepseek-ai/dsh-attachment-local"]: { name: "附件存储", desc: "内容寻址的附件本地存储", category: "storage" as PluginCategory },
  ["@deepseek-ai/dsh-session-query-sqlite"]: { name: "会话全文搜索", desc: "SQLite FTS5 全文检索会话内容", category: "session" as PluginCategory },
  ["@deepseek-ai/dsh-session-projection"]: { name: "会话投影", desc: "会话数据的可合并扩展投影类型表", category: "session" as PluginCategory },
  ["@deepseek-ai/dsh-session-telemetry-otel"]: { name: "遥测上报", desc: "把会话记录交给 OpenTelemetry 上报（可关闭）", category: "session" as PluginCategory },
  ["@deepseek-ai/dsh-subprocess-local"]: { name: "子进程执行", desc: "本地子进程执行实现", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-sandbox-local"]: { name: "进程沙箱", desc: "本地进程沙箱后端（bwrap / landlock 等）", category: "sandbox" as PluginCategory },
  ["@deepseek-ai/dsh-sandbox-policy"]: { name: "沙箱策略", desc: "每次调用的沙箱策略解析（权限模式/工作区根）", category: "sandbox" as PluginCategory },
  ["@deepseek-ai/dsh-bash-sandbox"]: { name: "Bash 执行器（沙箱）", desc: "通过沙箱执行 Bash 命令（Windows 下默认停用）", category: "sandbox" as PluginCategory },
  ["@deepseek-ai/dsh-pwsh-sandbox"]: { name: "PowerShell 执行器（沙箱）", desc: "通过沙箱执行 PowerShell 命令（Windows 专用）", category: "sandbox" as PluginCategory },
  ["@deepseek-ai/dsh-user-approval"]: { name: "操作审批", desc: "危险操作的一次性权限审批通道", category: "sandbox" as PluginCategory },
  ["@deepseek-ai/dsh-permission-presets"]: { name: "权限预设", desc: "面向用户的权限预设（只读/工作区写/完全访问）", category: "sandbox" as PluginCategory },
  ["@deepseek-ai/dsh-shell-env"]: { name: "Shell 环境注册", desc: "管理注入 shell 的 DSH_* 环境变量", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-tool-bash"]: { name: "Bash 工具", desc: "给模型用的 bash 命令工具（Web 端默认停用）", category: "tool" as PluginCategory },
  ["@deepseek-ai/dsh-tool-pwsh"]: { name: "PowerShell 工具", desc: "给模型用的 pwsh 命令工具（Web 端默认停用）", category: "tool" as PluginCategory },
  ["@deepseek-ai/dsh-tool-jobs"]: { name: "后台任务工具", desc: "job_output / job_list / job_kill 工具（Web 端默认停用）", category: "tool" as PluginCategory },
  ["@deepseek-ai/dsh-fs-observation-policy"]: { name: "文件观察策略", desc: "文件上下文策略：读取前观察、编辑前先读等", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-tool-fs"]: { name: "文件工具", desc: "read / write / edit 文件操作工具（Web 端默认停用）", category: "tool" as PluginCategory },
  ["@deepseek-ai/dsh-tool-fs-search"]: { name: "文件搜索工具", desc: "glob / grep 文件发现工具（内置 ripgrep）", category: "tool" as PluginCategory },
  ["@deepseek-ai/dsh-agent-instructions"]: { name: "工作区指令加载", desc: "加载 AGENTS.md / CLAUDE.md 项目指令", category: "agent" as PluginCategory },
  ["@deepseek-ai/dsh-skill"]: { name: "技能注册中心", desc: "Agent 技能（skill）提供者注册表", category: "skill" as PluginCategory },
  ["@deepseek-ai/dsh-skill-filesystem"]: { name: "技能文件系统", desc: "从本地目录加载技能文件", category: "skill" as PluginCategory },
  ["@deepseek-ai/dsh-skill-badge"]: { name: "DSH 徽章技能", desc: "内置的 dsh 徽章技能提供者", category: "skill" as PluginCategory },
  ["@deepseek-ai/dsh-tool-skill"]: { name: "技能工具", desc: "给模型用的 skill 加载工具", category: "skill" as PluginCategory },
  ["@deepseek-ai/dsh-commands"]: { name: "命令注册表", desc: "插件持有的人类命令注册（斜杠命令）", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-command-feedback"]: { name: "反馈命令", desc: "会话反馈记录 + /feedback 斜杠命令", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-goal"]: { name: "目标状态服务", desc: "同会话目标（goal）的事件溯源状态与生命周期", category: "agent" as PluginCategory },
  ["@deepseek-ai/dsh-goal-round-driver"]: { name: "目标轮次驱动", desc: "目标自动续轮驱动器", category: "agent" as PluginCategory },
  ["@deepseek-ai/dsh-command-goal"]: { name: "目标命令", desc: "人类用的目标斜杠命令", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-plan-mode"]: { name: "计划模式", desc: "按会话记录的计划模式（先计划后执行）", category: "agent" as PluginCategory },
  ["@deepseek-ai/dsh-token-meter"]: { name: "Token 计量", desc: "回放感知的 token 消耗测量服务", category: "llm" as PluginCategory },
  ["@deepseek-ai/dsh-compaction-basic"]: { name: "上下文压缩", desc: "按 token 阈值自动压缩会话上下文", category: "session" as PluginCategory },
  ["@deepseek-ai/dsh-command-compact"]: { name: "压缩命令", desc: "人类手动触发会话压缩的斜杠命令", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-subagent"]: { name: "子代理接口", desc: "委托子代理（subagent）的命名提供者注册", category: "agent" as PluginCategory },
  ["@deepseek-ai/dsh-subagent-spawn-in-process"]: { name: "子代理（进程内）", desc: "进程内生成全新子代理的后端", category: "agent" as PluginCategory },
  ["@deepseek-ai/dsh-subagent-fork-in-process"]: { name: "子代理（分叉）", desc: "继承父会话前缀的分叉子代理后端", category: "agent" as PluginCategory },
  ["@deepseek-ai/dsh-tool-subagent-control"]: { name: "子代理控制工具", desc: "send_message / interrupt_agent / list_agents 工具", category: "agent" as PluginCategory },
  ["@deepseek-ai/dsh-tool-subagent-control/list-agents"]: { name: "子代理控制工具（列表）", desc: "同一子代理控制工具包的列表入口", category: "agent" as PluginCategory },
  ["@deepseek-ai/dsh-tool-subagent"]: { name: "子代理委托工具", desc: "给模型用的 subagent 委托工具", category: "agent" as PluginCategory },
  ["@deepseek-ai/dsh-tool-subagent-fork"]: { name: "子代理分叉工具", desc: "给模型用的分叉式 subagent 工具", category: "agent" as PluginCategory },
  ["@deepseek-ai/dsh-tool-subagent-report"]: { name: "子代理报告工具", desc: "子代理作用域内的结果上报工具", category: "agent" as PluginCategory },
  ["@deepseek-ai/dsh-workflow-worker-thread"]: { name: "工作流引擎", desc: "在 worker 线程中执行编排脚本的工作流引擎", category: "agent" as PluginCategory },
  ["@deepseek-ai/dsh-tool-workflow"]: { name: "工作流工具", desc: "给模型用的 workflow 编排脚本工具", category: "tool" as PluginCategory },
  ["@deepseek-ai/dsh-tool-call-timeout-policy"]: { name: "工具超时策略", desc: "工具调用超时策略（按工具类型设定时限）", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-spill-local"]: { name: "溢写存储（本地）", desc: "超大工具结果溢写到本地文件", category: "storage" as PluginCategory },
  ["@deepseek-ai/dsh-spill-policy"]: { name: "溢写策略", desc: "把超长工具结果替换为文件引用", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-session-checkpoint-policy"]: { name: "会话检查点", desc: "模型请求与工具副作用前的持久化检查点", category: "session" as PluginCategory },
  ["@deepseek-ai/dsh-compaction-tool-result-pruner"]: { name: "结果裁剪", desc: "回放安全地裁剪工具结果（头部/中部/尾部）", category: "session" as PluginCategory },
  ["@deepseek-ai/dsh-tool-todo"]: { name: "待办工具", desc: "给模型用的 todo_write 待办列表工具", category: "tool" as PluginCategory },
  ["@deepseek-ai/dsh-tool-goal"]: { name: "目标工具", desc: "给模型用的同会话目标工具（含权限检查）", category: "tool" as PluginCategory },
  ["@deepseek-ai/dsh-tool-ralph"]: { name: "Ralph 循环工具", desc: "给模型用的 Ralph 全新代理迭代循环", category: "tool" as PluginCategory },
  ["@deepseek-ai/dsh-tool-str-replace-editor"]: { name: "字符串编辑工具", desc: "view/create/替换/插入行的文本编辑工具", category: "tool" as PluginCategory },
  ["@deepseek-ai/dsh-repeat-tool-reminder"]: { name: "重复调用提醒", desc: "模型重复调用同一工具时给出提醒", category: "agent" as PluginCategory },
  ["@deepseek-ai/dsh-web"]: { name: "网络能力接口", desc: "搜索/抓取能力的抽象接口与提供者注册", category: "llm" as PluginCategory },
  ["@deepseek-ai/dsh-web-search-deepseek"]: { name: "DeepSeek 搜索", desc: "DeepSeek 官方搜索提供者（web_search）", category: "llm" as PluginCategory },
  ["@deepseek-ai/dsh-tool-web"]: { name: "网络工具", desc: "给模型用的 web_search / web_fetch 工具", category: "tool" as PluginCategory },
  ["@deepseek-ai/dsh-tools"]: { name: "工具注册中心", desc: "工具注册表与执行管线（所有 tool_* 的宿主）", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-system-prompt"]: { name: "系统提示词组装", desc: "系统提示词分节组装注册表", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-agent-loop"]: { name: "Agent 主循环", desc: "具体 Agent 循环（思考-调用工具-产出）实现", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-fs-sandbox"]: { name: "文件沙箱执行", desc: "按沙箱策略拦截 write/edit 的文件系统实现", category: "sandbox" as PluginCategory },
  ["@deepseek-ai/dsh-llm-deepseek"]: { name: "DeepSeek 模型适配器", desc: "DeepSeek 官方 chat-completions 模型适配", category: "llm" as PluginCategory },
  ["@deepseek-ai/dsh-code-runtime-worker-thread"]: { name: "代码执行运行时", desc: "在 worker 线程中执行代码的运行时", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-storage"]: { name: "存储中枢", desc: "命名存储后端注册与数据形态设施", category: "storage" as PluginCategory },
  ["@deepseek-ai/dsh-storage-json"]: { name: "JSON 存储后端", desc: "JSON 文件 KV 存储后端", category: "storage" as PluginCategory },
  ["@deepseek-ai/dsh-storage-domain"]: { name: "领域存储", desc: "带模式校验的 KV 领域数据存储", category: "storage" as PluginCategory },
  ["@deepseek-ai/dsh-message-feedback"]: { name: "消息反馈", desc: "每条消息的点赞/点踩与备注", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-session-log-export"]: { name: "会话导出", desc: "Web 端会话日志导出与下载对话框", category: "session" as PluginCategory },
  ["@deepseek-ai/dsh-workspace"]: { name: "工作区注册", desc: "工作区（workspace）实体注册与会话挂接", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-session-projection-cache"]: { name: "投影缓存", desc: "会话投影的持久化检查点缓存", category: "session" as PluginCategory },
  ["@deepseek-ai/dsh-session-stats"]: { name: "会话统计", desc: "整个会话日志的轮次/耗时统计投影", category: "session" as PluginCategory },
  ["@deepseek-ai/dsh-host-directory-picker-auto"]: { name: "目录选择器", desc: "按宿主环境自动选择原生/浏览式目录选择", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-host-plugin-inventory"]: { name: "插件清单服务（只读）", desc: "把 Cordis 加载器插件状态投影给客户端（只读）", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-host-apiproxy"]: { name: "API 网关宿主", desc: "API 网关：/api 契约、fetch 载体与主机插件", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-cordis-host-runner"]: { name: "动态插件宿主", desc: "AI 动态定义插件的注册、沙箱与调用处理器", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-web-app/startup"]: { name: "Web 启动参数", desc: "解析 Web 启动参数（host/port/信任主机等）", category: "web" as PluginCategory },
  ["@deepseek-ai/dsh-host-webserver"]: { name: "HTTP 服务器", desc: "Web 路由注册与静态资源服务", category: "web" as PluginCategory },
  ["@deepseek-ai/dsh-web-app"]: { name: "Web 运行时", desc: "Web 界面运行时（前端静态资源、信任栅栏）", category: "web" as PluginCategory },
  ["@deepseek-ai/dsh-client-hmr"]: { name: "客户端热更新", desc: "开发模式下客户端插件热更新驱动", category: "web" as PluginCategory },
  ["@deepseek-ai/dsh-client-modules"]: { name: "客户端模块系统", desc: "浏览器插件模块表与 __DSH_BOOT__ 组装", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-client-connection"]: { name: "客户端连接", desc: "浏览器与主机的 HTTP/WebSocket 连接层", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-api-remotes"]: { name: "远程接口装配", desc: "把主机远程服务装配给浏览器（remote.*）", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-client-runtime"]: { name: "客户端运行时", desc: "浏览器核心服务：会话运行时与槽位注册", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-cordis-client-runner"]: { name: "动态插件客户端", desc: "AI 动态定义插件的浏览器半执行环境", category: "core" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-theme"]: { name: "主题", desc: "明暗主题状态与切换", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-locale"]: { name: "语言", desc: "中/英语言偏好与文案字典", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-layout"]: { name: "界面框架", desc: "三栏应用框架与拖拽调节、面板状态", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-sidebar"]: { name: "侧边栏", desc: "会话多级树、搜索、分组与状态点", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-settings"]: { name: "设置框架", desc: "设置页的命名空间作用域与槽位契约", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-settings-general"]: { name: "常规设置", desc: "常规设置分区与新手引导", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-settings-models"]: { name: "模型设置", desc: "模型配置设置与凭据接入对话框", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-settings-plugin-inventory"]: { name: "插件列表页（只读）", desc: "设置里的只读插件清单标签页", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-conversation"]: { name: "对话界面", desc: "对话区骨架、消息流、输入框与详情", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-tool"]: { name: "工具调用卡片", desc: "工具调用树的渲染与按工具定制视图", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-cordis"]: { name: "动态插件卡片", desc: "cordis_define 工具行的运行/停止开关卡片", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-workflow-run"]: { name: "工作流运行节点", desc: "工作流运行生命周期对话节点", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-deliverables"]: { name: "产出文件栏", desc: "回复尾部产出文件引用与点击打开", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-workspace"]: { name: "工作区选择器", desc: "侧边栏里的工作区选择组件", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-input-trigger"]: { name: "输入触发器", desc: "'/' 与 '@' 触发管线与候选菜单", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-commands"]: { name: "命令面板", desc: "全局命令目录与 '/' 命令源、弹层选择", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-skill"]: { name: "技能引用", desc: "Web 端技能引用与技能工具行", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-subagent"]: { name: "子代理界面", desc: "子代理会话目录、续接路由与 '@' 引用源", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-jobs"]: { name: "后台任务列表", desc: "会话头的后台任务实时列表", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-goal"]: { name: "目标条", desc: "输入框上方的会话目标条（GoalBar）", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-message-feedback"]: { name: "消息反馈按钮", desc: "助手消息操作条上的点赞/点踩与备注", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-model-selection"]: { name: "模型选择", desc: "/model 弹层选择与会话模型切换", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-permission-presets"]: { name: "权限界面", desc: "新会话默认权限与 /permission 弹层", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-agent-preset"]: { name: "Agent 预设界面", desc: "默认/当前会话的 Agent 预设与组合编辑器", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-settings-plugins"]: { name: "插件设置分区", desc: "设置→插件 分区与可配置插件卡片", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-plan"]: { name: "计划模式控件", desc: "输入框上的计划模式开关与 /plan 命令", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-user-questions"]: { name: "提问界面", desc: "ask_user_question 的输入框接管提问 UI", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-client-ui-trajectory"]: { name: "轨迹视图", desc: "交互式时序轨迹事件总览", category: "ui" as PluginCategory },
  ["@deepseek-ai/dsh-agent-presets"]: { name: "Agent 预设引擎", desc: "按预设 cordis.yml 组合每个会话的 Agent", category: "agent" as PluginCategory },
  ["@dsh-external/dsh-navbar"]: { name: "对话导航条", desc: "对话区右缘的消息节点导航（第三方插件）", category: "external" as PluginCategory },
}

/** 系统保护模块：缺失会导致应用/传输层/插件管家自身失效，界面不允许停用。 */
export const SYSTEM_MODULES: ReadonlySet<string> = new Set([
  // 基础运行时与热加载
  '@deepseek-ai/cordis-plugin-timer',
  '@deepseek-ai/cordis-plugin-hmr',
  // 类型反射与 RPC
  '@deepseek-ai/dsh-typert-registry',
  '@deepseek-ai/dsh-typert-loader',
  '@deepseek-ai/dsh-api-gateway',
  '@deepseek-ai/dsh-host-apiproxy',
  // 大模型与工具管线（停用后 Agent 无法工作）
  '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-tools',
  '@deepseek-ai/dsh-system-prompt',
  '@deepseek-ai/dsh-agent',
  '@deepseek-ai/dsh-agent-loop',
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-session-persistence-jsonl',
  // 设置与凭据存储
  '@deepseek-ai/dsh-settings-file',
  '@deepseek-ai/dsh-storage',
  '@deepseek-ai/dsh-storage-json',
  '@deepseek-ai/dsh-storage-domain',
  // 沙箱基础
  '@deepseek-ai/dsh-sandbox-local',
  '@deepseek-ai/dsh-sandbox-policy',
  '@deepseek-ai/dsh-fs-sandbox',
  // Web 宿主与传输
  '@deepseek-ai/dsh-host-webserver',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-web-app/startup',
  '@deepseek-ai/dsh-client-modules',
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-api-remotes',
  '@deepseek-ai/dsh-client-runtime',
  // 设置页外壳（插件管家标签页的宿主）
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-ui-settings-plugins',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-layout',
  // 插件管家自身
  '@2768651338/dsh-plugin-manager',
])

/** 按行 id 保护（与模块名无关的引导行，如 include 根）。 */
export const SYSTEM_ROW_IDS: ReadonlySet<string> = new Set([
  'include',
  'loader',
  'plugin-manager',
])

/** 目录里未收录时的默认说明。 */
export const FALLBACK_DESC = '该插件暂无内置说明，可在覆盖文件中补充自定义说明。'