/**
 * 插件来源标记（issue #1）的纯函数：官方/社区粗分与「用户安装」信号推导。
 * 只依赖纯输入，不触碰 DOM / 远程服务 / node:fs，node 可直跑导入（smoke 测试用）。
 * @module dsh-plugin-manager/origin
 */

/**
 * 官方 scope 清单：只用于官方/社区粗分（来源徽标与「官方内置」筛选），
 * 不参与「是否用户安装」的判断——后者以 profile 依赖表为准（issue #1 的建议）。
 * @cordis 一并算官方：框架自带行，绝不可能是社区插件。
 */
const OFFICIAL_SCOPES: readonly string[] = ['@deepseek-ai/', '@cordis/']

/** 是否官方 scope 模块（非字符串输入一律按非官方兜底，不抛错）。 */
export function isOfficialModule(moduleName: unknown): boolean {
  return typeof moduleName === 'string' && OFFICIAL_SCOPES.some(scope => moduleName.startsWith(scope))
}

/** 模块名是否出现在 profile 依赖表里（用户主动安装信号，含 file: 等非常规 spec）。 */
export function isDeclaredDependency(dependencies: Readonly<Record<string, string>>, moduleName: unknown): boolean {
  return typeof moduleName === 'string' && Object.hasOwn(dependencies, moduleName)
}
