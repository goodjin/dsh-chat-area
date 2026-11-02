/**
 * DSH Conversation Files — unified plugin for conversation-area enhancements.
 *
 * Generic conversation-area features that work regardless of which agent
 * is running. Agent-specific features (quota pills, model label, handover
 * card, switch progress, ACP visibility, process view, interrupted recovery,
 * lost input) belong in a separate plugin.
 *
 * Features:
 * 1. File view: in-conversation file reading, editing, open-with picker
 * 2. Mermaid: render Mermaid diagrams in Markdown code blocks
 * 3. Session ID bar: short session ID with copy button in conversation header
 */

import { applyFileView } from './file-view/index.js'
import { applyMermaid } from './mermaid/index.js'
import { applySessionIdBar } from './session-id-bar/index.js'

export const name = 'threadharbor-conversation-files'

export const inject = ['slots', 'remote'] as const

export interface PluginContext {
  logger(name: string): { info(message: string): void; warn(message: string): void }
  effect(callback: () => unknown, name?: string): unknown
  get(name: string): unknown
  slots: {
    inject(key: string, callback: () => (() => void) | Iterable<() => void, void, void>): () => void
    register(options: Record<string, unknown>, component: unknown): () => void
  }
}

export function apply(ctx: PluginContext): void {
  const log = ctx.logger(name)

  const features = [
    { label: 'file view', fn: applyFileView },
    { label: 'mermaid', fn: applyMermaid },
    { label: 'session id bar', fn: applySessionIdBar },
  ]

  for (const { label, fn } of features) {
    ctx.effect(() => {
      try {
        fn(ctx)
      } catch (error: unknown) {
        log.warn(`${label}: unavailable — ${error instanceof Error ? error.message : String(error)}`)
      }
    }, `threadharbor: ${label}`)
  }
}
