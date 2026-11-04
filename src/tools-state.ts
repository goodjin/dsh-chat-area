/** Independent conversation tools. Never calls the host sidebar controller. */
export type ToolKind = 'files' | 'browser' | 'terminal' | 'text' | 'local'
export interface ToolTab {
  id: string
  kind: string
  contentId: string
  title: string
  params?: any
  controller: AbortController
  commands: { refresh?: () => void }
}
export interface ToolsSnapshot { expanded: boolean; active?: string; tabs: readonly ToolTab[] }
const EMPTY: ToolsSnapshot = { expanded: false, tabs: [] }
export class ToolsState {
  private sessions = new Map<string, ToolsSnapshot>()
  private listeners = new Set<() => void>()
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  get = (id: string) => this.sessions.get(id) ?? EMPTY
  private put(id: string, snapshot: ToolsSnapshot) {
    this.sessions.set(id, snapshot)
    for (const fn of this.listeners) fn()
  }
  toggle(id: string) { const s = this.get(id); this.put(id, { ...s, expanded: !s.expanded }) }
  collapse(id: string) { this.put(id, { ...this.get(id), expanded: false }) }
  select(id: string, active: string) { this.put(id, { ...this.get(id), expanded: true, active }) }
  open(id: string, kind: string, title: string, contentId = `sidebar://${kind}`, params?: any, multiple = false) {
    const s = this.get(id)
    const found = !multiple && s.tabs.find(t => t.kind === kind && t.contentId === contentId)
    if (found) { this.select(id, found.id); return found }
    const tab: ToolTab = { id: `chat-tools-${crypto.randomUUID()}`, kind, title, contentId, params, controller: new AbortController(), commands: {} }
    this.put(id, { expanded: true, active: tab.id, tabs: [...s.tabs, tab] })
    return tab
  }
  close(id: string, tabId: string) {
    const s = this.get(id)
    const tab = s.tabs.find(t => t.id === tabId)
    const tabs = s.tabs.filter(t => t.id !== tabId)
    this.put(id, { ...s, tabs, active: s.active === tabId ? tabs.at(-1)?.id : s.active })
    tab?.controller.abort()
  }
  inventory() { return [...this.sessions].flatMap(([sessionId, s]) => s.tabs.map(tab => ({ ...tab, sessionId, tabId: tab.id }))) }
  dispose() { for (const t of this.inventory()) t.controller.abort(); this.sessions.clear(); this.listeners.clear() }
}
export const toolsState = new ToolsState()
