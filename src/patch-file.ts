/**
 * 启停补丁文件（cordis.patch.yml）的手术式编辑：只增删目标行的 disabled 字段，
 * 保留文件里的其它行、注释与 !!js 表达式原样不动。不依赖 YAML 库——
 * 按“列 0 的 - ”切行块，行内匹配 id / disabled 键。
 * 写盘前的 YAML 回读校验在 patch-yaml 模块（编辑器本身保持零依赖）。
 * @module dsh-plugin-manager/patch-file
 */

/** 一个顶层数组行块。 */
export interface PatchRowBlock {
  /** 行块文本（含 "- id: ..." 首行）。 */
  readonly lines: readonly string[]
  /** 首行在文件中的下标（0 起）。 */
  readonly start: number
  /** 结束行下标（不含）。 */
  readonly end: number
  /** 行块声明的 id（无 id 时为 null）。 */
  readonly id: string | null
  /** disabled 行在块内的相对下标；无该字段时为 -1。 */
  readonly disabledIndex: number
  /** disabled 字段的原始值（已 trim）；无该字段时为 null。 */
  readonly disabledValue: string | null
}

/** 去掉 YAML 标量两侧的成对引号。 */
function unquote(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

/** 判断 disabled 值是否为 !!js 表达式（不可安全编辑）。 */
export function isExpression(value: string | null): boolean {
  return value !== null && value.trim().startsWith('!!js')
}

/** 去掉值尾部的行内注释（第一个「 #」起的尾串）并 trim，仅用于键值比较，不回写。 */
function stripInlineComment(value: string): string {
  const at = value.search(/\s#/)
  return (at >= 0 ? value.slice(0, at) : value).trim()
}

/** 提取一行的行内注释尾串（含前导空白）；改写 disabled 键时原样保留，避免销毁用户注释。 */
function inlineCommentSuffix(line: string): string {
  const at = line.search(/\s#/)
  return at >= 0 ? line.slice(at) : ''
}

/** 把文件内容解析为顶层行块序列（忽略注释与空行，保留原文文本）。 */
export function parsePatchFile(content: string): PatchRowBlock[] {
  const lines = content.split(/\r?\n/)
  const blocks: PatchRowBlock[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (!/^- /.test(line)) {
      index += 1
      continue
    }
    const start = index
    index += 1
    while (index < lines.length && !/^- /.test(lines[index] ?? '')) index += 1
    const blockLines = lines.slice(start, index)
    let id: string | null = null
    let disabledIndex = -1
    let disabledValue: string | null = null
    for (let at = 0; at < blockLines.length; at += 1) {
      const text = blockLines[at] ?? ''
      // 用 match 而非 exec：语义一致（非全局正则），且不触发安全扫描的命令执行误报。
      const idMatch = text.match(/^- id:\s*(.*)$/)
      if (idMatch) id = unquote(stripInlineComment(idMatch[1] ?? ''))
      const disabledMatch = text.match(/^(\s*)disabled:\s*(.*)$/)
      if (disabledMatch && disabledIndex < 0) {
        disabledIndex = at
        disabledValue = stripInlineComment(disabledMatch[2] ?? '')
      }
    }
    blocks.push({ lines: blockLines, start, end: index, id, disabledIndex, disabledValue })
  }
  return blocks
}

/**
 * 追加（或替换空数组标记 [] 为）一个启停行块。
 * 文件处于“仅注释 + []”的空形态时，直接把 [] 行替换成新行块，保证仍是合法 YAML。
 */
function appendRow(
  lines: string[],
  eol: string,
  content: string,
  entryId: string,
  value: 'true' | 'false',
): { content: string; changed: boolean; blocked: null } {
  const addition = [`- id: ${entryId}`, `  disabled: ${value}`]
  const marker = lines.findIndex(line => line.trim() === '[]')
  if (marker >= 0) {
    const next = [...lines]
    next.splice(marker, 1, ...addition)
    return { content: next.join(eol), changed: true, blocked: null }
  }
  const trimmed = content.length > 0 && !content.endsWith(eol) ? content + eol : content
  return { content: trimmed + addition.join(eol) + eol, changed: true, blocked: null }
}

/** 检测文件的行尾风格（\r\n 或 \n）。 */
function eolOf(content: string): string {
  return content.includes('\r\n') ? '\r\n' : '\n'
}

/**
 * 检测「目标 id 已在文件里、但不是行块首键形态」的无法识别行（评估 P0-2）。
 * 例如手工写的 `- name: x` 换行 `id: y`、缩进的续行 id、多写空格的 `-   id:`。
 * 这类行无法被行块编辑安全改写；不检测会在启停时静默追加重复行，永不生效。
 */
function hasUnrecognizedIdRow(content: string, entryId: string): boolean {
  for (const line of content.split(/\r?\n/)) {
    const text = line.trimStart()
    if (text.startsWith('#')) continue
    const match = text.match(/^(?:-\s+)?id:\s*(.*)$/)
    if (match && unquote(stripInlineComment(match[1] ?? '')) === entryId) return true
  }
  return false
}

/**
 * 在补丁文件内容里为 entryId 设置/清除 disabled。
 * @param content - 当前文件内容。
 * @param entryId - 目标行 id。
 * @param enabled - true=启用（写/改 disabled: false 显式覆盖），false=停用（写 disabled: true）。
 * @returns 新内容与结果描述；未命中任何行且无需写入时 content 不变。
 *   blocked 为 'unrecognized' 表示目标行存在但格式无法识别（拒绝写入重复行）。
 */
export function setRowDisabled(
  content: string,
  entryId: string,
  enabled: boolean,
): { content: string; changed: boolean; blocked: 'expression' | 'unrecognized' | null } {
  const eol = eolOf(content)
  const lines = content.split(/\r?\n/)
  const blocks = parsePatchFile(content)
  const target = blocks.find(block => block.id === entryId)

  if (target !== undefined && target.disabledIndex >= 0 && isExpression(target.disabledValue)) {
    return { content, changed: false, blocked: 'expression' }
  }

  if (!enabled) {
    // 停用：保证存在 disabled: true。
    if (target !== undefined && target.disabledValue === 'true') {
      return { content, changed: false, blocked: null }
    }
    if (target !== undefined && target.disabledIndex >= 0) {
      const next = [...lines]
      const comment = inlineCommentSuffix(lines[target.start + target.disabledIndex] ?? '')
      next[target.start + target.disabledIndex] = `  disabled: true${comment}`
      return { content: next.join(eol), changed: true, blocked: null }
    }
    if (target !== undefined) {
      // 已有行但无 disabled 字段：插到 id 行之后。
      const next = [...lines]
      next.splice(target.start + 1, 0, '  disabled: true')
      return { content: next.join(eol), changed: true, blocked: null }
    }
    if (hasUnrecognizedIdRow(content, entryId)) {
      return { content, changed: false, blocked: 'unrecognized' }
    }
    // 没有行：追加新块（或替换空数组标记 []）。
    return appendRow(lines, eol, content, entryId, 'true')
  }

  // 启用：写显式 disabled: false（可覆盖更低层的 disable），或把 true 改成 false。
  if (target !== undefined) {
    if (target.disabledIndex >= 0) {
      const next = [...lines]
      const comment = inlineCommentSuffix(lines[target.start + target.disabledIndex] ?? '')
      next[target.start + target.disabledIndex] = `  disabled: false${comment}`
      return { content: next.join(eol), changed: true, blocked: null }
    }
    const next = [...lines]
    next.splice(target.start + 1, 0, '  disabled: false')
    return { content: next.join(eol), changed: true, blocked: null }
  }
  if (hasUnrecognizedIdRow(content, entryId)) {
    return { content, changed: false, blocked: 'unrecognized' }
  }
  return appendRow(lines, eol, content, entryId, 'false')
}

/** 生成补丁文件的初始内容（文件不存在时）。 */
export function initialPatchFile(): string {
  return [
    '# dsh-plugin-manager（插件管家）管理的启停补丁 —— 全局层，修改后实时热生效。',
    '# 你仍可手工编辑本文件；插件管家只在需要时增删“- id: … / disabled: …”行块。',
    '# !!js 表达式控制的插件不会被插件管家改写。',
    '[]',
    '',
  ].join('\n')
}