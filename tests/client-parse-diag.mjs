// 用真实 3080 的响应验证客户端 strict schema 能否解析（复现浏览器侧的 parse 失败）。
const response = await fetch('http://127.0.0.1:3080/api/pluginManager/list', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'client-request', rpcId: 'diag-4', method: 'pluginManager/list', payload: { args: {} } }),
})
console.log('http status:', response.status)
const envelope = await response.json()
console.log('ok:', envelope.result?.ok)
const value = envelope.result?.value
if (value) console.log('entries:', value.entries?.length)

// 用客户端工件（tsc 产物，与浏览器打包内容同源）解析
const { TYPERT_REMOTE } = await import('../lib/types/client/remote.js')
const descriptor = TYPERT_REMOTE.descriptors.find(d => d.method === 'list')
try {
  const parsed = descriptor.result.schema.parse(value)
  console.log('CLIENT SCHEMA PARSE: OK, entries =', parsed.entries.length)
} catch (error) {
  console.log('CLIENT SCHEMA PARSE FAILED:')
  console.log(error.issues?.slice(0, 12).map(i => JSON.stringify({ path: i.path, code: i.code, message: i.message, expected: i.expected })).join('\n'))
}

// 逐条目定位问题字段
if (value?.entries) {
  for (const [index, entry] of value.entries.entries()) {
    try {
      descriptor.result.schema.parse({ patchFile: value.patchFile, overridesFile: value.overridesFile, entryCount: value.entryCount, enabledCount: value.enabledCount, entries: [entry] })
    } catch (error) {
      console.log('BAD ENTRY #' + index + ':', JSON.stringify(entry).slice(0, 200))
      console.log(error.issues?.slice(0, 5).map(i => JSON.stringify({ path: i.path, code: i.code })).join('\n'))
      break
    }
  }
}
