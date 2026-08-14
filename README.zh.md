<!-- 中文文档。English README: README.md -->
<div align="center">

# dsh-plugin-manager（插件管家）

> **让每个插件都自报家门** —— 中文名、一句话说明、一键启停，还有界面内的备注编辑，一站式管理 DeepSeek Harness 的所有插件。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![version](https://img.shields.io/badge/version-v0.3.0-success.svg)](https://github.com/2768651338/dsh-plugin-manager/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-7B68EE.svg)](https://github.com/topics/dsh-plugin)

<br>

<img src="assets/preview.png" alt="插件管家标签页 — 实际截图" width="720">

**设置 → 插件 → 插件管家** · 165 个插件全部有中文说明，一键启停，备注就地编辑。

<br>

[English](README.md) · [为什么需要](#为什么需要它) · [安装](#安装) · [功能](#功能) · [工作原理](#工作原理) · [自定义备注](#自定义备注) · [测试](#测试)

</div>

---

> 🆕 **2026-08-14 · v0.3.0** — 界面内备注编辑上线：点卡片上的「编辑备注」就能改名、改写说明，不用再碰 catalog.json 配置文件。
>
> 🔧 **v0.2.x** — 修复 tsx 源码启动模式下的端点 404（./typert 严格注册）与 cordis 注入访问问题（ctx.get 通道）。

---

## 为什么需要它

| 痛点 | 之前 | 用了插件管家之后 |
|------|------|------------------|
| 插件列表看不懂 | 只有英文模块名，不知道每个插件是干嘛的 | 每个插件都有中文名 + 一句话说明 + 分类 |
| 启停全靠手改配置 | 手工编辑 cordis.patch.yml，一改就错 | 一键开关，行级手术式编辑，约 1 秒热生效 |
| 没收录的插件永远神秘 | 只有兜底文案 | 界面里直接补说明 |
| 手滑就出事 | 任何行都能被停用 | 系统行锁定，!!js 表达式行标注禁改 |

## 安装

```bash
# 方式一：从 GitHub 安装（推荐，与 dsh-navbar 相同的 bundle 机制）
dsh plugin --profile web add github:2768651338/dsh-plugin-manager#main

# 方式二：从 zip 包安装（下载 Release 里的 zip）
# 解压到无空格路径后：
dsh plugin --profile web add file:/<解压目录>/dsh-plugin-manager

# 方式三：本地构建安装（克隆本仓库）
pnpm build   # tsc + tsdown，产出 lib/index.js（主机半）与 lib/client.js（浏览器半）
dsh plugin --profile web add file:./dsh-plugin-manager
```

> 装完**重启 DeepSeek Harness**，页面按一次 **Ctrl+F5**，打开 设置 → 插件 → 「插件管家」。
> 仓库已提交 lib/ 构建产物，GitHub 安装无需本地构建。

## 功能

| 功能 | 说明 |
|------|------|
| 📚 中文目录 | 130+ 内置条目（名称/说明/分类），未收录自动兜底、可自定义 |
| 🔘 一键启停 | 开关写入 `~/.dsh/cordis.patch.yml`（全局层），DSH 的 HMR 观察者约 1 秒内实时重应用；启用时写显式 `disabled: false` 可压过低层停用 |
| ✏️ 界面内备注 | 卡片上的「编辑备注」直接改中文名/说明（保存到 `~/.dsh/plugin-manager/catalog.json`），支持一键恢复默认 |
| 🛡️ 防呆保护 | 引导/传输/设置外壳等系统行不可停用；!!js 表达式控制的行标注「表达式控制」 |
| 🔍 搜索与分类 | 按名称/说明/模块名搜索，按分类过滤，统计启用数 |

## 工作原理

| 半侧 | 文件 | 职责 |
|------|------|------|
| 主机 | `lib/index.js` | 注册 `pluginManager` cordis 服务（Typert 远程）：`list` / `setEnabled` / `setOverride` / `removeOverride`。启停用手术式编辑补丁文件——保留注释与 !!js 表达式，写前重读合并并发编辑 |
| 主机 | `lib/typert.host.js` | 导出 `./typert`，由 typert-loader 注册为**严格调用定义**。关键修复：DSH 以 tsx 源码模式启动时，网关与外部插件可能各持一份 typert-protocol，装饰器标记跨实例不可见（症状：所有调用 404）；严格注册走共享注册表声明，绕开模块实例身份问题 |
| 浏览器 | `lib/client.js` | 经免注入通道 `ctx.get()` 挂载 `pluginManager` 远程命名空间（避开自挂载死锁），向 `settings.plugins.tab` 槽位注册「插件管家」标签页 |

> 运行依赖：`@deepseek-ai/cordis` 与 `@deepseek-ai/dsh-typert-protocol` 由 DSH 安装目录的 profiles/node_modules 回退链接提供，无需 pnpm 额外下载。

## 自定义备注

界面内点「编辑备注」即可；两个字段都清空再保存 = 移除该插件的自定义。高级用户也可直接编辑 `~/.dsh/plugin-manager/catalog.json`：

```json
{
  "@dsh-external/dsh-navbar": { "name": "对话导航条", "desc": "对话区右缘的消息节点导航" }
}
```

覆盖优先级：覆盖文件 > 内置目录 > 英文短名。

## 项目结构

```text
src/
  index.ts             主机半：PluginManagerGateway（list / setEnabled / setOverride / removeOverride）
  patch-file.ts        补丁文件手术式编辑（纯函数）
  catalog.ts           内置目录 + 系统保护集
  types.ts             两侧共享的纯数据类型
  typert-host.ts       严格端点注册工件（./typert）
  client/
    index.ts           浏览器半：挂载远程命名空间 + 注册标签页
    remote.ts          客户端远程工件（strict zod codec）
    PluginManagerTab.tsx  标签页 UI（列表/启停/备注编辑）
    locales.ts         中英文案
cordis.patch.yml       bundle 补丁（插入 plugin-manager 行）
lib/                   构建产物（已提交，GitHub 安装免构建）
tests/                 冒烟/端到端测试
```

## 测试

```bash
node tests/patch-file.smoke.mjs   # 补丁编辑器 9 项冒烟测试
node tests/host-gateway.e2e.mjs   # 主机网关端到端（含覆盖文件落盘校验）
node tests/claims.e2e.mjs         # 端点声明验证（普通与 tsx 源码启动模式均适用）
```

> 测试脚本内的绝对路径指向本机 DSH 安装目录（仅开发环境使用，不影响运行时行为）。

## 注意事项

- 停用浏览器端插件（ui-* / client-*）后，刷新页面才会完全卸载；
- 手工编辑补丁文件时请保留行块结构（列 0 的 - 开头）；
- 卸载：`dsh plugin --profile web remove @dsh-external/dsh-plugin-manager`。

---

## Star History

<a href="https://www.star-history.com/?repos=2768651338%2Fdsh-plugin-manager&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&legend=top-left" />
  </picture>
</a>

---

<div align="center">

MIT License © [2768651338](https://github.com/2768651338)

基于 DeepSeek Harness 公开插件机制开发，与 DeepSeek 官方无隶属关系。

</div>
