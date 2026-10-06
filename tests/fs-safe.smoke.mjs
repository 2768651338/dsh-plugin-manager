// 原子写与备份防呆冒烟测试（node 直跑，不依赖测试框架）。
import assert from 'node:assert'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTimestampedBackup, localDayKey, pruneBackups, writeFileAtomic } from '../lib/types/fs-safe.js'

const dir = mkdtempSync(join(tmpdir(), 'dsh-pm-fs-'))
let pass = 0

try {
  // 1) writeFileAtomic：创建 + 覆盖 + 无临时文件残留
  {
    const target = join(dir, 'a.yml')
    writeFileAtomic(target, 'first\n')
    assert.strictEqual(readFileSync(target, 'utf8'), 'first\n')
    writeFileAtomic(target, 'second\n')
    assert.strictEqual(readFileSync(target, 'utf8'), 'second\n')
    assert.ok(!readdirSync(dir).some(name => name.endsWith('.tmp')), 'no temp leftovers')
    pass += 1
  }

  // 2) createTimestampedBackup：源缺失返回 undefined；存在时备份内容一致
  {
    const target = join(dir, 'b.yml')
    assert.strictEqual(createTimestampedBackup(target, new Date()), undefined)
    writeFileSync(target, 'payload\n', 'utf8')
    const backup = createTimestampedBackup(target, new Date(2026, 0, 2, 3, 4, 5))
    assert.ok(backup !== undefined && backup.endsWith('.20260102-030405.bak'), 'timestamped name: ' + String(backup))
    assert.strictEqual(readFileSync(backup, 'utf8'), 'payload\n')
    pass += 1
  }

  // 3) pruneBackups：保留最新 keep 份，旧的清掉
  {
    const target = join(dir, 'c.yml')
    writeFileSync(target, 'x\n', 'utf8')
    const stamps = []
    for (let i = 1; i <= 7; i += 1) {
      stamps.push(createTimestampedBackup(target, new Date(2026, 0, 1, 0, 0, i)))
    }
    assert.strictEqual(stamps.length, 7)
    pruneBackups(target, 5)
    const left = readdirSync(dir).filter(name => name.startsWith('c.yml.') && name.endsWith('.bak')).sort()
    assert.strictEqual(left.length, 5, 'keep 5 newest, got: ' + left.join(','))
    assert.ok(left[0].endsWith('000003.bak'), 'oldest two pruned: ' + left[0])
    pass += 1
  }

  // 4) 损坏内容也能备份（备份的意义正是保住坏现场）
  {
    const target = join(dir, 'd.yml')
    writeFileSync(target, 'broken: [yaml\n', 'utf8')
    const backup = createTimestampedBackup(target, new Date())
    assert.ok(backup !== undefined && readFileSync(backup, 'utf8') === 'broken: [yaml\n')
    pass += 1
  }

  // 5) localDayKey：本地日期键格式
  {
    assert.strictEqual(localDayKey(new Date(2026, 9, 1)), '2026-10-01')
    assert.strictEqual(localDayKey(new Date(2026, 0, 5)), '2026-01-05')
    pass += 1
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}

assert.ok(!existsSync(dir), 'temp dir cleaned')
console.log('fs-safe.smoke: ' + pass + '/5 groups passed')
