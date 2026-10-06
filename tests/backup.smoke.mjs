// 备份/恢复纯数据逻辑冒烟测试（node 直跑，不依赖测试框架）。
import assert from 'node:assert'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  auditDependencySpecs,
  buildBackupDocument,
  buildBackupPreview,
  isNonRegistrySpec,
  mergeBundles,
  mergeDependencies,
  mergeOverrides,
  mergePatchRows,
  validateBackupDocument,
} from '../lib/types/backup.js'

let pass = 0

// 1) buildBackupDocument：字段齐全、时间戳/格式/版本正确
{
  const doc = buildBackupDocument({
    profile: 'web',
    overrides: { a: { name: 'A' } },
    dependencies: { b: '^1.0.0' },
    bundles: ['b', 'c'],
    patchFile: '# patch',
  })
  assert.strictEqual(doc.format, BACKUP_FORMAT)
  assert.strictEqual(doc.version, BACKUP_VERSION)
  assert.strictEqual(doc.profile, 'web')
  assert.strictEqual(typeof doc.createdAt, 'string')
  assert.deepStrictEqual(doc.bundles, ['b', 'c'])
  assert.strictEqual(doc.patchFile, '# patch')
  assert.strictEqual(doc.overrides.a.name, 'A')
  assert.strictEqual(doc.dependencies.b, '^1.0.0')
  pass += 1
}

// 2) buildBackupDocument：patchFile 缺省时不带该字段
{
  const doc = buildBackupDocument({ profile: 'web', overrides: {}, dependencies: {}, bundles: [] })
  assert.ok(!('patchFile' in doc))
  pass += 1
}

// 3) validateBackupDocument：合法文档通过
{
  const doc = buildBackupDocument({ profile: 'web', overrides: {}, dependencies: {}, bundles: ['x'] })
  const result = validateBackupDocument(doc)
  assert.strictEqual(result.ok, true)
  pass += 1
}

// 4) validateBackupDocument：错误格式/版本/字段拒绝
{
  assert.strictEqual(validateBackupDocument(null).ok, false)
  assert.strictEqual(validateBackupDocument({ format: 'other', version: 1, createdAt: 't', profile: 'p', overrides: {}, dependencies: {}, bundles: [] }).ok, false)
  assert.strictEqual(validateBackupDocument({ format: BACKUP_FORMAT, version: 999, createdAt: 't', profile: 'p', overrides: {}, dependencies: {}, bundles: [] }).ok, false)
  assert.strictEqual(validateBackupDocument({ format: BACKUP_FORMAT, version: 1, createdAt: 't', profile: 'p', overrides: {}, dependencies: { x: 1 }, bundles: [] }).ok, false)
  assert.strictEqual(validateBackupDocument({ format: BACKUP_FORMAT, version: 1, createdAt: 't', profile: 'p', overrides: {}, dependencies: {}, bundles: [1] }).ok, false)
  pass += 1
}

// 5) mergeOverrides：备份覆盖当前，保留当前独有条目
{
  const current = { keep: { name: 'keep' }, dup: { name: 'old' } }
  const incoming = { dup: { name: 'new' }, added: { desc: 'd' } }
  const { merged, changed } = mergeOverrides(current, incoming)
  assert.deepStrictEqual(merged, { keep: { name: 'keep' }, dup: { name: 'new' }, added: { desc: 'd' } })
  assert.strictEqual(changed, 2)
  pass += 1
}

// 5b) mergeOverrides：内容完全相同的条目不计入变更（P1-3：预览与恢复计数一致）
{
  const current = { a: { name: 'A', desc: 'x' }, b: { name: 'B' } }
  const { merged, changed } = mergeOverrides(current, { a: { name: 'A', desc: 'x' }, c: { name: 'C' } })
  assert.strictEqual(changed, 1)
  assert.deepStrictEqual(merged, { a: { name: 'A', desc: 'x' }, b: { name: 'B' }, c: { name: 'C' } })
  pass += 1
}

// 6) mergeDependencies：备份 spec 覆盖，保留独有
{
  const { merged, changed } = mergeDependencies({ a: '^1.0.0' }, { a: '^2.0.0', b: '^3.0.0' })
  assert.deepStrictEqual(merged, { a: '^2.0.0', b: '^3.0.0' })
  assert.strictEqual(changed, 2)
  pass += 1
}

// 7) mergeBundles：去重、保持当前顺序、缺失追加
{
  const { merged, changed } = mergeBundles(['a', 'b'], ['b', 'c', 'a'])
  assert.deepStrictEqual(merged, ['a', 'b', 'c'])
  assert.strictEqual(changed, 1)
  pass += 1
}

// 8) isNonRegistrySpec：registry 风格放行，非常规来源全部拦下
{
  const registry = ['^1.0.0', '~2.3.4', '1.2.3', 'v1.2.3', '>=1 <2', '1.2.3 - 2.0.0', '1.x', '*', 'latest', 'beta', '', 'next', '>=0.2.0-rc.0']
  const nonRegistry = [
    'git+https://github.com/u/r.git', 'git://x/y', 'git@github.com:u/r.git',
    'file:../local', 'file:///D:/x', 'link:../x', 'https://x/y.tgz', 'http://x/y.tgz',
    'npm:foo@^1.0.0', 'workspace:*', 'portal:../x',
    'user/repo', 'user/repo#v1.0.0', 'github:u/r',
    '/abs/path', './rel', '../rel', '~/x', 'D:\\tools\\pkg', '\\\\srv\\share',
  ]
  for (const spec of registry) assert.strictEqual(isNonRegistrySpec(spec), false, 'registry: ' + JSON.stringify(spec))
  for (const spec of nonRegistry) assert.strictEqual(isNonRegistrySpec(spec), true, 'non-registry: ' + JSON.stringify(spec))
  pass += 1
}

// 9) auditDependencySpecs：null=全部非常规进 pending；清单=已确认进 writable
{
  const deps = { '@a/one': '^1.0.0', '@a/two': 'github:evil/twin', '@a/three': 'file:../x', '@a/four': 'github:evil/twin' }
  const probe = auditDependencySpecs(deps, null)
  assert.deepStrictEqual(probe.writable, { '@a/one': '^1.0.0' })
  assert.deepStrictEqual(probe.pending, [
    { name: '@a/two', spec: 'github:evil/twin' },
    { name: '@a/three', spec: 'file:../x' },
    { name: '@a/four', spec: 'github:evil/twin' },
  ])
  const decided = auditDependencySpecs(deps, ['github:evil/twin'])
  assert.deepStrictEqual(decided.writable, { '@a/one': '^1.0.0', '@a/two': 'github:evil/twin', '@a/four': 'github:evil/twin' })
  assert.deepStrictEqual(decided.pending, [{ name: '@a/three', spec: 'file:../x' }])
  const allApproved = auditDependencySpecs(deps, ['github:evil/twin', 'file:../x'])
  assert.deepStrictEqual(allApproved.pending, [])
  assert.deepStrictEqual(Object.keys(allApproved.writable).sort(), ['@a/four', '@a/one', '@a/three', '@a/two'])
  pass += 1
}

// 10) mergePatchRows：翻转行收集、表达式行/无法识别行跳过、结果内容合法
{
  const current = [
    '# header comment',
    '- id: a',
    '  disabled: false',
    '- id: b',
    '  disabled: !!js () => true',
    '- name: whatever',
    '  id: c',
    '  disabled: false',
  ].join('\n') + '\n'
  const backup = '- id: a\n  disabled: true\n- id: b\n  disabled: true\n- id: c\n  disabled: true\n- id: a\n  disabled: true\n'
  const { content, rows } = mergePatchRows(current, backup)
  assert.deepStrictEqual(rows, [{ id: 'a', enabled: false }], 'expression/unrecognized/no-op rows skipped')
  assert.ok(content.includes('- id: a\n  disabled: true'), 'target row flipped')
  assert.ok(content.includes('# header comment'), 'comments preserved')
  assert.ok(content.includes('disabled: !!js'), 'expression row untouched')
  assert.ok(content.includes('id: c'), 'unrecognized block untouched')
  pass += 1
}

// 11) mergePatchRows：无行可写时不校验、不抛错；有行可写但当前文件损坏时抛 YAML 校验错
//     （备份里的 disabled: false 对缺失行会写入显式启用行——与导入共用同一合并语义）
{
  const noChange = mergePatchRows('just: a map\n', '')
  assert.deepStrictEqual(noChange.rows, [])
  assert.throws(() => mergePatchRows('just: a map\n', '- id: a\n  disabled: true\n'), /拒绝写入/,
    'preview/import get the same YAML guard error on a broken current patch file')
  pass += 1
}

// 12) buildBackupPreview：逐项 diff（add/update/skip、非常规来源、启停行）
{
  const doc = buildBackupDocument({
    profile: 'web',
    overrides: { same: { name: 'S', desc: 's' }, upd: { name: 'U2' }, add: { desc: 'new' } },
    dependencies: { '@x/same': '^1.0.0', '@x/upd': '^2.0.0', '@x/add': 'github:u/r', '@x/new': '^3.0.0' },
    bundles: ['b1', 'b2'],
    patchFile: '- id: row-a\n  disabled: true\n- id: row-b\n  disabled: false\n',
  })
  const preview = buildBackupPreview({
    currentOverrides: { same: { name: 'S', desc: 's' }, upd: { name: 'U1' } },
    currentDependencies: { '@x/same': '^1.0.0', '@x/upd': '^1.0.0' },
    currentBundles: ['b0', 'b2'],
    currentPatchFile: '- id: row-a\n  disabled: false\n- id: row-b\n  disabled: false\n',
    document: doc,
  })
  assert.strictEqual(preview.backupProfile, 'web')
  assert.deepStrictEqual(preview.overrides, [
    { name: 'upd', nextName: 'U2', kind: 'update' },
    { name: 'add', nextDesc: 'new', kind: 'add' },
  ])
  assert.deepStrictEqual(preview.dependencies, [
    { name: '@x/upd', spec: '^2.0.0', kind: 'update', nonRegistry: false },
    { name: '@x/add', spec: 'github:u/r', kind: 'add', nonRegistry: true },
    { name: '@x/new', spec: '^3.0.0', kind: 'add', nonRegistry: false },
  ])
  assert.deepStrictEqual(preview.bundlesAdded, ['b1'])
  // row-a 翻转为停用；row-b 在备份与当前均为启用——启用的显式化重写按既有合并语义计为一次应用
  assert.deepStrictEqual(preview.patchRows, [
    { id: 'row-a', enabled: false },
    { id: 'row-b', enabled: true },
  ])
  assert.deepStrictEqual(preview.pendingNonRegistrySpecs, [{ name: '@x/add', spec: 'github:u/r' }])
  pass += 1
}

// 13) buildBackupPreview：当前补丁文件缺失时按空形态比对
{
  const doc = buildBackupDocument({
    profile: 'web',
    overrides: {},
    dependencies: {},
    bundles: [],
    patchFile: '- id: row-a\n  disabled: true\n',
  })
  const preview = buildBackupPreview({
    currentOverrides: {},
    currentDependencies: {},
    currentBundles: [],
    document: doc,
  })
  assert.deepStrictEqual(preview.patchRows, [{ id: 'row-a', enabled: false }])
  pass += 1
}

console.log('backup.smoke: ' + pass + ' groups passed')
