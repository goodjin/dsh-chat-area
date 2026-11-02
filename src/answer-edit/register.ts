/**
 * Register the answer edit card into the conversation chat node.
 *
 * Wraps the 'assistant-step' chat node with an AnswerCard that adds
 * edit/copy controls around the final answer content.
 *
 * Port from: dsh-client/src/acp-process-surface.tsx (AnswerCard usage)
 */

import type { FileReaders } from '../file-view/readers.js'

type PluginContext = {
  get(name: string): unknown
  slots: {
    entries(key: string): readonly { options: Record<string, unknown>; component: unknown }[]
    subscribe(key: string, fn: () => void): () => void
    register(options: Record<string, unknown>, component: unknown): () => void
  }
}

export function registerAnswerEdit(ctx: PluginContext): () => void {
  const uiConversation = ctx.get('uiConversation')
  const views = (uiConversation as Record<string, unknown>)?.views as
    { entries(): readonly unknown[]; subscribe(fn: () => void): () => void } | undefined
  const events = (uiConversation as Record<string, unknown>)?.events as
    { register(definition: unknown): () => void } | undefined

  if (typeof views?.entries !== 'function' || typeof views?.subscribe !== 'function'
    || typeof events?.register !== 'function') {
    return () => {}
  }

  // Port full implementation from dsh-client/src/acp-process-surface.tsx
  // Strategy: wrap the 'assistant-step' node renderer, adding AnswerCard
  // around the answer step content.
  return () => { /* cleanup */ }
}
