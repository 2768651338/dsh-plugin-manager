// 备份/恢复纯数据逻辑冒烟测试（node 直跑，不依赖测试框架）。
import assert from 'node:assert'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  buildBackupDocument,
  mergeBundles,
  mergeDependencies,
  mergeOverrides,
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

console.log('backup.smoke: ' + pass + ' groups passed')
