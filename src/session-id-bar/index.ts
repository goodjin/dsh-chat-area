/**
 * Session ID bar: display the short session ID with a copy button in the
 * conversation header utilities row.
 *
 * Registered into: conversation.session.header.utilities (list, session scope)
 * The framework passes the sessionId as the first inject argument.
 */

export const name = 'threadharbor-session-id-bar'
export const inject = ['slots'] as const

export { registerSessionIdBar } from './register.js'

import type { PluginContext } from '../index.js'

export function applySessionIdBar(ctx: PluginContext): void {
  const log = ctx.logger(name)

  ctx.effect(() => {
    try {
      registerSessionIdBar(ctx.slots)
      log.info('session id bar: registered')
    } catch (error: unknown) {
      log.warn(`session id bar: registration failed — ${error instanceof Error ? error.message : String(error)}`)
    }
  }, 'threadharbor: session id bar')
}
