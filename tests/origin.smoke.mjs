// 来源标记纯函数冒烟测试（issue #1；node 直跑，不依赖测试框架）。
import assert from 'node:assert'
import { isDeclaredDependency, isOfficialModule } from '../lib/types/origin.js'

let pass = 0

// 1) isOfficialModule：官方 scope 粗分（@deepseek-ai / @cordis），非字符串兜底 false
{
  assert.strictEqual(isOfficialModule('@deepseek-ai/dsh-llm'), true, 'deepseek scope is official')
  assert.strictEqual(isOfficialModule('@deepseek-ai/cordis-plugin-timer'), true, 'cordis-plugin under deepseek scope is official')
  assert.strictEqual(isOfficialModule('@cordis/worker'), true, 'cordis framework scope is official')
  assert.strictEqual(isOfficialModule('@dsh-external/dsh-navbar'), false, 'third-party scope is not official')
  assert.strictEqual(isOfficialModule('@x/community-mod'), false, 'unknown scope is not official')
  assert.strictEqual(isOfficialModule('file:///x/y/noop.mjs'), false, 'file: module is not official')
  assert.strictEqual(isOfficialModule(undefined), false, 'undefined module name falls back to false')
  assert.strictEqual(isOfficialModule(42), false, 'non-string input falls back to false')
  pass += 1
}

// 2) isDeclaredDependency：profile 依赖表命中即「用户安装」，含 file: 等非常规 spec
{
  const deps = {
    '@x/registry-only': '^1.0.0',
    '@x/git-dep': 'github:evil/twin',
    'file:///x/local-mod': 'file:../local',
  }
  assert.strictEqual(isDeclaredDependency(deps, '@x/registry-only'), true, 'registry dep declared')
  assert.strictEqual(isDeclaredDependency(deps, '@x/git-dep'), true, 'git spec still counts as declared')
  assert.strictEqual(isDeclaredDependency(deps, 'file:///x/local-mod'), true, 'file: spec counts as declared')
  assert.strictEqual(isDeclaredDependency(deps, '@x/not-in-deps'), false, 'missing module not declared')
  assert.strictEqual(isDeclaredDependency(deps, undefined), false, 'undefined module name not declared')
  assert.strictEqual(isDeclaredDependency({}, '@x/registry-only'), false, 'empty deps never declare')
  pass += 1
}

console.log(`ORIGIN SMOKE: ${pass}/2 GROUPS PASS`)
