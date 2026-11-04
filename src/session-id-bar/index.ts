/** 会话头部短 ID 与复制；文件入口由 conversation-tools 负责。 */
import { useEffect, useRef, useState } from 'react'
import { createElement } from 'react'
import { IconCheckOutlineRegular, IconCopyOutlineRegular, IconWarningOutlineRegular, Toast, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { RuntimeT } from '../locales.ts'
import { NAMESPACE, fallbackT } from '../locales.ts'
import css from './session-id-bar.module.css'

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

/**
 * 词条解析：框给的 `t` 解不出来时会**原样返回键名**（词典没注册、语言缺失），
 * 那时退回本地词典——界面上不能出现 `panel.sessionBar.copy` 这种东西。
 * @param t - 框架给的翻译座位。
 * @param key - 词条键。
 * @returns 要显示的文字。
 */
export function textOf(t: RuntimeT, key: string): string {
  const value = t(key)
  return value === key ? fallbackT(key) : value
}

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
    createElement(Tooltip, {
      portal: true,
      label: t('panel.sessionBar.copy'),
      side: 'bottom',
      delayMs: 500,
      children: createElement('button', {
        type: 'button',
        className: css.copyBtn,
        'data-action': 'copy-session-id',
        onClick: copy,
        'aria-label': t('panel.sessionBar.copy'),
        'data-copied': state === 'copied' || undefined,
      },
        state === 'copied'
          ? createElement(IconCheckOutlineRegular, { size: 14 })
          : createElement(IconCopyOutlineRegular, { size: 14 }),
      ),
    }),
    state === 'idle' ? null : createElement(Toast, {
      key: state === 'copied' ? 'copied' : state.failed,
      text: state === 'copied'
        ? t('panel.sessionBar.copied')

          : `${t('panel.sessionBar.copyFailed')}${state.failed}`,
      icon: state === 'copied'
        ? createElement(state === 'copied' ? IconCheckOutlineRegular : IconWarningOutlineRegular)
        : createElement(IconWarningOutlineRegular),
      onDone: () => { setState('idle') },
    }),
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
