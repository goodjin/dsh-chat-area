/**
 * Interrupted recovery: recover button for turns that were interrupted
 * with no answer body.
 *
 * Registers into conversation.chat.turnTail. Shows an expand button when
 * a turn was interrupted, has no answer anchor, but has process content.
 *
 * Registered into: conversation.chat.turnTail
 */

export const name = 'threadharbor-interrupted-recovery'
export const inject = ['slots'] as const

export { registerInterruptedRecovery } from './register.js'

import type { PluginContext } from '../index.js'

export function applyInterruptedRecovery(ctx: PluginContext): void {
  const log = ctx.logger(name)

  ctx.effect(() => {
    try {
      registerInterruptedRecovery(ctx.slots)
      log.info('interrupted recovery: registered')
    } catch (error: unknown) {
      log.warn(`interrupted recovery: registration failed — ${error instanceof Error ? error.message : String(error)}`)
    }
  }, 'threadharbor: interrupted recovery')
}
