/**
 * 选区弹条的纯逻辑：弹条位置钳制与选区资格判定。
 *
 * DOM 交互（监听、注入）不在这里测——仓库没有 jsdom；这里钉住的是
 * 弹条行为的两条规则：出视口往回收、编辑区/文件区/输入框不弹条。
 */

import { describe, expect, it } from 'vitest'
import {
  addMultiItem,
  clearMultiItems,
  closeSelectionEdit,
  composeFillAppend,
  getMultiItems,
  getSelectionEdit,
  joinMultiTexts,
  openSelectionEdit,
  SELECTION_SHOW_DELAY_MS,
  selectionAllowed,
  selectionBarPosition,
  selectionEditVisible,
} from '../src/selection-actions.ts'

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

describe('填充输入框的追加文本', () => {
  it('已有草稿时：三个空格 + 选中文字 + 尾空格（追加到末尾，旧内容由光标路径保留）', () => {
    expect(composeFillAppend('已有草稿', '选中内容')).toBe('   选中内容 ')
  })

  it('草稿为空时：直接是选中文字加尾空格', () => {
    expect(composeFillAppend('', '选中内容')).toBe('选中内容 ')
  })
})

describe('多选收藏', () => {
  it('按捕获顺序追加；join 按原顺序、项间空行拼接', () => {
    clearMultiItems()
    addMultiItem('第一段', { collapsed: false } as unknown as Range)
    addMultiItem('第二段', { collapsed: false } as unknown as Range)
    const items = getMultiItems()
    expect(items.map(item => item.text)).toEqual(['第一段', '第二段'])
    expect(joinMultiTexts(items)).toBe('第一段\n\n第二段')
    clearMultiItems()
    expect(getMultiItems()).toEqual([])
  })

  it('收藏里的失效（塌缩）Range 在重刷高亮时被淘汰，文本保留', () => {
    clearMultiItems()
    addMultiItem('第一段', { collapsed: false } as unknown as Range)
    addMultiItem('第二段', { collapsed: true } as unknown as Range)
    const items = getMultiItems()
    expect(items.map(item => item.text)).toEqual(['第一段', '第二段'])
    clearMultiItems()
  })
})

describe('选区编辑卡状态', () => {
  it('单选编辑：打开带文本，关闭后状态清空、不影响多选收藏', () => {
    clearMultiItems()
    addMultiItem('收藏段', { collapsed: false } as unknown as Range)
    openSelectionEdit('选中文字', false, 'session-a')
    expect(getSelectionEdit()).toMatchObject({ text: '选中文字', multi: false, sessionId: 'session-a' })
    closeSelectionEdit()
    expect(getSelectionEdit()).toBeNull()
    expect(getMultiItems().map(item => item.text)).toEqual(['收藏段'])
    clearMultiItems()
  })

  it('多选编辑：关闭/结束会连收藏一起清掉', () => {
    clearMultiItems()
    addMultiItem('第一段', { collapsed: false } as unknown as Range)
    addMultiItem('第二段', { collapsed: false } as unknown as Range)
    openSelectionEdit(joinMultiTexts(getMultiItems()), true, 'session-a')
    expect(getSelectionEdit()).toMatchObject({ multi: true, sessionId: 'session-a' })
    const seq = getSelectionEdit()?.seq
    openSelectionEdit('再开一次', true, 'session-a')
    // seq 自增：编辑卡以 seq 为 key 重挂载，回到初始文本。
    expect(getSelectionEdit()?.seq).toBe((seq ?? 0) + 1)
    closeSelectionEdit()
    expect(getSelectionEdit()).toBeNull()
    expect(getMultiItems()).toEqual([])
  })
})

describe('编辑卡的会话作用域可见性', () => {
  const state = (sessionId: string | undefined): ReturnType<typeof getSelectionEdit> => {
    openSelectionEdit('文字', false, sessionId)
    return getSelectionEdit()
  }

  it('关闭状态不渲染', () => {
    expect(selectionEditVisible(null, 'session-a')).toBe(false)
  })

  it('state 无 sessionId（读不到会话时的旧口径）：放行渲染', () => {
    expect(selectionEditVisible(state(undefined), 'session-a')).toBe(true)
  })

  it('激活会话 key 读不到：放行渲染（避免整卡消失）', () => {
    expect(selectionEditVisible(state('session-a'), undefined)).toBe(true)
  })

  it('激活会话与打开时会话一致：渲染', () => {
    expect(selectionEditVisible(state('session-a'), 'session-a')).toBe(true)
  })

  it('切换到别的会话：不渲染（否则每个打开过的会话都盖住输入框）', () => {
    expect(selectionEditVisible(state('session-a'), 'session-b')).toBe(false)
  })
})
