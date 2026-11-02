/**
 * Register the ACP process view enhancement.
 *
 * Port from: dsh-client/src/acp-process-surface.tsx
 * Wraps the 'assistant-step' chat node with answer cards and link tools.
 */

type PluginContext = {
  get(name: string): unknown
  slots: {
    entries(key: string): readonly { options: Record<string, unknown>; component: unknown }[]
    subscribe(key: string, fn: () => void): () => void
    register(options: Record<string, unknown>, component: unknown): () => void
  }
}

export function registerAcpProcessView(ctx: PluginContext): () => void {
  const ui = ctx.get('uiConversation') as {
    views?: { entries(): unknown[]; subscribe(fn: () => void): () => void }
    events?: { register(definition: unknown): () => void }
  } | undefined

  if (typeof ui?.views?.entries !== 'function' || typeof ui.views.subscribe !== 'function'
    || typeof ui.events?.register !== 'function') {
    return () => {}
  }

  // Port full implementation from dsh-client/src/acp-process-surface.tsx
  return () => { /* cleanup */ }
}
