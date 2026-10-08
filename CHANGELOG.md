# Changelog

All notable changes to dsh-plugin-manager are documented here.

## [0.8.0] — 2026-10-09

Origin filtering and source badges from [issue #1](https://github.com/2768651338/dsh-plugin-manager/issues/1).

- **Origin filter with "installed" as the default view (issue #1).** The tab now
  has an origin dropdown next to the category one: All / Installed / Built-in /
  Community. It defaults to **Installed** so the user's own plugins are visible
  immediately instead of drowning in ~170 built-in rows; the choice is persisted
  in localStorage and restored on the next visit. If that view is empty, an
  inline "Show all {count} plugins" button offers a one-click way back.
- **Source badges derived from two signals (issue #1).** Each snapshot entry now
  carries `declared` (the module appears in the profile's `package.json`
  dependencies — the user-installed signal, including `file:` specs) and
  `official` (an `@deepseek-ai/*` or `@cordis/*` module). Cards show a
  Built-in / Official / Community badge accordingly; `file:` rows keep their
  existing Local badge. A module installed by the user is classified as
  Installed regardless of who maintains it — the four labels requested in the
  issue overlap, so "official but extra-install" plugins are not split out as a
  separate class (they are indistinguishable from built-ins in the loader tree);
  the Official badge still identifies them.
- **Graceful degradation for stale clients (issue #1).** Snapshots from an old
  host build carry no origin fields; the tab then falls back to the All view
  instead of misclassifying every row as community. The derivation helpers live
  in a new pure module `src/origin.ts` (`tests/origin.smoke.mjs`) with the
  filter/badge logic in `src/client/util.ts` (covered by
  `tests/client-util.smoke.mjs`) and end-to-end assertions in
  `tests/host-gateway.e2e.mjs`.
- **`external` category retired.** With attribution now carried by the origin
  signal alone, keeping a second "third-party" axis in the category list was
  redundant: the last entry using it (`@dsh-external/dsh-navbar`) moved to
  `ui`, the value is gone from `PluginCategory` / `CATEGORY_LABELS`, and the
  category axis is purely functional. Client-side rendering of unknown
  categories already falls back to the raw key, so override files (which never
  carried categories) are unaffected.

P2 fixes from the 2026-10-01 evaluation ([`docs/evaluation-2026-10-01.md`](docs/evaluation-2026-10-01.md)).

- **Bilingual catalog (P2-9).** All 195 built-in entries gained English
  `nameEn` / `descEn` fields. In an English UI the tab shows English names and
  descriptions — when an entry has no English text it falls back to the module
  short name + an English placeholder note instead of Chinese, so English users
  no longer see mixed Chinese content. User-written overrides apply in both
  languages (user data wins). Search now matches both languages.
- **Category labels ship with the snapshot (P2-7).** `list()` now carries
  `categoryLabels` (zh/en per category) so the catalog owns its naming in one
  place; the tab's duplicated label map is gone.
- **Server-side input limits (P2-8).** `setOverride` / `removeOverride` enforce
  module-name ≤ 200, name ≤ 200 and description ≤ 1000 characters with a clear
  `invalid-input` message — the client's `maxLength` is only politeness, the
  server limit is the limit (the backup `json` 2MB cap and change-based restore
  counting landed earlier with P0-3/P1-3).
- **`file:`-installed rows show a readable name (P2-5).** Modules loaded from a
  `file://` URL collapse to the basename without extension (e.g. `noop`) instead
  of the full path, and carry a "Local" badge on the card.
- **Toggle refresh polls instead of gambling (P2-1).** After a toggle the tab
  refreshes on a 300 ms / 900 ms / 2000 ms ladder until the row's `enabled`
  matches the request and the fiber phase settles — three refreshes max, stop on
  hit, no infinite retry. This replaces the single fixed 900 ms refresh.
- **"Nothing to change" is its own message (P2-6).** Re-importing a backup whose
  content is already in place now reports the no-change wording instead of
  "Restored: 0 notes, 0 deps, 0 plugins, 0 rows".
- **Shared schema source for both typert artifacts (P2-2).** `remote.ts` and
  `typert-host.ts` import their zod schemas and `strictCodec` from a new
  `src/schemas.ts`, removing the ~90-line duplicated block that had to be edited
  in two places (and could drift). Descriptor shapes stay generator-aligned.
- **Browser-half pure functions under test (P2-4).** `format` / `dateStamp` /
  `matches` / `fiberPhaseSettled` moved to `src/client/util.ts` with a new
  `tests/client-util.smoke.mjs` (same zero-dependency style as the other smokes).
- **ESLint + CI (P2-3).** Flat-config `eslint` + `typescript-eslint` (lenient,
  defect-oriented rules) with `pnpm lint`, and a GitHub Actions workflow running
  lint + typecheck + build + test on node 22/24 for every push and PR
  (node 20 is below tsdown 0.22's floor, so the matrix starts at 22).

P0 hardening from the 2026-10-01 evaluation ([`docs/evaluation-2026-10-01.md`](docs/evaluation-2026-10-01.md)).

- **Atomic writes everywhere + automatic patch backups (P0-1).** All three
  write sites (`cordis.patch.yml`, `catalog.json`, the profile `package.json`)
  now go through temp-file + `rename` (temp file is fsynced first). On Windows,
  when the target is briefly locked (editor/antivirus), the rename retries and
  finally degrades to a plain overwrite instead of failing the toggle. Before
  the first patch-file write of each day, a timestamped `cordis.patch.yml.<stamp>.bak`
  copy is created automatically (newest 5 kept, older ones pruned).
- **YAML re-validation before every patch write (P0-2).** The hand-rolled line
  editor's output is now parsed with a real YAML parser before hitting disk;
  invalid content is refused with a readable error. The parser runs a custom
  safe schema that accepts `!!js/*` tags as opaque scalars — expressions are
  **never** evaluated during validation. Two silent-corruption paths are also
  closed: a target row whose `id` is not the block's first key (multi-line
  hand-written form) is now rejected as `unrecognized` instead of appending a
  duplicate row that would never take effect, and inline comments
  (`disabled: true # note`) survive rewrites instead of being destroyed.
- **Backup import no longer trusts arbitrary dependency specs (P0-3).**
  `importBackup` is now two-phase: called with `allowNonRegistrySpecs = null`
  it only parses/audits and — if the backup contains non-registry specs
  (`git:`, `file:`, `npm:` aliases, `workspace:`, URLs/tarballs, scp paths,
  GitHub shorthand `user/repo#ref`, local paths) — returns
  `confirmation-required` with the itemized list **without writing anything**.
  The UI shows a per-item checklist (unchecked entries are skipped and reported
  via `detail.nonRegistrySkipped`); registry-style specs (semver/ranges/dist-tags)
  still import in a single call. The `json` argument is capped at 2MB.
- `js-yaml` moved from devDependencies to **runtime dependencies** (the host
  profile resolves it from the plugin's own `node_modules`); `@types/js-yaml`
  added for development.
- New smoke tests (`patch-yaml`, `fs-safe`) and extended `patch-file`/`backup`
  smokes plus e2e coverage for the rejection paths and the two-phase import.

P1 fixes from the same evaluation.

- **One global write queue (P1-1).** Toggle, notes editing, backup import and
  the corrupt-file rescue now share a single serialized write queue. The three
  previously independent queues did not know about each other, so concurrent
  operations touching the same file (e.g. a toggle landing mid-import) could
  overwrite each other and silently drop updates.
- **Broken override files are reported, not swallowed (P1-2).** When
  `catalog.json` exists but cannot be read or parsed, `list()` carries an
  `overridesWarning` and the tab shows a banner explaining that the custom
  notes are still on disk (nothing was deleted) — with a one-click
  **rename the broken file aside** rescue
  (`catalog.json.corrupt-<timestamp>.json`) so the tab recovers immediately.
- **Backup import previews before writing (P1-3).** New `previewBackup`
  endpoint diffs a backup against the current state — notes to add/overwrite,
  dependencies to add/update, bundles to append, toggle rows to flip — without
  touching any file. The tab renders this as a review panel (the non-registry
  dependency checklist from P0-3 is merged into it) and only calls
  `importBackup` after confirmation. Preview and import share the same row
  merge function, so the review matches what actually gets written, and
  restore counters now only count real changes (identical entries no longer
  inflate the "restored N notes" message).
- **Toggles that did not take effect are explained (P1-4).** After a toggle,
  the client reconciles the refreshed snapshot against the request (with one
  extra re-check for slow HMR before concluding). If the state still
  contradicts the request, the card message explains the row may also be
  controlled by a profile-layer patch or another config layer and points at
  the global patch file — instead of a generic "click refresh" hint.
- **Runtime detection of official-manager coexistence (P1-5).** `list()`
  flags the snapshot with `compatibilityWarning` when the official
  `@deepseek-ai/dsh-plugin-manager` host row is still loaded alongside this
  plugin (i.e. the bundle-patch takeover did not happen as expected); the tab
  shows a compatibility banner instead of failing silently.
- **Undo for disable (P1-6).** Disabling a plugin now opens a 9-second
  in-card **Undo** window instead of an instant no-confirm change; undo
  re-invokes `setEnabled` and the copy makes clear it restores the
  configuration (the hot reload still applies).
- **Security model documented (P1-7).** The README gains a "Security model"
  paragraph: the plugin ships no authentication of its own, reachability of
  the write operations is decided by DSH's trust barrier, and the web server
  must not be exposed on non-loopback addresses in untrusted networks. The
  tab footer shows a matching security hint line; all language READMEs note
  the same.
- Tests: backup smoke now 14 groups (preview diff, row merge incl. expression/
  unrecognized/no-op handling, change-based override counting); host-gateway
  e2e covers the new snapshot warning fields, the quarantine rescue, and
  preview→confirm→import consistency (no writes during preview).

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
