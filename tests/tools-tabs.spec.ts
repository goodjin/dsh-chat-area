/**
 * 工具标签并入宿主行的行为：同步（补挂 / 自建行）与点击路由。
 *
 * 宿主 conversation.view 条目是全局的，装不下按会话各自的文件标签——这一段
 * 用假元素直接测 DOM 行为：宿主行在场补挂进宿主行、缺席时自建行、激活标记、
 * 关闭钮路由、种类启动器路由、宿主标签点击先收工具。
 */

import { describe, expect, it } from 'vitest'
import {
  GROUP_ATTR,
  LIVE_ATTR,
  ROW_ATTR,
  TAB_ATTR,
  TAB_CLOSE_ATTR,
  TAB_ID_ATTR,
  TAB_KIND_ATTR,
  handleToolsRowClick,
  syncSessionToolsRow,
  type RowElementLike,
  type ToolsRowHandlers,
  type ToolsRowSnapshot,
} from '../src/tools-tabs.ts'

/** 最小假元素：属性 + 子节点 + 最近祖先查找，够 sync 与 click 路由用。 */
interface FakeEl {
  tag: string
  attrs: Record<string, string>
  children: FakeEl[]
  parent: FakeEl | null
  setAttribute(name: string, value: string): void
  getAttribute(name: string): string | null
  hasAttribute(name: string): boolean
  removeAttribute(name: string): void
  remove(): void
  append(child: FakeEl): void
  replaceChildren(): void
  insertBefore(child: FakeEl, before: FakeEl | null): void
  querySelector(selector: string): FakeEl | null
  querySelectorAll(selector: string): FakeEl[]
  closest(selector: string): FakeEl | null
}

function el(tag: string, attrs: Record<string, string> = {}): FakeEl {
  const node: FakeEl = {
    tag,
    attrs: { ...attrs },
    children: [],
    parent: null,
    setAttribute(name, value) { node.attrs[name] = value },
    getAttribute(name) { return name in node.attrs ? node.attrs[name] ?? null : null },
    hasAttribute(name) { return name in node.attrs },
    removeAttribute(name) { delete node.attrs[name] },
    remove() {
      const parent = node.parent
      if (parent === null) return
      const at = parent.children.indexOf(node)
      if (at >= 0) parent.children.splice(at, 1)
      node.parent = null
    },
    append(child) { child.parent = node; node.children.push(child) },
    replaceChildren() { for (const child of node.children) child.parent = null; node.children = [] },
    insertBefore(child, before) {
      child.parent = node
      const at = before === null ? -1 : node.children.indexOf(before)
      if (at < 0) node.children.push(child)
      else node.children.splice(at, 0, child)
    },
    querySelector(selector) {
      const attribute = /\[([^\]=]+)\]/.exec(selector)?.[1]
      const walk = (current: FakeEl): FakeEl | null => {
        for (const child of current.children) {
          if (typeof child.hasAttribute !== 'function') continue
          if (attribute !== undefined && child.hasAttribute(attribute)) return child
          const found = walk(child)
          if (found !== null) return found
        }
        return null
      }
      return walk(node)
    },
    querySelectorAll(selector) {
      const attribute = /\[([^\]=]+)\]/.exec(selector)?.[1]
      const found: FakeEl[] = []
      const walk = (current: FakeEl): void => {
        for (const child of current.children) {
          if (typeof child.hasAttribute !== 'function') continue
          if (attribute !== undefined && child.hasAttribute(attribute)) found.push(child)
          walk(child)
        }
      }
      walk(node)
      return found
    },
    closest(selector) {
      const attribute = /\[([^\]=]+)\]/.exec(selector)?.[1] ?? /button\[role=tab\]/.exec(selector)?.[0]
      if (attribute === undefined) return null
      let cursor: FakeEl | null = node
      while (cursor !== null) {
        if (attribute.startsWith('button')) {
          if (cursor.tag === 'button' && cursor.getAttribute('role') === 'tab') return cursor
        } else if (cursor.hasAttribute(attribute)) return cursor
        cursor = cursor.parent
      }
      return null
    },
  }
  return node
}
const fakeDoc = () => ({ createElement: (tag: string) => el(tag), createTextNode: (text: string) => ({ text }), querySelectorAll: () => [] as FakeEl[] })

/** 记录动作的假处理器。 */
function handlers(snapshot: (sessionId: string) => ToolsRowSnapshot): { value: ToolsRowHandlers; actions: string[] } {
  const actions: string[] = []
  const value: ToolsRowHandlers = {
    snapshot,
    activateChat: id => { actions.push(`chat:${id}`) },
    selectTab: (id, tabId) => { actions.push(`select:${id}:${tabId}`) },
    openKind: (id, kind) => { actions.push(`kind:${id}:${kind}`) },
    closeTab: (id, tabId) => { actions.push(`close:${id}:${tabId}`) },
    subscribe: () => () => {},
    labels: { chat: '对话', kinds: { files: '文件', browser: '浏览器', terminal: '终端' } },
  }
  return { value, actions }
}

/** 会话内容根：宿主标签行可给可不给。 */
const content = (sessionId: string, withHostRow: boolean): FakeEl => {
  const root = el('div', { 'data-conversation-content': '', 'data-conversation-session': sessionId })
  if (withHostRow) root.append(el('div', { 'data-conversation-tabs': '' }))
  return root
}

const snapshotOf = (tabs: ToolsRowSnapshot['tabs'], active?: string): ToolsRowSnapshot => ({ active, tabs })

describe('syncSessionToolsRow（同步）', () => {
  it('宿主行在场：标签组补挂进宿主行，宿主行不缺少话标签', () => {
    const root = content('s1', true)
    const h = handlers(() => snapshotOf([{ id: 't1', kind: 'local', title: 'a.md' }], 't1'))
    const row = syncSessionToolsRow(root, fakeDoc(), h.value, {})
    expect(row).not.toBeUndefined()
    expect(root.querySelector(`[${ROW_ATTR}]`)).toBeNull()
    const group = root.querySelector(`[${GROUP_ATTR}]`)
    expect(group).not.toBeNull()
    expect(row!.getAttribute(LIVE_ATTR)).toBe('')
    // 三个种类启动器 + 一个文件标签 + 一枚关闭钮。
    const tabs = group!.querySelectorAll(`[${TAB_ATTR}]`)
    expect(tabs).toHaveLength(4)
    expect(group!.querySelectorAll(`[${TAB_CLOSE_ATTR}]`)).toHaveLength(1)
  })

  it('宿主行缺席：自建行带自己的「对话」标签，工具激活时对话不高亮', () => {
    const root = content('s1', false)
    const h = handlers(() => snapshotOf([{ id: 't1', kind: 'files', title: '工作区文件' }], 't1'))
    const row = syncSessionToolsRow(root, fakeDoc(), h.value, {})
    expect(row!.hasAttribute(ROW_ATTR)).toBe(true)
    const chat = row!.querySelector('[data-chat-tools-chat-button]')
    expect(chat!.getAttribute('aria-selected')).toBe('false')
    expect(row!.getAttribute(LIVE_ATTR)).toBe('')
  })

  it('回到对话：激活标记摘除，自建行对话标签恢复高亮', () => {
    const root = content('s1', false)
    const h = handlers(() => snapshotOf([{ id: 't1', kind: 'local', title: 'a.md' }], undefined))
    const row = syncSessionToolsRow(root, fakeDoc(), h.value, {})
    expect(row!.hasAttribute(LIVE_ATTR)).toBe(false)
    expect(row!.querySelector('[data-chat-tools-chat-button]')!.getAttribute('aria-selected')).toBe('true')
  })

  it('同步是全量重画：两次同步不叠出两份标签', () => {
    const root = content('s1', true)
    const h = handlers(() => snapshotOf([{ id: 't1', kind: 'local', title: 'a.md' }], undefined))
    syncSessionToolsRow(root, fakeDoc(), h.value, {})
    syncSessionToolsRow(root, fakeDoc(), h.value, {})
    const group = root.querySelector(`[${GROUP_ATTR}]`)
    expect(group!.querySelectorAll(`[${TAB_ATTR}]`)).toHaveLength(4)
  })
})

describe('handleToolsRowClick（点击路由）', () => {
  const build = (): { root: FakeEl; group: FakeEl; actions: string[]; value: ToolsRowHandlers } => {
    const root = content('s1', true)
    const h = handlers(() => snapshotOf([
      { id: 't1', kind: 'local', title: 'a.md' },
      { id: 't2', kind: 'browser', title: '浏览器' },
    ], 't1'))
    const row = syncSessionToolsRow(root, fakeDoc(), h.value, {})
    const group = row!.querySelector(`[${GROUP_ATTR}]`) as FakeEl
    return { root, group, actions: h.actions, value: h.value }
  }

  it('点文件标签 → selectTab', () => {
    const { group, actions, value } = build()
    const tab = group.querySelectorAll(`[${TAB_ID_ATTR}]`)[0]!
    const event = { target: tab, preventDefault: () => {}, stopPropagation: () => {} }
    expect(handleToolsRowClick(event as never, value)).toBe(true)
    expect(actions).toEqual(['select:s1:t1'])
  })

  it('点关闭钮 → closeTab（文件标签走丢弃草稿的关闭）', () => {
    const { group, actions, value } = build()
    const close = group.querySelectorAll(`[${TAB_CLOSE_ATTR}]`)[0]!
    handleToolsRowClick({ target: close, preventDefault: () => {}, stopPropagation: () => {} } as never, value)
    expect(actions).toEqual(['close:s1:t1'])
  })

  it('点种类启动器 → openKind', () => {
    const { group, actions, value } = build()
    const kindTab = group.querySelectorAll(`[${TAB_KIND_ATTR}]`)[1]!
    handleToolsRowClick({ target: kindTab, preventDefault: () => {}, stopPropagation: () => {} } as never, value)
    expect(actions).toEqual(['kind:s1:browser'])
  })

  it('工具激活时点宿主标签 → 先回对话，不吞事件', () => {
    const { root, actions, value } = build()
    const hostRow = root.querySelector('[data-conversation-tabs]')!
    const hostTab = el('button', { role: 'tab' })
    hostRow.append(hostTab)
    const stopped = { stopped: false }
    const handled = handleToolsRowClick({ target: hostTab, preventDefault: () => {}, stopPropagation: () => { stopped.stopped = true } } as never, value)
    expect(handled).toBe(false)
    expect(stopped.stopped).toBe(false)
    expect(actions).toEqual(['chat:s1'])
  })
})
