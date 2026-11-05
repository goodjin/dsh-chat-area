/**
 * 「新建会话」继承当前会话的工作目录。
 *
 * 2026-11-05 现场：编辑结果块的「新建会话」调 `session.create({})`——空参数让宿主
 * 把新会话的工作目录落在 App 的默认目录（`~/.dsh/profiles/desktop`），而侧栏按项目
 * （cwd）分组，新会话掉进一个陌生分组里，用户看到的是「没有新建成功」。
 *
 * 修复口径：调用方把当前会话 id 以 `inheritCwdFrom` 传入，readers 先查会话列表拿
 * 到它的 cwd，再以 `create({ cwd })` 建新会话——新会话与当前会话同项目、同分组。
 * 查不到（列表没有这只会话）就维持旧口径 `create({})`。
 */

import { describe, expect, it } from 'vitest'
import { createMarkdownTurnReaders } from '../src/markdown-turn-sources.ts'
import type { MarkdownTurnReaders } from '../src/markdown-turn-sources.ts'

/** 假 remote：session.list / session.create，create 的参数被记下来。 */
function fakeRemote(options: {
  summaries?: { sessionId: string; cwd?: string }[]
  createError?: Error
} = {}) {
  const createCalls: unknown[] = []
  const remote = {
    session: {
      async list() {
        return options.summaries ?? []
      },
      async create(args: unknown) {
        if (options.createError !== undefined) throw options.createError
        createCalls.push(args)
        return { ok: true, value: { sessionId: 'session-new' } }
      },
    },
  }
  return { remote, createCalls }
}

function readersOf(remote: unknown): MarkdownTurnReaders {
  return createMarkdownTurnReaders(() => remote)
}

describe('createSession 继承当前会话的工作目录', () => {
  it('inheritCwdFrom 指到当前会话：create 带 cwd，新会话落回同一项目', async () => {
    const { remote, createCalls } = fakeRemote({
      summaries: [{ sessionId: 's1', cwd: '/Users/good/github/dsh-plugins' }],
    })
    const newId = await readersOf(remote).createSession({ inheritCwdFrom: 's1' })
    expect(newId).toBe('session-new')
    expect(createCalls[0]).toEqual({ cwd: '/Users/good/github/dsh-plugins' })
  })

  it('列表里查不到该会话：退回 create({})，行为与旧版一致', async () => {
    const { remote, createCalls } = fakeRemote({ summaries: [] })
    const newId = await readersOf(remote).createSession({ inheritCwdFrom: 's1' })
    expect(newId).toBe('session-new')
    expect(createCalls[0]).toEqual({})
  })

  it('不传 inheritCwdFrom（旧调用形状）：保持 create({})', async () => {
    const { remote, createCalls } = fakeRemote({
      summaries: [{ sessionId: 's1', cwd: '/x' }],
    })
    const newId = await readersOf(remote).createSession()
    expect(newId).toBe('session-new')
    expect(createCalls[0]).toEqual({})
  })

  it('远端拒绝创建：原样抛出，调用方据以提示失败', async () => {
    const { remote } = fakeRemote({
      summaries: [{ sessionId: 's1', cwd: '/x' }],
      createError: new Error('workspace not found'),
    })
    await expect(readersOf(remote).createSession({ inheritCwdFrom: 's1' }))
      .rejects.toThrow('workspace not found')
  })

  it('session 面缺失：报 session.create is missing（现有契约）', async () => {
    const readers = readersOf({})
    await expect(readers.createSession({ inheritCwdFrom: 's1' }))
      .rejects.toThrow('session.create is missing')
  })
})
