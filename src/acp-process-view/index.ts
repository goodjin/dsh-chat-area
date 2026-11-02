/**
 * ACP process view: enhanced rendering for ACP agent process content.
 *
 * Wraps the assistant-step chat node renderer to add answer cards,
 * link hover toolbars, and other enhancements for ACP agent output.
 *
 * Registered into: conversation.chat.node (keyed, replaces 'assistant-step')
 * Host dependency: uiConversation service
 */

export const name = 'threadharbor-acp-process-view'
export const inject = ['slots', 'uiConversation'] as const

export { registerAcpProcessView } from './register.js'

import type { PluginContext } from '../index.js'

export function applyAcpProcessView(ctx: PluginContext): void {
  const log = ctx.logger(name)

  ctx.effect(() => {
    try {
      registerAcpProcessView(ctx)
      log.info('acp process view: registered')
    } catch (error: unknown) {
      log.warn(`acp process view: registration failed — ${error instanceof Error ? error.message : String(error)}`)
    }
  }, 'threadharbor: acp process view')
}
