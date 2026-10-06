/**
 * 文件写入防呆（评估 P0-1）：所有配置写盘改为「临时文件 + rename」原子替换；
 * 补丁文件改写前自动留带时间戳的 .bak（滚动清理）。
 * 主机半专用模块（依赖 node:fs），浏览器半不得引入。
 * @module dsh-plugin-manager/fs-safe
 */

import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  openSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'

/** 备份文件后缀。 */
const BACKUP_SUFFIX = '.bak'

/** 模块内自增计数：保证同一毫秒内的多次写也不会撞临时文件名。 */
let tempSeq = 0

/** 同步休眠毫秒（rename 被锁重试时用；宿主主线程可安全 Atomics.wait）。 */
function sleepSync(ms: number): void {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
  } catch {
    // 受限上下文不支持同步等待时立即返回：少一次重试间隔，不影响错误语义。
  }
}

/**
 * 原子替换写：先写同目录临时文件并 fsync 落盘，再 rename 到目标。
 * Windows 上目标被编辑器/杀毒软件占用（EPERM/EBUSY/EACCES）时重试数次，
 * 仍失败则降级为直接覆盖写（等价旧行为，不让启停整体失败）。
 */
export function writeFileAtomic(targetPath: string, data: string): void {
  const temp = join(
    dirname(targetPath),
    `${basename(targetPath)}.${process.pid}.${Date.now()}.${tempSeq++}.tmp`,
  )
  try {
    writeFileSync(temp, data, 'utf8')
    const fd = openSync(temp, 'r+')
    try {
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    renameWithRetry(temp, targetPath)
  } catch (error) {
    try {
      if (existsSync(temp)) unlinkSync(temp)
    } catch {
      // 清理失败不掩盖原始错误。
    }
    if (renameBlocked(error)) {
      // 降级：目标被长期占用时直接覆盖写（与旧版行为一致）。
      writeFileSync(targetPath, data, 'utf8')
      return
    }
    throw error
  }
}

/** rename 遇到目标被占用的错误码。 */
function renameBlocked(error: unknown): boolean {
  return ['EPERM', 'EBUSY', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')
}

/** 带重试的 rename：短暂文件锁（杀毒扫描等）在数百毫秒内自愈。 */
function renameWithRetry(from: string, to: string): void {
  for (let attempt = 0; ; attempt += 1) {
    try {
      renameSync(from, to)
      return
    } catch (error) {
      if (attempt >= 4 || !renameBlocked(error)) throw error
      sleepSync(60 * (attempt + 1))
    }
  }
}

/** 本地时间戳（文件名友好）：YYYYMMDD-HHmmss。 */
export function stampOf(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

/** 本地日期键（YYYY-MM-DD）：判断「今天是否已备份过」。 */
export function localDayKey(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * 为目标文件创建带时间戳的备份（同目录 `<名>.<时间戳>.bak`）。
 * 源文件不存在时返回 undefined；源文件内容损坏也照原样复制（备份的意义正是保住坏现场）。
 */
export function createTimestampedBackup(targetPath: string, now: Date): string | undefined {
  if (!existsSync(targetPath)) return undefined
  const backupPath = `${targetPath}.${stampOf(now)}${BACKUP_SUFFIX}`
  copyFileSync(targetPath, backupPath)
  return backupPath
}

/** 清理同一目标的旧备份，按时间戳保留最新 keep 份；单个删除失败不阻断。 */
export function pruneBackups(targetPath: string, keep: number): void {
  let names: string[]
  try {
    names = readdirSync(dirname(targetPath))
  } catch {
    return
  }
  const prefix = `${basename(targetPath)}.`
  const backups = names
    .filter(name => name.startsWith(prefix) && name.endsWith(BACKUP_SUFFIX))
    .sort()
  const outdated = backups.slice(0, Math.max(0, backups.length - keep))
  for (const name of outdated) {
    try {
      unlinkSync(join(dirname(targetPath), name))
    } catch {
      // 单个清理失败留给下一次。
    }
  }
}
