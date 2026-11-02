/**
 * Register the file view panel into the conversation turnTail slot.
 *
 * Port from: dsh-client/src/markdown-turn.tsx
 * Full implementation includes file list, expand/collapse, content loading,
 * Markdown rendering, edit mode, open-with picker, line selection.
 */

import type { FileReaders } from './readers.js'

const TAIL_ID = 'threadharbor-file-view'
const TAIL_ORDER = 5

type TailSlotHost = {
  inject(key: string, callback: () => (() => void) | Iterable<() => void, void, void>): () => void
  register(options: Record<string, unknown>, component: unknown): () => void
}

export function registerFileView(slots: TailSlotHost, _readers: FileReaders): () => void {
  return slots.inject('conversation.chat.turnTail', () => slots.register(
    {
      name: 'conversation.chat.turnTail',
      id: TAIL_ID,
      order: TAIL_ORDER,
      locale: 'conversationFiles',
    },
    () => null, // Port full component from dsh-client markdown-turn.tsx
  ))
}
