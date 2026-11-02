/**
 * DSH 会话区增强 — 浏览器半边。
 *
 * 现在只做一件事：会话头部右端的「短会话 ID + 复制」。
 *
 * 这个包曾经声明了四项功能（文件查看、mermaid、答案编辑、会话 ID 条），但前
 * 三项只有占位实现——文件查看的组件返回 null、mermaid 指向一条不存在的路由、
 * 答案编辑是空函数。它们真正的实现活在 `@goodjin2/dsh-acp-agent` 的浏览器
 * 半边（会话尾部文件卡片、mermaid 渲染、答案卡片），并且已经随机组装载。
 * 为避免两套 UI 打架，这里不再重复注册，只保留本包独有、也没被别处提供的
 * 会话 ID 条。
 *
 * `src/file-view`、`src/mermaid`、`src/answer-edit` 三个目录仍留在仓库里，作为
 * 将来要搬回时的脚手架；它们不在任何装载路径上（DSH 只加载 `.` 与 `./client`）。
 */

import { registerSessionIdBar } from './session-id-bar/register.js'

/** Loader 行与诊断里看到的插件名。 */
export const name = 'threadharbor-chat-area'

/** 唯一的依赖：插槽表。会话 id 由框架按会话作用域作为 props 传进来。 */
export const inject = ['slots'] as const

export interface PluginContext {
  logger(name: string): { info(message: string): void; warn(message: string): void }
  effect(callback: () => unknown, name?: string): unknown
  get(name: string): unknown
  slots: {
    inject(key: string, callback: () => unknown): unknown
    register(options: Record<string, unknown>, component: unknown): unknown
    entries(key: string): readonly { options: Record<string, unknown>; component: unknown }[]
    subscribe(key: string, fn: () => void): () => void
  }
}

/** 日志：插件的 logger 找不到时退回 console，绝不因为日志把整条 entry 弄挂。 */
function safeLogger(ctx: PluginContext): { info(message: string): void; warn(message: string): void } {
  try {
    const logger = ctx.logger(name)
    if (typeof logger?.info === 'function' && typeof logger?.warn === 'function') return logger
  } catch {
    // 落下去，用 console
  }
  return {
    info: (message: string): void => { console.info(`[${name}] ${message}`) },
    warn: (message: string): void => { console.warn(`[${name}] ${message}`) },
  }
}

export function apply(ctx: PluginContext): void {
  const log = safeLogger(ctx)
  try {
    registerSessionIdBar(ctx.slots)
    log.info('session id bar: registered')
  } catch (error: unknown) {
    log.warn(`session id bar: registration failed — ${error instanceof Error ? error.message : String(error)}`)
  }
}
