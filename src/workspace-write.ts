/**
 * 工作区文件受限写回通道（宿主侧）。
 *
 * 宿主的 workspaceFiles 服务只读（接口设计如此，没有写方法），而文件编辑卡
 * 的「仅保存」需要一个能写回的口子。这里照 mermaid-asset 的同款模式挂一条
 * exact 路由，把写回范围压到最小：
 *
 * - 同一登录准入：先 `connection.admit` 再应答，拒绝时状态码原样、短体固定；
 * - 只认 POST JSON `{sessionId, path, text}`，正文有大小上限（默认 5 MB）；
 * - 会话工作区根按会话头解析（`sessions.get(sessionId)?.header?.cwd`，缺席退回
 *   沙箱根）——与 workspaceFiles 读取服务同一条解析规则；
 * - 路径必须相对、落在工作区根之内：绝对路径、`..`、反斜杠、目录跳跃一律 400；
 * - 写文件走注入面（默认 node:fs 的 writeFile），失败折成 500 短体，原因只进
 *   日志、不回显路径。
 *
 * 会话解析、准入、webServer 三个宿主面与 mermaid-asset 同源；`sessions`/
 * `sandboxPolicy` 与 workspaceFiles 服务声明的依赖一致。
 */

import { writeFile as nodeWriteFile } from 'node:fs/promises'
import { resolve as pathResolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

export const name = 'chat-power-workspace-write'

/** webServer 挂路由；connection 做准入；sessions/sandboxPolicy 解析工作区根。 */
export const inject = ['webServer', 'connection', 'sessions', 'sandboxPolicy'] as const

/** exact 路由路径；浏览器侧 workspace-save.ts 用同一个常量。 */
export const WORKSPACE_FILE_ROUTE = '/chat-power/workspace-file'

/** 默认正文上限：5 MB（与编辑器读入上限一致）。 */
export const DEFAULT_MAX_BYTES = 5 * 1024 * 1024

/** 这份入口需要的宿主面（窄接口，测试立桩照这个来）。 */
export interface WorkspaceWriteContext {
  effect(factory: () => unknown, label?: string): unknown
  webServer: {
    register(route: {
      kind: 'exact'
      path: string
      handler(request: IncomingMessage, response: ServerResponse): void | Promise<void>
    }): (() => void) | void
  }
  connection: {
    admit(request: IncomingMessage): { rejection: number } | { peer: unknown }
  }
  sessions: { get(sessionId: string): { header?: { cwd?: string } } | undefined }
  sandboxPolicy: { workspaceRoot?: string }
  /** 写失败时留一行原因；测试与窄上下文可以不给。 */
  logger?(name: string): { warn(message: string): void }
}

/** 注册时可选的注入面；生产用 node:fs，测试换假写入器。 */
export interface WorkspaceWriteRouteDeps {
  /** 写一份文本；缺省用 node:fs 写盘。 */
  writeFile?(full: string, text: string): Promise<void>
  /** 正文大小上限；缺省 5 MB。 */
  maxBytes?: number
}

/** 装载入口：挂上这条 exact 路由。 */
export function apply(ctx: WorkspaceWriteContext): void {
  registerWorkspaceWriteRoute(ctx)
}

/** 收完请求体（受上限约束）；超限返回 undefined。 */
async function readBody(request: IncomingMessage, maxBytes: number): Promise<string | undefined> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request as unknown as AsyncIterable<Buffer | string>) {
    const piece = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk
    total += piece.byteLength
    if (total > maxBytes) return undefined
    chunks.push(piece)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** 会话工作区根：会话必须存在，取会话头的 cwd，缺席退回沙箱根；没有则 undefined。 */
function sessionRoot(ctx: WorkspaceWriteContext, sessionId: string): string | undefined {
  const session = ctx.sessions.get(sessionId)
  if (session === undefined) return undefined
  return session.header?.cwd ?? ctx.sandboxPolicy.workspaceRoot
}

/** 会话工作区内的相对路径校验：拒绝绝对路径、反斜杠与任何形式的向上跳。 */
function safeRelativePath(path: string): string | undefined {
  if (path === '' || path.startsWith('/') || path.includes('\\')) return undefined
  if (pathResolve('/', path) === '/') return undefined
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') return undefined
  }
  return path
}

/** 工作区根之内才放行：拼出的绝对路径必须等于根或在根目录之下。 */
function insideRoot(root: string, full: string): boolean {
  const normalizedRoot = root.endsWith(sep) ? root.slice(0, -sep.length) : root
  return full === normalizedRoot || full.startsWith(normalizedRoot + sep)
}

/**
 * 注册受限写回路由，走 DSH 插件的登记样式。
 * @param ctx - 宿主上下文（effect / webServer / connection / sessions / sandboxPolicy）。
 * @param deps - 可选注入面；缺省用 node:fs 写盘、5 MB 上限。
 */
export function registerWorkspaceWriteRoute(ctx: WorkspaceWriteContext, deps: WorkspaceWriteRouteDeps = {}): void {
  const writeFile = deps.writeFile ?? nodeWriteFile
  const maxBytes = deps.maxBytes ?? DEFAULT_MAX_BYTES
  ctx.webServer.register({
    kind: 'exact',
    path: WORKSPACE_FILE_ROUTE,
    handler: async (request, response) => {
      const admit = ctx.connection.admit(request)
      if ('rejection' in admit) {
        response.writeHead(admit.rejection, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        response.end(admit.rejection === 401 ? 'unauthorized' : 'forbidden')
        return
      }
      if (request.method !== 'POST') {
        response.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        response.end('method not allowed')
        return
      }
      const body = await readBody(request, maxBytes)
      if (body === undefined) {
        response.writeHead(413, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        response.end('payload too large')
        return
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(body)
      } catch {
        parsed = undefined
      }
      const shape = parsed as { sessionId?: unknown; path?: unknown; text?: unknown } | undefined
      if (shape === null || typeof shape !== 'object'
        || typeof shape.sessionId !== 'string' || shape.sessionId === ''
        || typeof shape.path !== 'string'
        || typeof shape.text !== 'string') {
        response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        response.end('bad request')
        return
      }
      // 会话必须存在：宿主不认识的会话不提供写回（404），没有 cwd 才退回沙箱根。
      const root = sessionRoot(ctx, shape.sessionId)
      if (root === undefined) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        response.end('session not found')
        return
      }
      const relative = safeRelativePath(shape.path)
      let full: string | undefined
      if (relative !== undefined) {
        const candidate = pathResolve(root, relative)
        if (insideRoot(root, candidate)) full = candidate
      }
      if (full === undefined) {
        response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        response.end('bad request')
        return
      }
      try {
        await writeFile(full, shape.text)
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        response.end('{"ok":true}')
      } catch (error) {
        ctx.logger?.('chat-power-workspace-write').warn(`workspace write failed: ${String(error)}`)
        response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        response.end('workspace write failed')
      }
    },
  })
}
