<!-- English version. 中文文档见 README.zh.md -->
<div align="center">

# dsh-plugin-manager

> **Every plugin finally speaks for itself** — Chinese names, plain-language descriptions, one-click enable/disable, and in-UI notes editing for DeepSeek Harness.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![version](https://img.shields.io/badge/version-v0.3.0-success.svg)](https://github.com/2768651338/dsh-plugin-manager/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-7B68EE.svg)](https://github.com/topics/dsh-plugin)

<br>

<img src="assets/preview.png" alt="Plugin Manager tab — real screenshot" width="720">

**Settings → Plugins → Plugin Manager** · 165 plugins cataloged, one click to toggle, notes edited in place.

<br>

[Why](#why-it-exists) · [Install](#install) · [Features](#features) · [How It Works](#how-it-works) · [Custom Notes](#custom-notes) · [Tests](#tests)

[**中文**](docs/lang/README_ZH.md) · [**Español**](docs/lang/README_ES.md) · [**日本語**](docs/lang/README_JA.md) · [**Deutsch**](docs/lang/README_DE.md) · [**Русский**](docs/lang/README_RU.md) · [**Português**](docs/lang/README_PT.md) · [**한국어**](docs/lang/README_KO.md)

</div>

---

> 🆕 **2026-08-14 · v0.3.0** — In-UI notes editing is live: click **Edit notes** on any card to rename a plugin or rewrite its description in place. No more hand-editing `catalog.json`.
>
> 🔧 **v0.2.x** — Fixed endpoint 404 under tsx source launch (strict `./typert` registration) and the cordis inject access (`ctx.get` channel).

---

## Why it exists

| Pain | Before | With this plugin |
|------|--------|------------------|
| Plugin list is meaningless | English module names only, no clue what each row does | Chinese name + one-line description + category for every plugin |
| Toggling is manual | Hand-edit `cordis.patch.yml` (easy to break) | One-click switch, surgical line-level edits, hot-reloaded in ~1s |
| Unknown plugins stay mysterious | Fallback text only | Add your own notes directly in the UI |
| Nothing is safe from fat fingers | Any row can be disabled | System rows locked, `!!js`-controlled rows labeled |

## Install

```bash
# Option 1: install from GitHub (recommended, same bundle mechanism as dsh-navbar)
dsh plugin --profile web add github:2768651338/dsh-plugin-manager#main

# Option 2: install from a zip (download from the Release page)
# unzip to a path without spaces, then:
dsh plugin --profile web add file:/<unzipped-dir>/dsh-plugin-manager

# Option 3: build locally (clone this repository)
pnpm build   # tsc + tsdown → lib/index.js (host half) and lib/client.js (browser half)
dsh plugin --profile web add file:./dsh-plugin-manager
```

> Then **restart DeepSeek Harness** and press **Ctrl+F5** once. Open *Settings → Plugins → Plugin Manager*.
> The `lib/` artifacts are committed, so GitHub installs need no local build.

## Features

| Feature | Description |
|---------|-------------|
| 📚 Chinese catalog | 130+ built-in entries (name / description / category), fallback + per-plugin customization |
| 🔘 One-click toggle | Writes `~/.dsh/cordis.patch.yml` (global layer); DSH's HMR watcher re-applies within ~1 second; enabling writes an explicit `disabled: false` that overrides lower layers |
| ✏️ In-UI notes | "Edit notes" on each card edits the Chinese name/description (`~/.dsh/plugin-manager/catalog.json`), with one-click restore-to-default |
| 🛡️ Safety guards | Bootstrap/transport/settings-shell rows locked as "System"; `!!js`-expression rows labeled "Expression-controlled" |
| 🔍 Search & filter | Search by name/description/module, filter by category, enabled-count summary |

## How It Works

| Half | File | Role |
|------|------|------|
| Host | `lib/index.js` | Registers the `pluginManager` cordis service (Typert remote): `list` / `setEnabled` / `setOverride` / `removeOverride`. Toggles use surgical patch-file editing — comments and `!!js` expressions preserved, file re-read before write to merge concurrent edits. |
| Host | `lib/typert.host.js` | Exports `./typert`; the typert-loader registers it as **strict invocation definitions**. Crucial fix: under tsx source launch the gateway and an external plugin can hold two copies of typert-protocol — decorator markers are invisible across copies (symptom: every call 404s). Strict registration goes through the shared registry, sidestepping module-instance identity. |
| Browser | `lib/client.js` | Mounts the `pluginManager` remote namespace via the inject-free `ctx.get()` channel (avoids a self-mount deadlock) and registers the Plugin Manager tab in the `settings.plugins.tab` slot. |

> Runtime dependencies: `@deepseek-ai/cordis` and `@deepseek-ai/dsh-typert-protocol` resolve through DSH's `profiles/node_modules` fallback links — no extra pnpm downloads.

## Custom Notes

Click **Edit notes** on any card. Saving with both fields empty removes that plugin's customization. Power users may still edit `~/.dsh/plugin-manager/catalog.json` directly:

```json
{
  "@dsh-external/dsh-navbar": { "name": "对话导航条", "desc": "对话区右缘的消息节点导航" }
}
```

Precedence: override file > built-in catalog > English short name.

## Project Structure

```text
src/
  index.ts              host half: PluginManagerGateway (list / setEnabled / setOverride / removeOverride)
  patch-file.ts         surgical patch-file editor (pure functions)
  catalog.ts            built-in catalog + system-protection set
  types.ts              shared plain data types
  typert-host.ts        strict endpoint registration artifact (./typert)
  client/
    index.ts            browser half: mount remote namespace + register the tab
    remote.ts           client remote artifact (strict zod codecs)
    PluginManagerTab.tsx tab UI (list / toggles / notes editing)
    locales.ts          zh/en dictionaries
cordis.patch.yml        bundle patch (inserts the plugin-manager row)
lib/                    built artifacts (committed; GitHub installs skip building)
tests/                  smoke / end-to-end tests
```

## Tests

```bash
node tests/patch-file.smoke.mjs   # 9 smoke tests for the patch editor
node tests/host-gateway.e2e.mjs   # host gateway end-to-end (incl. override-file contents)
node tests/claims.e2e.mjs         # endpoint claims under plain-node and tsx source launch
```

> Absolute paths inside the test scripts point at the local DSH installation and are development-only; they do not affect runtime behavior.

## Notes

- Disabling browser-side plugins (ui-* / client-*) fully unloads them only after a page refresh;
- When hand-editing the patch file, keep the row-block structure (a `- ` dash at column 0);
- Uninstall: `dsh plugin --profile web remove @dsh-external/dsh-plugin-manager`.

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

Built on DeepSeek Harness's public plugin mechanism — not affiliated with DeepSeek.

</div>
