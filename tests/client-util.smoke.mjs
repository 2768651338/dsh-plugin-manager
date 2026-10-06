// 浏览器半纯函数冒烟测试（评估 P2-4；node 直跑，不依赖测试框架）。
import assert from 'node:assert'
import {
  dateStamp,
  fiberPhaseSettled,
  format,
  hasOriginData,
  loadStoredOriginFilter,
  matches,
  matchesOriginFilter,
  originBadge,
  ORIGIN_FILTER_STORAGE_KEY,
  storeOriginFilter,
} from '../lib/types/client/util.js'

let pass = 0

/** 构造一个最小 entry（只含 matches 用到的字段）。 */
function entry(overrides = {}) {
  return {
    entryId: 'ui-conversation',
    moduleName: '@deepseek-ai/dsh-client-ui-conversation',
    enabled: true,
    fiberPhase: 'active',
    displayName: '对话界面',
    description: '对话区骨架、消息流、输入框与详情',
    displayNameEn: 'Conversation UI',
    descriptionEn: 'Conversation skeleton, message stream, composer and details',
    category: 'ui',
    system: false,
    toggleable: true,
    toggleBlockReason: null,
    hasOverride: false,
    local: false,
    declared: false,
    official: true,
    ...overrides,
  }
}

// 1) format：{key} 插值；缺失键替换为空串；连续插值。
{
  assert.strictEqual(format('共 {count} 个，启用 {enabled} 个', { count: 3, enabled: 1 }), '共 3 个，启用 1 个')
  assert.strictEqual(format('失败：{message}', {}), '失败：')
  assert.strictEqual(format('{a}-{a}', { a: 'x' }), 'x-x')
  pass += 1
}

// 2) dateStamp：文件名友好且不含冒号/T。
{
  assert.match(dateStamp(), /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/)
  pass += 1
}

// 3) matches：空查询恒命中（短路）；各字段子串命中。约定：query 由调用方先 toLocaleLowerCase。
{
  assert.strictEqual(matches(entry(), ''), true, 'empty query matches all')
  assert.strictEqual(matches(entry(), '对话'), true, 'zh display name')
  assert.strictEqual(matches(entry(), 'conversation'), true, 'en display name')
  assert.strictEqual(matches(entry(), '骨架'), true, 'zh description')
  assert.strictEqual(matches(entry(), 'skeleton'), true, 'en description')
  assert.strictEqual(matches(entry(), 'client-ui-conv'), true, 'module name')
  assert.strictEqual(matches(entry(), 'ui-conversation'), true, 'entry id')
  assert.strictEqual(matches(entry(), '不存在的词'), false, 'no match')
  pass += 1
}

// 4) fiberPhaseSettled：稳态 active/failed/null；过渡态未稳定。
{
  assert.strictEqual(fiberPhaseSettled('active'), true)
  assert.strictEqual(fiberPhaseSettled('failed'), true)
  assert.strictEqual(fiberPhaseSettled(null), true)
  assert.strictEqual(fiberPhaseSettled('pending'), false)
  assert.strictEqual(fiberPhaseSettled('loading'), false)
  assert.strictEqual(fiberPhaseSettled('unloading'), false)
  pass += 1
}

// 5) 来源筛选谓词（issue #1）：命名视图允许重叠；旧主机缺字段时按 false 兜底
{
  const officialBuiltin = entry()
  const officialInstalled = entry({ declared: true })
  const communityInstalled = entry({ official: false, declared: true })
  const communitySpawned = entry({ official: false })
  const localModule = entry({ official: false, local: true })
  // 用户安装：declared 或 local
  assert.strictEqual(matchesOriginFilter(officialInstalled, 'user'), true, 'installed official is user')
  assert.strictEqual(matchesOriginFilter(communityInstalled, 'user'), true, 'installed community is user')
  assert.strictEqual(matchesOriginFilter(localModule, 'user'), true, 'file: module is user')
  assert.strictEqual(matchesOriginFilter(officialBuiltin, 'user'), false, 'built-in is not user')
  // 官方内置：official 且未被用户安装
  assert.strictEqual(matchesOriginFilter(officialBuiltin, 'builtin'), true)
  assert.strictEqual(matchesOriginFilter(officialInstalled, 'builtin'), false, 'installed official not builtin')
  assert.strictEqual(matchesOriginFilter(localModule, 'builtin'), false, 'local official not builtin')
  // 社区：非官方且非本地（含用户安装的社区插件）
  assert.strictEqual(matchesOriginFilter(communityInstalled, 'community'), true, 'installed community hits community view')
  assert.strictEqual(matchesOriginFilter(communitySpawned, 'community'), true, 'spawned community hits community view')
  assert.strictEqual(matchesOriginFilter(officialBuiltin, 'community'), false)
  assert.strictEqual(matchesOriginFilter(localModule, 'community'), false, 'local module excluded from community')
  // 全部恒真；缺字段兜底不抛错
  assert.strictEqual(matchesOriginFilter(officialBuiltin, 'all'), true)
  assert.strictEqual(matchesOriginFilter({ local: false }, 'user'), false, 'missing declared/official tolerated')
  pass += 1
}

// 6) 来源徽标（issue #1）：内置/官方/社区；local 沿用既有「本地」徽标不重复；派生行不发徽标
{
  assert.strictEqual(originBadge(entry()), 'builtin', 'undeclared official shows built-in badge')
  assert.strictEqual(originBadge(entry({ declared: true })), 'official', 'installed official shows official badge')
  assert.strictEqual(originBadge(entry({ official: false, declared: true })), 'community', 'installed community shows community badge')
  assert.strictEqual(originBadge(entry({ official: false })), null, 'spawned non-official has no badge')
  assert.strictEqual(originBadge(entry({ local: true })), null, 'local module keeps existing local badge only')
  assert.strictEqual(originBadge({ local: false }), null, 'missing fields tolerated')
  pass += 1
}

// 7) hasOriginData（issue #1 防呆）：旧主机快照整体退回「全部」的判据
{
  assert.strictEqual(hasOriginData([entry()]), true, 'fields present → origin data available')
  assert.strictEqual(hasOriginData([{ local: false }, { local: true }]), false, 'old host snapshot without fields')
  assert.strictEqual(hasOriginData([]), false, 'empty entries → no origin data')
  pass += 1
}

// 8) 来源筛选持久化（issue #1）：node 无 window，读取兜底 undefined、写入静默跳过（浏览器行为由类型保证）
{
  assert.strictEqual(loadStoredOriginFilter(), undefined, 'no storage in node → undefined')
  storeOriginFilter('user')
  assert.strictEqual(ORIGIN_FILTER_STORAGE_KEY, 'dsh-plugin-manager:origin-filter')
  pass += 1
}

console.log(`client-util smoke pass: ${pass}/8 groups`)
