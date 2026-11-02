/**
 * Register the interrupted turn recovery button.
 *
 * Port from: dsh-client/src/interrupted-turn-recovery.ts
 */

const TAIL_ID = 'threadharbor-interrupted-recovery'
const TAIL_ORDER = 10

type TailSlotHost = {
  inject(key: string, callback: () => (() => void) | Iterable<() => void, void, void>): () => void
  register(options: Record<string, unknown>, component: unknown): () => void
}

export function registerInterruptedRecovery(slots: TailSlotHost): () => void {
  return slots.inject('conversation.chat.turnTail', () => slots.register(
    {
      name: 'conversation.chat.turnTail',
      id: TAIL_ID,
      order: TAIL_ORDER,
      locale: 'conversationFiles',
    },
    () => null, // Port full component from dsh-client interrupted-turn-recovery.ts
  ))
}
