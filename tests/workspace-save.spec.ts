/**
 * 工作区文件保存：浏览器侧发送端的行为。
 */

import { describe, expect, it } from 'vitest'
import { saveWorkspaceText, WORKSPACE_FILE_ROUTE } from '../src/workspace-save.ts'
import { WORKSPACE_FILE_ROUTE as HOST_ROUTE } from '../src/workspace-write.ts'

describe('saveWorkspaceText', () => {
  it('POST 到写回路由，体是 {sessionId, path, text} 的 JSON', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const ok = new Response('{"ok":true}', { status: 200 })
    await saveWorkspaceText('session-1', 'docs/a.md', '# hello', (async (url: string, init?: RequestInit) => {
      calls.push({ url, init: init ?? {} })
      return ok
    }) as unknown as typeof fetch)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe(WORKSPACE_FILE_ROUTE)
    expect(calls[0]!.init.method).toBe('POST')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ sessionId: 'session-1', path: 'docs/a.md', text: '# hello' })
  })

  it('2xx 都算成功', async () => {
    await expect(saveWorkspaceText('s', 'a.md', 'x', (async () => new Response(null, { status: 204 })) as unknown as typeof fetch)).resolves.toBeUndefined()
  })

  it('非 2xx 抛错（调用方据此提示并保留正文）', async () => {
    await expect(saveWorkspaceText('s', 'a.md', 'x', (async () => new Response('forbidden', { status: 403 })) as unknown as typeof fetch)).rejects.toThrow('HTTP 403')
    await expect(saveWorkspaceText('s', 'a.md', 'x', (async () => new Response(null, { status: 500 })) as unknown as typeof fetch)).rejects.toThrow('HTTP 500')
  })

  it('网络错误原样抛出', async () => {
    await expect(saveWorkspaceText('s', 'a.md', 'x', (async () => { throw new Error('socket hang up') }) as unknown as typeof fetch)).rejects.toThrow('socket hang up')
  })
})

describe('路由同源', () => {
  it('客户端与宿主用同一个路径', () => {
    expect(WORKSPACE_FILE_ROUTE).toBe(HOST_ROUTE)
    expect(WORKSPACE_FILE_ROUTE).toBe('/chat-power/workspace-file')
  })
})
