/**
 * DSH 会话区增强 — 浏览器半边。
 *
 * 通用会话区功能，与跑哪种 agent 无关：
 * - 会话头部右端的「短会话 ID + 复制」（本包独有）；
 * - Mermaid 图渲染（扫 DOM 的 ```mermaid 代码块，画成 SVG，可切「图表 / 源码」）；
 *   运行时经宿主半边 `/chat-power/mermaid.js` 按需懒加载，不内联进客户端包；
 * - 答案卡片、会话尾部文件阅读区（`conversation-surfaces.tsx`）。
 *
 * 历史上这些曾在 `@goodjin2/dsh-acp-agent` 的浏览器半边实现，2026-11 迁回本包。
 * ACP 专属的进程段渲染仍留在 acp-agent，经座位 `conversation.chat.node.acp-segment-renderer`
 * 接进本包的 `assistant-step` 包装（见 conversation-surfaces.tsx 的说明）。
 */

import { registerConversationTools } from './conversation-tools.tsx'
import { registerSessionIdBar } from './session-id-bar/index.js'
import { startMermaidDiagrams } from './mermaid.ts'
import { injectTablePadCss } from './table-pad.ts'
import { startSelectionActionsFromRemote, sessionKeyAccessorsOf } from './selection-actions.ts'
import { registerConversationSurfaces } from './conversation-surfaces.tsx'
import { fallbackT } from './locales.ts'

/** Loader 行与诊断里看到的插件名。 */
export const name = 'dsh-chat-power'

/**
 * 依赖：插槽表、locale 注册中心（文案）、remote 服务（文件阅读区读 workspaceFiles /
 * session），以及右侧栏的 `sidebarRight`（工具标签的宿主服务）。缺任一，对应功能
 * 安静退回，不拖累其它。
 *
 * `sidebarRight` 必须声明：工具适配器在 apply 里就要读它的 openTabs 订阅；
 * 不声明的话会抢在它注册之前启动，拿到 undefined 直接抛错（2026-11-05 现场：
 * 桌面版启动时把整条 entry 弄成 failed）。
 */
export const inject = ['slots', 'locale', 'remote', 'remote.session', 'remote.workspaceFiles', 'sidebarRight', 'uiSession'] as const

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

export function apply(ctx: PluginContext): void {
  const log = safeLogger(ctx)
  try {
    // 会话区工具（标签条、文件树控件、本机文件卡）。整块失败只损失工具区，
    // 不能让整条 entry 变 failed——启动审计一旦判失败，整页都打不开。
    registerConversationTools(ctx)
  } catch (error: unknown) {
    log.warn(`conversation tools: registration failed — ${error instanceof Error ? error.message : String(error)}`)
  }
  try {
    // 宽表格末列右边距：官方样式清零了末列右 padding，宽表滚到最右时
    // 末格文字贴边；注入一条覆盖（只作用 md-table-wide 的滚动容器）。
    injectTablePadCss()
  } catch (error: unknown) {
    log.warn(`table pad: inject failed — ${error instanceof Error ? error.message : String(error)}`)
  }
  try {
    // 会话区选区弹条：选中文字末尾弹「添加到会话 / 发送会话」。
    const disposeSelection = startSelectionActionsFromRemote(
      () => ctx.get('remote'),
      fallbackT,
      sessionKeyAccessorsOf(ctx),
    )
    ctx.effect(() => disposeSelection, 'dsh-chat-power: selection actions')
    log.info('selection actions: started')
  } catch (error: unknown) {
    log.warn(`selection actions: start failed — ${error instanceof Error ? error.message : String(error)}`)
  }
  try {
    // 注册会话 ID 条（需要 slots）
    const slotHost = ctx.slots as Parameters<typeof registerSessionIdBar>[0]
    registerSessionIdBar(slotHost)
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
  try {
    // 答案卡片 + 会话尾部文件阅读区；顺带注册本包 locale 字典。
    registerConversationSurfaces(ctx)
    log.info('conversation surfaces: registered')
  } catch (error: unknown) {
    log.warn(`conversation surfaces: registration failed — ${error instanceof Error ? error.message : String(error)}`)
  }
}
