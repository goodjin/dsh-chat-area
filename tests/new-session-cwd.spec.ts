/**
 * 「新建会话」继承当前会话的工作目录。
 *
 * 2026-11-05 现场（第一次）：编辑结果块的「新建会话」调 `session.create({})`——空参数
 * 让宿主把新会话的工作目录落在 App 的默认目录（`~/.dsh/profiles/desktop`），而侧栏按
 * 项目（cwd）分组，新会话掉进一个陌生分组里，用户看到的是「没有新建成功」。
 *
 * 修复口径：调用方把当前会话 id 以 `inheritCwdFrom` 传入，readers 先查会话列表拿
 * 到它的 cwd，再以 `create({ cwd })` 建新会话——新会话与当前会话同项目、同分组。
 * 查不到（列表没有这只会话）就维持旧口径 `create({})`。
 *
 * 2026-11-05 现场（第二次，同日复现）：第一次修复没生效——宿主 remote 的
 * `session.list()` 返回的是 **{ items: [...] } 信封**（RemoteSessionService「Read all
 * visible Session rows」），而 readers 只认裸数组，`Array.isArray` 永远为 false，
 * cwd 查找从未命中，每次都静默回退默认目录。修法：两种形状都接；查不到 cwd 时
 * console.warn 自报状态，不再无声。
 */

import { describe, expect, it } from 'vitest'
import { createMarkdownTurnReaders } from '../src/markdown-turn-sources.ts'
import type { MarkdownTurnReaders } from '../src/markdown-turn-sources.ts'

/** 假 remote：session.list / session.create，create 的参数被记下来。 */
function fakeRemote(options: {
  summaries?: { sessionId: string; cwd?: string }[]
  /** list 返回形状：'envelope'（宿主真实，{items}）| 'array'（兼容旧形状）。 */
  shape?: 'envelope' | 'array'
  createError?: Error
} = {}) {
  const createCalls: unknown[] = []
  const remote = {
    session: {
      async list() {
        const summaries = options.summaries ?? []
        return options.shape === 'array' ? summaries : { items: summaries }
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
  it('信封形状（宿主真实）：inheritCwdFrom 指到当前会话，create 带 cwd', async () => {
    const { remote, createCalls } = fakeRemote({
      summaries: [{ sessionId: 's1', cwd: '/Users/good/qg/glasses/nexa-service' }],
    })
    const newId = await readersOf(remote).createSession({ inheritCwdFrom: 's1' })
    expect(newId).toBe('session-new')
    expect(createCalls[0]).toEqual({ cwd: '/Users/good/qg/glasses/nexa-service' })
  })

  it('信封形状 + session- 前缀 id（DOM attr 同源格式）：cwd 命中', async () => {
    const { remote, createCalls } = fakeRemote({
      summaries: [{ sessionId: 'session-abc', cwd: '/Users/good/qg/glasses/nexa-service' }],
    })
    await readersOf(remote).createSession({ inheritCwdFrom: 'session-abc' })
    expect(createCalls[0]).toEqual({ cwd: '/Users/good/qg/glasses/nexa-service' })
  })

  it('裸数组形状（兼容旧口径）：cwd 同样命中', async () => {
    const { remote, createCalls } = fakeRemote({
      summaries: [{ sessionId: 's1', cwd: '/x' }],
      shape: 'array',
    })
    await readersOf(remote).createSession({ inheritCwdFrom: 's1' })
    expect(createCalls[0]).toEqual({ cwd: '/x' })
  })

  it('信封形状但列表里查不到该会话：退回 create({})，行为与旧版一致', async () => {
    const { remote, createCalls } = fakeRemote({ summaries: [] })
    const newId = await readersOf(remote).createSession({ inheritCwdFrom: 's1' })
    expect(newId).toBe('session-new')
    expect(createCalls[0]).toEqual({})
  })

  it('不传 inheritCwdFrom（旧调用形状）：保持 create({})', async () => {
    const { remote, createCalls } = fakeRemote({
      summaries: [{ sessionId: 's1', cwd: '/x' }],
      shape: 'array',
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
