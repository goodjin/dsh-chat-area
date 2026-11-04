/**
 * 工作区全文读取：分页拼装 + 体积/行数上限。
 *
 * 复制全文、文件行编辑共用这条读法。超过限制抛错，绝不返回残缺正文；
 * 页拼装复用 markdown-turn-sources 的 readMarkdownText（页与页之间补换行）。
 */
import { readMarkdownText } from './markdown-turn-sources.ts'
import { LOCAL_FILE_MAX_BYTES } from './local-file.tsx'

/** workspaceFiles.read 的正文页形状。 */
export type TextPageReader = (offset: number) => Promise<{ text: string; lines: number; eof: boolean }>

/** 工作区文本编辑的行数上限：超过就拒绝，不读半篇。 */
export const WORKSPACE_MAX_LINES = 20000

/**
 * 读一整篇工作区文本。
 * @throws 正文超过 {@link LOCAL_FILE_MAX_BYTES}、超过 {@link WORKSPACE_MAX_LINES} 行，或 signal 中止时。
 */
export async function readEntireWorkspaceText(
  sessionId: string,
  path: string,
  readPage: TextPageReader,
  signal: AbortSignal,
): Promise<string> {
  let size = 0
  const result = await readMarkdownText(async offset => {
    if (signal.aborted) throw new Error('workspace text read aborted')
    const page = await readPage(offset)
    size += new TextEncoder().encode(page.text).length
    if (size > LOCAL_FILE_MAX_BYTES) throw new Error('文件超过 5 MB')
    return page
  }, WORKSPACE_MAX_LINES)
  if (signal.aborted) throw new Error('workspace text read aborted')
  if (result.truncated) throw new Error(`文件超过 ${WORKSPACE_MAX_LINES} 行，无法完整复制或编辑`)
  return result.text
}
