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
 */

import { isAbsolute, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const id = '@goodjin2/dsh-chat-area'
const root = fileURLToPath(new URL('.', import.meta.url))

export default {
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
  external: ['react', 'react/jsx-runtime'],
  outputOptions: {
    inlineDynamicImports: true,
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    sourcemapPathTransform: (source: string) => isAbsolute(source) ? relative(root, source).replaceAll('\\', '/') : source,
  },
}
