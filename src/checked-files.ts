/**
 * 会话作用域的轻量状态：文件勾选集合 + 工具区提示。
 *
 * 勾选集合按会话隔离：同一文件在 A 会话勾了不代表 B 会话也勾着。发送清空
 * （引用已随消息带走，勾选态不该残留）。提示是会话里最后一行错误文案。
 */
export interface SessionSetStore {
  subscribe(listener: () => void): () => void
  has(sessionId: string, path: string): boolean
  paths(sessionId: string): string[]
  toggle(sessionId: string, path: string, checked: boolean): void
  clear(sessionId: string): void
  dispose(): void
}

function createSessionSetStore(): SessionSetStore {
  const sessions = new Map<string, Set<string>>()
  const listeners = new Set<() => void>()
  const notify = (): void => { for (const listener of listeners) listener() }
  const setOf = (sessionId: string): Set<string> => {
    let set = sessions.get(sessionId)
    if (set === undefined) { set = new Set(); sessions.set(sessionId, set) }
    return set
  }
  return {
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    has(sessionId, path) { return sessions.get(sessionId)?.has(path) ?? false },
    paths(sessionId) { return [...sessions.get(sessionId) ?? []] },
    toggle(sessionId, path, checked) {
      const set = setOf(sessionId)
      if (checked) set.add(path)
      else set.delete(path)
      notify()
    },
    clear(sessionId) {
      if (sessions.get(sessionId)?.size) { sessions.set(sessionId, new Set()); notify() }
    },
    dispose() { sessions.clear(); listeners.clear() },
  }
}

export const checkedFiles = createSessionSetStore()

export interface NoticeStore {
  subscribe(listener: () => void): () => void
  get(sessionId: string): string
  set(sessionId: string, message: string): void
  clear(sessionId: string): void
  dispose(): void
}

function createNoticeStore(): NoticeStore {
  const notices = new Map<string, string>()
  const listeners = new Set<() => void>()
  const notify = (): void => { for (const listener of listeners) listener() }
  return {
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    get(sessionId) { return notices.get(sessionId) ?? '' },
    set(sessionId, message) { notices.set(sessionId, message); notify() },
    clear(sessionId) { if (notices.delete(sessionId)) notify() },
    dispose() { notices.clear(); listeners.clear() },
  }
}

export const toolsNotice = createNoticeStore()
