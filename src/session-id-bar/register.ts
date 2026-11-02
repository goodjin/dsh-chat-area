/**
 * Register the session ID bar into the conversation header utilities row.
 *
 * Port from: dsh-client/src/session-id-bar.ts
 * The slot is session-scoped: the framework passes sessionId as first inject arg.
 */

const TAIL_ID = 'threadharbor-session-id'

type UtilitiesSlotHost = {
  inject(key: string, callback: () => unknown): unknown
  register(options: {
    name: string
    id?: string
    locale?: string
    inject?: (sessionId: string) => unknown
  }, component: unknown): () => void
}

/** The short form shown in the bar; the full id rides the title attribute. */
function shortId(sessionId: string): string {
  return sessionId.replace(/^session-/, '').slice(0, 8)
}

export function registerSessionIdBar(slots: UtilitiesSlotHost): void {
  slots.inject('conversation.session.header.utilities', () => slots.register(
    {
      name: 'conversation.session.header.utilities',
      id: TAIL_ID,
      locale: 'conversationFiles',
      inject: (sessionId: string) => ({ sessionId }),
    },
    (props: { readonly sessionId?: string; readonly t?: (key: string) => string }) => {
      const sessionId = props.sessionId
      if (sessionId === undefined) return null

      const t = props.t ?? ((key: string) => key)

      return {
        // Port full component from dsh-client/src/session-id-bar.ts
        // Uses: createElement, useEffect, useRef, useState, navigator.clipboard
        type: 'div',
        props: {
          'data-session-id-bar': true,
          title: sessionId,
          style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', opacity: 0.75 },
        },
        children: [
          { type: 'code', props: {}, children: [shortId(sessionId)] },
          {
            type: 'button',
            props: {
              type: 'button',
              'data-action': 'copy-session-id',
              title: t('panel.sessionBar.copy'),
              style: { border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px' },
            },
            children: [t('panel.sessionBar.copy')],
          },
        ],
      }
    },
  ))
}
