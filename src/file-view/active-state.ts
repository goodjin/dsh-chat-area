/**
 * Shared "active file" state for the file panel.
 *
 * Tracks which file is currently active and per-file open/edit state.
 * Shared between the action bar and inline file entries so they stay in sync.
 */

export interface FileUiState {
  readonly open: boolean
  readonly editing: boolean
}

const EMPTY_STATE: FileUiState = { open: false, editing: false }

let activePath: string | null = null
const fileStates = new Map<string, FileUiState>()
const listeners = new Set<() => void>()

export function getActiveFile(): string | null { return activePath }

export function setActiveFile(path: string | null | undefined): void {
  const next = typeof path === 'string' && path.length > 0 ? path : null
  if (next === activePath) return
  activePath = next
  emit()
}

export function resetActiveFile(): void {
  activePath = null
  fileStates.clear()
  emit()
}

export function subscribeActiveFile(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getFileState(path: string): FileUiState {
  return fileStates.get(path) ?? EMPTY_STATE
}

export function setFileState(path: string, next: FileUiState): void {
  fileStates.set(path, next)
  emit()
}

export function toggleFileOpen(path: string): void {
  const state = getFileState(path)
  setFileState(path, { open: !state.open, editing: state.editing })
}

export function toggleFileEditing(path: string): void {
  const state = getFileState(path)
  setFileState(path, { open: state.open, editing: !state.editing })
}

function emit(): void {
  for (const listener of listeners) listener()
}
