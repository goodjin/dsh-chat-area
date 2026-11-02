/**
 * Lost input: recover failed turns whose message never reached the conversation.
 *
 * When a turn fails after claim but before user/message is persisted,
 * the original text is only in inbox splice events. This feature reconstructs
 * that combination and shows a recovery row with copy/resend buttons.
 *
 * Registered into: conversation.chat.node (custom node kind)
 * Host dependency: uiConversation service, sessions service
 */

export const name = 'threadharbor-lost-input'
export const inject = ['slots', 'uiConversation', 'sessions'] as const

export { registerLostInput } from './register.js'

import type { PluginContext } from '../index.js'

export function applyLostInput(ctx: PluginContext): void {
  const log = ctx.logger(name)

  ctx.effect(() => {
    try {
      registerLostInput(ctx)
      log.info('lost input: registered')
    } catch (error: unknown) {
      log.warn(`lost input: registration failed — ${error instanceof Error ? error.message : String(error)}`)
    }
  }, 'threadharbor: lost input')
}
