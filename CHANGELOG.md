# Changelog

All notable changes to dsh-plugin-manager are documented here.

## [0.7.0] — 2026-10-01

- **Adapt to DSH 0.2.0** (verified against the `0.2.0-rc.2` package set) while
  keeping 0.1.x hosts working — the e2e suite passes against **both**
  `0.2.0-rc.2` and `0.1.5-rc.3`:
  - **Dual-form strict codecs.** DSH 0.2.0 changed typert codec validation from
    reading a zod instance (`schema` field, `"_zod" in schema`) to a `create()`
    factory (checked by the 0.2.0 typert-loader and registry at registration).
    0.1.x still requires the zod instance, so a single-form artifact breaks one
    generation either way. Both artifacts (`src/typert-host.ts`,
    `src/client/remote.ts`) now emit objects carrying **both** `schema` (zod
    instance, for 0.1.x) and `create: () => schema` (factory, for 0.2.0); each
    generation's validator reads only the field it knows.
  - **Search icon inlined.** 0.2.0 `dsh-client-ui-primitives` removed the
    generic icon family (`IconSearchOutline16` gone), and the icon package is
    not in the shell's frozen module table, so it cannot be externalized — the
    tab now carries a small inline SVG search icon. This also drops the plugin's
    only runtime import from `ui-primitives`.
  - **Peer ranges widen** to `>=0.1.0-rc.0 || >=0.1.5-rc.0 || >=0.2.0-rc.0`:
    semver prerelease rules mean `0.2.0-rc.2` does **not** satisfy
    `>=0.1.5-rc.0` (different version tuple), so the old range would warn
    falsely on 0.2.0 installs (same class of issue as 0.4.1; verified with the
    real `semver` package).
  - **Hot-reload still works on 0.2.0** — app-boot's `watchUserPatches` was
    removed, but the new `dsh-hmr` service (mounted by the `dsh-base` bundle in
    profile contexts) watches `$DSH_HOME/cordis.patch.yml` plus the profile
    patch files and reconciles the patch stack on change. No UI copy changes.
  - **Catalog synced with the 0.2.0 rows** (sourced from the `dsh-base` /
    `dsh-web-app` bundle patches and each package's own description): `dsh-hmr`,
    `dsh-settings`, the DeepSeek LLM split (`llm-deepseek-api-key` /
    `-account` / `-account-platform`), `ptc-runtime-node`, `workflow-ptc`,
    `compaction-image-offload`, `web-fetch-http`, `mcp-resources`, the official
    plugin manager rows, and more (+27 entries). `dsh-hmr` and `dsh-settings`
    join the system-protection set (0.1.x names kept).
  - Dev environment pinned at `0.2.0-rc.2` (`cordis` 4.0.4,
    `cordis-plugin-loader` 1.0.5 — 0.2.0 requires the `~4.0.4`/`~1.0.5` line;
    do not mix with the 0.1.5 pins).
  - **DSH 0.2.0 coexistence note:** the `dsh-base` bundle now ships an official
    plugin manager (`@deepseek-ai/dsh-plugin-manager`, row id `plugin-manager`).
    This plugin's bundle patch inserts the same row id and the later bundle
    layer wins, so installing this plugin replaces the official host row; the
    official sidebar panel is a separate surface and may coexist.
- Browser-half live check on a real running DSH 0.2.0 remains a manual step
  (restart DSH Desktop, Ctrl+F5, open the Plugin Manager tab).
- **Package renamed to `@txc2768651338/dsh-plugin-manager` and first npm
  publish** — an npm scope must match the publishing account, and
  `2768651338` is not an npm account the author controls, so the
  owner-controlled scope follows the npm username. The cordis row `name`,
  typert invocation/codec ids, and the self-protection entry move with it;
  existing GitHub installs pick the renamed row up on the next
  `dsh plugin --profile web update`. GitHub installs keep working unchanged;
  the npm package makes the plugin installable from the 1024 Store
  (`dsh1024 plugin --profile web add @txc2768651338/dsh-plugin-manager`).

## [0.6.0] — 2026-10-01

- **Adapt to DSH 0.1.5** (verified against the `0.1.5-rc.3` package set):
  - The client-half `ClientContext` type now comes from `@deepseek-ai/cordis`
    (`Context`) — `@deepseek-ai/dsh-client-runtime` was removed upstream in
    0.1.5, and its `ctx.slots` typing moved to
    `@deepseek-ai/dsh-client-ui-renderer/client`. Type-only change; the
    runtime mount/toggle/notes flows are unchanged.
  - `platform.ts` mirrors 0.1.5's frozen module table (`dsh-client-store` and
    `dsh-client-ui-dockkit` in; `dsh-client-web-react`, `dsh-client-ui-attachment`,
    `dsh-client-schema-form` out).
  - Peer ranges for `@deepseek-ai/dsh-typert-protocol` and
    `@deepseek-ai/dsh-client-ui-primitives` widen to
    `>=0.1.0-rc.0 || >=0.1.5-rc.0` so pnpm accepts the prerelease `0.1.5-rc.x`
    line without a false "peer range does not match" warning.
- **Rename the client locale namespace** `settings.pluginManager` → `settings.dshPluginManager`.
  The bundled plugin manager inside `@linxin666/dsh-web-ui-all` (`@linxin666/dsh-client-ui-plugin-manager`)
  registers the same namespace first, so our `locale.register` threw
  `locale namespace "settings.pluginManager" already has locale "zh"` and the whole client apply failed
  ("Failed to load plugins"). A plugin-prefixed namespace can no longer collide.
- **Hermetic development/test environment**: the host-side DSH packages
  (`dsh-app-boot`, `dsh-typert-*`, `dsh-api-gateway`, `dsh-api-remotes`,
  client type packages, `cordis`/`cordis-plugin-loader`) are now pinned
  devDependencies at the DSH 0.1.5-rc.3 versions, and the e2e tests resolve
  the plugin/registry/gateway entries through `import.meta.resolve` instead of
  machine-specific absolute install paths. `pnpm test` now runs on any
  machine with no local DSH installation.

## [0.5.0] — 2026-08-17

- Add **backup / restore**: export notes (catalog.json overrides) and the plugin list
  (profile `dependencies` + `dsh.profile.bundles`) plus the global enable/disable patch
  into a single readable JSON file, and import it back on another machine.
- Restore merges rather than replaces: incoming entries override current ones while
  entries you already have are kept, and the enable/disable patch is applied row-by-row.
- After a restore the tab shows the exact `dsh plugin --profile <name> install` command
  to materialize the restored plugin list, plus a restart reminder.
## [0.4.1] — 2026-08-17

- Fix peer ranges for `@deepseek-ai/dsh-typert-protocol` and `@deepseek-ai/dsh-client-ui-primitives`:
  `*` → `>=0.1.0-rc.0`. DSH ships these as prerelease `0.1.0-rc.6`, and semver `*` does not match
  prereleases, so pnpm printed a false "peer range does not match resolved" warning on install.
- Document the peer-warning workaround in the Troubleshooting sections (EN/ZH).

## [0.4.0] — 2026-08-14

- **Rename to the owner-controlled scope** `@2768651338/dsh-plugin-manager` (previously `@dsh-external/*`, which was not authorized).
- Restore full runtime peer declarations (`react`, `ui-primitives`) after the rename sync.
- Add **English README** as the main document; Chinese moved to `docs/lang/README_ZH.md`.
- Add **multilingual READMEs** (ES/JA/DE/RU/PT/KO) under `docs/lang/`.
- Replace the schematic preview with the **real Plugin Manager screenshot**.
- Restyle the READMEs: badges, pain-point table, feature table, changelog, star history.
- Compliance pass: Compatibility / Quick Start / Configuration / Permissions & Data / Troubleshooting sections.

## [0.3.0] — 2026-08-14

- Initial public release: the Plugin Manager tab in **Settings → Plugins** — Chinese catalog,
  one-click enable/disable, in-UI notes editing, and search/filter over the installed plugins.
