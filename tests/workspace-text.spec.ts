/**
 * 工作区全文读取的纯逻辑：分页拼装 + 体积/行数上限。
 *
 * 复制全文与文件行编辑共用这条读法：超过 5 MB 或 20000 行直接抛错，
 * 绝不返回残缺正文。页形状对齐 workspaceFiles.read 的正文页。
 */
import { describe, expect, it } from 'vitest'
import { readEntireWorkspaceText, type TextPageReader } from '../src/workspace-text.ts'

function readerOf(pages: { text: string; lines: number; eof: boolean }[]): TextPageReader {
  let index = 0
  return async () => {
    const page = pages[index] ?? { text: '', lines: 0, eof: true }
    index += 1
    return page
  }
}

describe('工作区全文读取', () => {
  it('分页按顺序拼成全文', async () => {
    const text = await readEntireWorkspaceText('s', 'src/a.ts', readerOf([
      { text: '第一页', lines: 2, eof: false },
      { text: '第二页', lines: 2, eof: true },
    ]), new AbortController().signal)
    expect(text).toBe('第一页\n第二页')
  })
  it('超过 20000 行抛错，不返回残缺正文', async () => {
    const long = Array.from({ length: 20001 }, (_, i) => `第${i}行`)
    await expect(readEntireWorkspaceText('s', 'big.log', readerOf([
      { text: long.join('\n'), lines: 20001, eof: false },
    ]), new AbortController().signal)).rejects.toThrow('20000')
  })
  it('超过 5 MB 抛错', async () => {
    const big = 'x'.repeat(5 * 1024 * 1024 + 1)
    await expect(readEntireWorkspaceText('s', 'big.log', readerOf([
      { text: big, lines: 1, eof: true },
    ]), new AbortController().signal)).rejects.toThrow('5 MB')
  })
  it('正好在限制内成功', async () => {
    const ok = Array.from({ length: 20000 }, (_, i) => `${i}`)
    const text = await readEntireWorkspaceText('s', 'ok.log', readerOf([
      { text: ok.join('\n'), lines: 20000, eof: true },
    ]), new AbortController().signal)
    expect(text.split('\n')).toHaveLength(20000)
  })
  it('中止后不再读下一页', async () => {
    const controller = new AbortController()
    let reads = 0
    const reader: TextPageReader = async () => {
      reads += 1
      controller.abort()
      return { text: '第一页', lines: 1, eof: false }
    }
    await expect(readEntireWorkspaceText('s', 'a.ts', reader, controller.signal)).rejects.toThrow()
    expect(reads).toBe(1)
  })
})
