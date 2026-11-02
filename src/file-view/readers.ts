/**
 * Readers that bridge the file panel to the host's file services.
 *
 * All operations go through the `remote` namespace:
 * - remote.workspaceFiles.read — read file content (paginated)
 * - remote.workspaceFiles.stat — get file absolute path
 * - remote.session.openWorkspacePath — open with desktop application
 * - remote.session.canOpenWorkspacePath — query desktop support
 */

export interface FileTextPage {
  readonly text: string
  readonly lines: number
  readonly eof: boolean
}

export interface FileApplication {
  readonly id: string
  readonly name: string
  readonly icon: string | null
  readonly default: boolean
}

export type FileOpenAction =
  | { readonly kind: 'default' }
  | { readonly kind: 'application'; readonly id: string }
  | { readonly kind: 'reveal' }

export interface FileReaders {
  readPage(sessionId: string, path: string, offset: number, signal: AbortSignal): Promise<FileTextPage>
  loadSummary(sessionId: string, seq: number, signal: AbortSignal): Promise<unknown>
  revealFile(sessionId: string, path: string): Promise<void>
  canOpenFiles(): Promise<boolean>
  fileApplications(sessionId: string, path: string, signal: AbortSignal): Promise<readonly FileApplication[] | null>
  openFile(sessionId: string, path: string, action: FileOpenAction): Promise<void>
  sendToSession(sessionId: string, text: string): Promise<void>
  createSession(): Promise<string>
}

/** Build the readers from a live `remote` namespace accessor. */
export function createFileReaders(_remote: () => unknown): FileReaders {
  // Implementation to be ported from dsh-client/src/markdown-turn-sources.ts
  throw new Error('Not yet implemented — port from dsh-client markdown-turn-sources.ts')
}
