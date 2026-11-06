/**
 * 会话选区增强的共享 store：多选收藏、编辑卡状态、会话作用域可见性。
 *
 * 工具栏本体（选中文字后弹出那条）由宿主文本交互座位渲染，见
 * selection-toolbar.tsx；这里钉的是 store 的纯逻辑：收藏增删、按原顺序
 * 拼接、编辑卡开关与会话作用域可见性。
 */

import { describe, expect, it } from 'vitest'
import {
  addMultiItem,
  clearMultiItems,
  closeSelectionEdit,
  composeFillAppend,
  getMultiItems,
  getSelectionEdit,
  boundToActiveSession,
  joinMultiTexts,
  openSelectionEdit,
  removeMultiItem,
  selectionEditVisible,
} from '../src/selection-actions.ts'

describe('填充输入框的追加文本', () => {
  it('已有草稿时：三个空格 + 选中文字 + 尾空格（追加到末尾，旧内容由光标路径保留）', () => {
    expect(composeFillAppend('已有草稿', '选中内容')).toBe('   选中内容 ')
  })

  it('草稿为空时：直接是选中文字加尾空格', () => {
    expect(composeFillAppend('', '选中内容')).toBe('选中内容 ')
  })
})

describe('多选收藏', () => {
  it('收藏绑定收集时的会话：换会话收集会重开新会话的收藏流', () => {
    clearMultiItems()
    addMultiItem('A 会话第一段', { collapsed: false } as unknown as Range, 'session-a')
    addMultiItem('A 会话第二段', { collapsed: false } as unknown as Range, 'session-a')
    expect(getMultiItems().map(item => item.text)).toEqual(['A 会话第一段', 'A 会话第二段'])
    // 切到会话 B 收集：旧收藏清掉，重开 B 的收藏流。
    addMultiItem('B 会话内容', { collapsed: false } as unknown as Range, 'session-b')
    expect(getMultiItems().map(item => item.text)).toEqual(['B 会话内容'])
    clearMultiItems()
  })

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

  it('移除中间一条：其余条目保持原顺序，对应高亮一并撤掉', () => {
    clearMultiItems()
    addMultiItem('第一段', { collapsed: false } as unknown as Range)
    addMultiItem('第二段', { collapsed: false } as unknown as Range)
    addMultiItem('第三段', { collapsed: false } as unknown as Range)
    removeMultiItem(getMultiItems()[1]!.id)
    const items = getMultiItems()
    expect(items.map(item => item.text)).toEqual(['第一段', '第三段'])
    expect(joinMultiTexts(items)).toBe('第一段\n\n第三段')
    clearMultiItems()
  })

  it('移除不存在的 id：静默无变化', () => {
    clearMultiItems()
    addMultiItem('第一段', { collapsed: false } as unknown as Range)
    removeMultiItem(9999)
    expect(getMultiItems().map(item => item.text)).toEqual(['第一段'])
    clearMultiItems()
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

describe('绑定会话的浮层可见性', () => {
  it('绑定会话或激活会话读不到：放行（避免整块消失）', () => {
    expect(boundToActiveSession(undefined, 'session-a')).toBe(true)
    expect(boundToActiveSession('session-a', undefined)).toBe(true)
    expect(boundToActiveSession(undefined, undefined)).toBe(true)
  })

  it('绑定会话 == 激活会话：显示；不一致：隐藏', () => {
    expect(boundToActiveSession('session-a', 'session-a')).toBe(true)
    expect(boundToActiveSession('session-a', 'session-b')).toBe(false)
  })
})
