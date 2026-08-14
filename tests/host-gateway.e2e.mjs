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
const configDir = 'D:/Program Files (x86)/DeepSeek Harness/resources/harness/packages/external/dsh-plugin-manager'
const configPath = join(tempHome, 'cordis.yml')
const pluginUrl = pathToFileURL('D:/Program Files (x86)/DeepSeek Harness/resources/harness/packages/external/dsh-plugin-manager/lib/index.js').href
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

  // 6) 快照里 probe-row 的目录信息（未知模块 → 兜底）
  const snapshot2 = service.list()
  const probe = snapshot2.entries.find(e => e.entryId === 'probe-row')
  assert.ok(probe)
  assert.ok(probe.description.includes('暂无内置说明'))
  console.log('probe row display:', probe.displayName, '/', probe.description)

  await ctx.fiber.dispose()
  console.log('HOST GATEWAY E2E: ALL PASS')
} finally {
  rmSync(tempHome, { recursive: true, force: true })
}