/**
 * 选区弹条的纯逻辑：弹条位置钳制与选区资格判定。
 *
 * DOM 交互（监听、注入）不在这里测——仓库没有 jsdom；这里钉住的是
 * 弹条行为的两条规则：出视口往回收、编辑区/文件区/输入框不弹条。
 */

import { describe, expect, it } from 'vitest'
import { selectionAllowed, selectionBarPosition } from '../src/selection-actions.ts'

/** 造一个最小 closest 面：命中集合里的选择器（按逗号拆开比对）返回占位元素，否则 null。 */
function anchor(matching: readonly string[]): { closest(selector: string): unknown } {
  const set = new Set(matching)
  const element = {} as Element
  return {
    closest: (selector: string) => (
      selector.split(',').some(part => set.has(part.trim())) ? element : null
    ),
  }
}

describe('选区弹条位置', () => {
  const viewport = { width: 1000, height: 800 }
  const bar = { width: 160, height: 30 }

  it('正常情况贴在选区末行右缘、垂直居中', () => {
    const position = selectionBarPosition(
      { left: 100, right: 300, top: 200, bottom: 220, height: 20 },
      viewport,
      bar,
    )
    expect(position.left).toBe(308)
    expect(position.top).toBe(200 + 10 - 15)
  })

  it('选区贴近视口右缘时弹条往左收，不出屏', () => {
    const position = selectionBarPosition(
      { left: 880, right: 990, top: 200, bottom: 220, height: 20 },
      viewport,
      bar,
    )
    expect(position.left).toBe(1000 - 160 - 8)
    expect(position.left + bar.width).toBeLessThanOrEqual(1000)
  })

  it('选区贴近视口底部时弹条往上收', () => {
    const position = selectionBarPosition(
      { left: 100, right: 300, top: 790, bottom: 800, height: 10 },
      viewport,
      bar,
    )
    expect(position.top).toBe(800 - 30 - 8)
    expect(position.top + bar.height).toBeLessThanOrEqual(800)
  })
})

describe('选区资格判定', () => {
  it('会话容器内的普通选区通过', () => {
    const probe = anchor(['[data-conversation-scroll]'])
    expect(selectionAllowed(probe as never, false)).toBe(true)
  })

  it('不在会话容器里不弹', () => {
    const probe = anchor([])
    expect(selectionAllowed(probe as never, false)).toBe(false)
  })

  it('输入框、编辑框、contenteditable 里的选区不弹', () => {
    for (const inside of ['[data-composer-input]', 'textarea', 'input', '[contenteditable="true"]']) {
      const probe = anchor([inside, '[data-conversation-scroll]'])
      expect(selectionAllowed(probe as never, false)).toBe(false)
    }
  })

  it('文件阅读区正文不弹（那里有自己的选区工具条）', () => {
    const probe = anchor(['[data-markdown-interactive]', '[data-conversation-scroll]'])
    expect(selectionAllowed(probe as never, false)).toBe(false)
  })

  it('弹条自身内部的选区不弹', () => {
    const probe = anchor(['.dshca-selbar', '[data-conversation-scroll]'])
    expect(selectionAllowed(probe as never, true)).toBe(false)
  })

  it('弹条未挂载时 .dshca-selbar 不参与排除（防御：不该出现这个状态）', () => {
    const probe = anchor(['.dshca-selbar', '[data-conversation-scroll]'])
    expect(selectionAllowed(probe as never, false)).toBe(true)
  })
})
