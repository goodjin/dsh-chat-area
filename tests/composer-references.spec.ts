/**
 * 勾选 → 输入框引用的落地逻辑。
 *
 * 首选宿主输入外壳（会话作用域的 input shell）：读草稿快照 → 增删引用 →
 * 写回。外壳不可达时退回 execCommand 插入纯文本提及（只支持勾选方向）。
 */
import { describe, expect, it, vi } from 'vitest'
import { createReferenceApplier } from '../src/composer-references.ts'

type MockFn = ReturnType<typeof vi.fn>

function shellOf(snapshot: unknown, setDraft: MockFn = vi.fn()): { draftSnapshot: unknown; setDraft: MockFn } {
  return { draftSnapshot: snapshot, setDraft }
}

describe('引用落地', () => {
  it('勾选：经外壳把引用写回草稿', () => {
    const shell = shellOf({ text: '', references: [] })
    const apply = createReferenceApplier({ shellOf: () => shell })
    expect(apply('s', 'src/a.ts', true)).toBe(true)
    const written = shell.setDraft.mock.calls[0]![0] as { text: string; references: unknown[] }
    expect(written.text).toBe('@src/a.ts ')
    expect(written.references).toHaveLength(1)
  })
  it('取消勾选：经外壳把引用从草稿移除', () => {
    const shell = shellOf({ text: '@src/a.ts ', references: [{ source: 'reference', ref: '@src/a.ts', offset: 0, length: 9, label: 'a.ts', appearance: 'file', clipboardText: '@src/a.ts' }] })
    const apply = createReferenceApplier({ shellOf: () => shell })
    expect(apply('s', 'src/a.ts', false)).toBe(true)
    const written = shell.setDraft.mock.calls[0]![0] as { text: string; references: unknown[] }
    expect(written.text).toBe('')
    expect(written.references).toHaveLength(0)
  })
  it('外壳不可达：勾选退回 execCommand 插入提及文本', () => {
    const insert = vi.fn(() => true)
    const apply = createReferenceApplier({ shellOf: () => undefined, insertViaCommand: insert })
    expect(apply('s', 'src/a.ts', true)).toBe(true)
    expect(insert).toHaveBeenCalledWith('@src/a.ts ')
  })
  it('外壳不可达：取消勾选不成功（返回 false，由调用方还原勾选框）', () => {
    const insert = vi.fn(() => true)
    const apply = createReferenceApplier({ shellOf: () => undefined, insertViaCommand: insert })
    expect(apply('s', 'src/a.ts', false)).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })
  it('外壳读写抛错：退回 execCommand', () => {
    const insert = vi.fn(() => true)
    const apply = createReferenceApplier({
      shellOf: () => ({ draftSnapshot: undefined, setDraft: () => { throw new Error('boom') } }),
      insertViaCommand: insert,
    })
    expect(apply('s', 'src/a.ts', true)).toBe(true)
    expect(insert).toHaveBeenCalledWith('@src/a.ts ')
  })
})
