/**
 * 启停补丁文件（cordis.patch.yml）的手术式编辑：只增删目标行的 disabled 字段，
 * 保留文件里的其它行、注释与 !!js 表达式原样不动。不依赖 YAML 库——
 * 按“列 0 的 - ”切行块，行内匹配 id / disabled 键。
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
      const idMatch = /^- id:\s*(.*)$/.exec(text)
      if (idMatch) id = unquote(idMatch[1] ?? '')
      const disabledMatch = /^(\s*)disabled:\s*(.*)$/.exec(text)
      if (disabledMatch && disabledIndex < 0) {
        disabledIndex = at
        disabledValue = (disabledMatch[2] ?? '').trim()
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
 * 在补丁文件内容里为 entryId 设置/清除 disabled。
 * @param content - 当前文件内容。
 * @param entryId - 目标行 id。
 * @param enabled - true=启用（写/改 disabled: false 显式覆盖），false=停用（写 disabled: true）。
 * @returns 新内容与结果描述；未命中任何行且无需写入时 content 不变。
 */
export function setRowDisabled(
  content: string,
  entryId: string,
  enabled: boolean,
): { content: string; changed: boolean; blocked: 'expression' | null } {
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
      next[target.start + target.disabledIndex] = '  disabled: true'
      return { content: next.join(eol), changed: true, blocked: null }
    }
    if (target !== undefined) {
      // 已有行但无 disabled 字段：插到 id 行之后。
      const next = [...lines]
      next.splice(target.start + 1, 0, '  disabled: true')
      return { content: next.join(eol), changed: true, blocked: null }
    }
    // 没有行：追加新块（或替换空数组标记 []）。
    return appendRow(lines, eol, content, entryId, 'true')
  }

  // 启用：写显式 disabled: false（可覆盖更低层的 disable），或把 true 改成 false。
  if (target !== undefined) {
    if (target.disabledIndex >= 0) {
      const next = [...lines]
      next[target.start + target.disabledIndex] = '  disabled: false'
      return { content: next.join(eol), changed: true, blocked: null }
    }
    const next = [...lines]
    next.splice(target.start + 1, 0, '  disabled: false')
    return { content: next.join(eol), changed: true, blocked: null }
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