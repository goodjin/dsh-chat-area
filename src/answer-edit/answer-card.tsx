/**
 * Result card for a turn's final answer.
 *
 * A header with the thinking icon, an edit toggle and a copy button,
 * then the native answer content below. Editing swaps the body for a
 * one-screen textarea whose prose can be sent to the session or a new
 * session as a task. Thinking keeps its own fold/expand inside the content.
 *
 * Port from: dsh-client/src/answer-card.tsx
 */

import { useState, type ReactNode } from 'react'

export interface AnswerTextBlock {
  readonly kind: string
  readonly text?: string
}

export interface AnswerCardProps {
  readonly children: ReactNode
  readonly blocks: readonly AnswerTextBlock[]
  readonly sessionId: string | undefined
  readonly readers: {
    sendToSession(sessionId: string, text: string): Promise<void>
    createSession(): Promise<string>
  } | undefined
  readonly t: (key: string, params?: Record<string, unknown>) => string
}

/** Plain-prose copyable text from the answer's text/reasoning blocks. */
function answerText(blocks: readonly AnswerTextBlock[]): string {
  return blocks
    .filter(block => (block.kind === 'text' || block.kind === 'reasoning') && (block.text?.trim() ?? '') !== '')
    .map(block => block.text ?? '')
    .join('\n\n')
}

/** Prefix added when sending to a new session, so the agent knows the source. */
const NEW_SESSION_HEADER = '以下为会话结果框中的内容：'

export function AnswerCard(props: AnswerCardProps): ReactNode {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const text = answerText(props.blocks)
  const canEdit = props.sessionId !== undefined && props.readers !== undefined

  // Port full component from dsh-client/src/answer-card.tsx
  // Includes: edit toggle, textarea, send to session, send to new session, copy
  return null as unknown as ReactNode // placeholder
}
