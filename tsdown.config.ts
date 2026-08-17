/**
 * 插件管家构建配置：主机 half（ESM lib/index.js）+ 浏览器 half（CJS lib/client.js）。
 * 浏览器 half 复用官方外部插件约定：经典脚本 + window.__ModuleLoader__.load 工厂，
 * 平台模块（react / ui-primitives / ui-slots 等）走 externals，其余（zod 等）打进包内；
 * CSS Modules 由 lightningcss 内联并在工厂执行时注入 <style data-plugin>。
 * @module dsh-plugin-manager/tsdown
 */

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, resolve as resolvePath } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'
import { PLATFORM_MODULES } from './platform.ts'

const ID = '@2768651338/dsh-plugin-manager'

/** 浏览器 externals：shell 共享的冻结模块表。 */
const CLIENT_EXTERNALS: readonly string[] = [...PLATFORM_MODULES]

/** CSS 虚拟模块前后缀：避开 tsdown 自身的 css 管线。 */
const CSS_VIRTUAL_PREFIX = '\0dsh-pm-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** 可内联的 @deepseek-ai 线缆层（无共享运行时身份）。 */
const INLINE_SAFE = /^@deepseek-ai\/dsh-(host-apiproxy|session|llm|tools|brand)(\/|$)/
const VENDORED_LIBRARY = /^@deepseek-ai\/(cosmokit|schemastery)(\/|$)/
const GENERATED_REMOTE = /^@deepseek-ai\/dsh-[a-z0-9]+(?:-[a-z0-9]+)*\/remote$/

/** 解析虚拟 CSS id 对应的物理文件。 */
function sourceAssetPath(source: string, importer: string | undefined): string {
  const resolved = resolvePath(dirname(importer ?? ''), source)
  if (existsSync(resolved)) return resolved
  return resolved
}

/** 主机 half：ESM 库构建，依赖全部 external（由 profile 的 node_modules 解析）。 */
const libConfig: UserConfig = {
  name: ID,
  entry: { index: 'lib/types/index.js', 'typert.host': 'lib/types/typert-host.js' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
}

/** 浏览器 half：CJS 工厂包 + 平台 externals + 内联其余。 */
const clientConfig: UserConfig = {
  name: ID + '/client',
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  external: [...CLIENT_EXTERNALS],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
  plugins: [{
    name: 'dsh-plugin-manager-bundle-purity',
    resolveId(source: string) {
      if (!source.startsWith('@deepseek-ai/')) return null
      if (CLIENT_EXTERNALS.includes(source)) return null
      if (VENDORED_LIBRARY.test(source) || INLINE_SAFE.test(source) || GENERATED_REMOTE.test(source)) return null
      throw new Error(
        'plugin-manager client bundle purity: "' + source + '" is not a platform module or inline-safe wire layer — ' +
        'cross-plugin value imports are forbidden; collaborate through cordis services (type-only imports are erased)',
      )
    },
  }, {
    name: 'dsh-plugin-manager-css-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      const abs = importer !== undefined ? sourceAssetPath(source, importer) : source
      return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: source,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap: Record<string, string> = {}
      for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
      const cssBody = [
        'const css = ' + JSON.stringify(code.toString()) + ';',
        'const tagId = ' + JSON.stringify(ID + '/' + basename(fileId)) + ';',
        "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
        "  const tag = document.createElement('style');",
        '  tag.dataset.plugin = ' + JSON.stringify(ID) + ';',
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        'export default ' + JSON.stringify(classMap) + ';',
      ]
      return cssBody.join('\n')
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: ' + JSON.stringify(ID) + ', factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [libConfig, clientConfig]