// 忠实复现真实 app 的端点声明检查（含 typert-loader 严格注册路径）。
// 裸包名行从 profile node_modules 解析（与真实 app 相同的 bareModuleBaseUrl 机制），
// 抓取 connection 上注册的 claim，验证 pluginManager/* 被声明并可调用。
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert'
import { boot } from '@deepseek-ai/dsh-app-boot'

const tempHome = mkdtempSync(join(tmpdir(), 'dsh-pm-claims-'))
process.env.DSH_HOME = tempHome
const base = 'D:/Program Files (x86)/DeepSeek Harness/resources/harness/'
const typertUrl = pathToFileURL(base + 'node_modules/@deepseek-ai/dsh-typert-registry/lib/index.js').href
const typertLoaderUrl = pathToFileURL(base + 'node_modules/@deepseek-ai/dsh-typert-loader/lib/index.js').href
const gatewayUrl = pathToFileURL(base + 'node_modules/@deepseek-ai/dsh-api-gateway/lib/index.js').href
const profileModules = pathToFileURL('C:/Users/Administrator/.dsh/profiles/web/node_modules/').href
const configPath = join(tempHome, 'cordis.yml')
writeFileSync(configPath, [
  '- id: typert',
  "  name: '" + typertUrl + "'",
  '- id: typert-loader',
  "  name: '" + typertLoaderUrl + "'",
  '- id: api-gateway',
  "  name: '" + gatewayUrl + "'",
  '- id: plugin-manager',
  "  name: '@2768651338/dsh-plugin-manager'",
  '',
].join('\n'))

const claims = []
try {
  const ctx = await boot('dsh-pm-claims', configPath, undefined, async (hostCtx) => {
    hostCtx.provide('connection', {
      rpc: {
        intercept: (channel, claim, handler) => {
          claims.push({ channel, claim, handler })
          return () => {}
        },
      },
    })
  }, profileModules)

  assert.strictEqual(claims.length, 1, 'gateway registered one rpc intercept')
  const { claim, handler } = claims[0]
  for (const endpoint of ['pluginManager/list', 'pluginManager/setEnabled', 'pluginManager/setOverride', 'pluginManager/removeOverride']) {
    console.log(endpoint, '=>', claim(endpoint))
  }
  assert.strictEqual(claim('pluginManager/list'), true, 'pluginManager/list must be claimed')
  assert.strictEqual(claim('pluginManager/setEnabled'), true, 'pluginManager/setEnabled must be claimed')
  assert.strictEqual(claim('pluginManager/setOverride'), true, 'pluginManager/setOverride must be claimed')
  assert.strictEqual(claim('pluginManager/removeOverride'), true, 'pluginManager/removeOverride must be claimed')

  const result = await handler('pluginManager/list', { args: {} }, new AbortController().signal)
  console.log('handler result ok:', result.ok, result.ok ? 'entries=' + result.value.entries.length : JSON.stringify(result.error))
  assert.strictEqual(result.ok, true)

  // 严格路径下 setEnabled 也应可调用（保护行拒绝 + 参数解码）
  const toggle = await handler('pluginManager/setEnabled', { args: { entryId: 'include:plugin-manager', enabled: false } }, new AbortController().signal)
  console.log('setEnabled via handler:', JSON.stringify(toggle))
  assert.strictEqual(toggle.ok, true)
  assert.strictEqual(toggle.value.reason, 'system')

  await ctx.fiber.dispose()
  console.log('CLAIMS E2E: ALL PASS')
} finally {
  rmSync(tempHome, { recursive: true, force: true })
}