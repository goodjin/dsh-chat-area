import { afterEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ scopes: [] as string[], source: undefined as any }))
vi.mock('@deepseek-ai/dsh-client-ui-sidebar-files', () => ({
  inject: ['slots', 'sidebarRight', 'sidebarRightTabs'],
  apply(ctx: any) {
    fixture.source = ctx
    ctx.sidebarRightTabs.register({ kind: 'files', id: 'files-test', title: () => 'Files' })
    ctx.slots.register({ name: 'sidebar.right.pane.tab', key: 'files-test',
      store: { create: (scope: string) => { fixture.scopes.push(scope); return {} } },
      children: { 'sidebar.right.tab.files.actions': { kind: 'list', scope: 'session' } },
    }, () => null)
  },
}))
import { createToolsAdapter } from '../src/tools-adapter.tsx'
import { toolsState } from '../src/tools-state.ts'
afterEach(() => { toolsState.dispose(); fixture.scopes.length = 0 })
function host() {
  const register = vi.fn(() => () => {})
  const nativeOpen = vi.fn()
  const original = { openTabIn: nativeOpen, openTabs: { getSnapshot: () => [], subscribe: () => () => {} } }
  const ctx: any = {
    slots: { register },
    get: (key: string) => key === 'sidebarRight' ? original : undefined,
    inject: (_names: string[], callback: any) => callback(ctx),
    effect: () => {},
  }
  return { ctx, register, nativeOpen }
}
describe('private feature adapter', () => {
  it('namespaces seats and persisted stores without changing the native sidebar', () => {
    const h = host(); const adapter = createToolsAdapter(h.ctx); adapter.install()
    const [options] = h.register.mock.calls[0] as unknown as [any]
    expect(options.name).toBe('chat-area.tools.pane.tab')
    expect(Object.keys(options.children)).toEqual(['chat-area.tools.tab.files.actions'])
    options.store.create('session-one')
    expect(fixture.scopes).toEqual(['chat-area.tools.session-one'])
    fixture.source.sidebarRight.openTabIn('session-one', 'files')
    expect(toolsState.get('session-one').tabs).toHaveLength(1)
    expect(h.nativeOpen).not.toHaveBeenCalled()
  })
  it('aborts private tab lifetime and runs its resource cleanup on close', () => {
    const h = host(); const adapter = createToolsAdapter(h.ctx); adapter.install()
    const close = vi.fn()
    fixture.source.sidebarRight.registerCloseHandler('files', close)
    const tab = adapter.open('one', 'files')
    const occurrence = adapter.occurrence('one', tab)
    adapter.close('one', tab.id)
    expect(close).toHaveBeenCalledWith('one', tab)
    expect(occurrence.signal.aborted).toBe(true)
    expect(h.nativeOpen).not.toHaveBeenCalled()
  })
})
