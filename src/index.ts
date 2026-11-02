/**
 * DSH 会话区增强 — 浏览器半边。
 *
 * 通用会话区功能，与跑哪种 agent 无关：
 * - 会话头部右端的「短会话 ID + 复制」（本包独有）；
 * - Mermaid 图渲染（扫 DOM 的 ```mermaid 代码块，画成 SVG，可切「图表 / 源码」）；
 *   运行时经宿主半边 `/threadharbor/mermaid.js` 按需懒加载，不内联进客户端包；
 * - 答案卡片、会话尾部文件卡片（随后续批次从 acp-agent 迁入）。
 *
 * 历史上这三（除会话 ID 条外）曾在 acp-agent 的浏览器半边实现，2026-11 迁回本包。
 */

import { registerSessionIdBar } from './session-id-bar/register.js'
import { startMermaidDiagrams } from './mermaid.ts'
import { fallbackT, NAMESPACE, zh } from './locales.ts'

/** Loader 行与诊断里看到的插件名。 */
export const name = 'threadharbor-chat-area'

/** 依赖：插槽表（会话 ID 条）与 locale 注册中心（mermaid 文案）。 */
export const inject = ['slots', 'locale'] as const

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
  locale?: {
    register?: (dictionaries: Record<string, unknown>) => void
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

/** 把本包文案装进 host 的 locale 注册中心；拿不到就安静退回，不拖累注册。 */
function registerLocales(ctx: PluginContext): void {
  try {
    const register = ctx.locale?.register
    if (typeof register !== 'function') return
    register({ [NAMESPACE]: { zh: { ...zh }, en: {} } })
  } catch {
    // locale 注册失败不该连累其它功能
  }
}

export function apply(ctx: PluginContext): void {
  const log = safeLogger(ctx)
  registerLocales(ctx)
  try {
    registerSessionIdBar(ctx.slots)
    log.info('session id bar: registered')
  } catch (error: unknown) {
    log.warn(`session id bar: registration failed — ${error instanceof Error ? error.message : String(error)}`)
  }
  try {
    // Mermaid 扫 DOM 找代码块，不需要插槽；文案走 fallbackT（中文），
    // 与迁前在 acp-agent 里的行为一致。
    startMermaidDiagrams({ t: fallbackT, log: (message: string) => log.info(message) })
    log.info('mermaid: registered')
  } catch (error: unknown) {
    log.warn(`mermaid: registration failed — ${error instanceof Error ? error.message : String(error)}`)
  }
}
