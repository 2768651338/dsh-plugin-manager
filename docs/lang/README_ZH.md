<!-- 中文文档。English README: ../README.md -->
<div align="center">

# dsh-plugin-manager（插件管家）

> **让每个插件都自报家门** —— 中文名、一句话说明、一键启停，还有界面内的备注编辑，一站式管理 DeepSeek Harness 的所有插件。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![version](https://img.shields.io/badge/version-v0.4.0-success.svg)](https://github.com/2768651338/dsh-plugin-manager/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-7B68EE.svg)](https://github.com/topics/dsh-plugin)

<br>

<img src="../assets/preview.png" alt="插件管家标签页 — 实际截图" width="720">

**设置 → 插件 → 插件管家** · 165 个插件全部有中文说明，一键启停，备注就地编辑。

<br>

[概述](#概述) · [兼容性](#兼容性) · [安装与卸载](#安装与卸载) · [快速上手](#快速上手) · [配置](#配置) · [权限与数据](#权限与数据) · [功能](#功能) · [故障排查](#故障排查) · [开发](#开发)

[**English**](../README.md) · [**Español**](README_ES.md) · [**日本語**](README_JA.md) · [**Deutsch**](README_DE.md) · [**Русский**](README_RU.md) · [**Português**](README_PT.md) · [**한국어**](README_KO.md)

</div>

---

> 🆕 **2026-08-14 · v0.3.0** — 界面内备注编辑上线：点卡片上的「编辑备注」就能改名、改写说明，不用再碰 catalog.json 配置文件。
>
> 🏷️ **v0.4.0** — 包名改用自有命名空间：@2768651338/dsh-plugin-manager（原 @dsh-external/* 无维护权限，已按要求更换）。
>
> 🔧 **v0.2.x** — 修复 tsx 源码启动模式下的端点 404（./typert 严格注册）与 cordis 注入访问问题（ctx.get 通道）。

---

## 概述

**解决什么问题**：DSH 内置「插件列表」只有英文模块名、没有说明，插件装多了不知道各自是做什么的；启停只能手工编辑 cordis.patch.yml，容易改错。

**适合谁**：所有 DeepSeek Harness 用户，尤其是安装了大量插件、想搞清楚每个插件用途并安全启停的人。

| 痛点 | 之前 | 用了插件管家之后 |
|------|------|------------------|
| 插件列表看不懂 | 只有英文模块名，不知道每个插件是干嘛的 | 每个插件都有中文名 + 一句话说明 + 分类 |
| 启停全靠手改配置 | 手工编辑 cordis.patch.yml，一改就错 | 一键开关，行级手术式编辑，约 1 秒热生效 |
| 没收录的插件永远神秘 | 只有兜底文案 | 界面里直接补说明 |
| 手滑就出事 | 任何行都能被停用 | 系统行锁定，!!js 表达式行标注禁改 |

## 兼容性

| 项目 | 说明 |
|------|------|
| DSH 版本 | **0.1.0-rc.5**（官方安装包，resources/harness 内置源码树） |
| 验证时间 | **2026-08-14**，web profile，Windows |
| 安装机制 | `dsh plugin --profile web add`（bundle 补丁 + 双面行） |
| 依赖的内置行 | dsh-base + dsh-web-app 自带的 typert-loader / api-gateway / client-modules |

> 官方启动器以 tsx 源码模式启动；本插件的 ./typert 严格注册专门兼容普通 node 与 tsx 源码两种启动模式（tests/claims.e2e.mjs 覆盖）。如果你使用其它 DSH 版本，请先跑一遍测试再报问题。

## 安装与卸载

```bash
# 安装（推荐，与 dsh-navbar 相同的 bundle 机制）
dsh plugin --profile web add github:2768651338/dsh-plugin-manager#main

# 备选：从 zip 包安装（下载 Release 里的 zip），解压到无空格路径后：
dsh plugin --profile web add file:/<解压目录>/dsh-plugin-manager

# 备选：本地构建安装（克隆本仓库）
pnpm build   # tsc + tsdown，产出 lib/index.js（主机半）与 lib/client.js（浏览器半）
dsh plugin --profile web add file:./dsh-plugin-manager
```

> 装完**重启 DeepSeek Harness**，页面按一次 **Ctrl+F5**，打开 设置 → 插件 → 「插件管家」。仓库已提交 lib/ 构建产物，GitHub 安装无需本地构建。

| 操作 | 命令 |
|------|------|
| 升级 | `dsh plugin --profile web update`（或重新执行 add 命令），然后重启 DSH |
| 临时禁用 | 在插件管家自己的卡片上点「停用」——行仍在，随时可重新启用 |
| 彻底移除 | `dsh plugin --profile web remove @2768651338/dsh-plugin-manager`，若补丁文件中有它写入的行块则一并删除 |

## 快速上手

最小可复现流程（约 2 分钟）：

```bash
# 1. 安装
dsh plugin --profile web add github:2768651338/dsh-plugin-manager#main
# 2. 重启 DeepSeek Harness，网页按一次 Ctrl+F5
```

3. 打开 **设置 → 插件 → 插件管家** —— 看到带中文名和说明的完整目录。
4. 启停一个插件：搜索 `trajectory`，在「轨迹视图」卡片点「停用」→ 约 1 秒后变为「已停用」（主机侧即时生效；浏览器端插件刷新页面后完全卸载）。
5. 备注一个插件：点「联网搜索」卡片的「编辑备注」，改名并补充说明，点「保存」→ 卡片立即更新；「恢复默认」可还原。

## 配置

| 项目 | 说明 |
|------|------|
| 插件级配置项 | 无 —— 开箱即用，无需任何配置 |
| 启停补丁文件 | `~/.dsh/cordis.patch.yml`（全局层，DSH 实时热加载） |
| 备注覆盖文件 | `~/.dsh/plugin-manager/catalog.json`（首次保存时自动创建） |
| 环境变量 | 无自有环境变量；文件位置遵循 DSH 的 `DSH_HOME` 约定 |
| 默认值 | 未收录插件：内置目录 → 英文短名 → 兜底文案 |
| 敏感项 | 无 —— 不读取、不存储任何密钥/token/凭据 |

## 权限与数据

| 范围 | 涉及内容 |
|------|----------|
| 读取文件 | `cordis.patch.yml`、`plugin-manager/catalog.json`、进程内插件清单，以及 profile 的 `package.json`（备份） |
| 写入文件 | 仅 DSH 目录内的 `~/.dsh/cordis.patch.yml`（启停行）、`~/.dsh/plugin-manager/catalog.json`（备注）与 profile 的 `package.json`（恢复） |
| 网络 | 无外网访问；浏览器半仅与本地 DSH 的 `/api` RPC 端点通信 |
| 凭据 | 从不读取 |
| 用户数据 | 从不读取（不接触会话、消息、提示词） |

## 功能

| 功能 | 说明 |
|------|------|
| 📚 中文目录 | 130+ 内置条目（名称/说明/分类），未收录自动兜底、可自定义 |
| 🔘 一键启停 | 开关写入 `~/.dsh/cordis.patch.yml`（全局层），DSH 的 HMR 观察者约 1 秒内实时重应用；启用时写显式 `disabled: false` 可压过低层停用 |
| ✏️ 界面内备注 | 卡片上的「编辑备注」直接改中文名/说明（保存到 `~/.dsh/plugin-manager/catalog.json`），支持一键恢复默认 |
| 🛡️ 防呆保护 | 引导/传输/设置外壳等系统行不可停用；!!js 表达式控制的行标注「表达式控制」 |
| 🔍 搜索与分类 | 按名称/说明/模块名搜索，按分类过滤，统计启用数 |
| 💾 备份与恢复 | 把备注 + 插件清单（profile 依赖/bundles）+ 启停补丁导出为单个 JSON；导入采用合并（不删除已有条目），并给出精确的重装命令 |

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

## 故障排查

| 症状 | 处理 |
|------|------|
| 标签页不出现 | 重启 DeepSeek Harness，再 Ctrl+F5 刷新页面（客户端包在启动时装载） |
| 「暂时无法读取插件」且带错误代码块 | 看灰色错误详情：`pluginManager.list failed: ...` / `transport failure ...`，按下面条目对号入座 |
| 错误含 **404** 或 `invocation-unavailable` | 安装版本低于 0.2.0（缺少 ./typert 严格注册）——更新并重启 |
| `cannot get property "remote.pluginManager" without inject` | 版本低于 0.2.2 —— 更新后刷新页面 |
| 开关点了没反应 | 检查 `~/.dsh/cordis.patch.yml` 是否保持行块结构（列 0 的 - 开头）；标注「表达式控制」的行由 !!js 表达式决定，需直接改配置文件 |
| pnpm 报 `peer range @deepseek-ai/*@* does not match resolved 0.1.0-rc.6` | 无害——DSH 以 prerelease `0.1.0-rc.6` 发布这些包，semver `*` 不匹配 prerelease。v0.4.1+ 已声明 `>=0.1.0-rc.0`；其它插件可在 `pnpm-workspace.yaml` 加 `peerDependencyRules.allowAny: ['@deepseek-ai/*']` |
| 日志在哪里 | 主机错误看 DSH 启动日志（启动器控制台）；客户端错误看浏览器 F12 控制台 |
| 回滚 | 删除补丁文件中插件管家写入的行块；备注点「恢复默认」；或按上面的 remove 命令卸载 |

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

## 开发

```bash
pnpm build                      # tsc + tsdown
node tests/patch-file.smoke.mjs # 补丁编辑器 9 项冒烟测试
node tests/host-gateway.e2e.mjs # 主机网关端到端（含覆盖文件落盘校验）
node tests/claims.e2e.mjs       # 端点声明验证（普通与 tsx 源码启动模式均适用）
```

> 测试脚本内的绝对路径指向本机 DSH 安装目录（仅开发环境使用，不影响运行时行为）。

**贡献**：Fork → 修改 → `pnpm build` → 跑上面的测试 → 向 main 分支提 PR。文档、目录条目、翻译等小型修复无需提前沟通。报 issue 时请附 DSH 版本和标签页里显示的完整错误详情。

## 许可证与安全

**许可证**：MIT —— 见 [LICENSE](../../LICENSE)。基于 DeepSeek Harness 公开插件机制开发，与 DeepSeek 官方无隶属关系。

**安全**：本插件不读取任何凭据、不访问外网。发现安全问题请使用 GitHub 仓库 [Security 标签页](../../security) 的 **Report a vulnerability** 私下报告，不要公开发布漏洞细节。

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

</div>
