/**
 * File view: in-conversation file reading, editing, and open-with picker.
 *
 * Extracts file paths from turn output/deliverables, expands them inline
 * in the conversation, supports editing and sending content back to the session.
 *
 * Registered into: conversation.chat.turnTail
 * Host dependency: remote.workspaceFiles, remote.session
 */

export const name = 'threadharbor-file-view'
export const inject = ['slots', 'remote'] as const

export { createFileReaders } from './readers.js'
export type { FileReaders, FileTextPage, FileApplication, FileOpenAction } from './readers.js'
export { setActiveFile, getActiveFile, toggleFileOpen, toggleFileEditing } from './active-state.js'
export type { FileUiState } from './active-state.js'
export { registerFileView } from './register.js'

import type { PluginContext } from '../index.js'

export function applyFileView(ctx: PluginContext): void {
  const log = ctx.logger(name)

  const readers = createFileReaders(() => ctx.get('remote'))

  ctx.effect(() => {
    try {
      const dispose = registerFileView(ctx.slots, readers)
      log.info('file view: registered')
      return dispose
    } catch (error: unknown) {
      log.warn(`file view: registration failed — ${error instanceof Error ? error.message : String(error)}`)
    }
  }, 'threadharbor: file view')
}
