import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { basename, dirname, join, resolve } from "node:path";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { DEFAULT_SCHEMA, Type, load } from "js-yaml";
//#region lib/types/catalog.js
/**
* 插件管家内置目录：模块名 → 中文名/说明 + 英文名/说明 + 分类。
* 仅作为“出厂默认”——用户可在覆盖文件（~/.dsh/plugin-manager/catalog.json）中
* 为任意模块自定义 name/desc，未收录模块显示英文短名 + 兜底说明。
* 英文界面（评估 P2-9）优先取 nameEn/descEn；缺失时回退英文短名 + 英文兜底说明，
* 不会把中文内容暴露给英文用户（用户自定义覆盖除外——用户数据两种语言下都生效）。
* @module dsh-plugin-manager/catalog
*/
/** 分类的双语标签（评估 P2-7：随 list() 快照下发，界面按当前语言取用）。 */
const CATEGORY_LABELS = {
	core: {
		zh: "核心服务",
		en: "Core services"
	},
	llm: {
		zh: "模型与网络",
		en: "Models & network"
	},
	session: {
		zh: "会话",
		en: "Sessions"
	},
	agent: {
		zh: "智能体",
		en: "Agents"
	},
	tool: {
		zh: "工具",
		en: "Tools"
	},
	skill: {
		zh: "技能",
		en: "Skills"
	},
	ui: {
		zh: "界面",
		en: "UI"
	},
	web: {
		zh: "Web 服务",
		en: "Web services"
	},
	sandbox: {
		zh: "沙箱与安全",
		en: "Sandbox & security"
	},
	storage: {
		zh: "存储",
		en: "Storage"
	},
	external: {
		zh: "第三方插件",
		en: "Third-party plugins"
	},
	other: {
		zh: "其它",
		en: "Other"
	}
};
/** 内置目录（键 = 模块名，即 cordis 行里的 name）。 */
const CATALOG = {
	["@deepseek-ai/cordis-plugin-timer"]: {
		name: "定时器服务",
		desc: "提供 delay 等定时基础能力，热加载与调度依赖它",
		nameEn: "Timer service",
		descEn: "Provides delay and other basic timing capabilities; hot reload and scheduling depend on it",
		category: "core"
	},
	["@deepseek-ai/cordis-plugin-hmr"]: {
		name: "热加载驱动",
		desc: "监听配置文件与插件变更并热重载（Web 端默认停用）",
		nameEn: "Hot reload driver",
		descEn: "Watches config and plugin changes and hot-reloads them (disabled by default on web)",
		category: "core"
	},
	["@deepseek-ai/dsh-llm"]: {
		name: "大模型服务接口",
		desc: "统一的模型调用接口层，所有模型适配器都挂在它下面",
		nameEn: "LLM service interface",
		descEn: "Unified model invocation layer; all model adapters hang off it",
		category: "llm"
	},
	["@deepseek-ai/dsh-session"]: {
		name: "会话存储核心",
		desc: "事件溯源式会话数据核心，记录整个对话轨迹",
		nameEn: "Session store core",
		descEn: "Event-sourced session data core recording the whole conversation",
		category: "session"
	},
	["@deepseek-ai/dsh-typert-registry"]: {
		name: "类型反射注册表",
		desc: "运行时的包反射与 Zod 模式注册中心（RPC 依赖）",
		nameEn: "Typert registry",
		descEn: "Runtime package reflection and Zod schema registry (RPC dependency)",
		category: "core"
	},
	["@deepseek-ai/dsh-typert-loader"]: {
		name: "类型反射加载器",
		desc: "把生成的 Typert 包贡献加载进加载器",
		nameEn: "Typert loader",
		descEn: "Loads generated Typert package contributions into the loader",
		category: "core"
	},
	["@deepseek-ai/dsh-api-gateway"]: {
		name: "API 网关",
		desc: "远程调用（RPC）的主机分发与客户端接口",
		nameEn: "API gateway",
		descEn: "Host dispatch and client interface for remote calls (RPC)",
		category: "core"
	},
	["@deepseek-ai/dsh-session-title"]: {
		name: "会话标题服务",
		desc: "基于会话记录生成标题的服务与提供者注册",
		nameEn: "Session title service",
		descEn: "Title generation service and provider registration based on session records",
		category: "session"
	},
	["@deepseek-ai/dsh-session-title-first-prompt-llm"]: {
		name: "会话标题生成（LLM）",
		desc: "用第一条消息让大模型生成会话标题",
		nameEn: "Session title (LLM)",
		descEn: "Has an LLM generate the session title from the first message",
		category: "session"
	},
	["@deepseek-ai/dsh-user-questions"]: {
		name: "用户提问通道",
		desc: "向用户提问的抽象接口（Agent 运行中征求确认用）",
		nameEn: "User question channel",
		descEn: "Abstract interface for asking the user questions (agent confirmations)",
		category: "agent"
	},
	["@deepseek-ai/dsh-agent"]: {
		name: "智能体核心",
		desc: "Agent 接口、注册表与会话事件词汇",
		nameEn: "Agent core",
		descEn: "Agent interfaces, registries and session event vocabulary",
		category: "agent"
	},
	["@deepseek-ai/dsh-agent-default-model"]: {
		name: "默认模型选择",
		desc: "Agent 入口共享的默认模型选择服务",
		nameEn: "Default model picker",
		descEn: "Default model selection service shared by agent entries",
		category: "llm"
	},
	["@deepseek-ai/dsh-jobs-local"]: {
		name: "后台任务注册表",
		desc: "进程内后台任务（job）注册与管理",
		nameEn: "Local jobs registry",
		descEn: "In-process background job registration and management",
		category: "core"
	},
	["@deepseek-ai/dsh-llm-retry"]: {
		name: "模型请求重试",
		desc: "按提供商路由的 LLM 请求重试策略",
		nameEn: "LLM request retry",
		descEn: "Per-provider retry policies for LLM requests",
		category: "llm"
	},
	["@deepseek-ai/dsh-settings-file"]: {
		name: "设置存储（文件）",
		desc: "把设置写入 settings.yaml 的文件后端",
		nameEn: "File settings store",
		descEn: "File backend persisting settings into settings.yaml",
		category: "storage"
	},
	["@deepseek-ai/dsh-credentials-local"]: {
		name: "凭据存储（本地）",
		desc: "本地凭据提供者（.credentials.yaml / .env）",
		nameEn: "Local credentials store",
		descEn: "Local credential provider (.credentials.yaml / .env)",
		category: "storage"
	},
	["@deepseek-ai/dsh-llm-pi-ai"]: {
		name: "pi-ai 模型适配器",
		desc: "基于 pi-ai 的多提供商模型适配（自定义 API 基址）",
		nameEn: "pi-ai model adapter",
		descEn: "Multi-provider model adapter based on pi-ai (custom API base URLs)",
		category: "llm"
	},
	["@deepseek-ai/dsh-session-persistence-jsonl"]: {
		name: "会话持久化（JSONL）",
		desc: "把会话记录以 JSONL 文件持久化保存",
		nameEn: "Session persistence (JSONL)",
		descEn: "Persists session records as JSONL files",
		category: "session"
	},
	["@deepseek-ai/dsh-attachment-local"]: {
		name: "附件存储",
		desc: "内容寻址的附件本地存储",
		nameEn: "Attachment store",
		descEn: "Content-addressed local attachment storage",
		category: "storage"
	},
	["@deepseek-ai/dsh-session-query-sqlite"]: {
		name: "会话全文搜索",
		desc: "SQLite FTS5 全文检索会话内容",
		nameEn: "Session full-text search",
		descEn: "SQLite FTS5 full-text search over session content",
		category: "session"
	},
	["@deepseek-ai/dsh-session-projection"]: {
		name: "会话投影",
		desc: "会话数据的可合并扩展投影类型表",
		nameEn: "Session projections",
		descEn: "Mergeable extension projection types for session data",
		category: "session"
	},
	["@deepseek-ai/dsh-session-telemetry-otel"]: {
		name: "遥测上报",
		desc: "把会话记录交给 OpenTelemetry 上报（可关闭）",
		nameEn: "Session telemetry (OTel)",
		descEn: "Hands session records to OpenTelemetry reporting (opt-out)",
		category: "session"
	},
	["@deepseek-ai/dsh-subprocess-local"]: {
		name: "子进程执行",
		desc: "本地子进程执行实现",
		nameEn: "Subprocess runner",
		descEn: "Local subprocess execution implementation",
		category: "core"
	},
	["@deepseek-ai/dsh-sandbox-local"]: {
		name: "进程沙箱",
		desc: "本地进程沙箱后端（bwrap / landlock 等）",
		nameEn: "Process sandbox",
		descEn: "Local process sandbox backend (bwrap / landlock etc.)",
		category: "sandbox"
	},
	["@deepseek-ai/dsh-sandbox-policy"]: {
		name: "沙箱策略",
		desc: "每次调用的沙箱策略解析（权限模式/工作区根）",
		nameEn: "Sandbox policy",
		descEn: "Per-call sandbox policy resolution (permission mode / workspace root)",
		category: "sandbox"
	},
	["@deepseek-ai/dsh-bash-sandbox"]: {
		name: "Bash 执行器（沙箱）",
		desc: "通过沙箱执行 Bash 命令（Windows 下默认停用）",
		nameEn: "Bash runner (sandboxed)",
		descEn: "Runs Bash commands through the sandbox (disabled by default on Windows)",
		category: "sandbox"
	},
	["@deepseek-ai/dsh-pwsh-sandbox"]: {
		name: "PowerShell 执行器（沙箱）",
		desc: "通过沙箱执行 PowerShell 命令（Windows 专用）",
		nameEn: "PowerShell runner (sandboxed)",
		descEn: "Runs PowerShell commands through the sandbox (Windows only)",
		category: "sandbox"
	},
	["@deepseek-ai/dsh-user-approval"]: {
		name: "操作审批",
		desc: "危险操作的一次性权限审批通道",
		nameEn: "Operation approval",
		descEn: "One-shot approval channel for dangerous operations",
		category: "sandbox"
	},
	["@deepseek-ai/dsh-permission-presets"]: {
		name: "权限预设",
		desc: "面向用户的权限预设（只读/工作区写/完全访问）",
		nameEn: "Permission presets",
		descEn: "User-facing permission presets (read-only / workspace-write / full access)",
		category: "sandbox"
	},
	["@deepseek-ai/dsh-shell-env"]: {
		name: "Shell 环境注册",
		desc: "管理注入 shell 的 DSH_* 环境变量",
		nameEn: "Shell environment registry",
		descEn: "Manages the DSH_* environment variables injected into shells",
		category: "core"
	},
	["@deepseek-ai/dsh-tool-bash"]: {
		name: "Bash 工具",
		desc: "给模型用的 bash 命令工具（Web 端默认停用）",
		nameEn: "Bash tool",
		descEn: "Bash command tool for the model (disabled by default on web)",
		category: "tool"
	},
	["@deepseek-ai/dsh-tool-pwsh"]: {
		name: "PowerShell 工具",
		desc: "给模型用的 pwsh 命令工具（Web 端默认停用）",
		nameEn: "PowerShell tool",
		descEn: "pwsh command tool for the model (disabled by default on web)",
		category: "tool"
	},
	["@deepseek-ai/dsh-tool-jobs"]: {
		name: "后台任务工具",
		desc: "job_output / job_list / job_kill 工具（Web 端默认停用）",
		nameEn: "Jobs tools",
		descEn: "job_output / job_list / job_kill tools (disabled by default on web)",
		category: "tool"
	},
	["@deepseek-ai/dsh-fs-observation-policy"]: {
		name: "文件观察策略",
		desc: "文件上下文策略：读取前观察、编辑前先读等",
		nameEn: "File observation policy",
		descEn: "File context policy: observe before reads, read before edits, etc.",
		category: "core"
	},
	["@deepseek-ai/dsh-tool-fs"]: {
		name: "文件工具",
		desc: "read / write / edit 文件操作工具（Web 端默认停用）",
		nameEn: "File tools",
		descEn: "read / write / edit file operation tools (disabled by default on web)",
		category: "tool"
	},
	["@deepseek-ai/dsh-tool-fs-search"]: {
		name: "文件搜索工具",
		desc: "glob / grep 文件发现工具（内置 ripgrep）",
		nameEn: "File search tool",
		descEn: "glob / grep file discovery tools (bundled ripgrep)",
		category: "tool"
	},
	["@deepseek-ai/dsh-agent-instructions"]: {
		name: "工作区指令加载",
		desc: "加载 AGENTS.md / CLAUDE.md 项目指令",
		nameEn: "Workspace instructions",
		descEn: "Loads AGENTS.md / CLAUDE.md project instructions",
		category: "agent"
	},
	["@deepseek-ai/dsh-skill"]: {
		name: "技能注册中心",
		desc: "Agent 技能（skill）提供者注册表",
		nameEn: "Skill registry",
		descEn: "Provider registry for agent skills",
		category: "skill"
	},
	["@deepseek-ai/dsh-skill-filesystem"]: {
		name: "技能文件系统",
		desc: "从本地目录加载技能文件",
		nameEn: "Skill filesystem",
		descEn: "Loads skill files from local directories",
		category: "skill"
	},
	["@deepseek-ai/dsh-skill-badge"]: {
		name: "DSH 徽章技能",
		desc: "内置的 dsh 徽章技能提供者",
		nameEn: "DSH badge skill",
		descEn: "Built-in dsh badge skill provider",
		category: "skill"
	},
	["@deepseek-ai/dsh-tool-skill"]: {
		name: "技能工具",
		desc: "给模型用的 skill 加载工具",
		nameEn: "Skill tool",
		descEn: "Skill loading tool for the model",
		category: "skill"
	},
	["@deepseek-ai/dsh-commands"]: {
		name: "命令注册表",
		desc: "插件持有的人类命令注册（斜杠命令）",
		nameEn: "Command registry",
		descEn: "Registration of human-facing commands held by plugins (slash commands)",
		category: "ui"
	},
	["@deepseek-ai/dsh-command-feedback"]: {
		name: "反馈命令",
		desc: "会话反馈记录 + /feedback 斜杠命令",
		nameEn: "Feedback command",
		descEn: "Session feedback records + the /feedback slash command",
		category: "ui"
	},
	["@deepseek-ai/dsh-goal"]: {
		name: "目标状态服务",
		desc: "同会话目标（goal）的事件溯源状态与生命周期",
		nameEn: "Goal state service",
		descEn: "Event-sourced state and lifecycle for session-scoped goals",
		category: "agent"
	},
	["@deepseek-ai/dsh-goal-round-driver"]: {
		name: "目标轮次驱动",
		desc: "目标自动续轮驱动器",
		nameEn: "Goal round driver",
		descEn: "Driver that automatically continues goal rounds",
		category: "agent"
	},
	["@deepseek-ai/dsh-command-goal"]: {
		name: "目标命令",
		desc: "人类用的目标斜杠命令",
		nameEn: "Goal command",
		descEn: "Goal slash commands for humans",
		category: "ui"
	},
	["@deepseek-ai/dsh-plan-mode"]: {
		name: "计划模式",
		desc: "按会话记录的计划模式（先计划后执行）",
		nameEn: "Plan mode",
		descEn: "Session-record-backed plan mode (plan first, then execute)",
		category: "agent"
	},
	["@deepseek-ai/dsh-token-meter"]: {
		name: "Token 计量",
		desc: "回放感知的 token 消耗测量服务",
		nameEn: "Token meter",
		descEn: "Replay-aware token consumption metering service",
		category: "llm"
	},
	["@deepseek-ai/dsh-compaction-basic"]: {
		name: "上下文压缩",
		desc: "按 token 阈值自动压缩会话上下文",
		nameEn: "Context compaction",
		descEn: "Auto-compacts session context at token thresholds",
		category: "session"
	},
	["@deepseek-ai/dsh-command-compact"]: {
		name: "压缩命令",
		desc: "人类手动触发会话压缩的斜杠命令",
		nameEn: "Compact command",
		descEn: "Slash command for manually triggering session compaction",
		category: "ui"
	},
	["@deepseek-ai/dsh-subagent"]: {
		name: "子代理接口",
		desc: "委托子代理（subagent）的命名提供者注册",
		nameEn: "Subagent interface",
		descEn: "Named provider registry for delegating subagents",
		category: "agent"
	},
	["@deepseek-ai/dsh-subagent-spawn-in-process"]: {
		name: "子代理（进程内）",
		desc: "进程内生成全新子代理的后端",
		nameEn: "Subagent (in-process)",
		descEn: "Backend spawning fresh subagents in-process",
		category: "agent"
	},
	["@deepseek-ai/dsh-subagent-fork-in-process"]: {
		name: "子代理（分叉）",
		desc: "继承父会话前缀的分叉子代理后端",
		nameEn: "Subagent (fork)",
		descEn: "Backend forking subagents that inherit the parent session prefix",
		category: "agent"
	},
	["@deepseek-ai/dsh-tool-subagent-control"]: {
		name: "子代理控制工具",
		desc: "send_message / interrupt_agent / list_agents 工具",
		nameEn: "Subagent control tool",
		descEn: "send_message / interrupt_agent / list_agents tools",
		category: "agent"
	},
	["@deepseek-ai/dsh-tool-subagent-control/list-agents"]: {
		name: "子代理控制工具（列表）",
		desc: "同一子代理控制工具包的列表入口",
		nameEn: "Subagent control (list)",
		descEn: "List entry of the same subagent control tool package",
		category: "agent"
	},
	["@deepseek-ai/dsh-tool-subagent"]: {
		name: "子代理委托工具",
		desc: "给模型用的 subagent 委托工具",
		nameEn: "Subagent delegation tool",
		descEn: "Subagent delegation tool for the model",
		category: "agent"
	},
	["@deepseek-ai/dsh-tool-subagent-fork"]: {
		name: "子代理分叉工具",
		desc: "给模型用的分叉式 subagent 工具",
		nameEn: "Subagent fork tool",
		descEn: "Fork-style subagent tool for the model",
		category: "agent"
	},
	["@deepseek-ai/dsh-tool-subagent-report"]: {
		name: "子代理报告工具",
		desc: "子代理作用域内的结果上报工具",
		nameEn: "Subagent report tool",
		descEn: "Result reporting tool scoped to subagents",
		category: "agent"
	},
	["@deepseek-ai/dsh-workflow-worker-thread"]: {
		name: "工作流引擎",
		desc: "在 worker 线程中执行编排脚本的工作流引擎",
		nameEn: "Workflow engine",
		descEn: "Workflow engine running orchestration scripts in worker threads",
		category: "agent"
	},
	["@deepseek-ai/dsh-tool-workflow"]: {
		name: "工作流工具",
		desc: "给模型用的 workflow 编排脚本工具",
		nameEn: "Workflow tool",
		descEn: "Workflow orchestration script tool for the model",
		category: "tool"
	},
	["@deepseek-ai/dsh-tool-call-timeout-policy"]: {
		name: "工具超时策略",
		desc: "工具调用超时策略（按工具类型设定时限）",
		nameEn: "Tool timeout policy",
		descEn: "Tool call timeout policy (per tool type limits)",
		category: "core"
	},
	["@deepseek-ai/dsh-spill-local"]: {
		name: "溢写存储（本地）",
		desc: "超大工具结果溢写到本地文件",
		nameEn: "Local spill store",
		descEn: "Spills oversized tool results to local files",
		category: "storage"
	},
	["@deepseek-ai/dsh-spill-policy"]: {
		name: "溢写策略",
		desc: "把超长工具结果替换为文件引用",
		nameEn: "Spill policy",
		descEn: "Replaces overlong tool results with file references",
		category: "core"
	},
	["@deepseek-ai/dsh-session-checkpoint-policy"]: {
		name: "会话检查点",
		desc: "模型请求与工具副作用前的持久化检查点",
		nameEn: "Session checkpoint",
		descEn: "Persistent checkpoints before model requests and tool side effects",
		category: "session"
	},
	["@deepseek-ai/dsh-compaction-tool-result-pruner"]: {
		name: "结果裁剪",
		desc: "回放安全地裁剪工具结果（头部/中部/尾部）",
		nameEn: "Result pruner",
		descEn: "Replay-safely prunes tool results (head / middle / tail)",
		category: "session"
	},
	["@deepseek-ai/dsh-tool-todo"]: {
		name: "待办工具",
		desc: "给模型用的 todo_write 待办列表工具",
		nameEn: "Todo tool",
		descEn: "todo_write todo-list tool for the model",
		category: "tool"
	},
	["@deepseek-ai/dsh-tool-goal"]: {
		name: "目标工具",
		desc: "给模型用的同会话目标工具（含权限检查）",
		nameEn: "Goal tool",
		descEn: "Session goal tool for the model (with permission checks)",
		category: "tool"
	},
	["@deepseek-ai/dsh-tool-ralph"]: {
		name: "Ralph 循环工具",
		desc: "给模型用的 Ralph 全新代理迭代循环",
		nameEn: "Ralph loop tool",
		descEn: "Ralph fresh-agent iteration loop tool for the model",
		category: "tool"
	},
	["@deepseek-ai/dsh-tool-str-replace-editor"]: {
		name: "字符串编辑工具",
		desc: "view/create/替换/插入行的文本编辑工具",
		nameEn: "Str-replace editor",
		descEn: "Text editing tool with view/create/replace/insert-lines operations",
		category: "tool"
	},
	["@deepseek-ai/dsh-repeat-tool-reminder"]: {
		name: "重复调用提醒",
		desc: "模型重复调用同一工具时给出提醒",
		nameEn: "Repeat call reminder",
		descEn: "Reminds when the model repeatedly calls the same tool",
		category: "agent"
	},
	["@deepseek-ai/dsh-web"]: {
		name: "网络能力接口",
		desc: "搜索/抓取能力的抽象接口与提供者注册",
		nameEn: "Web capability interface",
		descEn: "Abstract interface and provider registry for search/fetch",
		category: "llm"
	},
	["@deepseek-ai/dsh-web-search-deepseek"]: {
		name: "DeepSeek 搜索",
		desc: "DeepSeek 官方搜索提供者（web_search）",
		nameEn: "DeepSeek search",
		descEn: "Official DeepSeek search provider (web_search)",
		category: "llm"
	},
	["@deepseek-ai/dsh-tool-web"]: {
		name: "网络工具",
		desc: "给模型用的 web_search / web_fetch 工具",
		nameEn: "Web tools",
		descEn: "web_search / web_fetch tools for the model",
		category: "tool"
	},
	["@deepseek-ai/dsh-tools"]: {
		name: "工具注册中心",
		desc: "工具注册表与执行管线（所有 tool_* 的宿主）",
		nameEn: "Tools registry",
		descEn: "Tool registry and execution pipeline (host of all tool_*)",
		category: "core"
	},
	["@deepseek-ai/dsh-system-prompt"]: {
		name: "系统提示词组装",
		desc: "系统提示词分节组装注册表",
		nameEn: "System prompt builder",
		descEn: "Registry for assembling system prompt sections",
		category: "core"
	},
	["@deepseek-ai/dsh-agent-loop"]: {
		name: "Agent 主循环",
		desc: "具体 Agent 循环（思考-调用工具-产出）实现",
		nameEn: "Agent loop",
		descEn: "Concrete agent loop implementation (think - call tools - produce)",
		category: "core"
	},
	["@deepseek-ai/dsh-fs-sandbox"]: {
		name: "文件沙箱执行",
		desc: "按沙箱策略拦截 write/edit 的文件系统实现",
		nameEn: "Filesystem sandbox",
		descEn: "Filesystem implementation intercepting write/edit per sandbox policy",
		category: "sandbox"
	},
	["@deepseek-ai/dsh-llm-deepseek"]: {
		name: "DeepSeek 模型适配器",
		desc: "DeepSeek 官方 chat-completions 模型适配",
		nameEn: "DeepSeek model adapter",
		descEn: "Official DeepSeek chat-completions model adapter",
		category: "llm"
	},
	["@deepseek-ai/dsh-code-runtime-worker-thread"]: {
		name: "代码执行运行时",
		desc: "在 worker 线程中执行代码的运行时",
		nameEn: "Code execution runtime",
		descEn: "Runtime executing code in worker threads",
		category: "core"
	},
	["@deepseek-ai/dsh-storage"]: {
		name: "存储中枢",
		desc: "命名存储后端注册与数据形态设施",
		nameEn: "Storage hub",
		descEn: "Named storage backend registry and data shape facilities",
		category: "storage"
	},
	["@deepseek-ai/dsh-storage-json"]: {
		name: "JSON 存储后端",
		desc: "JSON 文件 KV 存储后端",
		nameEn: "JSON storage backend",
		descEn: "JSON-file KV storage backend",
		category: "storage"
	},
	["@deepseek-ai/dsh-storage-domain"]: {
		name: "领域存储",
		desc: "带模式校验的 KV 领域数据存储",
		nameEn: "Domain storage",
		descEn: "Schema-validated KV domain data storage",
		category: "storage"
	},
	["@deepseek-ai/dsh-message-feedback"]: {
		name: "消息反馈",
		desc: "每条消息的点赞/点踩与备注",
		nameEn: "Message feedback",
		descEn: "Per-message like/dislike and notes",
		category: "ui"
	},
	["@deepseek-ai/dsh-session-log-export"]: {
		name: "会话导出",
		desc: "Web 端会话日志导出与下载对话框",
		nameEn: "Session export",
		descEn: "Web session log export and download dialog",
		category: "session"
	},
	["@deepseek-ai/dsh-workspace"]: {
		name: "工作区注册",
		desc: "工作区（workspace）实体注册与会话挂接",
		nameEn: "Workspace registry",
		descEn: "Workspace entity registration and session attachment",
		category: "core"
	},
	["@deepseek-ai/dsh-session-projection-cache"]: {
		name: "投影缓存",
		desc: "会话投影的持久化检查点缓存",
		nameEn: "Projection cache",
		descEn: "Persistent checkpoint cache for session projections",
		category: "session"
	},
	["@deepseek-ai/dsh-session-stats"]: {
		name: "会话统计",
		desc: "整个会话日志的轮次/耗时统计投影",
		nameEn: "Session stats",
		descEn: "Round/duration statistics projection over the whole session log",
		category: "session"
	},
	["@deepseek-ai/dsh-host-directory-picker-auto"]: {
		name: "目录选择器",
		desc: "按宿主环境自动选择原生/浏览式目录选择",
		nameEn: "Directory picker",
		descEn: "Picks native or browser-style directory selection per host environment",
		category: "ui"
	},
	["@deepseek-ai/dsh-host-plugin-inventory"]: {
		name: "插件清单服务（只读）",
		desc: "把 Cordis 加载器插件状态投影给客户端（只读）",
		nameEn: "Plugin inventory service (read-only)",
		descEn: "Projects Cordis loader plugin state to the client (read-only)",
		category: "core"
	},
	["@deepseek-ai/dsh-host-apiproxy"]: {
		name: "API 网关宿主",
		desc: "API 网关：/api 契约、fetch 载体与主机插件",
		nameEn: "API gateway host",
		descEn: "API gateway: /api contract, fetch carrier and host plugin",
		category: "core"
	},
	["@deepseek-ai/dsh-cordis-host-runner"]: {
		name: "动态插件宿主",
		desc: "AI 动态定义插件的注册、沙箱与调用处理器",
		nameEn: "Dynamic plugin host",
		descEn: "Registration, sandboxing and invocation handlers for AI-defined plugins",
		category: "core"
	},
	["@deepseek-ai/dsh-web-app/startup"]: {
		name: "Web 启动参数",
		desc: "解析 Web 启动参数（host/port/信任主机等）",
		nameEn: "Web startup options",
		descEn: "Parses web startup options (host / port / trusted hosts etc.)",
		category: "web"
	},
	["@deepseek-ai/dsh-host-webserver"]: {
		name: "HTTP 服务器",
		desc: "Web 路由注册与静态资源服务",
		nameEn: "HTTP server",
		descEn: "Web route registration and static asset serving",
		category: "web"
	},
	["@deepseek-ai/dsh-web-app"]: {
		name: "Web 运行时",
		desc: "Web 界面运行时（前端静态资源、信任栅栏）",
		nameEn: "Web runtime",
		descEn: "Web UI runtime (frontend assets, trust barrier)",
		category: "web"
	},
	["@deepseek-ai/dsh-client-hmr"]: {
		name: "客户端热更新",
		desc: "开发模式下客户端插件热更新驱动",
		nameEn: "Client hot reload",
		descEn: "Hot reload driver for client plugins in development mode",
		category: "web"
	},
	["@deepseek-ai/dsh-client-modules"]: {
		name: "客户端模块系统",
		desc: "浏览器插件模块表与 __DSH_BOOT__ 组装",
		nameEn: "Client module system",
		descEn: "Browser plugin module table and __DSH_BOOT__ assembly",
		category: "core"
	},
	["@deepseek-ai/dsh-client-connection"]: {
		name: "客户端连接",
		desc: "浏览器与主机的 HTTP/WebSocket 连接层",
		nameEn: "Client connection",
		descEn: "HTTP/WebSocket connection layer between browser and host",
		category: "core"
	},
	["@deepseek-ai/dsh-api-remotes"]: {
		name: "远程接口装配",
		desc: "把主机远程服务装配给浏览器（remote.*）",
		nameEn: "Remote assembly",
		descEn: "Assembles host remote services for the browser (remote.*)",
		category: "core"
	},
	["@deepseek-ai/dsh-client-runtime"]: {
		name: "客户端运行时",
		desc: "浏览器核心服务：会话运行时与槽位注册",
		nameEn: "Client runtime",
		descEn: "Browser core services: session runtime and slot registration",
		category: "core"
	},
	["@deepseek-ai/dsh-cordis-client-runner"]: {
		name: "动态插件客户端",
		desc: "AI 动态定义插件的浏览器半执行环境",
		nameEn: "Dynamic plugin client",
		descEn: "Browser-side execution environment for AI-defined plugins",
		category: "core"
	},
	["@deepseek-ai/dsh-client-ui-theme"]: {
		name: "主题",
		desc: "明暗主题状态与切换",
		nameEn: "Theme",
		descEn: "Light/dark theme state and switching",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-locale"]: {
		name: "语言",
		desc: "中/英语言偏好与文案字典",
		nameEn: "Language",
		descEn: "Chinese/English language preference and copy dictionaries",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-layout"]: {
		name: "界面框架",
		desc: "三栏应用框架与拖拽调节、面板状态",
		nameEn: "App layout",
		descEn: "Three-column app shell with drag resizing and panel state",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-sidebar"]: {
		name: "侧边栏",
		desc: "会话多级树、搜索、分组与状态点",
		nameEn: "Sidebar",
		descEn: "Session tree, search, grouping and status dots",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-settings"]: {
		name: "设置框架",
		desc: "设置页的命名空间作用域与槽位契约",
		nameEn: "Settings shell",
		descEn: "Namespace scoping and slot contracts for the settings page",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-settings-general"]: {
		name: "常规设置",
		desc: "常规设置分区与新手引导",
		nameEn: "General settings",
		descEn: "General settings section and onboarding",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-settings-models"]: {
		name: "模型设置",
		desc: "模型配置设置与凭据接入对话框",
		nameEn: "Model settings",
		descEn: "Model configuration settings and credential onboarding dialog",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-settings-plugin-inventory"]: {
		name: "插件列表页（只读）",
		desc: "设置里的只读插件清单标签页",
		nameEn: "Plugin list page (read-only)",
		descEn: "Read-only plugin inventory tab in settings",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-conversation"]: {
		name: "对话界面",
		desc: "对话区骨架、消息流、输入框与详情",
		nameEn: "Conversation UI",
		descEn: "Conversation skeleton, message stream, composer and details",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-tool"]: {
		name: "工具调用卡片",
		desc: "工具调用树的渲染与按工具定制视图",
		nameEn: "Tool call cards",
		descEn: "Renders the tool call tree with per-tool custom views",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-cordis"]: {
		name: "动态插件卡片",
		desc: "cordis_define 工具行的运行/停止开关卡片",
		nameEn: "Dynamic plugin cards",
		descEn: "Run/stop toggle cards for cordis_define tool rows",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-workflow-run"]: {
		name: "工作流运行节点",
		desc: "工作流运行生命周期对话节点",
		nameEn: "Workflow run nodes",
		descEn: "Conversation nodes for the workflow run lifecycle",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-deliverables"]: {
		name: "产出文件栏",
		desc: "回复尾部产出文件引用与点击打开",
		nameEn: "Deliverables bar",
		descEn: "End-of-reply deliverable file references with click-to-open",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-workspace"]: {
		name: "工作区选择器",
		desc: "侧边栏里的工作区选择组件",
		nameEn: "Workspace picker",
		descEn: "Workspace selection component in the sidebar",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-input-trigger"]: {
		name: "输入触发器",
		desc: "'/' 与 '@' 触发管线与候选菜单",
		nameEn: "Input triggers",
		descEn: "Trigger pipelines and candidate menus for '/' and '@'",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-commands"]: {
		name: "命令面板",
		desc: "全局命令目录与 '/' 命令源、弹层选择",
		nameEn: "Command palette",
		descEn: "Global command catalog, '/' command source and overlay picker",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-skill"]: {
		name: "技能引用",
		desc: "Web 端技能引用与技能工具行",
		nameEn: "Skill references",
		descEn: "Web skill references and skill tool rows",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-subagent"]: {
		name: "子代理界面",
		desc: "子代理会话目录、续接路由与 '@' 引用源",
		nameEn: "Subagent UI",
		descEn: "Subagent session directory, continuation routing and '@' reference source",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-jobs"]: {
		name: "后台任务列表",
		desc: "会话头的后台任务实时列表",
		nameEn: "Jobs list",
		descEn: "Live background job list in the session header",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-goal"]: {
		name: "目标条",
		desc: "输入框上方的会话目标条（GoalBar）",
		nameEn: "Goal bar",
		descEn: "Session goal bar above the composer (GoalBar)",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-message-feedback"]: {
		name: "消息反馈按钮",
		desc: "助手消息操作条上的点赞/点踩与备注",
		nameEn: "Message feedback buttons",
		descEn: "Like/dislike and notes on the assistant message action bar",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-model-selection"]: {
		name: "模型选择",
		desc: "/model 弹层选择与会话模型切换",
		nameEn: "Model selection",
		descEn: "The /model overlay picker and per-session model switching",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-permission-presets"]: {
		name: "权限界面",
		desc: "新会话默认权限与 /permission 弹层",
		nameEn: "Permission UI",
		descEn: "New-session default permissions and the /permission overlay",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-agent-preset"]: {
		name: "Agent 预设界面",
		desc: "默认/当前会话的 Agent 预设与组合编辑器",
		nameEn: "Agent preset UI",
		descEn: "Agent presets and composition editor for default/current session",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-settings-plugins"]: {
		name: "插件设置分区",
		desc: "设置→插件 分区与可配置插件卡片",
		nameEn: "Plugin settings section",
		descEn: "The settings→plugins section and configurable plugin cards",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-plan"]: {
		name: "计划模式控件",
		desc: "输入框上的计划模式开关与 /plan 命令",
		nameEn: "Plan mode controls",
		descEn: "Plan mode toggle above the composer and the /plan command",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-user-questions"]: {
		name: "提问界面",
		desc: "ask_user_question 的输入框接管提问 UI",
		nameEn: "Question UI",
		descEn: "Composer-taking-over question UI for ask_user_question",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-trajectory"]: {
		name: "轨迹视图",
		desc: "交互式时序轨迹事件总览",
		nameEn: "Trajectory view",
		descEn: "Interactive chronological overview of trajectory events",
		category: "ui"
	},
	["@deepseek-ai/dsh-agent-presets"]: {
		name: "Agent 预设引擎",
		desc: "按预设 cordis.yml 组合每个会话的 Agent",
		nameEn: "Agent preset engine",
		descEn: "Composes each session's agent from preset cordis.yml",
		category: "agent"
	},
	["dsh-auto-review"]: {
		name: "自动审查",
		desc: "审批链上的第二模型自动审查：只读 reviewer 子代理给出 allow/deny 结构化判定，默认 fail-closed，全程会话日志可审计。",
		nameEn: "Auto review",
		descEn: "Second-model review on the approval chain: a read-only reviewer subagent returns structured allow/deny verdicts, fail-closed by default, fully auditable in the session log.",
		category: "agent"
	},
	["dsh-permission-rules"]: {
		name: "权限规则",
		desc: "声明式有序 allow/deny/ask 权限规则：匹配工具名、参数（glob/正则）、工作区路径与网络目标（域名/IP/端口/协议），外加 Codex 风格进程级网络策略。",
		nameEn: "Permission rules",
		descEn: "Declarative ordered allow/deny/ask rules matching tool names, arguments (glob/regex), workspace paths and network targets (domain/IP/port/protocol), plus Codex-style process-level network policies.",
		category: "sandbox"
	},
	["dsh-doublecheck"]: {
		name: "双重校验",
		desc: "交付质量门：动笔前审讯需求、红绿测试证据、交付后对抗评审，最终给出 deliverable/rework 放行判定。",
		nameEn: "Double check",
		descEn: "Delivery quality gate: interrogates requirements before work starts, requires red/green test evidence, runs an adversarial review after delivery, and issues a deliverable/rework verdict.",
		category: "tool"
	},
	["dsh-memento"]: {
		name: "记忆",
		desc: "有界、分层、带审批门、可审计的跨会话记忆：ctx.memory 能力缝 + 本地 SQLite 提供者 + memory 工具 + 冻结快照注入。",
		nameEn: "Memory",
		descEn: "Bounded, layered, approval-gated and auditable cross-session memory: ctx.memory capability seam + local SQLite provider + memory tools + frozen snapshot injection.",
		category: "session"
	},
	["dsh-checkpoint-rewind"]: {
		name: "检查点回退",
		desc: "统一 DSH 检查点：会话/工作区/配置三态快照 + /checkpoint、/rewind 一键回退 + 设置页时间线 diff + 种子回放恢复。",
		nameEn: "Checkpoint & rewind",
		descEn: "Unified DSH checkpoints: session/workspace/config snapshots + one-click /checkpoint and /rewind + a settings-page timeline diff + seed-replay restore.",
		category: "session"
	},
	["dsh-mcp-panel"]: {
		name: "MCP 面板",
		desc: "MCP 服务器管理面板：查看状态、启停、日志、配置与工具试调，带自动备份。",
		nameEn: "MCP panel",
		descEn: "MCP server management panel: status, enable/disable, logs, config and tool trial calls, with automatic backups.",
		category: "tool"
	},
	["dsh-composer-history"]: {
		name: "输入历史",
		desc: "Web 输入框的终端式输入历史：方向键精确恢复草稿与光标、浏览器本地持久化、Ctrl+R 反查、工作区召回、压缩感知。",
		nameEn: "Input history",
		descEn: "Terminal-style input history for the web composer: arrow-key draft and cursor restore, browser-local persistence, Ctrl+R reverse search, workspace recall and compaction awareness.",
		category: "ui"
	},
	["dsh-session-pin"]: {
		name: "会话置顶",
		desc: "置顶重要会话：保持可见、排序靠前、避免被清理。",
		nameEn: "Session pin",
		descEn: "Pin important sessions: keep them visible, sorted first and safe from cleanup.",
		category: "session"
	},
	["dsh-session-sync"]: {
		name: "会话同步",
		desc: "会话日志推送/拉取到远程存储，支持可配置的自动同步。",
		nameEn: "Session sync",
		descEn: "Push/pull session logs to remote storage with configurable auto-sync.",
		category: "session"
	},
	["dsh-output-styles"]: {
		name: "输出样式",
		desc: "运行时切换模型输出样式：内置六款样式库、/style 命令、会话级持久化、系统提示词注入与渲染器注册表。",
		nameEn: "Output styles",
		descEn: "Switch model output styles at runtime: six built-in styles, the /style command, session-level persistence, system-prompt injection and a renderer registry.",
		category: "ui"
	},
	["dsh-lsp-actions"]: {
		name: "LSP 动作",
		desc: "语言服务器能力暴露给 agent：诊断、定义、引用、补全、code actions 与整仓重命名。",
		nameEn: "LSP actions",
		descEn: "Exposes language-server capabilities to agents: diagnostics, definitions, references, completions, code actions and whole-repo renames.",
		category: "tool"
	},
	["dsh-background-agents"]: {
		name: "后台子代理",
		desc: "后台持久子代理：结构化任务板、进度监控、随时消息与中断控制。",
		nameEn: "Background agents",
		descEn: "Persistent background subagents: structured task board, progress monitoring, messaging at any time and interrupt control.",
		category: "agent"
	},
	["dsh-claude-move"]: {
		name: "Claude 迁移",
		desc: "Claude Code/Codex/OpenCode/Hermes → DSH 迁移：导入 CLAUDE.md/AGENTS.md、斜杠命令与会话历史，审批门 + 幂等。",
		nameEn: "Claude migration",
		descEn: "Migrates Claude Code/Codex/OpenCode/Hermes → DSH: imports CLAUDE.md/AGENTS.md, slash commands and session history; approval-gated and idempotent.",
		category: "tool"
	},
	["dsh-translate"]: {
		name: "翻译",
		desc: "会话内翻译文本与文件并做质量校验；顺带修复模型产出的坏 JSON。",
		nameEn: "Translate",
		descEn: "Translates text and files in-session with quality checks; also repairs broken model-emitted JSON.",
		category: "tool"
	},
	["dsh-local-ai"]: {
		name: "本地模型",
		desc: "把 Ollama / LM Studio / 本地端点变成 DSH 的直接模型路由。",
		nameEn: "Local AI",
		descEn: "Turns Ollama / LM Studio / local endpoints into direct DSH model routes.",
		category: "llm"
	},
	["dsh-mask"]: {
		name: "脱敏",
		desc: "敏感值遮蔽：密钥遮蔽规则 + 内存白名单 + 受控揭示流程。",
		nameEn: "Masking",
		descEn: "Sensitive-value masking: secret masking rules + in-memory allowlist + controlled reveal flow.",
		category: "tool"
	},
	["dsh-data-quality"]: {
		name: "数据质量",
		desc: "确定性数据画像、清洗与核验：DAMA 记分卡、内容哈希去重、指标期望与漂移检查。",
		nameEn: "Data quality",
		descEn: "Deterministic data profiling, cleaning and verification: DAMA scorecards, content-hash dedup, metric expectations and drift checks.",
		category: "tool"
	},
	["dsh-score"]: {
		name: "评分",
		desc: "插件质量评分：按检查项评估插件并产出证据化合规报告。",
		nameEn: "Score",
		descEn: "Plugin quality scoring: evaluates plugins per checklist item and produces evidence-backed compliance reports.",
		category: "tool"
	},
	["dsh-test-drive"]: {
		name: "试驾",
		desc: "在一次性沙箱环境（临时 DSH_HOME）试跑插件并输出 JSON/Markdown 评分。",
		nameEn: "Test drive",
		descEn: "Trials plugins in a disposable sandbox (temporary DSH_HOME) and emits JSON/Markdown score reports.",
		category: "tool"
	},
	["dsh-defend"]: {
		name: "防御",
		desc: "提示注入、越狱与密钥泄露防御：Aho-Corasick 检测 + allow/ask/block 拦截 + 递归删除执行前门。",
		nameEn: "Defend",
		descEn: "Defense against prompt injection, jailbreaks and secret leakage: Aho-Corasick detection + allow/ask/block interception + a pre-execution gate for recursive deletes.",
		category: "sandbox"
	},
	["dsh-budget"]: {
		name: "预算",
		desc: "成本治理：按模型/会话/天聚合 token 与费用、预算上限与阈值告警、碳足迹估算、/budget 命令。",
		nameEn: "Budget",
		descEn: "Cost governance: token and cost aggregation per model/session/day, budget caps and threshold alerts, carbon footprint estimates and the /budget command.",
		category: "tool"
	},
	["dsh-fast"]: {
		name: "快检",
		desc: "只读性能诊断：会话加载/恢复耗时、溢写命中、压缩次数、上下文注入量、LLM 缓存命中率（/fast）。",
		nameEn: "Fast check",
		descEn: "Read-only performance diagnostics: session load/restore times, spill hits, compaction counts, context injection volume and LLM cache hit rate (/fast).",
		category: "tool"
	},
	["dsh-observe"]: {
		name: "可观测",
		desc: "可观测性：请求追踪、遥测、日志缓冲与重试可见性。",
		nameEn: "Observe",
		descEn: "Observability: request tracing, telemetry, log buffering and retry visibility.",
		category: "tool"
	},
	["dsh-click"]: {
		name: "桌面控制",
		desc: "跨平台原生桌面控制（Windows 优先）：截图、读屏、点击/键入/滚动/按键、应用列表与启动——审批门 + 不抢焦点。",
		nameEn: "Desktop control",
		descEn: "Cross-platform native desktop control (Windows first): screenshots, screen reading, click/type/scroll/keys, app listing and launching — approval-gated and never steals focus.",
		category: "tool"
	},
	["dsh-talk"]: {
		name: "语音",
		desc: "语音能力：文本转语音与语音转文本，带静音与说即聊控制。",
		nameEn: "Voice",
		descEn: "Voice capabilities: text-to-speech and speech-to-text with mute and push-to-talk controls.",
		category: "tool"
	},
	["dsh-draw"]: {
		name: "绘图",
		desc: "统一 image_generate 工具：OpenAI Images / Zhipu CogView 路由、健康感知回退、会话配额记账。",
		nameEn: "Draw",
		descEn: "Unified image_generate tool: OpenAI Images / Zhipu CogView routing, health-aware fallback and per-session quota accounting.",
		category: "tool"
	},
	["dsh-industry-research"]: {
		name: "行业研究",
		desc: "结构化公司/行业深研：来源捕获 + 可审计研究轨迹。",
		nameEn: "Industry research",
		descEn: "Structured company/industry deep research: source capture + an auditable research trail.",
		category: "tool"
	},
	["dsh-research-report"]: {
		name: "研究报告",
		desc: "证据链研究报告：内容哈希封印来源目录，报告与来源不可分。",
		nameEn: "Research report",
		descEn: "Evidence-chain research reports: the source catalog is sealed by content hashes and cannot be separated from the report.",
		category: "tool"
	},
	["dsh-fund-research"]: {
		name: "基金研究",
		desc: "基金分析：收益、持仓与绩效归因。",
		nameEn: "Fund research",
		descEn: "Fund analysis: returns, holdings and performance attribution.",
		category: "tool"
	},
	["dsh-library"]: {
		name: "知识库",
		desc: "本地文档知识库：语义+关键词混合检索、引用感知注入、SQLite 索引、本地嵌入零模型下载。",
		nameEn: "Library",
		descEn: "Local document knowledge base: hybrid semantic+keyword retrieval, citation-aware injection, SQLite indexing and local embeddings with zero model downloads.",
		category: "tool"
	},
	["dsh-plugin-guide"]: {
		name: "插件指南",
		desc: "可安装的 DSH 插件开发指南技能：打包、契约、检查与构建校验器。",
		nameEn: "Plugin guide",
		descEn: "Installable DSH plugin development guide skill: packaging, contracts, checks and build validators.",
		category: "skill"
	},
	["@perrylink/dsh-github"]: {
		name: "GitHub",
		desc: "GitHub 集成：PR/issue/仓库/文件工具、评审与 CI 检查——写操作全审批门、token 不落日志。",
		nameEn: "GitHub",
		descEn: "GitHub integration: PR/issue/repo/file tools, reviews and CI checks — all writes approval-gated, tokens never logged.",
		category: "tool"
	},
	["@perrylink/dsh-skill-pack-security-provider"]: {
		name: "安全技能包",
		desc: "预打包安全评审技能 + 风险卡：host 与 client 双端交付。",
		nameEn: "Security skill pack",
		descEn: "Pre-packaged security review skills + risk cards: delivered to both host and client.",
		category: "skill"
	},
	["dsh-personal-directive"]: {
		name: "个人指令",
		desc: "顶部栏一键开关的个人指令插件（框架版：中性占位指令，可替换为自己的内容）。",
		nameEn: "Personal directive",
		descEn: "One-click personal-directive plugin in the top bar (framework edition: neutral placeholder directive, replace it with your own).",
		category: "agent"
	},
	["@perrylink/dsh-ticktick"]: {
		name: "TickTick 任务桥",
		desc: "TickTick（滴答清单）任务桥：会话头任务面板 + 11 个精选 ticktick_* 工具 + 官方 MCP 端点上的设置卡片。",
		nameEn: "TickTick bridge",
		descEn: "TickTick task bridge: a session-header task panel + 11 curated ticktick_* tools + a settings card on the official MCP endpoint.",
		category: "tool"
	},
	["@perrylink/dsh-cert-mcp"]: {
		name: "认证 MCP",
		desc: "只读 MCP 服务器：暴露插件认证等级、快照与五维证据。",
		nameEn: "Certification MCP",
		descEn: "Read-only MCP server exposing plugin certification levels, snapshots and five-dimension evidence.",
		category: "tool"
	},
	["dsh-reach"]: {
		name: "触达",
		desc: "多通道决策与遥控桥：审批/提问卡片镜像到 IM（微信 iLink、Telegram、飞书），#token 稳定 id，聊天内直接应答。",
		nameEn: "Reach",
		descEn: "Multi-channel decision and remote-control bridge: mirrors approval/question cards to IM (WeChat iLink, Telegram, Feishu), stable #token ids, replies directly from chat.",
		category: "tool"
	},
	["dsh-autotier"]: {
		name: "自动分档",
		desc: "强/便宜模型分档路由：意图门控落档、计划模式交接（强档规划便宜档执行）、工具/执行前高危守卫、TTL 回退。",
		nameEn: "Auto tiering",
		descEn: "Strong/cheap model tier routing: intent-gated tier assignment, plan-mode handoff (strong tier plans, cheap tier executes), pre-tool/pre-execution danger guards and TTL fallback.",
		category: "llm"
	},
	["@dsh-external/dsh-navbar"]: {
		name: "对话导航条",
		desc: "对话区右缘的消息节点导航（第三方插件）",
		nameEn: "Conversation scrollbar",
		descEn: "Message-node navigation on the right edge of the conversation area (third-party plugin)",
		category: "external"
	},
	["@deepseek-ai/dsh-hmr"]: {
		name: "热加载驱动（0.2.0+）",
		desc: "协调模块与 profile 配置的热重载（0.2.0 起替代 cordis-plugin-hmr，监听全局与 profile 补丁文件）",
		nameEn: "Hot reload driver (0.2.0+)",
		descEn: "Coordinates hot reload for modules and profile config (replaces cordis-plugin-hmr in 0.2.0; watches global and profile patch files)",
		category: "core"
	},
	["@deepseek-ai/dsh-settings"]: {
		name: "设置服务",
		desc: "用户设置缝（ctx.settings）：设置文档读取与命名空间作用域",
		nameEn: "Settings service",
		descEn: "User settings seam (ctx.settings): settings document reads and namespace scoping",
		category: "core"
	},
	["@deepseek-ai/dsh-config-editor"]: {
		name: "配置编辑器",
		desc: "把插件配置持久化进 profile 补丁并经加载器对账热生效",
		nameEn: "Config editor",
		descEn: "Persists plugin config into profile patches and reconciles it hot through the loader",
		category: "core"
	},
	["@deepseek-ai/dsh-authorization"]: {
		name: "授权缝",
		desc: "插件自有凭据获取流程（ctx.authorization）：与用户对话取得凭据",
		nameEn: "Authorization seam",
		descEn: "Plugin-owned credential flows (ctx.authorization): obtains credentials by talking to the user",
		category: "core"
	},
	["@deepseek-ai/dsh-otel"]: {
		name: "OTLP 遥测通道",
		desc: "普通事件与会话日志的 OTLP 上报（可关闭）",
		nameEn: "OTLP telemetry",
		descEn: "OTLP reporting for ordinary events and session logs (opt-out)",
		category: "core"
	},
	["@deepseek-ai/dsh-plugin-package-inventory-deepseek"]: {
		name: "插件清单投影",
		desc: "把加载器中的插件包清单投喂给官方 DeepSeek 模型请求",
		nameEn: "Plugin package inventory",
		descEn: "Feeds the loader's plugin package inventory into official DeepSeek model requests",
		category: "core"
	},
	["@deepseek-ai/dsh-plugin-manager"]: {
		name: "官方插件管理服务",
		desc: "dsh CLI/Web/agent 工具共享的 profile 插件与捆绑管理（0.2.0+）；与本插件的行同 id 时由本插件替换",
		nameEn: "Official plugin management",
		descEn: "Profile plugin and bundle management shared by dsh CLI/Web/agent tooling (0.2.0+); replaced by this plugin when row ids collide",
		category: "core"
	},
	["@deepseek-ai/dsh-deepseek-account-platform"]: {
		name: "DeepSeek 账号授权",
		desc: "通过浏览器 PKCE 流程授权 DeepSeek 账号",
		nameEn: "DeepSeek account auth",
		descEn: "Authorizes DeepSeek accounts via the browser PKCE flow",
		category: "llm"
	},
	["@deepseek-ai/dsh-deepseek-llm-api-extensions"]: {
		name: "DeepSeek 请求扩展注册",
		desc: "官方 DeepSeek 模型适配的增量请求字段注册表",
		nameEn: "DeepSeek request extensions",
		descEn: "Registry of incremental request fields for the official DeepSeek model adapter",
		category: "llm"
	},
	["@deepseek-ai/dsh-llm-deepseek-api-key"]: {
		name: "DeepSeek API Key 适配",
		desc: "DeepSeek api-key 提供者的认证与模型发现",
		nameEn: "DeepSeek API key adapter",
		descEn: "Auth and model discovery for the DeepSeek api-key provider",
		category: "llm"
	},
	["@deepseek-ai/dsh-llm-deepseek-account"]: {
		name: "DeepSeek 账号适配",
		desc: "DeepSeek 账号提供者的认证与模型发现",
		nameEn: "DeepSeek account adapter",
		descEn: "Auth and model discovery for the DeepSeek account provider",
		category: "llm"
	},
	["@deepseek-ai/dsh-session-log-deepseek"]: {
		name: "会话日志请求扩展",
		desc: "官方 DeepSeek 适配的会话日志增量无损请求扩展",
		nameEn: "Session log request extensions",
		descEn: "Lossless incremental session-log request extensions for the official DeepSeek adapter",
		category: "session"
	},
	["@deepseek-ai/dsh-compaction-image-offload"]: {
		name: "图片溢写压缩",
		desc: "图片预算超限时把最旧图片替换为占位符并重试",
		nameEn: "Image offload compaction",
		descEn: "Replaces the oldest images with placeholders when the image budget is exceeded and retries",
		category: "session"
	},
	["@deepseek-ai/dsh-ptc-runtime-node"]: {
		name: "PTC 执行运行时",
		desc: "沙箱化 Node 进程实现的 PTC 执行能力",
		nameEn: "PTC execution runtime",
		descEn: "PTC execution capability backed by sandboxed Node processes",
		category: "core"
	},
	["@deepseek-ai/dsh-workflow-ptc"]: {
		name: "PTC 工作流",
		desc: "在共享 PTC 沙箱运行时中编排工作流脚本",
		nameEn: "PTC workflow",
		descEn: "Orchestrates workflow scripts in the shared PTC sandbox runtime",
		category: "agent"
	},
	["@deepseek-ai/dsh-web-fetch-http"]: {
		name: "HTTP 抓取提供者",
		desc: "ctx.web 的匿名公网 HTTP(S) 抓取提供者",
		nameEn: "HTTP fetch provider",
		descEn: "Anonymous public HTTP(S) fetch provider for ctx.web",
		category: "web"
	},
	["@deepseek-ai/dsh-mcp-resources"]: {
		name: "MCP 资源",
		desc: "经共享模型工具做作用域内的 MCP 资源发现与读取",
		nameEn: "MCP resources",
		descEn: "Scoped MCP resource discovery and reads through shared model tools",
		category: "tool"
	},
	["@deepseek-ai/dsh-client-resources"]: {
		name: "客户端资源模型",
		desc: "URL 地址经协议注册的提供者变为可用值（useResource 钩子）",
		nameEn: "Client resources",
		descEn: "URLs become usable values through protocol-registered providers (useResource hook)",
		category: "core"
	},
	["@deepseek-ai/dsh-client-shortcuts"]: {
		name: "快捷键注册",
		desc: "应用键盘命令注册与物理键路由",
		nameEn: "Shortcut registration",
		descEn: "App keyboard command registration and physical key routing",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-file-upload"]: {
		name: "文件上传",
		desc: "Agent 作用域的浏览器文件上传、流入与暂存服务",
		nameEn: "File upload",
		descEn: "Agent-scoped browser file upload, inflow and staging service",
		category: "core"
	},
	["@deepseek-ai/dsh-client-ui-renderer"]: {
		name: "界面渲染器",
		desc: "React 槽位绑定、ctx.uiRenderer 与组装后的应用根（0.2.0 起接管客户端运行时职责）",
		nameEn: "UI renderer",
		descEn: "React slot binding, ctx.uiRenderer and the assembled app root (takes over client-runtime duties from 0.2.0)",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-session"]: {
		name: "会话控制器适配",
		desc: "会话控制器的 React 适配与会话作用域槽位",
		nameEn: "Session controller adapter",
		descEn: "React adapter for the session controller and session-scoped slots",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-chat"]: {
		name: "会话目标界面",
		desc: "Chat Conversation 目标、节点定义、渲染器与详情面板",
		nameEn: "Chat conversation UI",
		descEn: "Chat Conversation target, node definitions, renderers and detail panels",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-approval"]: {
		name: "审批卡片",
		desc: "经作用域远程事件接管审批编排的对话卡片",
		nameEn: "Approval cards",
		descEn: "Conversation cards taking over approval orchestration via scoped remote events",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-shortcuts"]: {
		name: "快捷键面板",
		desc: "快捷键参考、录制与本地偏好编辑",
		nameEn: "Shortcuts panel",
		descEn: "Shortcut reference, recording and local preference editing",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-settings-account"]: {
		name: "账号设置",
		desc: "管理 DeepSeek 登录与开放平台账单页入口",
		nameEn: "Account settings",
		descEn: "Manages DeepSeek sign-in and the open-platform billing page entry",
		category: "ui"
	},
	["@deepseek-ai/dsh-client-ui-plugin-manager"]: {
		name: "官方插件面板",
		desc: "官方侧边栏插件面板：安装/启停/重试/组合插件包（0.2.0+，与本插件的设置页标签互不冲突）",
		nameEn: "Official plugin panel",
		descEn: "Official sidebar plugin panel: install/enable/retry/bundle plugins (0.2.0+; does not conflict with this plugin's settings tab)",
		category: "ui"
	}
};
/** 系统保护模块：缺失会导致应用/传输层/插件管家自身失效，界面不允许停用。 */
const SYSTEM_MODULES = /* @__PURE__ */ new Set([
	"@deepseek-ai/cordis-plugin-timer",
	"@deepseek-ai/cordis-plugin-hmr",
	"@deepseek-ai/dsh-hmr",
	"@deepseek-ai/dsh-typert-registry",
	"@deepseek-ai/dsh-typert-loader",
	"@deepseek-ai/dsh-api-gateway",
	"@deepseek-ai/dsh-host-apiproxy",
	"@deepseek-ai/dsh-llm",
	"@deepseek-ai/dsh-tools",
	"@deepseek-ai/dsh-system-prompt",
	"@deepseek-ai/dsh-agent",
	"@deepseek-ai/dsh-agent-loop",
	"@deepseek-ai/dsh-session",
	"@deepseek-ai/dsh-session-persistence-jsonl",
	"@deepseek-ai/dsh-settings",
	"@deepseek-ai/dsh-settings-file",
	"@deepseek-ai/dsh-storage",
	"@deepseek-ai/dsh-storage-json",
	"@deepseek-ai/dsh-storage-domain",
	"@deepseek-ai/dsh-sandbox-local",
	"@deepseek-ai/dsh-sandbox-policy",
	"@deepseek-ai/dsh-fs-sandbox",
	"@deepseek-ai/dsh-host-webserver",
	"@deepseek-ai/dsh-web-app",
	"@deepseek-ai/dsh-web-app/startup",
	"@deepseek-ai/dsh-client-modules",
	"@deepseek-ai/dsh-client-connection",
	"@deepseek-ai/dsh-api-remotes",
	"@deepseek-ai/dsh-client-runtime",
	"@deepseek-ai/dsh-client-ui-settings",
	"@deepseek-ai/dsh-client-ui-settings-plugins",
	"@deepseek-ai/dsh-client-locale",
	"@deepseek-ai/dsh-client-ui-layout",
	"@txc2768651338/dsh-plugin-manager"
]);
/** 按行 id 保护（与模块名无关的引导行，如 include 根）。 */
const SYSTEM_ROW_IDS = /* @__PURE__ */ new Set([
	"include",
	"loader",
	"plugin-manager"
]);
//#endregion
//#region lib/types/patch-file.js
/**
* 启停补丁文件（cordis.patch.yml）的手术式编辑：只增删目标行的 disabled 字段，
* 保留文件里的其它行、注释与 !!js 表达式原样不动。不依赖 YAML 库——
* 按“列 0 的 - ”切行块，行内匹配 id / disabled 键。
* 写盘前的 YAML 回读校验在 patch-yaml 模块（编辑器本身保持零依赖）。
* @module dsh-plugin-manager/patch-file
*/
/** 去掉 YAML 标量两侧的成对引号。 */
function unquote(value) {
	const trimmed = value.trim();
	if (trimmed.length >= 2) {
		const first = trimmed[0];
		const last = trimmed[trimmed.length - 1];
		if (first === "'" && last === "'" || first === "\"" && last === "\"") return trimmed.slice(1, -1);
	}
	return trimmed;
}
/** 判断 disabled 值是否为 !!js 表达式（不可安全编辑）。 */
function isExpression(value) {
	return value !== null && value.trim().startsWith("!!js");
}
/** 去掉值尾部的行内注释（第一个「 #」起的尾串）并 trim，仅用于键值比较，不回写。 */
function stripInlineComment(value) {
	const at = value.search(/\s#/);
	return (at >= 0 ? value.slice(0, at) : value).trim();
}
/** 提取一行的行内注释尾串（含前导空白）；改写 disabled 键时原样保留，避免销毁用户注释。 */
function inlineCommentSuffix(line) {
	const at = line.search(/\s#/);
	return at >= 0 ? line.slice(at) : "";
}
/** 把文件内容解析为顶层行块序列（忽略注释与空行，保留原文文本）。 */
function parsePatchFile(content) {
	const lines = content.split(/\r?\n/);
	const blocks = [];
	let index = 0;
	while (index < lines.length) {
		const line = lines[index] ?? "";
		if (!/^- /.test(line)) {
			index += 1;
			continue;
		}
		const start = index;
		index += 1;
		while (index < lines.length && !/^- /.test(lines[index] ?? "")) index += 1;
		const blockLines = lines.slice(start, index);
		let id = null;
		let disabledIndex = -1;
		let disabledValue = null;
		for (let at = 0; at < blockLines.length; at += 1) {
			const text = blockLines[at] ?? "";
			const idMatch = text.match(/^- id:\s*(.*)$/);
			if (idMatch) id = unquote(stripInlineComment(idMatch[1] ?? ""));
			const disabledMatch = text.match(/^(\s*)disabled:\s*(.*)$/);
			if (disabledMatch && disabledIndex < 0) {
				disabledIndex = at;
				disabledValue = stripInlineComment(disabledMatch[2] ?? "");
			}
		}
		blocks.push({
			lines: blockLines,
			start,
			end: index,
			id,
			disabledIndex,
			disabledValue
		});
	}
	return blocks;
}
/**
* 追加（或替换空数组标记 [] 为）一个启停行块。
* 文件处于“仅注释 + []”的空形态时，直接把 [] 行替换成新行块，保证仍是合法 YAML。
*/
function appendRow(lines, eol, content, entryId, value) {
	const addition = [`- id: ${entryId}`, `  disabled: ${value}`];
	const marker = lines.findIndex((line) => line.trim() === "[]");
	if (marker >= 0) {
		const next = [...lines];
		next.splice(marker, 1, ...addition);
		return {
			content: next.join(eol),
			changed: true,
			blocked: null
		};
	}
	return {
		content: (content.length > 0 && !content.endsWith(eol) ? content + eol : content) + addition.join(eol) + eol,
		changed: true,
		blocked: null
	};
}
/** 检测文件的行尾风格（\r\n 或 \n）。 */
function eolOf(content) {
	return content.includes("\r\n") ? "\r\n" : "\n";
}
/**
* 检测「目标 id 已在文件里、但不是行块首键形态」的无法识别行（评估 P0-2）。
* 例如手工写的 `- name: x` 换行 `id: y`、缩进的续行 id、多写空格的 `-   id:`。
* 这类行无法被行块编辑安全改写；不检测会在启停时静默追加重复行，永不生效。
*/
function hasUnrecognizedIdRow(content, entryId) {
	for (const line of content.split(/\r?\n/)) {
		const text = line.trimStart();
		if (text.startsWith("#")) continue;
		const match = text.match(/^(?:-\s+)?id:\s*(.*)$/);
		if (match && unquote(stripInlineComment(match[1] ?? "")) === entryId) return true;
	}
	return false;
}
/**
* 在补丁文件内容里为 entryId 设置/清除 disabled。
* @param content - 当前文件内容。
* @param entryId - 目标行 id。
* @param enabled - true=启用（写/改 disabled: false 显式覆盖），false=停用（写 disabled: true）。
* @returns 新内容与结果描述；未命中任何行且无需写入时 content 不变。
*   blocked 为 'unrecognized' 表示目标行存在但格式无法识别（拒绝写入重复行）。
*/
function setRowDisabled(content, entryId, enabled) {
	const eol = eolOf(content);
	const lines = content.split(/\r?\n/);
	const target = parsePatchFile(content).find((block) => block.id === entryId);
	if (target !== void 0 && target.disabledIndex >= 0 && isExpression(target.disabledValue)) return {
		content,
		changed: false,
		blocked: "expression"
	};
	if (!enabled) {
		if (target !== void 0 && target.disabledValue === "true") return {
			content,
			changed: false,
			blocked: null
		};
		if (target !== void 0 && target.disabledIndex >= 0) {
			const next = [...lines];
			const comment = inlineCommentSuffix(lines[target.start + target.disabledIndex] ?? "");
			next[target.start + target.disabledIndex] = `  disabled: true${comment}`;
			return {
				content: next.join(eol),
				changed: true,
				blocked: null
			};
		}
		if (target !== void 0) {
			const next = [...lines];
			next.splice(target.start + 1, 0, "  disabled: true");
			return {
				content: next.join(eol),
				changed: true,
				blocked: null
			};
		}
		if (hasUnrecognizedIdRow(content, entryId)) return {
			content,
			changed: false,
			blocked: "unrecognized"
		};
		return appendRow(lines, eol, content, entryId, "true");
	}
	if (target !== void 0) {
		if (target.disabledIndex >= 0) {
			const next = [...lines];
			const comment = inlineCommentSuffix(lines[target.start + target.disabledIndex] ?? "");
			next[target.start + target.disabledIndex] = `  disabled: false${comment}`;
			return {
				content: next.join(eol),
				changed: true,
				blocked: null
			};
		}
		const next = [...lines];
		next.splice(target.start + 1, 0, "  disabled: false");
		return {
			content: next.join(eol),
			changed: true,
			blocked: null
		};
	}
	if (hasUnrecognizedIdRow(content, entryId)) return {
		content,
		changed: false,
		blocked: "unrecognized"
	};
	return appendRow(lines, eol, content, entryId, "false");
}
/** 生成补丁文件的初始内容（文件不存在时）。 */
function initialPatchFile() {
	return [
		"# dsh-plugin-manager（插件管家）管理的启停补丁 —— 全局层，修改后实时热生效。",
		"# 你仍可手工编辑本文件；插件管家只在需要时增删“- id: … / disabled: …”行块。",
		"# !!js 表达式控制的插件不会被插件管家改写。",
		"[]",
		""
	].join("\n");
}
//#endregion
//#region lib/types/patch-yaml.js
/**
* 补丁写盘前的 YAML 回读校验（评估 P0-2）：手写行块编辑器产出的内容必须先被
* 真 YAML 解析器重新解析确认合法（且顶层为数组）才允许落盘，杜绝「逻辑写坏」。
*
* 自定义安全 schema：接受任意 `!!js/*` 标签的标量但不求值（construct 恒为 null）。
* js-yaml v4 的默认 schema 会拒绝 `!!js` 标签，而内置 `js-schema` 会真的编译
* `!!js/function`——两者都不适合；这里用 multi 类型把整族标签当作不透明标量放行。
* @module dsh-plugin-manager/patch-yaml
*/
/** 接受任意 `!!js/*` 标签的标量、construct 为 null 的安全类型（绝不执行表达式）。 */
const SAFE_JS_SCALAR = new Type("tag:yaml.org,2002:js", {
	multi: true,
	kind: "scalar",
	resolve: () => true,
	construct: () => null
});
/** 默认 schema + 安全 js 标签族。 */
const PATCH_SCHEMA = DEFAULT_SCHEMA.extend([SAFE_JS_SCALAR]);
/**
* 校验编辑后的补丁内容：必须是合法 YAML 且顶层为数组（cordis.patch.yml 的既定形态）。
* 不满足时抛错（错误信息可直接展示给用户），调用方不得写盘。
*/
function assertWritablePatchYaml(content) {
	let parsed;
	try {
		parsed = load(content, { schema: PATCH_SCHEMA });
	} catch (error) {
		const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
		throw new Error(`补丁内容未通过 YAML 回读校验，已拒绝写入：${reason}`, { cause: error });
	}
	if (!Array.isArray(parsed)) throw new Error("补丁内容顶层不是 YAML 数组（cordis.patch.yml 应为行块数组），已拒绝写入");
}
//#endregion
//#region lib/types/fs-safe.js
/**
* 文件写入防呆（评估 P0-1）：所有配置写盘改为「临时文件 + rename」原子替换；
* 补丁文件改写前自动留带时间戳的 .bak（滚动清理）。
* 主机半专用模块（依赖 node:fs），浏览器半不得引入。
* @module dsh-plugin-manager/fs-safe
*/
/** 备份文件后缀。 */
const BACKUP_SUFFIX = ".bak";
/** 模块内自增计数：保证同一毫秒内的多次写也不会撞临时文件名。 */
let tempSeq = 0;
/** 同步休眠毫秒（rename 被锁重试时用；宿主主线程可安全 Atomics.wait）。 */
function sleepSync(ms) {
	try {
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
	} catch {}
}
/**
* 原子替换写：先写同目录临时文件并 fsync 落盘，再 rename 到目标。
* Windows 上目标被编辑器/杀毒软件占用（EPERM/EBUSY/EACCES）时重试数次，
* 仍失败则降级为直接覆盖写（等价旧行为，不让启停整体失败）。
*/
function writeFileAtomic(targetPath, data) {
	const temp = join(dirname(targetPath), `${basename(targetPath)}.${process.pid}.${Date.now()}.${tempSeq++}.tmp`);
	try {
		writeFileSync(temp, data, "utf8");
		const fd = openSync(temp, "r+");
		try {
			fsyncSync(fd);
		} finally {
			closeSync(fd);
		}
		renameWithRetry(temp, targetPath);
	} catch (error) {
		try {
			if (existsSync(temp)) unlinkSync(temp);
		} catch {}
		if (renameBlocked(error)) {
			writeFileSync(targetPath, data, "utf8");
			return;
		}
		throw error;
	}
}
/** rename 遇到目标被占用的错误码。 */
function renameBlocked(error) {
	return [
		"EPERM",
		"EBUSY",
		"EACCES"
	].includes(error.code ?? "");
}
/** 带重试的 rename：短暂文件锁（杀毒扫描等）在数百毫秒内自愈。 */
function renameWithRetry(from, to) {
	for (let attempt = 0;; attempt += 1) try {
		renameSync(from, to);
		return;
	} catch (error) {
		if (attempt >= 4 || !renameBlocked(error)) throw error;
		sleepSync(60 * (attempt + 1));
	}
}
/** 本地时间戳（文件名友好）：YYYYMMDD-HHmmss。 */
function stampOf(date) {
	const pad = (value) => String(value).padStart(2, "0");
	return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
/** 本地日期键（YYYY-MM-DD）：判断「今天是否已备份过」。 */
function localDayKey(date) {
	const pad = (value) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
/**
* 为目标文件创建带时间戳的备份（同目录 `<名>.<时间戳>.bak`）。
* 源文件不存在时返回 undefined；源文件内容损坏也照原样复制（备份的意义正是保住坏现场）。
*/
function createTimestampedBackup(targetPath, now) {
	if (!existsSync(targetPath)) return void 0;
	const backupPath = `${targetPath}.${stampOf(now)}${BACKUP_SUFFIX}`;
	copyFileSync(targetPath, backupPath);
	return backupPath;
}
/** 清理同一目标的旧备份，按时间戳保留最新 keep 份；单个删除失败不阻断。 */
function pruneBackups(targetPath, keep) {
	let names;
	try {
		names = readdirSync(dirname(targetPath));
	} catch {
		return;
	}
	const prefix = `${basename(targetPath)}.`;
	const backups = names.filter((name) => name.startsWith(prefix) && name.endsWith(BACKUP_SUFFIX)).sort();
	const outdated = backups.slice(0, Math.max(0, backups.length - keep));
	for (const name of outdated) try {
		unlinkSync(join(dirname(targetPath), name));
	} catch {}
}
//#endregion
//#region lib/types/backup.js
/**
* 备份/恢复的纯数据逻辑：校验、组装、合并。不触碰文件系统，
* 便于独立单测，也把「格式契约」集中在一处（主机/浏览器两侧共享）。
* @module dsh-plugin-manager/backup
*/
/** 备份格式标识（写入 document.format）。 */
const BACKUP_FORMAT = "dsh-plugin-manager-backup";
/** 校验未知值是否为合法的备份文档（不抛异常）。 */
function validateBackupDocument(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return {
		ok: false,
		reason: "备份文件不是 JSON 对象"
	};
	const doc = value;
	if (doc.format !== "dsh-plugin-manager-backup") return {
		ok: false,
		reason: `格式标识不是 ${BACKUP_FORMAT}（得到 ${String(doc.format)}）`
	};
	if (doc.version !== 1) return {
		ok: false,
		reason: `不支持的备份版本 ${String(doc.version)}（当前支持 1）`
	};
	if (typeof doc.createdAt !== "string") return {
		ok: false,
		reason: "缺少 createdAt"
	};
	if (typeof doc.profile !== "string") return {
		ok: false,
		reason: "缺少 profile"
	};
	const overrides = doc.overrides;
	if (overrides === null || typeof overrides !== "object" || Array.isArray(overrides)) return {
		ok: false,
		reason: "overrides 必须是对象"
	};
	for (const [key, entry] of Object.entries(overrides)) {
		if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return {
			ok: false,
			reason: `overrides.${key} 必须是对象`
		};
		const fields = entry;
		for (const field of ["name", "desc"]) if (fields[field] !== void 0 && typeof fields[field] !== "string") return {
			ok: false,
			reason: `overrides.${key}.${field} 必须是字符串`
		};
	}
	const dependencies = doc.dependencies;
	if (dependencies === null || typeof dependencies !== "object" || Array.isArray(dependencies)) return {
		ok: false,
		reason: "dependencies 必须是对象"
	};
	for (const [key, spec] of Object.entries(dependencies)) if (typeof spec !== "string") return {
		ok: false,
		reason: `dependencies.${key} 必须是字符串`
	};
	const bundles = doc.bundles;
	if (!Array.isArray(bundles) || bundles.some((item) => typeof item !== "string")) return {
		ok: false,
		reason: "bundles 必须是字符串数组"
	};
	if (doc.patchFile !== void 0 && typeof doc.patchFile !== "string") return {
		ok: false,
		reason: "patchFile 必须是字符串"
	};
	return {
		ok: true,
		document: value
	};
}
/** 组装一个备份文档（由主机侧读取现状后调用）。 */
function buildBackupDocument(input) {
	return {
		format: BACKUP_FORMAT,
		version: 1,
		createdAt: (/* @__PURE__ */ new Date()).toISOString(),
		profile: input.profile,
		overrides: input.overrides,
		dependencies: input.dependencies,
		bundles: [...input.bundles],
		...input.patchFile === void 0 ? {} : { patchFile: input.patchFile }
	};
}
/** 合并备注覆盖：备份条目覆盖当前，保留当前独有的条目。仅统计真正发生变化的条数。 */
function mergeOverrides(current, incoming) {
	const merged = { ...current };
	let changed = 0;
	for (const [key, entry] of Object.entries(incoming)) {
		const existing = merged[key];
		if (existing === void 0 || existing.name !== entry.name || existing.desc !== entry.desc) changed += 1;
		merged[key] = { ...entry };
	}
	return {
		merged,
		changed
	};
}
/** 合并依赖：备份 spec 覆盖当前同名字段，保留当前独有依赖。 */
function mergeDependencies(current, incoming) {
	const merged = { ...current };
	let changed = 0;
	for (const [key, spec] of Object.entries(incoming)) {
		if (merged[key] !== spec) changed += 1;
		merged[key] = spec;
	}
	return {
		merged,
		changed
	};
}
/**
* 分类一个依赖 spec（评估 P0-3）：false=registry 风格（semver/版本范围/dist-tag），
* true=非常规来源（git / file / link / npm 别名 / workspace / http(tarball) / scp 路径 /
* GitHub shorthand（user/repo#ref）/ 本地路径），必须经用户逐项确认才允许写入。
*
* 判据说明：registry 风格 spec 的合法字符集中不含冒号，出现冒号即代表某种协议形态；
* 其余只补路径与 shorthand 两类形态。
*/
function isNonRegistrySpec(spec) {
	const value = spec.trim();
	if (value.length === 0 || value === "*" || value === "latest") return false;
	if (value.includes(":")) return true;
	if (value.startsWith("/") || value.startsWith("./") || value.startsWith("../") || value.startsWith("~/") || value.startsWith("\\") || value === "." || value === "..") return true;
	if (/^[a-zA-Z][a-zA-Z0-9._-]*\/[a-zA-Z0-9._-]+(?:#.*)?$/.test(value)) return true;
	return false;
}
/**
* 审计备份依赖（评估 P0-3）：把依赖拆为「可直接合并」与「待确认」两组。
* - allowNonRegistrySpecs 为 null：首次调用（用户尚未决策），全部非常规 spec 进 pending。
* - 传确认清单：用户已勾选的非常规 spec 进入 writable，未勾选的留在 pending（执行时跳过）。
*/
function auditDependencySpecs(dependencies, allowNonRegistrySpecs) {
	const allowed = allowNonRegistrySpecs === null ? null : new Set(allowNonRegistrySpecs);
	const writable = {};
	const pending = [];
	for (const [name, spec] of Object.entries(dependencies)) {
		if (!isNonRegistrySpec(spec) || allowed !== null && allowed.has(spec)) {
			writable[name] = spec;
			continue;
		}
		pending.push({
			name,
			spec
		});
	}
	return {
		writable,
		pending
	};
}
/** 合并 bundles：去重并保持当前顺序，备份里缺失的按备份顺序追加。 */
function mergeBundles(current, incoming) {
	const merged = [...current];
	const seen = new Set(merged);
	let changed = 0;
	for (const name of incoming) if (!seen.has(name)) {
		merged.push(name);
		seen.add(name);
		changed += 1;
	}
	return {
		merged,
		changed
	};
}
/**
* 把备份里的启停行逐条合并进当前补丁内容（评估 P1-3）。
* 预览与真正导入共用本函数，保证「将要改什么」和「实际改了什么」一致。
* 返回编辑后的内容与每一条实际翻转的行（含目标状态）；表达式行/无法识别的行跳过。
* 有行需要写入时先做 YAML 回读校验——当前补丁文件损坏（如手写成映射）时，
* 预览与导入会得到同一个明确错误，而不是预览说能改、导入时报错。
*/
function mergePatchRows(currentContent, backupPatchFile) {
	let content = currentContent;
	const rows = [];
	for (const row of parsePatchFile(backupPatchFile)) {
		if (row.id === null || row.disabledValue === null) continue;
		if (isExpression(row.disabledValue)) continue;
		const enabled = row.disabledValue !== "true";
		const edited = setRowDisabled(content, row.id, enabled);
		if (edited.blocked !== null || !edited.changed) continue;
		content = edited.content;
		rows.push({
			id: row.id,
			enabled
		});
	}
	if (rows.length > 0) assertWritablePatchYaml(content);
	return {
		content,
		rows
	};
}
/**
* 组装导入预览（评估 P1-3）：把备份文档与当前状态逐项比对，只读、不写任何文件。
* 当前补丁文件缺失时按 initialPatchFile() 的空形态比对，与导入行为一致。
*/
function buildBackupPreview(input) {
	const doc = input.document;
	const overrides = [];
	for (const [name, entry] of Object.entries(doc.overrides)) {
		const existing = input.currentOverrides[name];
		if (existing !== void 0 && existing.name === entry.name && existing.desc === entry.desc) continue;
		overrides.push({
			name,
			...entry.name === void 0 ? {} : { nextName: entry.name },
			...entry.desc === void 0 ? {} : { nextDesc: entry.desc },
			kind: existing === void 0 ? "add" : "update"
		});
	}
	const dependencies = [];
	for (const [name, spec] of Object.entries(doc.dependencies)) {
		const existing = input.currentDependencies[name];
		if (existing === spec) continue;
		dependencies.push({
			name,
			spec,
			kind: existing === void 0 ? "add" : "update",
			nonRegistry: isNonRegistrySpec(spec)
		});
	}
	const bundlesAdded = doc.bundles.filter((name) => !input.currentBundles.includes(name));
	const pendingNonRegistrySpecs = dependencies.filter((dep) => dep.nonRegistry).map((dep) => ({
		name: dep.name,
		spec: dep.spec
	}));
	const patchRows = doc.patchFile === void 0 ? [] : mergePatchRows(input.currentPatchFile ?? initialPatchFile(), doc.patchFile).rows;
	return {
		backupProfile: doc.profile,
		backupCreatedAt: doc.createdAt,
		overrides,
		dependencies,
		bundlesAdded,
		patchRows,
		pendingNonRegistrySpecs
	};
}
//#endregion
//#region lib/types/origin.js
/**
* 插件来源标记（issue #1）的纯函数：官方/社区粗分与「用户安装」信号推导。
* 只依赖纯输入，不触碰 DOM / 远程服务 / node:fs，node 可直跑导入（smoke 测试用）。
* @module dsh-plugin-manager/origin
*/
/**
* 官方 scope 清单：只用于官方/社区粗分（来源徽标与「官方内置」筛选），
* 不参与「是否用户安装」的判断——后者以 profile 依赖表为准（issue #1 的建议）。
* @cordis 一并算官方：框架自带行，绝不可能是社区插件。
*/
const OFFICIAL_SCOPES = ["@deepseek-ai/", "@cordis/"];
/** 是否官方 scope 模块（非字符串输入一律按非官方兜底，不抛错）。 */
function isOfficialModule(moduleName) {
	return typeof moduleName === "string" && OFFICIAL_SCOPES.some((scope) => moduleName.startsWith(scope));
}
/** 模块名是否出现在 profile 依赖表里（用户主动安装信号，含 file: 等非常规 spec）。 */
function isDeclaredDependency(dependencies, moduleName) {
	return typeof moduleName === "string" && Object.hasOwn(dependencies, moduleName);
}
//#endregion
//#region lib/types/index.js
/**
* 插件管家主机半：pluginManager 远程服务（list / setEnabled）。
*
* - list：把 Cordis Loader 的当前行投影给浏览器，并附上中文目录信息。
* - setEnabled：手术式改写全局层启停补丁（~/.dsh/cordis.patch.yml）。
*   该文件被 launcher 的 HMR 观察者（watchUserPatches）实时监听，写入即热生效。
*
* 系统行（引导/传输/插件管家自身）与 !!js 表达式控制的行不允许在界面停用。
* @module dsh-plugin-manager
*/
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) {
			if (kind === "field") initializers.unshift(_);
			else descriptor[key] = _;
		}
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/** 与 dsh-home-paths 一致的 home 解析（避免额外运行时依赖）：$DSH_HOME > ~/.dsh。 */
function dshHome() {
	const fromEnv = process.env.DSH_HOME;
	const selected = fromEnv !== void 0 && fromEnv.trim().length > 0 ? fromEnv.trim() : join(homedir(), ".dsh");
	const expanded = selected === "~" ? homedir() : selected.startsWith("~/") || selected.startsWith("~\\") ? join(homedir(), selected.slice(2)) : selected;
	return resolve(expanded);
}
/** 全局层启停补丁路径（与 launcher 的 homePatchPath 一致）。 */
function globalPatchPath() {
	return join(dshHome(), "cordis.patch.yml");
}
/** 目录覆盖文件路径。 */
function overridesPath() {
	return join(dshHome(), "plugin-manager", "catalog.json");
}
/** 是否为 file: 方式本地加载的模块（评估 P2-5）。 */
function isLocalModule(moduleName) {
	return /^file:/i.test(moduleName);
}
/** 把 file:// URL（或 file: 路径）折成短名：取 basename 去常见脚本扩展名（评估 P2-5）。 */
function fileModuleShortName(moduleName) {
	if (!isLocalModule(moduleName)) return void 0;
	try {
		const base = basename(fileURLToPath(moduleName)).replace(/\.(?:m|c)?js$/i, "");
		return base.length > 0 ? base : void 0;
	} catch {
		return;
	}
}
/** 紧凑一个模块名（去掉作用域与常见前缀）。 */
function moduleShortName(moduleName) {
	const fromFile = fileModuleShortName(moduleName);
	if (fromFile !== void 0) return fromFile;
	return (moduleName.startsWith("@") ? moduleName.slice(moduleName.indexOf("/") + 1) : moduleName).replace(/^cordis:/, "").replace(/^cordis-plugin-/, "").replace(/^dsh-(?:host-|client-)?/, "");
}
/** FiberState 跨包常量枚举的运行时镜像。 */
const FIBER_STATE = {
	PENDING: 0,
	LOADING: 1,
	ACTIVE: 2,
	FAILED: 3,
	DISPOSED: 4,
	UNLOADING: 5
};
const FIBER_PHASE = {
	[FIBER_STATE.PENDING]: "pending",
	[FIBER_STATE.LOADING]: "loading",
	[FIBER_STATE.ACTIVE]: "active",
	[FIBER_STATE.FAILED]: "failed",
	[FIBER_STATE.DISPOSED]: null,
	[FIBER_STATE.UNLOADING]: "unloading"
};
/** 官方插件管理器模块名（dsh-base 内置，行 id 同为 plugin-manager；评估 P1-5）。 */
const OFFICIAL_PLUGIN_MANAGER = "@deepseek-ai/dsh-plugin-manager";
/** 兼容性警告代码：官方插件管理器行仍被加载、与本插件并存。 */
const COMPAT_OFFICIAL_COEXISTS = "official-plugin-manager-coexists";
/**
* 读取目录覆盖文件（评估 P1-2）：文件不存在返回空表（正常形态）；
* 存在但读不出来/损坏时同样返回空表并携带 warning（不阻断列表，由界面横幅提示）。
*/
function readOverrides() {
	let raw;
	try {
		raw = readFileSync(overridesPath(), "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return { overrides: {} };
		return {
			overrides: {},
			warning: error instanceof Error ? error.message : String(error)
		};
	}
	try {
		const parsed = JSON.parse(raw);
		if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) return { overrides: parsed };
		return {
			overrides: {},
			warning: "文件内容不是 JSON 对象"
		};
	} catch (error) {
		return {
			overrides: {},
			warning: error instanceof Error ? error.message : String(error)
		};
	}
}
/** 安全读文件：不存在返回 undefined，其它错误抛给调用方。 */
function tryRead(path) {
	try {
		return readFileSync(path, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return void 0;
		throw error;
	}
}
/** 把 file:// URL（或绝对路径）归一化为本地目录；非法/非本地时返回 undefined。 */
function urlToDir(value) {
	try {
		if (value.startsWith("file:")) return fileURLToPath(value);
		if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/") || value.startsWith("\\\\")) return value;
		return;
	} catch {
		return;
	}
}
/** 读取 profile 清单；文件缺失或损坏时抛错（由调用方兜底）。 */
function readProfileManifest(path) {
	const parsed = JSON.parse(readFileSync(path, "utf8"));
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`profile 清单 ${path} 不是 JSON 对象`);
	return parsed;
}
/** 写回 profile 清单（2 空格缩进 + 末尾换行，与 dsh 的 writeProfileManifest 一致；原子替换）。 */
function writeProfileManifest(path, manifest) {
	writeFileAtomic(path, JSON.stringify(manifest, null, 2) + "\n");
}
/** 补丁备份（.bak）滚动保留份数。 */
const PATCH_BACKUP_KEEP = 5;
/** 备份 JSON 的大小上限（字符数，约 2MB 量级；防自我 DoS 与异常文件）。 */
const MAX_IMPORT_JSON_CHARS = 2097152;
/**
* 服务端输入长度上限（评估 P2-8）：客户端 maxLength 只是礼貌，服务端限制才是限制。
* 上限放宽到「显然异常才拦」的量级（比客户端 60/200 宽），让正常长尾输入不被误伤。
*/
const MAX_MODULE_NAME_CHARS = 200;
const MAX_OVERRIDE_NAME_CHARS = 200;
const MAX_OVERRIDE_DESC_CHARS = 1e3;
/** 模块名/名称/说明超限的统一拒绝（评估 P2-8）。 */
function tooLong(field) {
	return {
		accepted: false,
		reason: "invalid-input",
		message: `${field === "moduleName" ? "模块名" : field === "name" ? "名称" : "说明"}过长（上限 ${field === "moduleName" ? MAX_MODULE_NAME_CHARS : field === "name" ? MAX_OVERRIDE_NAME_CHARS : MAX_OVERRIDE_DESC_CHARS} 字符）`
	};
}
/** 目录缺失时的兜底分类。 */
const OTHER_CATEGORY = "other";
/**
* 插件管家网关：注册为 cordis 服务 pluginManager，由 Typert 网关自动导出
* （SRC 模式：参数名/返回值自动 JSON 编解码，方法参数必须保持简单形参名）。
*/
let PluginManagerGateway = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _setOverride_decorators;
	let _removeOverride_decorators;
	let _quarantineOverrides_decorators;
	let _list_decorators;
	let _setEnabled_decorators;
	let _previewBackup_decorators;
	let _exportBackup_decorators;
	let _importBackup_decorators;
	return class PluginManagerGateway extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_setOverride_decorators = [Remote("setOverride")];
			_removeOverride_decorators = [Remote("removeOverride")];
			_quarantineOverrides_decorators = [Remote("quarantineOverrides")];
			_list_decorators = [Remote("list")];
			_setEnabled_decorators = [Remote("setEnabled")];
			_previewBackup_decorators = [Remote("previewBackup")];
			_exportBackup_decorators = [Remote("exportBackup")];
			_importBackup_decorators = [Remote("importBackup")];
			__esDecorate(this, null, _setOverride_decorators, {
				kind: "method",
				name: "setOverride",
				static: false,
				private: false,
				access: {
					has: (obj) => "setOverride" in obj,
					get: (obj) => obj.setOverride
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _removeOverride_decorators, {
				kind: "method",
				name: "removeOverride",
				static: false,
				private: false,
				access: {
					has: (obj) => "removeOverride" in obj,
					get: (obj) => obj.removeOverride
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _quarantineOverrides_decorators, {
				kind: "method",
				name: "quarantineOverrides",
				static: false,
				private: false,
				access: {
					has: (obj) => "quarantineOverrides" in obj,
					get: (obj) => obj.quarantineOverrides
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _list_decorators, {
				kind: "method",
				name: "list",
				static: false,
				private: false,
				access: {
					has: (obj) => "list" in obj,
					get: (obj) => obj.list
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _setEnabled_decorators, {
				kind: "method",
				name: "setEnabled",
				static: false,
				private: false,
				access: {
					has: (obj) => "setEnabled" in obj,
					get: (obj) => obj.setEnabled
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _previewBackup_decorators, {
				kind: "method",
				name: "previewBackup",
				static: false,
				private: false,
				access: {
					has: (obj) => "previewBackup" in obj,
					get: (obj) => obj.previewBackup
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _exportBackup_decorators, {
				kind: "method",
				name: "exportBackup",
				static: false,
				private: false,
				access: {
					has: (obj) => "exportBackup" in obj,
					get: (obj) => obj.exportBackup
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _importBackup_decorators, {
				kind: "method",
				name: "importBackup",
				static: false,
				private: false,
				access: {
					has: (obj) => "importBackup" in obj,
					get: (obj) => obj.importBackup
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = ["loader"];
		/**
		* 全局写队列（评估 P1-1）：所有落盘方法（启停/目录编辑/备份导入/损坏文件改名）
		* 共用同一条串行队列——此前三条独立队列互不感知，导入与启停并发时会互相覆盖、
		* 静默丢更新。同一文件的所有写入方必须排同一条队。
		*/
		writeQueue = (__runInitializers(this, _instanceExtraInitializers), Promise.resolve());
		constructor(ctx) {
			super(ctx, "pluginManager");
		}
		/** 定位一个非分组行。 */
		findEntry(entryId) {
			for (const entry of this.ctx.loader.entries()) {
				if (entry.options.group) continue;
				if (entry.id === entryId) return entry;
			}
		}
		/** 定位当前 profile 目录：优先取 Loader 的 baseUrl（profile boot 会设成 profile 目录）。 */
		profileDir() {
			const loaderCtx = this.ctx.loader?.ctx;
			const rootBase = this.ctx.baseUrl;
			const baseUrl = loaderCtx?.baseUrl ?? rootBase;
			if (typeof baseUrl !== "string") return void 0;
			const dir = urlToDir(baseUrl);
			if (dir === void 0) return void 0;
			return existsSync(join(dir, "package.json")) ? dir : void 0;
		}
		/**
		* 读取当前 profile 的依赖表（issue #1：推导「用户安装」信号）。
		* 定位失败或文件缺失/损坏时按空表兜底——来源标记是增强信息，绝不因它阻断列表。
		*/
		profileDependencies() {
			try {
				const dir = this.profileDir();
				if (dir === void 0) return {};
				const deps = readProfileManifest(join(dir, "package.json")).dependencies;
				if (deps === null || typeof deps !== "object" || Array.isArray(deps)) return {};
				return deps;
			} catch {
				return {};
			}
		}
		/** 本地「今天」已做过补丁备份的日期键；跨天第一次写前自动备份一次。 */
		patchBackupDay = null;
		/** 把覆盖表原子化写入 catalog.json（目录缺失时创建）。 */
		writeOverrides(overrides) {
			mkdirSync(dirname(overridesPath()), { recursive: true });
			writeFileAtomic(overridesPath(), JSON.stringify(overrides, null, 2) + "\n");
		}
		/**
		* 写全局补丁文件（评估 P0-1/P0-2）：跨天首次写前自动备份（滚动保留
		* PATCH_BACKUP_KEEP 份），写前 YAML 回读校验，临时文件 + rename 原子替换。
		*/
		writePatchFile(path, content) {
			assertWritablePatchYaml(content);
			const day = localDayKey(/* @__PURE__ */ new Date());
			if (this.patchBackupDay !== day) try {
				createTimestampedBackup(path, /* @__PURE__ */ new Date());
				pruneBackups(path, PATCH_BACKUP_KEEP);
				this.patchBackupDay = day;
			} catch {}
			writeFileAtomic(path, content);
		}
		/** 保存一个模块的覆盖：空字段视为清除；两字段皆空则移除整条覆盖。 */
		setOverride(moduleName, name, desc) {
			const run = async () => {
				try {
					if (typeof moduleName !== "string" || moduleName.length === 0) return {
						accepted: false,
						reason: "invalid-input",
						message: "模块名不能为空"
					};
					if (moduleName.length > MAX_MODULE_NAME_CHARS) return tooLong("moduleName");
					const next = { ...readOverrides().overrides };
					const entry = {};
					const trimmedName = (name ?? "").trim();
					const trimmedDesc = (desc ?? "").trim();
					if (trimmedName.length > MAX_OVERRIDE_NAME_CHARS) return tooLong("name");
					if (trimmedDesc.length > MAX_OVERRIDE_DESC_CHARS) return tooLong("desc");
					if (trimmedName.length > 0) entry.name = trimmedName;
					if (trimmedDesc.length > 0) entry.desc = trimmedDesc;
					if (entry.name === void 0 && entry.desc === void 0) delete next[moduleName];
					else next[moduleName] = entry;
					this.writeOverrides(next);
					return { accepted: true };
				} catch (error) {
					return {
						accepted: false,
						reason: "io-error",
						message: error instanceof Error ? error.message : String(error)
					};
				}
			};
			const queued = this.writeQueue.then(run, run);
			this.writeQueue = queued.then(() => {}, () => {});
			return queued;
		}
		/** 移除一个模块的覆盖，恢复内置目录/短名。 */
		removeOverride(moduleName) {
			const run = async () => {
				try {
					if (typeof moduleName !== "string" || moduleName.length === 0) return {
						accepted: false,
						reason: "invalid-input",
						message: "模块名不能为空"
					};
					if (moduleName.length > MAX_MODULE_NAME_CHARS) return tooLong("moduleName");
					const overrides = readOverrides().overrides;
					if (!Object.prototype.hasOwnProperty.call(overrides, moduleName)) return { accepted: true };
					const next = { ...overrides };
					delete next[moduleName];
					this.writeOverrides(next);
					return { accepted: true };
				} catch (error) {
					return {
						accepted: false,
						reason: "io-error",
						message: error instanceof Error ? error.message : String(error)
					};
				}
			};
			const queued = this.writeQueue.then(run, run);
			this.writeQueue = queued.then(() => {}, () => {});
			return queued;
		}
		/**
		* 把损坏的覆盖文件改名保存（评估 P1-2）：catalog.json → catalog.json.corrupt-<时间戳>.json。
		* 内容留在磁盘上可人工找回；改名后 list() 不再报读取失败。
		*/
		quarantineOverrides() {
			const run = async () => {
				try {
					const path = overridesPath();
					if (!existsSync(path)) return { accepted: true };
					const movedTo = `${path}.corrupt-${stampOf(/* @__PURE__ */ new Date())}.json`;
					renameSync(path, movedTo);
					return {
						accepted: true,
						movedTo
					};
				} catch (error) {
					return {
						accepted: false,
						reason: "io-error",
						message: error instanceof Error ? error.message : String(error)
					};
				}
			};
			const queued = this.writeQueue.then(run, run);
			this.writeQueue = queued.then(() => {}, () => {});
			return queued;
		}
		/**
		* 运行时行 id 形如 include:<配置行 id>（include 子树的命名空间前缀），
		* 而补丁文件按配置行 id 定位——取最后一段作为补丁 id。
		*/
		patchIdOf(entryId) {
			return entryId.slice(entryId.lastIndexOf(":") + 1);
		}
		/** 判断一行是否允许界面启停。 */
		toggleGuard(entryId, moduleName) {
			const patchId = this.patchIdOf(entryId);
			if (patchId.length === 0) return {
				accepted: false,
				reason: "system",
				message: "引导行不允许启停"
			};
			if (SYSTEM_MODULES.has(moduleName) || SYSTEM_ROW_IDS.has(entryId) || SYSTEM_ROW_IDS.has(patchId)) return {
				accepted: false,
				reason: "system",
				message: "系统插件：停用会导致应用或插件管家自身不可用"
			};
			const entry = this.findEntry(entryId);
			if (entry === void 0) return {
				accepted: false,
				reason: "not-found",
				message: `插件行不存在：${entryId}`
			};
			const raw = entry.options.disabled;
			if (typeof raw !== "boolean" && raw !== null && raw !== void 0) return {
				accepted: false,
				reason: "expression",
				message: "该插件由 !!js 表达式控制启停，请直接编辑配置文件"
			};
		}
		/** 检测官方插件管理器行是否仍被加载（评估 P1-5）：并存说明本插件未按预期接管。 */
		detectCompatibilityWarning() {
			for (const entry of this.ctx.loader.entries()) if (entry.options.name === OFFICIAL_PLUGIN_MANAGER) return COMPAT_OFFICIAL_COEXISTS;
		}
		/** 当前 Loader 行快照 + 目录信息。 */
		list() {
			const { overrides, warning } = readOverrides();
			const declaredDeps = this.profileDependencies();
			const entries = [];
			let enabledCount = 0;
			for (const entry of this.ctx.loader.entries()) {
				if (entry.options.group) continue;
				const moduleName = entry.options.name;
				const enabled = !entry.disabled;
				if (enabled) enabledCount += 1;
				const catalog = CATALOG[moduleName];
				const override = overrides[moduleName];
				const system = SYSTEM_MODULES.has(moduleName) || SYSTEM_ROW_IDS.has(entry.id);
				const raw = entry.options.disabled;
				const expressionManaged = typeof raw !== "boolean" && raw !== null && raw !== void 0;
				const fiberPhase = entry.fiber === void 0 ? null : FIBER_PHASE[entry.fiber.state] ?? null;
				const shortName = moduleShortName(moduleName);
				entries.push({
					entryId: entry.id,
					moduleName,
					enabled,
					fiberPhase,
					displayName: override?.name ?? catalog?.name ?? shortName,
					description: override?.desc ?? catalog?.desc ?? "该插件暂无内置说明，可在覆盖文件中补充自定义说明。",
					displayNameEn: override?.name ?? catalog?.nameEn ?? shortName,
					descriptionEn: override?.desc ?? catalog?.descEn ?? "No built-in description yet. Add a custom note in the override file.",
					category: catalog?.category ?? OTHER_CATEGORY,
					system,
					toggleable: !system && !expressionManaged,
					toggleBlockReason: system ? "system" : expressionManaged ? "expression" : null,
					hasOverride: override !== void 0,
					local: isLocalModule(moduleName),
					declared: isDeclaredDependency(declaredDeps, moduleName),
					official: isOfficialModule(moduleName)
				});
			}
			const compatibility = this.detectCompatibilityWarning();
			return {
				patchFile: globalPatchPath(),
				overridesFile: overridesPath(),
				entryCount: entries.length,
				enabledCount,
				entries,
				categoryLabels: CATEGORY_LABELS,
				...warning === void 0 ? {} : { overridesWarning: warning },
				...compatibility === void 0 ? {} : { compatibilityWarning: compatibility }
			};
		}
		/** 启停一个插件：改写全局层补丁文件，由 HMR 观察者热应用。 */
		setEnabled(entryId, enabled) {
			const entry = this.findEntry(entryId);
			if (entry === void 0) return Promise.resolve({
				accepted: false,
				reason: "not-found",
				message: `插件行不存在：${entryId}`
			});
			const guarded = this.toggleGuard(entryId, entry.options.name);
			if (guarded !== void 0) return Promise.resolve(guarded);
			const patchId = this.patchIdOf(entryId);
			/** 无法识别行的拒绝结果（评估 P0-2：防静默追加重复行）。 */
			const unrecognized = () => ({
				accepted: false,
				reason: "unrecognized",
				message: "补丁文件里已存在该插件行，但行格式无法识别（行块首键必须是 id）；为避免写入重复行已拒绝本次操作，请手工检查 cordis.patch.yml"
			});
			const run = async () => {
				const path = globalPatchPath();
				try {
					const content = tryRead(path) ?? initialPatchFile();
					let edited = setRowDisabled(content, patchId, enabled);
					if (edited.blocked === "expression") return {
						accepted: false,
						reason: "expression",
						message: "该插件由 !!js 表达式控制启停，请直接编辑配置文件"
					};
					if (edited.blocked === "unrecognized") return unrecognized();
					if (edited.changed) {
						const current = tryRead(path);
						if (current !== void 0 && current !== content) {
							edited = setRowDisabled(current, patchId, enabled);
							if (edited.blocked === "expression") return {
								accepted: false,
								reason: "expression",
								message: "该插件由 !!js 表达式控制启停，请直接编辑配置文件"
							};
							if (edited.blocked === "unrecognized") return unrecognized();
						}
						this.writePatchFile(path, edited.content);
					}
					return { accepted: true };
				} catch (error) {
					return {
						accepted: false,
						reason: "io-error",
						message: error instanceof Error ? error.message : String(error)
					};
				}
			};
			const queued = this.writeQueue.then(run, run);
			this.writeQueue = queued.then(() => {}, () => {});
			return queued;
		}
		/**
		* 导入预览（评估 P1-3）：解析备份并与当前状态逐项比对，返回将翻转的启停行、
		* 将新增/覆盖的依赖、将追加的 bundles 与备注清单——只读，不写任何文件。
		* 界面先展示预览，用户确认后才调用 importBackup 真正写入。
		*/
		previewBackup(json) {
			try {
				if (typeof json !== "string" || json.length === 0) return {
					accepted: false,
					reason: "invalid-format",
					message: "备份内容为空"
				};
				if (json.length > MAX_IMPORT_JSON_CHARS) return {
					accepted: false,
					reason: "too-large",
					message: "备份文件过大（上限 2MB）"
				};
				let parsed;
				try {
					parsed = JSON.parse(json);
				} catch {
					return {
						accepted: false,
						reason: "invalid-format",
						message: "备份文件不是合法的 JSON"
					};
				}
				const validation = validateBackupDocument(parsed);
				if (!validation.ok) return {
					accepted: false,
					reason: "invalid-format",
					message: validation.reason
				};
				const profileDir = this.profileDir();
				if (profileDir === void 0) return {
					accepted: false,
					reason: "profile-not-found",
					message: "无法定位当前 profile 目录（缺少 package.json）"
				};
				const manifest = readProfileManifest(join(profileDir, "package.json"));
				return {
					accepted: true,
					preview: buildBackupPreview({
						currentOverrides: readOverrides().overrides,
						currentDependencies: manifest.dependencies ?? {},
						currentBundles: manifest.dsh?.profile?.bundles ?? [],
						currentPatchFile: tryRead(globalPatchPath()),
						document: validation.document
					})
				};
			} catch (error) {
				return {
					accepted: false,
					reason: "io-error",
					message: error instanceof Error ? error.message : String(error)
				};
			}
		}
		/** 导出备份：备注覆盖 + profile 依赖/bundles + 全局启停补丁。 */
		exportBackup() {
			try {
				const profileDir = this.profileDir();
				if (profileDir === void 0) return {
					accepted: false,
					reason: "profile-not-found",
					message: "无法定位当前 profile 目录（缺少 package.json）"
				};
				const manifest = readProfileManifest(join(profileDir, "package.json"));
				return {
					accepted: true,
					document: buildBackupDocument({
						profile: basename(profileDir),
						overrides: readOverrides().overrides,
						dependencies: manifest.dependencies ?? {},
						bundles: manifest.dsh?.profile?.bundles ?? [],
						patchFile: tryRead(globalPatchPath())
					})
				};
			} catch (error) {
				return {
					accepted: false,
					reason: "io-error",
					message: error instanceof Error ? error.message : String(error)
				};
			}
		}
		/**
		* 导入备份（评估 P0-3 两阶段）：恢复备注 + profile 依赖/bundles + 全局启停补丁
		* （合并语义，保留当前独有条目）。
		*
		* - `allowNonRegistrySpecs` 为 null（首次调用）：只解析与安全审计。若备份含非常规
		*   依赖（git/file/URL 等），返回 confirmation-required 与逐条清单，**不写任何文件**；
		*   全部依赖均为 registry 风格时直接执行写入。
		* - 传确认清单（用户勾选后重调）：执行写入；清单外的非常规依赖被跳过，
		*   并以 detail.nonRegistrySkipped 报告条数。
		*/
		importBackup(json, allowNonRegistrySpecs) {
			const run = async () => {
				try {
					if (typeof json !== "string" || json.length === 0) return {
						accepted: false,
						reason: "invalid-format",
						message: "备份内容为空"
					};
					if (json.length > MAX_IMPORT_JSON_CHARS) return {
						accepted: false,
						reason: "too-large",
						message: "备份文件过大（上限 2MB）"
					};
					let parsed;
					try {
						parsed = JSON.parse(json);
					} catch {
						return {
							accepted: false,
							reason: "invalid-format",
							message: "备份文件不是合法的 JSON"
						};
					}
					const validation = validateBackupDocument(parsed);
					if (!validation.ok) return {
						accepted: false,
						reason: "invalid-format",
						message: validation.reason
					};
					const doc = validation.document;
					const profileDir = this.profileDir();
					if (profileDir === void 0) return {
						accepted: false,
						reason: "profile-not-found",
						message: "无法定位当前 profile 目录（缺少 package.json）"
					};
					const audit = auditDependencySpecs(doc.dependencies, allowNonRegistrySpecs);
					if (allowNonRegistrySpecs === null && audit.pending.length > 0) return {
						accepted: false,
						reason: "confirmation-required",
						message: `备份包含 ${audit.pending.length} 个非常规依赖来源（本地路径 / 外部仓库等），安装时会执行其携带的代码，需逐项确认后才会写入`,
						pendingNonRegistrySpecs: audit.pending
					};
					const overrides = readOverrides().overrides;
					const overMerged = mergeOverrides(overrides, doc.overrides);
					this.writeOverrides(overMerged.merged);
					const manifestPath = join(profileDir, "package.json");
					const manifest = readProfileManifest(manifestPath);
					const depsMerged = mergeDependencies(manifest.dependencies ?? {}, audit.writable);
					const bundlesMerged = mergeBundles(manifest.dsh?.profile?.bundles ?? [], doc.bundles);
					writeProfileManifest(manifestPath, {
						...manifest,
						dependencies: depsMerged.merged,
						dsh: {
							...manifest.dsh,
							profile: {
								...manifest.dsh?.profile,
								bundles: bundlesMerged.merged
							}
						}
					});
					let patchRowsRestored = 0;
					if (doc.patchFile !== void 0) {
						const patchPath = globalPatchPath();
						const merged = mergePatchRows(tryRead(patchPath) ?? initialPatchFile(), doc.patchFile);
						patchRowsRestored = merged.rows.length;
						if (patchRowsRestored > 0) this.writePatchFile(patchPath, merged.content);
					}
					const profileName = basename(profileDir);
					return {
						accepted: true,
						detail: {
							overridesRestored: overMerged.changed,
							dependenciesRestored: depsMerged.changed,
							bundlesRestored: bundlesMerged.changed,
							patchRowsRestored,
							nonRegistrySkipped: audit.pending.length
						},
						installCommand: `dsh plugin --profile ${profileName} install`,
						restartRequired: true
					};
				} catch (error) {
					return {
						accepted: false,
						reason: "io-error",
						message: error instanceof Error ? error.message : String(error)
					};
				}
			};
			const queued = this.writeQueue.then(run, run);
			this.writeQueue = queued.then(() => {}, () => {});
			return queued;
		}
	};
})();
try {
	mkdirSync(dirname(overridesPath()), { recursive: true });
} catch {}
//#endregion
export { CATALOG, CATEGORY_LABELS, PluginManagerGateway, PluginManagerGateway as default, SYSTEM_MODULES };
