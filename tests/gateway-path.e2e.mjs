// 主机侧完整调用链复现：Loader + 插件 + Typert 注册表 + 真实网关服务。
// 直接调用 gateway.invoke({namespace:'pluginManager', method:'list'})，
// 验证 SRC 描述符解析、方法调用、结果编解码是否畅通。
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert'
import { boot } from '@deepseek-ai/dsh-app-boot'
import { TypertRegistry } from '@deepseek-ai/dsh-typert-registry'
import { TypertGatewayService } from '@deepseek-ai/dsh-api-gateway'

const tempHome = mkdtempSync(join(tmpdir(), 'dsh-pm-gw-'))
process.env.DSH_HOME = tempHome
const pluginUrl = pathToFileURL('D:/Program Files (x86)/DeepSeek Harness/resources/harness/packages/external/dsh-plugin-manager/lib/index.js').href
const configPath = join(tempHome, 'cordis.yml')
writeFileSync(configPath, [
  '- id: plugin-manager',
  `  name: '${pluginUrl}'`,
  '',
].join('\n'))

try {
  const ctx = await boot('dsh-pm-gw', configPath, undefined, async (hostCtx) => {
    await hostCtx.plugin(TypertRegistry)
    hostCtx.provide('connection', { rpc: { intercept: () => {} } })
  })

  const service = ctx.get('pluginManager')
  assert.ok(service, 'pluginManager service registered')

  // 直接查网关端点声明：复制 collectSrcClaims 的判断路径
  const gateway = new TypertGatewayService(ctx)
  const result = await gateway.invoke({ namespace: 'pluginManager', method: 'list', args: {} })
  assert.ok(result && typeof result === 'object', 'invoke returned a value')
  console.log('list via gateway =>', JSON.stringify({ entryCount: result.entryCount, first: result.entries?.[0]?.moduleName }))

  const toggle = await gateway.invoke({ namespace: 'pluginManager', method: 'setEnabled', args: { entryId: 'no-such', enabled: false } })
  console.log('setEnabled via gateway =>', JSON.stringify(toggle))
  assert.strictEqual(toggle.reason, 'not-found')

  // 编解码检查：把网关返回值喂给客户端 strict schema
  const { TYPERT_REMOTE } = await import('../lib/types/client/remote.js')
  const listDescriptor = TYPERT_REMOTE.descriptors.find(d => d.method === 'list')
  const parsed = listDescriptor.result.schema.parse(result)
  console.log('client schema parsed host result OK, entries =', parsed.entries.length)

  await ctx.fiber.dispose()
  console.log('GATEWAY PATH E2E: ALL PASS')
} finally {
  rmSync(tempHome, { recursive: true, force: true })
}
