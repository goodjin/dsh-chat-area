/**
 * Answer edit: editing toggle and copy button for a turn's final answer.
 *
 * Wraps the answer content with a header containing:
 * - Thinking icon
 * - Edit toggle (swaps body for a full-screen textarea)
 * - Copy button (shows checkmark after success)
 *
 * When editing, the prose can be sent to the current session or a new session
 * as a task — the same affordance the file reader offers, applied to the answer.
 *
 * Registered into: conversation.chat.node (keyed, wraps 'assistant-step')
 * Works with any agent type, not just ACP.
 */

export const name = 'threadharbor-answer-edit'
export const inject = ['slots', 'remote'] as const

export { registerAnswerEdit } from './register.js'
export { AnswerCard } from './answer-card.js'

import type { PluginContext } from '../index.js'

export function applyAnswerEdit(ctx: PluginContext): void {
  const log = ctx.logger(name)

  ctx.effect(() => {
    try {
      registerAnswerEdit(ctx)
      log.info('answer edit: registered')
    } catch (error: unknown) {
      log.warn(`answer edit: registration failed — ${error instanceof Error ? error.message : String(error)}`)
    }
  }, 'threadharbor: answer edit')
}
