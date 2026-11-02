/**
 * Register the lost input recovery surface.
 *
 * Port from: dsh-client/src/lost-input.ts
 */

type PluginContext = {
  get(name: string): unknown
  logger(name: string): { warn(message: string): void }
  slots: {
    inject(key: string, callback: () => unknown): unknown
    register(options: unknown, component: unknown): unknown
  }
}

export function registerLostInput(ctx: PluginContext): void {
  const uiConversation = ctx.get('uiConversation')
  const events = (uiConversation as Record<string, unknown>)?.events as Record<string, unknown> | undefined
  const register = events?.register

  if (typeof register !== 'function') {
    ctx.logger(name).warn('lost input: uiConversation.events unavailable — failed turns keep their unsent request hidden')
    return
  }

  // Port full implementation from dsh-client/src/lost-input.ts
  // Includes: state definition, node definition, card component, resend logic
}
