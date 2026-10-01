# Changelog

All notable changes to dsh-plugin-manager are documented here.

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
