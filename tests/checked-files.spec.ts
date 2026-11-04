/**
 * 会话级勾选集合与工具区提示的纯状态。
 *
 * 勾选集合按会话隔离：同一文件在 A 会话勾了不代表 B 会话也勾着；发送清空后
 * 引用已随消息带走，勾选态不该残留。提示是会话作用域的最后一行错误文案。
 */
import { describe, expect, it } from 'vitest'
import { checkedFiles, toolsNotice } from '../src/checked-files.ts'

describe('会话级文件勾选集合', () => {
  it('按会话隔离勾选状态', () => {
    checkedFiles.toggle('one', 'src/a.ts', true)
    expect(checkedFiles.has('one', 'src/a.ts')).toBe(true)
    expect(checkedFiles.has('two', 'src/a.ts')).toBe(false)
    checkedFiles.dispose()
  })
  it('取消勾选移除记录', () => {
    checkedFiles.toggle('one', 'src/a.ts', true)
    checkedFiles.toggle('one', 'src/a.ts', false)
    expect(checkedFiles.has('one', 'src/a.ts')).toBe(false)
    checkedFiles.dispose()
  })
  it('发送清空该会话的勾选', () => {
    checkedFiles.toggle('one', 'src/a.ts', true)
    checkedFiles.toggle('one', 'lib/b.ts', true)
    checkedFiles.clear('one')
    expect(checkedFiles.paths('one')).toEqual([])
    checkedFiles.dispose()
  })
  it('状态变化通知订阅者', () => {
    let calls = 0
    const stop = checkedFiles.subscribe(() => { calls += 1 })
    checkedFiles.toggle('one', 'src/a.ts', true)
    stop()
    checkedFiles.toggle('one', 'lib/b.ts', true)
    expect(calls).toBe(1)
    checkedFiles.dispose()
  })
})

describe('会话作用域的工具提示', () => {
  it('记录并按会话读取，新会话没有提示', () => {
    toolsNotice.set('one', '文件超过 5 MB')
    expect(toolsNotice.get('one')).toBe('文件超过 5 MB')
    expect(toolsNotice.get('two')).toBe('')
    toolsNotice.dispose()
  })
  it('清除后为空', () => {
    toolsNotice.set('one', '读取失败')
    toolsNotice.clear('one')
    expect(toolsNotice.get('one')).toBe('')
    toolsNotice.dispose()
  })
})
