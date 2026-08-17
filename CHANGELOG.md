# Changelog

All notable changes to dsh-plugin-manager are documented here.

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
