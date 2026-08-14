// 补丁编辑器冒烟测试（node 直跑，不依赖测试框架）。
import assert from 'node:assert'
import { parsePatchFile, setRowDisabled, initialPatchFile, isExpression } from '../lib/types/patch-file.js'

const cases = []
let pass = 0

// 1) 空形态（注释 + []）→ 停用一行：替换 []
{
  const before = initialPatchFile()
  const out = setRowDisabled(before, 'ui-conversation', false)
  assert.strictEqual(out.changed, true)
  assert.ok(!out.content.includes('[]'))
  assert.ok(out.content.includes('- id: ui-conversation'))
  assert.ok(out.content.includes('  disabled: true'))
  const parsed = parsePatchFile(out.content)
  assert.deepStrictEqual(parsed.map(b => b.id), ['ui-conversation'])
  cases.push('empty-marker replacement')
  pass += 1
}

// 2) 再停用另一行：追加第二个块
{
  const before = setRowDisabled(initialPatchFile(), 'ui-conversation', false).content
  const out = setRowDisabled(before, 'ui-tool', false)
  assert.strictEqual(out.changed, true)
  const parsed = parsePatchFile(out.content)
  assert.deepStrictEqual(parsed.map(b => b.id), ['ui-conversation', 'ui-tool'])
  assert.deepStrictEqual(parsed.map(b => b.disabledValue), ['true', 'true'])
  cases.push('append second row')
  pass += 1
}

// 3) 幂等：再次停用同一行不变化
{
  const before = setRowDisabled(initialPatchFile(), 'ui-conversation', false).content
  const out = setRowDisabled(before, 'ui-conversation', false)
  assert.strictEqual(out.changed, false)
  cases.push('idempotent disable')
  pass += 1
}

// 4) 启用：true → false（显式覆盖，保留行）
{
  const before = setRowDisabled(initialPatchFile(), 'ui-conversation', false).content
  const out = setRowDisabled(before, 'ui-conversation', true)
  assert.strictEqual(out.changed, true)
  const parsed = parsePatchFile(out.content)
  assert.deepStrictEqual(parsed.map(b => b.disabledValue), ['false'])
  cases.push('enable flips to explicit false')
  pass += 1
}

// 5) 表达式行：拒改
{
  const before = '- id: bash-sandbox\n  disabled: !!js process.platform === "win32"\n'
  const out = setRowDisabled(before, 'bash-sandbox', true)
  assert.strictEqual(out.blocked, 'expression')
  assert.strictEqual(out.content, before)
  assert.ok(isExpression('!!js x'))
  assert.ok(!isExpression('true'))
  cases.push('expression blocked')
  pass += 1
}

// 6) 已有行的其它键保留（含注释）
{
  const before = [
    '# 用户注释',
    '- id: custom',
    '  name: "@scope/pkg"',
    '  config:',
    '    a: 1',
    '',
  ].join('\n')
  const out = setRowDisabled(before, 'custom', false)
  assert.ok(out.content.includes('# 用户注释'))
  assert.ok(out.content.includes('name: "@scope/pkg"'))
  assert.ok(out.content.includes('a: 1'))
  const parsed = parsePatchFile(out.content)
  assert.strictEqual(parsed[0].disabledValue, 'true')
  cases.push('merge into existing row keeps config/comments')
  pass += 1
}

// 7) 未命中 id 的启用（无行）→ 追加 disabled: false 显式覆盖
{
  const before = initialPatchFile()
  const out = setRowDisabled(before, 'tool-bash', true)
  assert.strictEqual(out.changed, true)
  const parsed = parsePatchFile(out.content)
  assert.strictEqual(parsed[0].id, 'tool-bash')
  assert.strictEqual(parsed[0].disabledValue, 'false')
  cases.push('enable absent row writes explicit false')
  pass += 1
}

// 8) CRLF 行尾保持
{
  const before = '# c\r\n[]\r\n'
  const out = setRowDisabled(before, 'x-1', false)
  assert.ok(out.content.includes('\r\n'))
  assert.ok(!out.content.split('\r\n').some(l => l === '[]'))
  cases.push('crlf preserved')
  pass += 1
}

// 9) 输出始终可被 yaml.load 解析为数组（用 checkout 的 js-yaml）
{
  const { default: yaml } = await import('js-yaml')
  const out = setRowDisabled(initialPatchFile(), 'some-row', false).content
  const parsed = yaml.load(out)
  assert.ok(Array.isArray(parsed))
  assert.strictEqual(parsed[0].id, 'some-row')
  cases.push('valid yaml array')
  pass += 1
}

console.log('PASS ' + pass + '/' + (cases.length) + ': ' + cases.join(', '))