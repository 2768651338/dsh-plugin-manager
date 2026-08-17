/**
 * 浏览器侧“平台模块”清单（对齐 @deepseek-ai/dsh-client-web/src/platform.ts）。
 * 这些模块由 shell 的冻结模块表共享，客户端 bundle 必须 external 化，
 * 不能在包内重复打包（否则跨插件模块身份漂移）。
 * @module dsh-plugin-manager/platform
 */

/** shell 共享进冻结模块表的模块说明符。 */
export const PLATFORM_MODULES: readonly string[] = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
]
