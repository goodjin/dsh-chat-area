/**
 * 选区工具栏的注册面与接线。
 *
 * 被测的是**活实现**（`src/selection-toolbar.tsx`）。组件内部（按钮路由、剪贴板）
 * 需要 React 渲染器，本仓库没有 react-dom，故沿用 session-id-bar 的做法：只钉
 * 接线——插槽名、key（与官方引用钮同名 `quote`，这是「占位」的关键）、locale、
 * inject 回调、send 透传，以及纯逻辑 `fillComposerWith` 的追加文本口径。
 *
 * 「占位」对不对，最终由浏览器验收：选中文字后宿主表面弹出这条工具栏、引用钮
 * 与官方同位同效。这里钉的是「注册项能被宿主按 key 找到并顶替」的接线不变量。
 */

import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

// 全局 setup 把 primitives 换成空对象，工具栏的图标组件会取到 undefined。这里
// 给两个用到的图标喂哑组件，让组件工厂能产出元素树（不渲染，只验证形状）。
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  IconSendOutlineRegular: () => null,
  IconEditOutlineRegular: () => null,
}))

const { SELECTION_TOOLBAR_KEY, SelectionToolbar, registerSelectionToolbar, fillComposerWith } = await import('../src/selection-toolbar.tsx')
const { composeFillAppend } = await import('../src/selection-actions.ts')
const { NAMESPACE } = await import('../src/locales.ts')

/** 宿主文本交互座位名（ui-chat 声明，keyed / session 作用域）。 */
const SLOT = 'conversation.chat.text-interaction'

/** 只实现注册面，把调用与注册项记下来。 */
function fakeSlots(): {
  calls: string[]
  options?: Record<string, unknown>
  component?: unknown
  slots: {
    inject(key: string, callback: () => unknown): unknown
    register(options: Record<string, unknown>, component: unknown): () => void
  }
} {
  const state = {
    calls: [] as string[],
    options: undefined as Record<string, unknown> | undefined,
    component: undefined as unknown,
    slots: {
      inject(key: string, callback: () => unknown): unknown {
        state.calls.push(`inject:${key}`)
        return callback()
      },
      register(options: Record<string, unknown>, component: unknown): () => void {
        state.calls.push('register')
        state.options = options
        state.component = component
        return () => {}
      },
    },
  }
  return state
}

describe('占位的接线不变量', () => {
  it('key 与官方引用钮同名（quote）——座位按 key 寻址，同名顶替才占得住', () => {
    // 这是「占位置」的全部依据：座位项 key 必须等于官方引用钮的 key。
    expect(SELECTION_TOOLBAR_KEY).toBe('quote')
  })

  it('注册进宿主文本交互座位，声明项带 key=quote 与本包词典', () => {
    const host = fakeSlots()
    const dispose = registerSelectionToolbar(host.slots, (key: string) => key)
    expect(host.calls).toEqual([`inject:${SLOT}`, 'register'])
    expect(host.options).toMatchObject({ name: SLOT, key: SELECTION_TOOLBAR_KEY, locale: NAMESPACE })
    expect(typeof dispose).toBe('function')
  })

  it('inject 回调产出一个 React 组件（工具栏），且 send 透传进去', () => {
    const host = fakeSlots()
    let captured: ((props: Record<string, unknown>) => ReactElement) | undefined
    host.slots.register = (_options, component) => {
      captured = component as typeof captured
      return () => {}
    }
    const send = () => {}
    registerSelectionToolbar(host.slots, (key: string) => key, send)
    // inject 回调被调用，拿到注册组件工厂。
    expect(typeof captured).toBe('function')
    // 工厂产出一个元素（不渲染，只验证形状）。
    const element = captured?.({ readText: () => 'x', dismiss: () => {}, clearSelection: () => {}, send })
    expect(typeof element).toBe('object')
  })
})

describe('组件形状（不渲染，只验证产出的元素结构）', () => {
  /** 调组件工厂，拿返回的 React 元素树。 */
  function render(overrides: Record<string, unknown> = {}): ReactElement {
    return SelectionToolbar({
      readText: () => '选中文字',
      dismiss: () => {},
      clearSelection: () => {},
      t: (key: string) => key,
      ...overrides,
    } as never)
  }

  it('产出一条 toolbar 角色、带 dshcaSelbar 标记的容器', () => {
    const element = render()
    expect(element.type).toBe('div')
    const props = element.props as { role: string; 'data-dshcaSelbar': string }
    expect(props.role).toBe('toolbar')
    expect(props['data-dshcaSelbar']).toBe('')
  })

  it('五个按钮按序排列：引用（官方同位）在前，其后添加到会话/发送/编辑/多选', () => {
    const element = render()
    const props = element.props as { children: unknown[] }
    const actions = (props.children as ReactElement[])
      .flatMap(child => (child as { props?: { 'data-action'?: string } }).props?.['data-action'] ? [child] : [])
      .map(child => (child as { props: { 'data-action': string } }).props['data-action'])
    expect(actions).toEqual(['quote', 'add-to-chat', 'send-to-chat', 'edit-selection', 'multi-add'])
  })

  it('引用钮与「添加到会话」之间有一道分隔线', () => {
    const element = render()
    const props = element.props as { children: unknown[] }
    const divider = (props.children as ReactElement[]).find(
      child => (child as { props?: { className?: string } }).props?.className?.includes('divider'),
    )
    expect(divider).toBeDefined()
  })
})

describe('填充输入框的追加文本口径', () => {
  it('已有草稿：三个空格 + 选中文字 + 尾空格', () => {
    // fillComposerWith 内部走 composeFillAppend；这里钉住口径与旧弹条一致。
    expect(composeFillAppend('已有草稿', '选中内容')).toBe('   选中内容 ')
  })

  it('草稿为空：直接是选中文字加尾空格', () => {
    expect(composeFillAppend('', '选中内容')).toBe('选中内容 ')
  })
})
