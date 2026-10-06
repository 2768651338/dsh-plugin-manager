/**
 * ESLint flat config（评估 P2-3）：规则从宽——本仓库以正确性为主，
 * 风格交给 tsc（strict）与评审；只开启能拦住真实缺陷的规则。
 */

import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  // 构建产物、依赖与文档不参与 lint。
  { ignores: ['lib/**', 'node_modules/**', 'docs/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      // 源码同时包含浏览器半（window/document）与主机半（node:fs），全局并集，不按文件拆。
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // 从宽：风格类全部关闭。
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      // 真实缺陷类保持开启：
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['warn', { fixStyle: 'inline-type-imports' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-fallthrough': 'error',
      'no-prototype-builtins': 'error',
    },
  },
  {
    // 冒烟/e2e 测试与配置文件：Node 环境，结果走 console 输出。
    files: ['tests/**/*.mjs', '*.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },
)
