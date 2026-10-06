/**
 * 补丁写盘前的 YAML 回读校验（评估 P0-2）：手写行块编辑器产出的内容必须先被
 * 真 YAML 解析器重新解析确认合法（且顶层为数组）才允许落盘，杜绝「逻辑写坏」。
 *
 * 自定义安全 schema：接受任意 `!!js/*` 标签的标量但不求值（construct 恒为 null）。
 * js-yaml v4 的默认 schema 会拒绝 `!!js` 标签，而内置 `js-schema` 会真的编译
 * `!!js/function`——两者都不适合；这里用 multi 类型把整族标签当作不透明标量放行。
 * @module dsh-plugin-manager/patch-yaml
 */

import { DEFAULT_SCHEMA, Type, load } from 'js-yaml'

/** 接受任意 `!!js/*` 标签的标量、construct 为 null 的安全类型（绝不执行表达式）。 */
const SAFE_JS_SCALAR = new Type('tag:yaml.org,2002:js', {
  multi: true,
  kind: 'scalar',
  resolve: () => true,
  construct: () => null,
})

/** 默认 schema + 安全 js 标签族。 */
const PATCH_SCHEMA = DEFAULT_SCHEMA.extend([SAFE_JS_SCALAR])

/**
 * 校验编辑后的补丁内容：必须是合法 YAML 且顶层为数组（cordis.patch.yml 的既定形态）。
 * 不满足时抛错（错误信息可直接展示给用户），调用方不得写盘。
 */
export function assertWritablePatchYaml(content: string): void {
  let parsed: unknown
  try {
    parsed = load(content, { schema: PATCH_SCHEMA })
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error)
    throw new Error(`补丁内容未通过 YAML 回读校验，已拒绝写入：${reason}`, { cause: error })
  }
  if (!Array.isArray(parsed)) {
    throw new Error('补丁内容顶层不是 YAML 数组（cordis.patch.yml 应为行块数组），已拒绝写入')
  }
}
