/**
 * 文件操作栏（ActiveFileBar）已移除：每个文档卡自己就有完整的一排操作
 * （打开方式 / 编辑 / 展开 / 收起 / 关闭），顶部那条共享操作栏只会让第一个
 * 文件看起来出现两次——它兜底显示列表第一个文件，长得又和文件卡一模一样
 * （2026-11-04 用户反馈）。
 *
 * 这里钉两层：源码不再渲染它，产物里也不再有它的标记。
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

describe('文件操作栏已移除', () => {
  it('源码不再渲染 ActiveFileBar，共享状态留给文档卡自己的按钮', () => {
    const turn = readFileSync(`${root}/src/markdown-turn.tsx`, 'utf8')
    expect(turn).not.toContain('ActiveFileBar')
    expect(turn).not.toContain('data-active-file-bar')
  })

  it('浏览器产物里不再有操作栏标记', () => {
    const bundle = readFileSync(`${root}/lib/client.js`, 'utf8')
    expect(bundle).not.toContain('data-active-file-bar')
  })
})
