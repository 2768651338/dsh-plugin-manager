// 主机网关端到端测试：用真实 Loader 装载插件，直接调用 list/setEnabled。
// 使用临时 DSH_HOME，不触碰真实配置。
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert'
import { boot } from '@deepseek-ai/dsh-app-boot'

const tempHome = mkdtempSync(join(tmpdir(), 'dsh-pm-e2e-'))
process.env.DSH_HOME = tempHome
const configPath = join(tempHome, 'cordis.yml')
const pluginUrl = import.meta.resolve('@txc2768651338/dsh-plugin-manager')
writeFileSync(configPath, [
  '- id: plugin-manager',
  `  name: '${pluginUrl}'`,
  '',
].join('\n'))

try {
  // 用 app-boot 的 boot（Loader + include 树）
  const ctx = await boot('dsh-pm-test', configPath)

  const service = ctx.get('pluginManager')
  assert.ok(service, 'pluginManager service registered')
  console.log('all loader entries:', JSON.stringify([...ctx.loader.entries()].map(e => ({ id: e.id, name: e.options.name, group: !!e.options.group }))))

  // 1) list：应包含插件自身一行
  const snapshot = service.list()
  assert.strictEqual(snapshot.patchFile, join(tempHome, 'cordis.patch.yml'))
  assert.strictEqual(snapshot.overridesWarning, undefined, 'clean home has no overrides warning')
  assert.strictEqual(snapshot.compatibilityWarning, undefined, 'clean loader has no compat warning')
  const selfRow = snapshot.entries.find(e => e.entryId === 'include:plugin-manager')
  assert.ok(selfRow, 'self row present')
  // 测试用 file URL 装载，模块名非包名，因此 system 标记不匹配；保护由行 id 兜底。
  console.log('self row:', JSON.stringify({ displayName: selfRow.displayName, desc: selfRow.description, category: selfRow.category }))

  // 2) setEnabled 保护行（行 id 兜底）→ 拒绝
  const blocked = await service.setEnabled('include:plugin-manager', false)
  assert.strictEqual(blocked.accepted, false)
  assert.strictEqual(blocked.reason, 'system')
  console.log('protected toggle blocked:', JSON.stringify(blocked))

  // 3) 不存在的行 → not-found
  const missing = await service.setEnabled('no-such-row', false)
  assert.strictEqual(missing.reason, 'not-found')
  console.log('missing row rejected:', JSON.stringify(missing))

  // 4) 向组合里加一个可停用的行，验证真正的写盘
  writeFileSync(join(tempHome, 'noop.mjs'), 'export function apply() {}\n')
  await ctx.loader.create({ id: 'probe-row', name: pathToFileURL(join(tempHome, 'noop.mjs')).href })
  const patchPath = join(tempHome, 'cordis.patch.yml')
  const disable = await service.setEnabled('probe-row', false)
  assert.strictEqual(disable.accepted, true, 'disable accepted')
  assert.ok(existsSync(patchPath), 'patch file created')
  const content = readFileSync(patchPath, 'utf8')
  assert.ok(content.includes('- id: probe-row'), 'row written')
  assert.ok(content.includes('disabled: true'), 'disabled true written')
  console.log('patch after disable:', JSON.stringify(content))

  const enable = await service.setEnabled('probe-row', true)
  assert.strictEqual(enable.accepted, true)
  const content2 = readFileSync(patchPath, 'utf8')
  assert.ok(content2.includes('disabled: false'), 'disabled false written')
  console.log('patch after enable:', JSON.stringify(content2))

  // 5) 覆盖编辑：保存 → 文件内容；再移除 → 恢复
  const saved = await service.setOverride('@deepseek-ai/dsh-tool-bash', 'Bash 工具', '给模型用的 bash 命令工具')
  assert.strictEqual(saved.accepted, true)
  let overridesRaw = readFileSync(join(tempHome, 'plugin-manager', 'catalog.json'), 'utf8')
  let overrides = JSON.parse(overridesRaw)
  assert.deepStrictEqual(overrides['@deepseek-ai/dsh-tool-bash'], { name: 'Bash 工具', desc: '给模型用的 bash 命令工具' })
  console.log('overrides after save:', JSON.stringify(overrides))

  const cleared = await service.setOverride('@deepseek-ai/dsh-tool-bash', '', '')
  assert.strictEqual(cleared.accepted, true)
  overridesRaw = readFileSync(join(tempHome, 'plugin-manager', 'catalog.json'), 'utf8')
  overrides = JSON.parse(overridesRaw)
  assert.ok(!Object.prototype.hasOwnProperty.call(overrides, '@deepseek-ai/dsh-tool-bash'), '双空保存即移除覆盖')
  console.log('overrides after blank save:', JSON.stringify(overrides))

  const removed = await service.removeOverride('no-such-module')
  assert.strictEqual(removed.accepted, true)

  // 5b) P2-8：服务端输入长度上限（超限拒绝，恰好达限放行）
  const tooLongName = await service.setOverride('@x/long', '名'.repeat(201), '')
  assert.strictEqual(tooLongName.accepted, false)
  assert.strictEqual(tooLongName.reason, 'invalid-input')
  const tooLongDesc = await service.setOverride('@x/long', '', '述'.repeat(1001))
  assert.strictEqual(tooLongDesc.accepted, false)
  assert.strictEqual(tooLongDesc.reason, 'invalid-input')
  const okLen = await service.setOverride('@x/long', '名'.repeat(200), '述'.repeat(1000))
  assert.strictEqual(okLen.accepted, true, 'limits are inclusive: ' + JSON.stringify(okLen))
  await service.removeOverride('@x/long')
  console.log('P2-8 server-side length caps pass')

  // 6) 快照里 probe-row 的目录信息（未知模块 → 兜底）
  const snapshot2 = service.list()
  const probe = snapshot2.entries.find(e => e.entryId === 'probe-row')
  assert.ok(probe)
  assert.ok(probe.description.includes('暂无内置说明'))
  console.log('probe row display:', probe.displayName, '/', probe.description)

  // 6b) P2-5：file: 模块短名取 basename 去扩展名 + local 标记
  assert.strictEqual(probe.local, true, 'file: module flagged local')
  assert.strictEqual(probe.displayName, 'noop', 'file: display name is basename w/o ext, not the raw URL')
  assert.strictEqual(probe.displayNameEn, 'noop', 'file: EN display name matches short name')
  // 6c) P2-9：英文兜底说明（未知模块不显示中文说明）；P2-7：分类标签随快照下发
  assert.strictEqual(probe.descriptionEn, 'No built-in description yet. Add a custom note in the override file.')
  assert.deepStrictEqual(snapshot2.categoryLabels.core, { zh: '核心服务', en: 'Core services' })
  const catalogRow = snapshot2.entries.find(e => e.moduleName === '@deepseek-ai/dsh-client-ui-conversation')
  if (catalogRow) {
    assert.strictEqual(catalogRow.local, false, 'package module not local')
    assert.strictEqual(catalogRow.displayNameEn, 'Conversation UI', 'built-in EN name used')
    assert.strictEqual(catalogRow.descriptionEn, 'Conversation skeleton, message stream, composer and details')
  } else {
    console.log('note: ui-conversation row not loaded in this fixture, EN catalog row unchecked')
  }
  console.log('P2-5/P2-7/P2-9 snapshot fields pass')

  // 7) P0-2：目标行存在但行块首键不是 id → 拒绝（unrecognized），不追加重复行
  writeFileSync(join(tempHome, 'noop2.mjs'), 'export function apply() {}\n')
  await ctx.loader.create({ id: 'unrec-row', name: pathToFileURL(join(tempHome, 'noop2.mjs')).href })
  writeFileSync(patchPath, '- name: whatever\n  id: unrec-row\n  disabled: false\n', 'utf8')
  const unrec = await service.setEnabled('unrec-row', false)
  assert.strictEqual(unrec.accepted, false)
  assert.strictEqual(unrec.reason, 'unrecognized')
  assert.strictEqual(readFileSync(patchPath, 'utf8'), '- name: whatever\n  id: unrec-row\n  disabled: false\n', 'file untouched')
  console.log('unrecognized row rejected:', JSON.stringify(unrec))

  // 8) P0-2：顶层非数组的手写补丁 → YAML 回读校验拒绝写盘
  writeFileSync(patchPath, 'just: a map\n', 'utf8')
  const broken = await service.setEnabled('probe-row', true)
  assert.strictEqual(broken.accepted, false)
  assert.strictEqual(broken.reason, 'io-error')
  assert.ok((broken.message ?? '').includes('拒绝写入'), 'yaml guard message: ' + broken.message)
  assert.strictEqual(readFileSync(patchPath, 'utf8'), 'just: a map\n', 'broken file untouched')
  console.log('non-array patch rejected:', JSON.stringify(broken))

  // 9) P0-3：导入备份的两阶段确认流程（需要 profile package.json 可定位）
  writeFileSync(join(tempHome, 'package.json'), JSON.stringify({ name: 'profile', private: true }, null, 2) + '\n')
  const manifestPath = join(tempHome, 'package.json')
  const backupBase = {
    format: 'dsh-plugin-manager-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    profile: 'web',
    overrides: { '@x/mod': { name: '备注A' } },
    bundles: [],
  }

  // 9a) 纯 registry 依赖：null 直接执行
  const okImport = await service.importBackup(JSON.stringify({ ...backupBase, dependencies: { '@x/registry-only': '^1.0.0' } }), null)
  assert.strictEqual(okImport.accepted, true, 'registry-only import applies: ' + JSON.stringify(okImport))
  assert.strictEqual(okImport.detail?.nonRegistrySkipped, 0)
  assert.deepStrictEqual(JSON.parse(readFileSync(manifestPath, 'utf8')).dependencies, { '@x/registry-only': '^1.0.0' })
  assert.strictEqual(JSON.parse(readFileSync(join(tempHome, 'plugin-manager', 'catalog.json'), 'utf8'))['@x/mod'].name, '备注A')

  // 9b) 含 git 依赖：null → confirmation-required，不写任何文件
  const gitDoc = { ...backupBase, dependencies: { '@x/registry-only': '^1.0.0', '@x/git-dep': 'github:evil/twin', '@x/file-dep': 'file:../local' } }
  const ask = await service.importBackup(JSON.stringify(gitDoc), null)
  assert.strictEqual(ask.accepted, false)
  assert.strictEqual(ask.reason, 'confirmation-required')
  assert.deepStrictEqual(ask.pendingNonRegistrySpecs, [
    { name: '@x/git-dep', spec: 'github:evil/twin' },
    { name: '@x/file-dep', spec: 'file:../local' },
  ])
  assert.deepStrictEqual(JSON.parse(readFileSync(manifestPath, 'utf8')).dependencies, { '@x/registry-only': '^1.0.0' }, 'no deps written before confirmation')

  // 9c) 部分确认：确认的写入，未确认的跳过并在 detail 报告
  const partial = await service.importBackup(JSON.stringify(gitDoc), ['github:evil/twin'])
  assert.strictEqual(partial.accepted, true)
  assert.strictEqual(partial.detail?.nonRegistrySkipped, 1)
  assert.deepStrictEqual(JSON.parse(readFileSync(manifestPath, 'utf8')).dependencies, {
    '@x/registry-only': '^1.0.0',
    '@x/git-dep': 'github:evil/twin',
  }, 'confirmed written, declined skipped')
  console.log('import two-phase flow pass:', JSON.stringify({ ask: ask.reason, skipped: partial.detail?.nonRegistrySkipped }))

  // 9d) 超大备份 → too-large
  const huge = await service.importBackup(JSON.stringify({ ...backupBase, dependencies: {}, pad: 'x'.repeat(2 * 1024 * 1024 + 1) }), null)
  assert.strictEqual(huge.accepted, false)
  assert.strictEqual(huge.reason, 'too-large')
  console.log('oversized import rejected')

  // 10) P1-2：catalog.json 损坏 → list 携带 overridesWarning；quarantineOverrides 改名保存后恢复
  writeFileSync(join(tempHome, 'plugin-manager', 'catalog.json'), '{"@x/mod": ', 'utf8')
  const brokenList = service.list()
  assert.ok(typeof brokenList.overridesWarning === 'string' && brokenList.overridesWarning.length > 0, 'overridesWarning present on broken catalog.json')
  const repaired = await service.quarantineOverrides()
  assert.strictEqual(repaired.accepted, true, 'quarantine accepted: ' + JSON.stringify(repaired))
  assert.ok(repaired.movedTo !== undefined && existsSync(repaired.movedTo), 'broken file renamed aside, content kept')
  assert.strictEqual(service.list().overridesWarning, undefined, 'warning cleared after quarantine')
  console.log('P1-2 overrides warning + quarantine pass')

  // 11) P1-3：previewBackup 只读预览；确认导入与预览逐项一致
  writeFileSync(patchPath, '- id: probe-row\n  disabled: false\n', 'utf8')
  writeFileSync(join(tempHome, 'plugin-manager', 'catalog.json'), JSON.stringify({ '@x/mod': { name: '备注A' } }), 'utf8')
  const previewDoc = {
    format: 'dsh-plugin-manager-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    profile: 'web',
    overrides: { '@x/mod': { name: '备注A' }, '@x/new': { name: '新备注' } },
    dependencies: { '@x/registry-only': '^1.0.0', '@x/newdep': '^2.0.0', '@x/git2': 'file:../x' },
    bundles: ['b1'],
    patchFile: '- id: probe-row\n  disabled: true\n',
  }
  const previewJson = JSON.stringify(previewDoc)
  const preview = service.previewBackup(previewJson)
  assert.strictEqual(preview.accepted, true, 'preview accepted: ' + JSON.stringify(preview))
  assert.strictEqual(preview.preview.backupProfile, 'web')
  assert.deepStrictEqual(preview.preview.overrides, [{ name: '@x/new', nextName: '新备注', kind: 'add' }])
  assert.deepStrictEqual(preview.preview.dependencies, [
    { name: '@x/newdep', spec: '^2.0.0', kind: 'add', nonRegistry: false },
    { name: '@x/git2', spec: 'file:../x', kind: 'add', nonRegistry: true },
  ])
  assert.deepStrictEqual(preview.preview.bundlesAdded, ['b1'])
  assert.deepStrictEqual(preview.preview.patchRows, [{ id: 'probe-row', enabled: false }])
  assert.deepStrictEqual(preview.preview.pendingNonRegistrySpecs, [{ name: '@x/git2', spec: 'file:../x' }])
  // 只读：预览不落盘
  assert.deepStrictEqual(JSON.parse(readFileSync(manifestPath, 'utf8')).dependencies, {
    '@x/registry-only': '^1.0.0',
    '@x/git-dep': 'github:evil/twin',
  }, 'manifest untouched by preview')
  assert.strictEqual(readFileSync(patchPath, 'utf8'), '- id: probe-row\n  disabled: false\n', 'patch untouched by preview')
  const invalidPreview = service.previewBackup('not-json')
  assert.strictEqual(invalidPreview.accepted, false)
  assert.strictEqual(invalidPreview.reason, 'invalid-format')
  // 确认后导入：恢复计数与预览条目一一对应
  const confirmed = await service.importBackup(previewJson, ['file:../x'])
  assert.strictEqual(confirmed.accepted, true, 'confirmed import applies: ' + JSON.stringify(confirmed))
  assert.strictEqual(confirmed.detail?.overridesRestored, preview.preview.overrides.length)
  assert.strictEqual(confirmed.detail?.dependenciesRestored, preview.preview.dependencies.length)
  assert.strictEqual(confirmed.detail?.bundlesRestored, preview.preview.bundlesAdded.length)
  assert.strictEqual(confirmed.detail?.patchRowsRestored, preview.preview.patchRows.length)
  assert.strictEqual(confirmed.detail?.nonRegistrySkipped, 0)
  assert.ok(readFileSync(patchPath, 'utf8').includes('- id: probe-row\n  disabled: true'), 'patch flipped by confirmed import')
  console.log('P1-3 preview + confirmed import pass:', JSON.stringify(confirmed.detail))

  // 11b) issue #1：来源标记——profile 依赖命中 → declared（用户安装）；scope → official
  const originManifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  originManifest.dependencies[pathToFileURL(join(tempHome, 'noop.mjs')).href] = 'file:./noop.mjs'
  writeFileSync(manifestPath, JSON.stringify(originManifest, null, 2) + '\n', 'utf8')
  const originSnapshot = service.list()
  const probeOrigin = originSnapshot.entries.find(e => e.entryId === 'probe-row')
  assert.ok(probeOrigin, 'probe row still present')
  assert.strictEqual(probeOrigin.declared, true, 'profile-declared module flagged as user-installed')
  assert.strictEqual(probeOrigin.official, false, 'file: module is not official scope')
  const selfOrigin = originSnapshot.entries.find(e => e.entryId === 'include:plugin-manager')
  assert.ok(selfOrigin, 'self row still present')
  assert.strictEqual(selfOrigin.declared, false, 'self row not declared in profile deps')
  assert.strictEqual(selfOrigin.official, false, 'file: loaded self row is not official scope')
  assert.ok(
    originSnapshot.entries.every(e => typeof e.declared === 'boolean' && typeof e.official === 'boolean'),
    'every entry carries boolean declared/official',
  )
  console.log('issue #1 origin flags pass:', JSON.stringify({ probe: probeOrigin.declared, self: selfOrigin.declared }))

  await ctx.fiber.dispose()
  console.log('HOST GATEWAY E2E: ALL PASS')
} finally {
  rmSync(tempHome, { recursive: true, force: true })
}