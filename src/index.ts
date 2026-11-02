/**
 * DSH Conversation Files — unified plugin for conversation-area enhancements.
 *
 * Features:
 * 1. File view: in-conversation file reading, editing, open-with picker
 * 2. Mermaid: render Mermaid diagrams in Markdown code blocks
 * 3. ACP process view: enhanced rendering for ACP agent process content
 * 4. Interrupted recovery: recover button for turns interrupted with no answer
 * 5. Lost input: recover failed turns whose message never reached the conversation
 * 6. Session ID bar: short session ID with copy button in conversation header
 *
 * All features register into conversation-area slots. Each feature degrades
 * gracefully when its dependencies are unavailable.
 *
 * Note: Agent-related features (quota pills, model label, handover card,
 * switch progress, ACP visibility) are intentionally excluded — they belong
 * in a separate plugin (@threadharbor/dsh-acp-agent-ui) and coexist with
 * this one without conflict.
 */

import { applyFileView } from './file-view/index.js'
import { applyMermaid } from './mermaid/index.js'
import { applyAcpProcessView } from './acp-process-view/index.js'
import { applyInterruptedRecovery } from './interrupted-recovery/index.js'
import { applyLostInput } from './lost-input/index.js'
import { applySessionIdBar } from './session-id-bar/index.js'

export const name = 'threadharbor-conversation-files'

export const inject = ['slots', 'remote', 'uiConversation', 'uiWorkspace', 'sessions'] as const

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
    { label: 'acp process view', fn: applyAcpProcessView },
    { label: 'interrupted recovery', fn: applyInterruptedRecovery },
    { label: 'lost input', fn: applyLostInput },
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
