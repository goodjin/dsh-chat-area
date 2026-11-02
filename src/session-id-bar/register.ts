/**
 * 「会话 ID 条」：在会话头部右端放一枚短 id 与一个复制按钮。
 *
 * 目标插槽 `conversation.session.header.utilities` 是会话作用域的 list 插槽
 * （DSH 的 ui-conversation 声明）：注册项只要给出 id/order，框架会把
 * `sessionId` 作为标准 props 交给组件，不需要自己 inject。
 *
 * 组件分成两层：
 * - {@link SessionIdBar} 负责状态（是否已复制）与剪贴板；
 * - {@link sessionBarView} 是纯函数，直接把「该画什么」算成一个 React 元素，
 *   因此在没有 DOM、没有 React 渲染器的环境里也能测。
 *
 * 组件在拿不到 sessionId（或值不是字符串）时返回 null，而不是抛错——插槽里
 * 抛出去的异常会打在会话头部那一块渲染上，宁可什么都不显示。
 */

import { createElement, useState } from 'react'
import type { ReactElement } from 'react'

/** 目标插槽：会话头部右端的一排工具。 */
export const SLOT = 'conversation.session.header.utilities'

/** 注册项在插槽里的 key；自己起，不占用别人的格子。 */
export const PANEL_ID = 'threadharbor-session-id'

/** 排在大多数头部工具之后（默认 0），靠右。 */
export const PANEL_ORDER = 20

/** 复制成功的提示停留时间，毫秒。 */
const COPIED_MS = 1500

/** 注册面：只用到 inject + register。 */
export type HeaderSlots = {
  inject(key: string, callback: () => unknown): unknown
  register(options: Record<string, unknown>, component: unknown): unknown
}

/** 短 id：去掉 `session-` 前缀，取前 8 位；完整 id 留在 title 上。 */
export function shortSessionId(sessionId: string): string {
  return sessionId.replace(/^session-/, '').slice(0, 8)
}

/** 组建件的入参：框架按会话作用域传 `sessionId`。 */
export type SessionIdBarProps = {
  readonly sessionId?: unknown
}

/** 视图入参：状态与回调都从外面给，纯函数。 */
export type SessionBarViewInput = {
  readonly sessionId: string
  readonly copied: boolean
  readonly onCopy: () => void
}

/** 把「这一段头部工具」算成一个 React 元素；组件与测试共用。 */
export function sessionBarView(input: SessionBarViewInput): ReactElement {
  const full = input.sessionId
  const short = shortSessionId(full)
  return createElement(
    'div',
    {
      'data-session-id-bar': '',
      title: full,
      style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', opacity: 0.75 },
    },
    createElement(
      'code',
      { 'data-session-id-short': '', style: { fontFamily: 'var(--dsw-font-family-mono, monospace)' } },
      short,
    ),
    createElement(
      'button',
      {
        type: 'button',
        'data-session-id-copy': '',
        title: input.copied ? '已复制' : '复制完整会话 ID',
        'aria-label': input.copied ? '已复制' : '复制完整会话 ID',
        onClick: input.onCopy,
        style: {
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '4px',
          fontSize: '12px',
          color: 'inherit',
        },
      },
      input.copied ? '已复制' : '复制',
    ),
  )
}

/** 会话头部那一枚短 id + 复制按钮。 */
export function SessionIdBar(props: SessionIdBarProps): ReactElement | null {
  const [copied, setCopied] = useState(false)
  const sessionId = typeof props?.sessionId === 'string' && props.sessionId !== '' ? props.sessionId : undefined
  if (sessionId === undefined) return null
  const onCopy = (): void => {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
    if (clipboard === undefined) return
    void clipboard.writeText(sessionId).then(() => {
      setCopied(true)
      setTimeout(() => { setCopied(false) }, COPIED_MS)
    }, () => {
      // 复制被拒（非安全上下文等）时安静不动：不弹错、不抛
    })
  }
  return sessionBarView({ sessionId, copied, onCopy })
}

/** 注册进会话头部的工具排。 */
export function registerSessionIdBar(slots: HeaderSlots): unknown {
  return slots.inject(SLOT, () => slots.register(
    { name: SLOT, id: PANEL_ID, order: PANEL_ORDER },
    SessionIdBar,
  ))
}
