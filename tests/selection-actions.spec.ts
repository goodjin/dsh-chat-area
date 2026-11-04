/**
 * 选区弹条的纯逻辑：弹条位置钳制与选区资格判定。
 *
 * DOM 交互（监听、注入）不在这里测——仓库没有 jsdom；这里钉住的是
 * 弹条行为的两条规则：出视口往回收、编辑区/文件区/输入框不弹条。
 */

import { describe, expect, it } from 'vitest'
import { SELECTION_SHOW_DELAY_MS, selectionAllowed, selectionBarPosition } from '../src/selection-actions.ts'

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

  it('正常情况放在选区首行上方，尖角指向该行选区中心', () => {
    const position = selectionBarPosition(
      { left: 300, right: 500, top: 200, bottom: 220, width: 200, height: 20 },
      viewport,
      bar,
    )
    expect(position.top).toBe(200 - 30 - 6)
    expect(position.left).toBe(300)
    expect(position.arrow).toBe('down')
    // 行中心 400，相对弹条左缘 100。
    expect(position.arrowOffset).toBe(100)
  })

  it('选区贴近视口右缘时弹条往左收，尖角仍指向行中心且不出弹条', () => {
    const position = selectionBarPosition(
      { left: 880, right: 990, top: 200, bottom: 220, width: 110, height: 20 },
      viewport,
      bar,
    )
    expect(position.left).toBe(1000 - 160 - 8)
    expect(position.arrowOffset).toBe(Math.min(Math.max(935 - position.left, 10), 150))
    expect(position.arrowOffset).toBeLessThanOrEqual(bar.width - 10)
  })

  it('选区贴近视口顶时翻到行下方，尖角朝上', () => {
    const position = selectionBarPosition(
      { left: 300, right: 500, top: 20, bottom: 40, width: 200, height: 20 },
      viewport,
      bar,
    )
    expect(position.arrow).toBe('up')
    expect(position.top).toBe(40 + 6)
    expect(position.top).toBeGreaterThanOrEqual(8)
  })

  it('行中心在弹条内时尖角对准行中心（右收后仍指向选中内容）', () => {
    const position = selectionBarPosition(
      { left: 900, right: 990, top: 200, bottom: 220, width: 90, height: 20 },
      { width: 1000, height: 800 },
      bar,
    )
    // 弹条左缘收到 832，行中心 945 → 偏移 113，仍在弹条内。
    expect(position.left).toBe(832)
    expect(position.arrowOffset).toBe(113)
    expect(position.arrowOffset).toBeLessThanOrEqual(bar.width - 10)
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

describe('弹条出现时机', () => {
  it('选中后停顿 1 秒才弹（用户要求的延迟，钉住防止误改）', () => {
    expect(SELECTION_SHOW_DELAY_MS).toBe(1000)
  })
})
