/**
 * 选区弹条的纯逻辑：弹条位置钳制与选区资格判定。
 *
 * DOM 交互（监听、注入）不在这里测——仓库没有 jsdom；这里钉住的是
 * 弹条行为的两条规则：出视口往回收、编辑区/文件区/输入框不弹条。
 */

import { describe, expect, it } from 'vitest'
import { composeFillText, SELECTION_SHOW_DELAY_MS, selectionAllowed, selectionBarPosition } from '../src/selection-actions.ts'

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

  it('单行选区：弹条在首行上方、右缘对齐选区右端，尖角指向该右端', () => {
    const position = selectionBarPosition(
      { left: 300, right: 500, top: 200, bottom: 220, height: 20 },
      { left: 300, right: 500 },
      viewport,
      bar,
    )
    expect(position.top).toBe(200 - 30 - 6)
    expect(position.left).toBe(500 - 160)
    expect(position.arrow).toBe('down')
    // 末行右端 500，相对弹条左缘 340 → 160，钳到弹条内 150。
    expect(position.arrowOffset).toBe(bar.width - 10)
  })

  it('多行选区：垂直取首行上方，水平贴末行右缘', () => {
    const position = selectionBarPosition(
      { left: 100, right: 300, top: 200, bottom: 220, height: 20 },
      { left: 100, right: 400 },
      viewport,
      bar,
    )
    expect(position.top).toBe(200 - 30 - 6)
    expect(position.left).toBe(400 - 160)
    // 右端 400 对到弹条左缘 240 处偏移 160，钳进弹条内 150。
    expect(position.arrowOffset).toBe(bar.width - 10)
  })

  it('选区贴近视口右缘时弹条往左收，尖角仍指向末行右端且不出弹条', () => {
    const position = selectionBarPosition(
      { left: 880, right: 990, top: 200, bottom: 220, height: 20 },
      { left: 880, right: 990 },
      viewport,
      bar,
    )
    // 末行右端 990，弹条右缘直接贴上（830+160+8 ≤ 1000，无需再收）。
    expect(position.left).toBe(990 - 160)
    expect(position.arrowOffset).toBe(bar.width - 10)
  })

  it('选区贴近视口顶时翻到行下方，尖角朝上', () => {
    const position = selectionBarPosition(
      { left: 300, right: 500, top: 20, bottom: 40, height: 20 },
      { left: 300, right: 500 },
      viewport,
      bar,
    )
    expect(position.arrow).toBe('up')
    expect(position.top).toBe(40 + 6)
    expect(position.top).toBeGreaterThanOrEqual(8)
  })

  it('末行右端很靠左时尖角仍钳在弹条内（防御极端布局）', () => {
    const position = selectionBarPosition(
      { left: 100, right: 200, top: 200, bottom: 220, height: 20 },
      { left: 100, right: 120 },
      viewport,
      bar,
    )
    expect(position.arrowOffset).toBeLessThanOrEqual(bar.width - 10)
    expect(position.arrowOffset).toBeGreaterThanOrEqual(10)
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

describe('填充输入框的文本拼接', () => {
  it('已有草稿时：旧内容 + 三个空格 + 选中文字 + 尾空格', () => {
    expect(composeFillText('已有草稿', '选中内容')).toBe('已有草稿   选中内容 ')
  })

  it('草稿为空时：直接是选中文字加尾空格', () => {
    expect(composeFillText('', '选中内容')).toBe('选中内容 ')
  })

  it('草稿里的 nbsp 归一成普通空格再拼接', () => {
    expect(composeFillText('前\u00a0面', '文字')).toBe('前 面   文字 ')
  })
})
