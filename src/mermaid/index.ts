/**
 * Mermaid: render Mermaid diagrams in conversation Markdown.
 *
 * Intercepts ```mermaid code blocks in the conversation, lazily loads the
 * mermaid runtime from the host's static asset route, and renders diagrams.
 *
 * No slot registration — operates at the DOM level on rendered Markdown.
 * Host dependency: GET /threadharbor/mermaid.js (provided by dsh-acp-agent or similar)
 */

export const name = 'threadharbor-mermaid'
export const inject = ['slots'] as const

export { registerMermaid } from './register.js'

import type { PluginContext } from '../index.js'

export function applyMermaid(ctx: PluginContext): void {
  const log = ctx.logger(name)

  ctx.effect(() => {
    try {
      const dispose = registerMermaid()
      log.info('mermaid: registered')
      return dispose
    } catch (error: unknown) {
      log.warn(`mermaid: registration failed — ${error instanceof Error ? error.message : String(error)}`)
    }
  }, 'threadharbor: mermaid')
}
