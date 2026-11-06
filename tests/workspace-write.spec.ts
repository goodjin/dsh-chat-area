/**
 * 工作区文件受限写回通道（宿主侧行）。
 *
 * 宿主的 workspaceFiles 只读（接口设计如此），而「文件编辑 → 仅保存」需要一个
 * 能写回的口子。这里照 mermaid-asset 的同款模式补一条宿主侧 exact 路由：
 * 同一登录准入（connection.admit）、只认 POST JSON、路径必须落在会话自己的
 * 工作区根之内（会话头 cwd，退回沙箱根；拒绝绝对路径、`..`、反斜杠与目录跳跃）、
 * 正文有大小上限。写文件走注入面（默认 node:fs），测试不碰真文件系统。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it } from 'vitest'
import { apply, registerWorkspaceWriteRoute, WORKSPACE_FILE_ROUTE } from '../src/workspace-write.ts'
import type { WorkspaceWriteContext } from '../src/workspace-write.ts'

type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
interface CapturedRoute {
  kind: 'exact' | 'prefix'
  path: string
  handler: RouteHandler
}

function fakeConnection(options: { trustedHost?: string } = {}) {
  const connection = {
    admit(request: { headers?: Record<string, string> }) {
      if (options.trustedHost !== undefined && request.headers?.['host'] !== options.trustedHost) {
        return { rejection: 403 as const }
      }
      if ((request.headers?.['cookie'] ?? '') !== 'dsh-session=good') return { rejection: 401 as const }
      return { peer: { role: 'operator' } }
    },
  }
  return connection
}

/** 最小宿主面：effect 立即执行，webServer.register 捕获路由，logger 记 warn。 */
function rig(options: { sessions?: Record<string, { header?: { cwd?: string } }>; workspaceRoot?: string; trustedHost?: string } = {}) {
  const routes: CapturedRoute[] = []
  const warns: string[] = []
  const writes: Array<{ full: string; text: string }> = []
  let writeError: Error | undefined
  const ctx = {
    effect(factory: () => unknown) {
      factory()
      return () => {}
    },
    webServer: {
      register(route: CapturedRoute) {
        routes.push(route)
        return () => {}
      },
    },
    connection: fakeConnection({ trustedHost: options.trustedHost }),
    sessions: { get: (id: string) => options.sessions?.[id] },
    sandboxPolicy: { workspaceRoot: options.workspaceRoot },
    logger(name: string) {
      return { warn(message: string) { warns.push(`${name}: ${message}`) } }
    },
  } as unknown as WorkspaceWriteContext
  const deps = {
    writeFile: async (full: string, text: string) => {
      if (writeError !== undefined) throw writeError
      writes.push({ full, text })
    },
  }
  return { ctx, routes, warns, writes, deps, setWriteError: (error: Error) => { writeError = error } }
}

interface Answer {
  status: number
  body: string | undefined
}

/** 请进来一次：带合法 cookie 与 JSON 体，收回状态码与体。 */
async function callRoute(
  route: CapturedRoute | undefined,
  init: { method?: string; cookie?: string; host?: string; body?: string } = {},
): Promise<Answer> {
  if (route === undefined) throw new Error('route was not registered')
  const payload = init.body
  const req = {
    method: init.method ?? 'POST',
    headers: {
      host: init.host ?? 'trusted.example',
      cookie: init.cookie ?? 'dsh-session=good',
      ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
    },
    // IncomingMessage 可异步迭代；测试里给一段固定字节。
    async *[Symbol.asyncIterator]() {
      if (payload !== undefined) yield Buffer.from(payload, 'utf8')
    },
  } as unknown as IncomingMessage
  let status = 0
  let bodyOut: string | undefined
  const res = {
    writeHead(code: number) { status = code },
    end(body?: string) { bodyOut = body },
  } as unknown as ServerResponse
  await route.handler(req, res)
  return { status, body: bodyOut }
}

const GOOD_BODY = (path = 'docs/a.md', text = '# hello'): string => JSON.stringify({ sessionId: 'session-1', path, text })

describe('workspace-write 路由', () => {
  it('注册一条 exact 的 /chat-power/workspace-file 路由，路径与客户端常量一致', () => {
    const { ctx, routes } = rig()
    apply(ctx)
    expect(routes).toHaveLength(1)
    expect(routes[0]).toMatchObject({ kind: 'exact', path: WORKSPACE_FILE_ROUTE })
    expect(WORKSPACE_FILE_ROUTE).toBe('/chat-power/workspace-file')
  })

  it('准入通过时 200 写入：会话工作区根 + 相对路径，正文原样落盘', async () => {
    const { ctx, routes, writes, deps } = rig({ sessions: { 'session-1': { header: { cwd: '/ws/root' } } } })
    registerWorkspaceWriteRoute(ctx, deps)
    const answer = await callRoute(routes[0], { body: GOOD_BODY() })
    expect(answer.status).toBe(200)
    expect(answer.body).toBe('{"ok":true}')
    expect(writes).toEqual([{ full: '/ws/root/docs/a.md', text: '# hello' }])
  })

  it('会话头没有 cwd 时退回沙箱根', async () => {
    const { ctx, routes, writes, deps } = rig({ sessions: { 'session-1': { header: {} } }, workspaceRoot: '/sandbox/root' })
    registerWorkspaceWriteRoute(ctx, deps)
    const answer = await callRoute(routes[0], { body: GOOD_BODY('b.txt', 'x') })
    expect(answer.status).toBe(200)
    expect(writes[0]?.full).toBe('/sandbox/root/b.txt')
  })

  it('无 cookie 401、Host 不可信 403，短体固定', async () => {
    const { ctx, routes, deps, writes } = rig({ trustedHost: 'trusted.example', sessions: { 'session-1': { header: { cwd: '/ws' } } } })
    registerWorkspaceWriteRoute(ctx, deps)
    expect(await callRoute(routes[0], { cookie: '', host: 'trusted.example', body: GOOD_BODY() }))
      .toMatchObject({ status: 401, body: 'unauthorized' })
    expect(await callRoute(routes[0], { cookie: 'dsh-session=good', host: 'evil.example', body: GOOD_BODY() }))
      .toMatchObject({ status: 403, body: 'forbidden' })
    expect(writes).toHaveLength(0)
  })

  it('非 POST 一律 405', async () => {
    const { ctx, routes, deps } = rig({ sessions: { 'session-1': { header: { cwd: '/ws' } } } })
    registerWorkspaceWriteRoute(ctx, deps)
    expect(await callRoute(routes[0], { method: 'GET', body: GOOD_BODY() })).toMatchObject({ status: 405 })
  })

  it('体不是 JSON 或字段缺失回 400，不写入', async () => {
    const { ctx, routes, deps, writes } = rig({ sessions: { 'session-1': { header: { cwd: '/ws' } } } })
    registerWorkspaceWriteRoute(ctx, deps)
    expect(await callRoute(routes[0], { body: 'not-json' })).toMatchObject({ status: 400 })
    expect(await callRoute(routes[0], { body: JSON.stringify({ sessionId: 'session-1', path: 'a.md' }) })).toMatchObject({ status: 400 })
    expect(await callRoute(routes[0], { body: JSON.stringify({ sessionId: 'session-1', text: 'x' }) })).toMatchObject({ status: 400 })
    expect(writes).toHaveLength(0)
  })

  it('路径越界一律 400：绝对路径、..、反斜杠、目录跳跃都不写', async () => {
    const { ctx, routes, deps, writes } = rig({ sessions: { 'session-1': { header: { cwd: '/ws/root' } } } })
    registerWorkspaceWriteRoute(ctx, deps)
    for (const path of ['/etc/passwd', '../outside.md', 'a\\b.md', 'docs/../../outside.md', '']) {
      expect(await callRoute(routes[0], { body: GOOD_BODY(path) })).toMatchObject({ status: 400 })
    }
    expect(writes).toHaveLength(0)
  })

  it('不认识的会话回 404', async () => {
    const { ctx, routes, deps } = rig({ workspaceRoot: '/sandbox/root' })
    registerWorkspaceWriteRoute(ctx, deps)
    expect(await callRoute(routes[0], { body: GOOD_BODY() })).toMatchObject({ status: 404 })
  })

  it('正文超过上限回 413，不写入', async () => {
    const { ctx, routes, deps, writes } = rig({ sessions: { 'session-1': { header: { cwd: '/ws' } } } })
    registerWorkspaceWriteRoute(ctx, { ...deps, maxBytes: 8 })
    const answer = await callRoute(routes[0], { body: GOOD_BODY('big.md', 'x'.repeat(64)) })
    expect(answer.status).toBe(413)
    expect(writes).toHaveLength(0)
  })

  it('写失败回 500 短体，只报原因不回显路径', async () => {
    const { ctx, routes, deps, warns, setWriteError } = rig({ sessions: { 'session-1': { header: { cwd: '/ws/secret' } } } })
    setWriteError(new Error('EACCES: /ws/secret/docs/a.md denied'))
    registerWorkspaceWriteRoute(ctx, deps)
    const answer = await callRoute(routes[0], { body: GOOD_BODY() })
    expect(answer.status).toBe(500)
    expect(answer.body).toBe('workspace write failed')
    expect(warns).toHaveLength(1)
    expect(warns[0]).toContain('EACCES')
  })
})
