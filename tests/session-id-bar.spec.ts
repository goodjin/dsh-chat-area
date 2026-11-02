/**
 * 「会话 ID 条」的注册与视图形状。
 *
 * 这两条不属于能靠眼睛发现的那类错误：注册错插槽不报错，只是那一格永远不出现；
 * 组件返回普通对象而不是 React 元素时，报错发生在**别人的**渲染里。所有断言都
 * 只依赖真实插槽契约（会话作用域的 list 插槽：给 id/order，框架传 sessionId）
 * 和纯函数视图，不需要 DOM 或 React 渲染器。
 */

import { describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import { apply } from '../src/index.ts'
import {
  PANEL_ID,
  PANEL_ORDER,
  SLOT,
  SessionIdBar,
  registerSessionIdBar,
  sessionBarView,
  shortSessionId,
} from '../src/session-id-bar/register.ts'

/** 把元素树里的文本按顺序收成一个字符串。 */
function textOf(node: unknown): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node === null || typeof node !== 'object') return ''
  const children = (node as { props?: { children?: unknown } }).props?.children
  return textOf(children)
}

/** 在元素树里找第一个满足条件的节点。 */
function find(node: unknown, match: (props: Record<string, unknown>) => boolean): ReactElement | undefined {
  if (node === null || typeof node !== 'object') return undefined
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, match)
      if (hit !== undefined) return hit
    }
    return undefined
  }
  const element = node as ReactElement & { props?: Record<string, unknown> }
  if (element.props !== undefined && match(element.props)) return element
  return find(element.props?.children, match)
}

/** 只实现用到的注册面，并把调用记录下来。 */
function fakeSlots(): {
  calls: string[]
  registered: { options?: Record<string, unknown>; component?: unknown }
  slots: { inject(key: string, callback: () => unknown): unknown; register(options: Record<string, unknown>, component: unknown): unknown }
} {
  const state = {
    calls: [] as string[],
    registered: {} as { options?: Record<string, unknown>; component?: unknown },
    slots: {
      inject(key: string, callback: () => unknown): unknown {
        state.calls.push(`inject:${key}`)
        return callback()
      },
      register(options: Record<string, unknown>, component: unknown): unknown {
        state.calls.push('register')
        state.registered.options = options
        state.registered.component = component
        return () => {}
      },
    },
  }
  return state
}

describe('短会话 ID', () => {
  it('去掉 session- 前缀并截到 8 位', () => {
    expect(shortSessionId('session-044d3f5e-cbc2-42c6-bfbc-3300b157b639')).toBe('044d3f5e')
    expect(shortSessionId('abc')).toBe('abc')
  })
})

describe('注册进会话头部的工具排', () => {
  it('插槽名、注册 key 与次序都对得上', () => {
    const fake = fakeSlots()
    registerSessionIdBar(fake.slots)
    expect(fake.calls).toEqual([`inject:${SLOT}`, 'register'])
    expect(fake.registered.options).toEqual({ name: SLOT, id: PANEL_ID, order: PANEL_ORDER })
  })

  it('登记的是组件本身，不是普通对象', () => {
    const fake = fakeSlots()
    registerSessionIdBar(fake.slots)
    expect(fake.registered.component).toBe(SessionIdBar)
    expect(typeof fake.registered.component).toBe('function')
  })
})

describe('头部那一格的视图', () => {
  const view = sessionBarView({ sessionId: 'session-044d3f5e-cbc2', copied: false, onCopy: () => {} })

  it('显示短 id，完整 id 留在 title 上', () => {
    expect(textOf(view)).toContain('044d3f5e')
    expect(view.props.title).toBe('session-044d3f5e-cbc2')
  })

  it('复制按钮带得动的 onClick，并在复制后改文案', () => {
    let clicked = 0
    const live = sessionBarView({ sessionId: 'session-044d3f5e', copied: false, onCopy: () => { clicked += 1 } })
    const button = find(live, props => props['data-session-id-copy'] !== undefined)
    expect(button, '复制按钮应该在树里').toBeDefined()
    expect(textOf(button)).toBe('复制')
    ;(button?.props.onClick as () => void)()
    expect(clicked).toBe(1)
    expect(textOf(sessionBarView({ sessionId: 'session-044d3f5e', copied: true, onCopy: () => {} }))).toContain('已复制')
  })
})

describe('浏览器入口', () => {
  const ctxOf = (slots: unknown): Parameters<typeof apply>[0] => ({
    slots: slots as Parameters<typeof apply>[0]['slots'],
    logger: () => ({ info: () => {}, warn: () => {} }),
    effect: () => () => {},
    get: () => undefined,
  })

  it('apply 只注册这一格，并且不重复注册', () => {
    const fake = fakeSlots()
    apply(ctxOf(fake.slots))
    expect(fake.calls).toEqual([`inject:${SLOT}`, 'register'])
  })

  it('注册失败只记一条警告，不往上抛', () => {
    const warnings: string[] = []
    const throwing = {
      inject: () => { throw new Error('slot is not declared') },
      register: () => () => {},
      entries: () => [],
      subscribe: () => () => {},
    }
    const ctx = {
      slots: throwing,
      logger: () => ({ info: () => {}, warn: (message: string) => { warnings.push(message) } }),
      effect: () => () => {},
      get: () => undefined,
    }
    expect(() => apply(ctx)).not.toThrow()
    expect(warnings.join('\n')).toContain('slot is not declared')
  })
})
