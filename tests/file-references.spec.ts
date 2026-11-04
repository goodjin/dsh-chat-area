/**
 * 文件引用的纯逻辑：@提及拼写、勾选/取消勾选对草稿快照的增删。
 *
 * 草稿快照形状来自宿主 conversation 的 DraftSnapshot 契约：references 是
 * 有序、不重叠的文本区间，区间文本必须等于 clipboardText。这里钉住
 * chat-area 生成/移除引用时维持这些不变量。
 */
import { describe, expect, it } from 'vitest'
import { fileMention, fileReferenceInsert, fileReferenceRemove, type FileRefSnapshot } from '../src/file-references.ts'

const empty: FileRefSnapshot = { text: '', references: [] }

describe('@提及拼写', () => {
  it('普通路径不加引号', () => {
    expect(fileMention('src/a.ts')).toBe('@src/a.ts')
  })
  it('含空格的路径加引号（与宿主 file-reference 语法一致）', () => {
    expect(fileMention('a b/c d.ts')).toBe('@"a b/c d.ts"')
  })
})

describe('勾选：插入文件引用', () => {
  it('空草稿：引用在开头，后跟一个空格', () => {
    const next = fileReferenceInsert(empty, 'src/a.ts')
    expect(next.text).toBe('@src/a.ts ')
    expect(next.references).toEqual([{
      source: 'reference', ref: '@src/a.ts', offset: 0, length: 9,
      label: 'a.ts', appearance: 'file', clipboardText: '@src/a.ts',
    }])
  })
  it('非空草稿末尾没有空白：先补一个空格再插引用', () => {
    const next = fileReferenceInsert({ ...empty, text: '帮我看看' }, 'src/a.ts')
    expect(next.text).toBe('帮我看看 @src/a.ts ')
    expect(next.references[0]!.offset).toBe(5)
  })
  it('非空草稿末尾已有空白：直接接着插', () => {
    const next = fileReferenceInsert({ ...empty, text: '帮我看看 ' }, 'src/a.ts')
    expect(next.text).toBe('帮我看看 @src/a.ts ')
    expect(next.references[0]!.offset).toBe(5)
  })
  it('连续勾选两个文件：两个引用并排、区间不重叠', () => {
    const one = fileReferenceInsert(empty, 'src/a.ts')
    const two = fileReferenceInsert(one, 'lib/b.ts')
    expect(two.text).toBe('@src/a.ts @lib/b.ts ')
    expect(two.references.map(r => r.ref)).toEqual(['@src/a.ts', '@lib/b.ts'])
    expect(two.references[1]!.offset).toBe(10)
    expect(two.references[1]!.length).toBe(9)
  })
  it('带命令 token 的草稿：引用追加在末尾，仍在 token 之后', () => {
    const next = fileReferenceInsert({ ...empty, text: '/goal 重构', command: { token: '/goal ' } }, 'src/a.ts')
    expect(next.text).toBe('/goal 重构 @src/a.ts ')
    expect(next.command).toEqual({ token: '/goal ' })
    expect(next.references[0]!.offset).toBe(9)
  })
})

describe('取消勾选：移除文件引用', () => {
  it('移除唯一引用：区间和尾随空格一起消失', () => {
    const added = fileReferenceInsert(empty, 'src/a.ts')
    const next = fileReferenceRemove(added, 'src/a.ts')
    expect(next.text).toBe('')
    expect(next.references).toEqual([])
  })
  it('移除第一个引用：后面引用的区间前移', () => {
    const two = fileReferenceInsert(fileReferenceInsert(empty, 'src/a.ts'), 'lib/b.ts')
    const next = fileReferenceRemove(two, 'src/a.ts')
    expect(next.text).toBe('@lib/b.ts ')
    expect(next.references).toHaveLength(1)
    expect(next.references[0]!.offset).toBe(0)
  })
  it('移除末尾引用：前面的引用不动', () => {
    const two = fileReferenceInsert(fileReferenceInsert(empty, 'src/a.ts'), 'lib/b.ts')
    const next = fileReferenceRemove(two, 'lib/b.ts')
    expect(next.text).toBe('@src/a.ts ')
    expect(next.references[0]!.offset).toBe(0)
  })
  it('引用不存在时草稿原样返回', () => {
    const next = fileReferenceRemove({ ...empty, text: '正文' }, 'src/a.ts')
    expect(next.text).toBe('正文')
    expect(next.references).toEqual([])
  })
  it('移除后保留 quotes 并修正其区间', () => {
    const added = fileReferenceInsert(empty, 'src/a.ts')
    const withQuote: FileRefSnapshot = {
      ...added,
      text: `${added.text}> 引文\n`,
      quotes: [{ offset: 10, length: 8, text: '引文' }],
    }
    const next = fileReferenceRemove(withQuote, 'src/a.ts')
    expect(next.text).toBe('> 引文\n')
    expect(next.quotes?.[0]!.offset).toBe(0)
  })
})
