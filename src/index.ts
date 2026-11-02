/**
 * DSH Conversation Files — unified plugin for conversation-area enhancements.
 *
 * Features:
 * 1. File view: in-conversation file reading, editing, open-with picker
 * 2. Mermaid: render Mermaid diagrams in Markdown code blocks
 * 3. ACP process view: enhanced rendering for ACP agent process content
 * 4. Interrupted recovery: recover button for interrupted turns with no answer
 * 5. Lost input: recover failed turns whose message never reached the conversation
 *
 * All features register into conversation-area slots. Each feature degrades
 * gracefully when its dependencies are unavailable.
 */

import { applyFileView } from './file-view/index.js'
import { applyMermaid } from './mermaid/index.js'
import { applyAcpProcessView } from './acp-process-view/index.js'
import { applyInterruptedRecovery } from './interrupted-recovery/index.js'
import { applyLostInput } from './lost-input/index.js'

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
