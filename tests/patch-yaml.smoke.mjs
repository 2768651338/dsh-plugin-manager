// 补丁 YAML 回读校验冒烟测试（node 直跑，不依赖测试框架）。
import assert from 'node:assert'
import { assertWritablePatchYaml } from '../lib/types/patch-yaml.js'

let pass = 0

// 1) 标准内容 + !!js 表达式 → 通过（标签被安全放行）
{
  const content = [
    '# 注释',
    '- id: a',
    '  disabled: true',
    '- id: b',
    '  disabled: !!js process.platform === "win32"',
    '- id: c',
    '',
  ].join('\n')
  assert.doesNotThrow(() => assertWritablePatchYaml(content))
  pass += 1
}

// 2) !!js/function 不会被求值（校验绝不执行表达式）
{
  globalThis.__pmProbe = 0
  const content = [
    '- id: evil',
    `  disabled: !!js/function "function f(){ globalThis.__pmProbe = 1 }"`,
    '',
  ].join('\n')
  assert.doesNotThrow(() => assertWritablePatchYaml(content))
  assert.strictEqual(globalThis.__pmProbe, 0, '!!js/function must not execute')
  pass += 1
}

// 3) 顶层不是数组（手写映射）→ 拒绝
{
  assert.throws(() => assertWritablePatchYaml('just: a map\n'), /顶层不是 YAML 数组/)
  pass += 1
}

// 4) 截断/非法 YAML → 拒绝，且信息可读
{
  assert.throws(() => assertWritablePatchYaml('not: [broken\n'), /拒绝写入/)
  assert.throws(() => assertWritablePatchYaml('- id: a\n disabled: [unclosed\n'), /拒绝写入/)
  pass += 1
}

// 5) 空数组与初始内容 → 通过
{
  assert.doesNotThrow(() => assertWritablePatchYaml('[]\n'))
  pass += 1
}

console.log('patch-yaml.smoke: ' + pass + '/5 groups passed')
