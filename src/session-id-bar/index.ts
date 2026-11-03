/**
 * 会话 ID 条：显示在会话头部工具行，显示短 ID + 复制按钮。
 *
 * 从 threadharbor 迁移过来（2026-11-02），这是一个通用功能，不依赖多主机联邦。
 */
import { useEffect, useRef, useState } from 'react'
import { createElement } from 'react'
import type { RuntimeT } from '../locales.ts'
import { NAMESPACE, fallbackT } from '../locales.ts'

type BarProps = {
  readonly sessionId: string
  readonly t?: RuntimeT
}

type UtilitiesSlotHost = {
  inject(key: string, callback: () => unknown): unknown
  register(options: {
    name: string
    id?: string
    locale?: string
    inject?: (sessionId: string) => unknown
  }, component: unknown): () => void
}

/** 注册项在会话头部工具行里的 key；只用自己的 id，不去占别人的格子。 */
export const PANEL_ID = 'chat-area-session-id'

/** 短 ID 显示（完整 ID 在 title 属性里） */
export function shortId(sessionId: string): string {
  return sessionId.replace(/^session-/, '').slice(0, 8)
}

export function SessionIdBar({ sessionId, t = fallbackT }: BarProps) {
  const [state, setState] = useState<'idle' | 'copied' | { failed: string }>('idle')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => { if (timer.current !== undefined) window.clearTimeout(timer.current) }, [])

  const copy = (): void => {
    navigator.clipboard?.writeText(sessionId).then(() => {
      setState('copied')
      timer.current = window.setTimeout(() => { setState('idle') }, 2000)
    }, (error: unknown) => {
      setState({ failed: error instanceof Error ? error.message : String(error) })
    })
  }

  return createElement('div', {
    'data-session-id-bar': true,
    title: sessionId,
    style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', opacity: 0.75 },
  },
    createElement('code', { style: { fontVariantNumeric: 'tabular-nums' } }, shortId(sessionId)),
    createElement('button', {
      type: 'button',
      'data-action': 'copy-session-id',
      onClick: copy,
      style: { border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px' },
    }, t('panel.sessionBar.copy')),
    state === 'idle' ? null : createElement('span', { 'data-copy-state': true },
      state === 'copied' ? t('panel.sessionBar.copied') : `${t('panel.sessionBar.copyFailed')}${state.failed}`),
  )
}

/**
 * 注册会话 ID 条到会话头部工具行。
 * 
 * 这个座位是会话作用域的：框架会把 sessionId 作为注册回调的第一个参数传入
 * （会话包自己的头部也用它来处理视图切换器）。
 */
export function registerSessionIdBar(slots: UtilitiesSlotHost): void {
  slots.inject('conversation.session.header.utilities', () => slots.register(
    {
      name: 'conversation.session.header.utilities',
      id: PANEL_ID,
      locale: NAMESPACE,
      inject: (sessionId: string) => ({ sessionId }),
    },
    (props: { readonly sessionId?: string; readonly t?: RuntimeT }) => {
      const sessionId = props.sessionId
      // 空串等同于没有：别在会话头部画一枚只有按钮的条。
      if (sessionId === undefined || sessionId === '') return null
      return createElement(SessionIdBar, { sessionId, ...(props.t === undefined ? {} : { t: props.t }) })
    },
  ))
}
