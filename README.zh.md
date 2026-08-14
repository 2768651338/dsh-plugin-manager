# dsh-plugin-manager（插件管家）

DeepSeek Harness 的图形化插件管理插件：在 **设置 → 插件** 里新增「插件管家」标签页，用中文名和说明展示每个插件是做什么的，并提供一键启停开关与内置备注编辑——启停写入全局层补丁并实时热生效，备注保存到本地覆盖文件长期生效。

![插件管家标签页 — 实际截图](assets/preview.png)

## 为什么需要它

- 内置「插件列表」只有英文模块名、没有说明，插件装多了不知道各自是做什么的；
- 启停只能手工编辑 cordis.patch.yml，容易改错——本插件用行级手术式编辑，保留注释与 !!js 表达式，只动目标行的 disabled 字段；
- 内置 165 行中文目录（名称 + 一句话说明 + 分类），未收录插件可一键补齐说明；
- 备注直接在界面里改（名称/说明），无需再碰配置文件。

## 安装

```bash
# 方式一：从 GitHub 安装（推荐，与 dsh-navbar 相同的 bundle 机制）
dsh plugin --profile web add github:2768651338/dsh-plugin-manager#main

# 方式二：从 zip 包安装（下载 Release 或本仓库的 dsh-plugin-manager-*.zip）
# 解压到无空格路径后：
dsh plugin --profile web add file:/<解压目录>/dsh-plugin-manager

# 方式三：本地构建安装（克隆本仓库）
pnpm build   # tsc + tsdown，产出 lib/index.js（主机半）与 lib/client.js（浏览器半）
dsh plugin --profile web add file:./dsh-plugin-manager
```

安装后**重启 DeepSeek Harness**，打开 设置 → 插件 → 「插件管家」。仓库已提交 lib/ 构建产物，GitHub 安装无需本地构建。

## 功能

- **中文目录**：130+ 内置条目（名称/说明/分类），未收录插件自动兜底显示并可自定义；
- **一键启停**：开关写入 ~/.dsh/cordis.patch.yml（全局层），DSH 的 HMR 观察者实时重应用，约 1 秒生效；启用时写显式 disabled: false 可压过低层停用；
- **备注编辑**：卡片上的「编辑备注」直接修改中文名/说明（保存在 ~/.dsh/plugin-manager/catalog.json），支持一键恢复默认；
- **系统保护**：引导/传输/设置外壳等系统行不允许停用；!!js 表达式控制的行标注「表达式控制」，防止误操作；
- **搜索与分类**：按名称/说明/模块名搜索，按分类过滤，统计启用数。

## 工作原理

- **主机半**（lib/index.js）：注册 cordis 服务 pluginManager（Typert 远程服务），提供 list / setEnabled / setOverride / removeOverride；启停采用补丁文件手术式编辑（保留注释与表达式，写前重读合并并发编辑）；
- **严格端点注册**（lib/typert.host.js）：通过 exports["./typert"] 交由 typert-loader 注册严格调用定义——这是关键：DSH 以 tsx 源码模式启动时，网关与外部插件可能持有两份 typert-protocol 实例，装饰器标记互不可见（表现为 404）；严格注册走注册表声明，绕开模块实例身份问题；
- **浏览器半**（lib/client.js）：挂载 pluginManager 远程命名空间（经免注入通道 ctx.get() 访问，避免自挂载死锁），向 settings.plugins.tab 槽位注册「插件管家」标签页；
- **运行依赖**：对等依赖 @deepseek-ai/cordis 与 @deepseek-ai/dsh-typert-protocol 由 DSH 安装目录的 profiles/node_modules 回退链接提供，无需 pnpm 额外下载。

## 自定义备注

界面内点「编辑备注」即可；两个字段都清空再保存 = 移除该插件的自定义。高级用户也可直接编辑 ~/.dsh/plugin-manager/catalog.json：

```json
{
  "@dsh-external/dsh-navbar": { "name": "对话导航条", "desc": "对话区右缘的消息节点导航" }
}
```

覆盖优先级：覆盖文件 > 内置目录 > 英文短名。

## 目录结构

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
- 卸载：dsh plugin --profile web remove @dsh-external/dsh-plugin-manager。

## 许可证与声明

MIT License（见 LICENSE）。本插件基于 DeepSeek Harness 的公开插件机制开发，与 DeepSeek 官方无隶属关系，不包含官方私有代码。
