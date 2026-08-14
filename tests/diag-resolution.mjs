// 模块解析链诊断：真实 app 里，我的插件（profile 打包副本）与网关各解析到哪一份 typert-protocol？
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const require2 = createRequire(import.meta.url)

// 1) 从“我的插件（profile 打包副本）”视角解析
const fromPlugin = import.meta.resolve(
  '@deepseek-ai/dsh-typert-protocol',
  pathToFileURL('C:/Users/Administrator/.dsh/profiles/web/node_modules/@dsh-external/dsh-plugin-manager/lib/index.js').href,
)
console.log('from plugin(packed):', fromPlugin)

// 2) 从 checkout 里的插件视角
const fromCheckout = import.meta.resolve(
  '@deepseek-ai/dsh-typert-protocol',
  pathToFileURL('D:/Program Files (x86)/DeepSeek Harness/resources/harness/packages/external/dsh-plugin-manager/lib/index.js').href,
)
console.log('from plugin(checkout):', fromCheckout)

// 3) 从网关视角（dsh-api-gateway 的 lib）
const fromGateway = import.meta.resolve(
  '@deepseek-ai/dsh-typert-protocol',
  pathToFileURL('D:/Program Files (x86)/DeepSeek Harness/resources/harness/node_modules/@deepseek-ai/dsh-api-gateway/lib/index.js').href,
)
console.log('from gateway:         ', fromGateway)

// 4) 真实路径对比（node:fs realpath）
const { realpathSync, existsSync } = await import('node:fs')
const realOf = (u) => {
  try { return realpathSync(require2('node:url').fileURLToPath(u)) } catch (e) { return 'ERR ' + e.code }
}
console.log('real(plugin-packed): ', realOf(fromPlugin))
console.log('real(plugin-checkout):', realOf(fromCheckout))
console.log('real(gateway):       ', realOf(fromGateway))
console.log('identical: ', realOf(fromPlugin) === realOf(fromGateway))
