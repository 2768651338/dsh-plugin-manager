/** CSS Modules 类型声明（构建期由 lightningcss 内联，运行时无独立文件）。 */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
