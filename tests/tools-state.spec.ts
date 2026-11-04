import { describe, expect, it } from 'vitest'
import { ToolsState } from '../src/tools-state.ts'
describe('conversation tools lifetimes', () => {
  it('isolates sessions and preserves tabs on collapse', () => {
    const state = new ToolsState()
    const tab = state.open('one', 'browser', 'Browser')
    state.toggle('one')
    expect(state.get('one').expanded).toBe(false)
    expect(state.get('one').tabs[0]).toBe(tab)
    expect(tab.controller.signal.aborted).toBe(false)
    expect(state.get('two').tabs).toEqual([])
    state.toggle('one')
    expect(state.get('one').active).toBe(tab.id)
  })
  it('closing a tab aborts its resources and selects the remaining tab', () => {
    const state = new ToolsState()
    const a = state.open('one', 'files', 'Files')
    const b = state.open('one', 'terminal', 'Terminal')
    state.close('one', b.id)
    expect(b.controller.signal.aborted).toBe(true)
    expect(a.controller.signal.aborted).toBe(false)
    expect(state.get('one').active).toBe(a.id)
    state.dispose()
    expect(a.controller.signal.aborted).toBe(true)
  })
  it('deduplicates resources but permits independent terminal and browser tabs', () => {
    const state = new ToolsState()
    expect(state.open('one','files','Files')).toBe(state.open('one','files','Files'))
    const first = state.open('one','terminal','Terminal','sidebar://terminal',undefined,true)
    const second = state.open('one','terminal','Terminal','sidebar://terminal',undefined,true)
    expect(first.id).not.toBe(second.id)
  })
})
