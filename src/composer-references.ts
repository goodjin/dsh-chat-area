/**
 * 勾选 → 输入框引用的落地逻辑。
 *
 * 首选宿主输入外壳（conversation 服务的 per-session input shell）：读草稿
 * 快照 → 增删引用 → 写回，宿主把引用渲染成卡片 chip。外壳不可达（服务未
 * 就绪/会话无外壳/读写抛错）时退回 execCommand 插入纯文本提及——宿主输入框
 * 的词法扫描同样把它认成引用；该兜底只支持勾选方向，取消勾选返回 false，
 * 由调用方还原勾选框并提示。
 */
import { fileMention, fileReferenceInsert, fileReferenceRemove, type FileRefSnapshot } from './file-references.ts'

/** 宿主输入外壳里 chat-power 用到的最小面。 */
export interface InputShellFace {
  readonly draftSnapshot: unknown
  setDraft(draft: unknown): void
}

export interface ReferenceApplierDeps {
  /** 会话的输入外壳；未就绪返回 undefined（也可抛错）。 */
  shellOf(sessionId: string): InputShellFace | undefined
  /** 兜底插入（聚焦 composer + execCommand insertText）。 */
  insertViaCommand?(text: string): boolean
}

/** 把未知形态的草稿快照收敛成 chat-power 可写的结构。 */
function asSnapshot(value: unknown): FileRefSnapshot {
  if (typeof value === 'object' && value !== null) {
    const record = value as { text?: unknown; references?: unknown; command?: unknown; quotes?: unknown }
    if (typeof record.text === 'string' && Array.isArray(record.references)) {
      const command = record.command as { token?: unknown } | undefined
      return {
        text: record.text,
        references: record.references as FileRefSnapshot['references'],
        ...(typeof command?.token === 'string' ? { command: { token: command.token as string } } : {}),
        ...(Array.isArray(record.quotes) ? { quotes: record.quotes as FileRefSnapshot['quotes'] } : {}),
      }
    }
  }
  return { text: '', references: [] }
}

/** 创建引用落地函数：`apply(sessionId, path, checked)` 返回是否成功。 */
export function createReferenceApplier(deps: ReferenceApplierDeps): (sessionId: string, path: string, checked: boolean) => boolean {
  return (sessionId, path, checked) => {
    const fallback = (): boolean => {
      if (!checked || deps.insertViaCommand === undefined) return false
      return deps.insertViaCommand(`${fileMention(path)} `)
    }
    let shell: InputShellFace | undefined
    try { shell = deps.shellOf(sessionId) } catch { shell = undefined }
    if (shell === undefined || typeof shell.setDraft !== 'function') return fallback()
    try {
      const snapshot = asSnapshot(shell.draftSnapshot)
      const next = checked ? fileReferenceInsert(snapshot, path) : fileReferenceRemove(snapshot, path)
      shell.setDraft(next)
      return true
    } catch {
      return fallback()
    }
  }
}
