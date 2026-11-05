/**
 * 浏览器半边的打包配置。
 *
 * DSH 只下发 `exports["./client"]` 指向的那一个文件，并原样塞进页面的模块表；
 * 它必须是「单文件 CJS 工厂」，外面套一层 `window.__ModuleLoader__.load(...)`，
 * factory 收到的 `require` 负责把 react 这类外置模块从页面的模块表里取出来。
 * 这与 DSH 自带客户端插件、以及 @goodjin2/dsh-acp-agent 的产物同款。
 *
 * 输入是 tsc 的中间产物（lib/src，NodeNext 能把源码里的 `./x.js` 指到 `x.ts`），
 * 因为 rolldown 不会替我们把 `.js` 后缀的引用改写到 `.ts` 源文件。
 *
 * `.module.css` 用 lightningcss 在打包时转成「注入 <style> + 类名映射」，
 * 与 acp-agent 同款（客户端包不内联构建期 CSS 外链，运行时注入）。
 */

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import { isAbsolute, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'lightningcss'
import { defineConfig } from 'tsdown'

const id = '@goodjin2/dsh-chat-power'
const root = fileURLToPath(new URL('.', import.meta.url))
const cssPrefix = '\0threadharbor-css:'
const cssSuffix = '.mjs'
const externals = new Set([
  '@deepseek-ai/dsh-client-ui-sidebar-files',
  '@deepseek-ai/dsh-client-ui-sidebar-browser',
  '@deepseek-ai/dsh-client-ui-sidebar-terminal',
  '@deepseek-ai/dsh-client-ui-sidebar-documentpreview',
  'react-dom',
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-ui-primitives',
])

export default defineConfig({
  entry: { client: `${root}lib/src/index.js` },
  outDir: `${root}lib`,
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  sourcemap: true,
  minify: true,
  clean: false,
  // 页面模块表里已有 react；打进产物会出现第二份 React 实例。
  external: [...externals],
  noExternal: (specifier: string) => !externals.has(specifier),
  plugins: [{
    name: 'threadharbor-css-modules',
    resolveId(source: string, importer?: string) {
      if (!source.endsWith('.module.css') || importer === undefined) return null
      const emitted = new URL(source, `file://${importer}`).pathname
      const file = existsSync(emitted) ? emitted : emitted.replace('/lib/src/', '/src/')
      return `${cssPrefix}${file}${cssSuffix}`
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(cssPrefix)) return null
      const file = virtualId.slice(cssPrefix.length, -cssSuffix.length)
      this.addWatchFile(file)
      // lightningcss 的 [hash] 以文件名为种子：传绝对路径会让产物类名哈希随构建目录
      // 变化（.worktrees/... vs 主仓 → 同一 CSS 出不同 hash）。chat-power 的 module.css
      // 基名唯一，传基名即让哈希只由内容决定、跨目录可复现。
      const result = transform({
        filename: basename(file),
        code: await readFile(file),
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classes: Record<string, string> = {}
      for (const [local, value] of Object.entries(result.exports ?? {})) classes[local] = value.name
      // lightningcss 的 exports 键序不确定，直接序列化会让每次重建产物的类名映射对象键序
      // 都变（md5 漂移、无意义 diff、内容未变却触发热替换）。按键排序后再输出，产物可复现。
      const sortedClasses: Record<string, string> = {}
      for (const key of Object.keys(classes).sort()) sortedClasses[key] = classes[key]
      const css = result.code.toString()
      const tag = `${id}/${basename(file)}`
      return [
        `const css = ${JSON.stringify(css)};`,
        `const tag = ${JSON.stringify(tag)};`,
        "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tag) + ']') === null) {",
        "  const element = document.createElement('style');",
        `  element.dataset.plugin = ${JSON.stringify(id)};`,
        '  element.dataset.pluginCss = tag;',
        '  element.textContent = css;',
        '  document.head.appendChild(element);',
        '}',
        `export default ${JSON.stringify(sortedClasses)};`,
      ].join('\n')
    },
  }],
  outputOptions: {
    inlineDynamicImports: true,
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    sourcemapPathTransform: (source: string) => isAbsolute(source) ? relative(root, source).replaceAll('\\', '/') : source,
  },
})
