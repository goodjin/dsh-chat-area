/**
 * 会话区通用表面的浏览器半边：答案卡片 + 会话尾部文件阅读区。
 *
 * 这两样与跑哪种 agent 无关，从 `@goodjin2/dsh-acp-agent` 迁来：
 *
 * - **会话尾部文件卡片**：挂进通用座位 `conversation.chat.turnTail`，排在官方
 *   改动卡片之后。readers 走会话的 workspaceFiles / session 口子。
 * - **答案卡片**：包住 `assistant-step` 渲染位——turn-process 标记的最终答案步
 *   套一张卡（标题图标 + 编辑/复制），思考（reasoning）留在卡内、保留原生折叠。
 *   编辑/复制复用文件阅读区那套 readers（发到当前会话 / 新建会话）。
 *
 * ## 与 ACP 的分工（一个跨插件挂钩）
 *
 * `assistant-step` 这个「包住原生渲染器」的挂载点同时被两种节点用：
 * - 带 `acpProcessSegment` 的节点是 ACP 进程段，由 **acp-agent** 渲染；
 * - 最终答案步是通用的，由本包的答案卡片渲染。
 *
 * 两者不能各自再挂一个 wrap（同一挂载点多 wrap 叠加行为不可控，会互相覆盖），
 * 所以由本包独占这个 wrap，再开一个**座位挂钩** `SEGMENT_RENDERER_SLOT`：
 * acp-agent 把它的 `AcpProcessComponent` 注册进这个座位，本包在 wrap 里遇到
 * ACP 进程段时取来渲染。缺席时退回原生渲染（不炸）。这样通用件归 chat-area，
 * ACP 专属渲染仍留在 acp-agent，两边只通过一个座位名耦合。
 *
 * `acpProcessSegment` 数据本身仍由 acp-agent 的 `wrapChatView` 注入节点；本包
 * 只读不写。
 */

import { createElement } from 'react'
import type { ComponentType } from 'react'
import { AnswerCard } from './answer-card.tsx'
import { createMarkdownTurnReaders } from './markdown-turn-sources.ts'
import type { MarkdownTurnReaders } from './markdown-turn-sources.ts'
import { registerMarkdownTurn } from './markdown-turn.tsx'
import { fallbackT, NAMESPACE, zh } from './locales.ts'
import type { RuntimeT } from './locales.ts'

/**
 * ACP 进程段渲染器的座位名。acp-agent 把 `AcpProcessComponent` 注册进这里；
 * 本包在 `assistant-step` wrap 里遇到带 `acpProcessSegment` 的节点时取来渲染。
 * 两边必须字面一致（跨包不能共享常量）。
 */
export const SEGMENT_RENDERER_SLOT = 'conversation.chat.node.acp-segment-renderer'

/** 目标渲染位与 wrap 优先级。 */
const NODE_SLOT = 'conversation.chat.node'
const NODE_KEY = 'assistant-step'
const WRAP_PRIORITY = -20

type Surface = {
  readonly slots: unknown
  get(name: string): unknown
  effect(callback: () => (() => void), name?: string): unknown
}
type NodeSlotEntry = {
  options: Record<string, unknown>
  component: unknown
  locale?: string
  inject?: unknown
  key?: string
  priority?: number
}
type NodeSlots = {
  entries(key: string): readonly NodeSlotEntry[]
  subscribe(key: string, fn: () => void): () => void
  register(options: Record<string, unknown>, component: unknown): () => void
}
type SegmentRendererProps = { readonly segment: unknown; readonly t: unknown }
type SegmentRenderer = ComponentType<SegmentRendererProps>
type AssistantStepProps = Record<string, any>

/** 绑定本插件词典的 t；宿主 locale 服务给出 bind，缺席则 undefined。 */
function localeBindOf(ctx: Surface): RuntimeT | undefined {
  const service = ctx.get('locale')
  if (service === null || typeof service !== 'object') return undefined
  const bind = (service as { bind?: unknown }).bind
  if (typeof bind !== 'function') return undefined
  try {
    const bound = (bind as (ns: string) => unknown)(NAMESPACE)
    return typeof bound === 'function' ? (bound as RuntimeT) : undefined
  } catch {
    return undefined
  }
}

/** 当前会话编号。chat 节点的 view props 不带 sessionId，从会话根节点读。 */
function currentSessionIdFromDom(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const node = document.querySelector('[data-conversation-session]')
  const value = node?.getAttribute('data-conversation-session')
  return value === null || value === '' ? undefined : value
}

/** 取当前注册的 ACP 进程段渲染器；没注册返回 undefined（wrap 退回原生）。 */
function segmentRendererOf(slots: NodeSlots): SegmentRenderer | undefined {
  const entry = slots.entries(SEGMENT_RENDERER_SLOT)[0]
  const component = entry?.component
  return typeof component === 'function' ? (component as SegmentRenderer) : undefined
}

/**
 * 构造 `assistant-step` 的包装组件。
 *
 * 抓住原生渲染器（`Native`）后降优先级重注册；渲染时按节点分派：
 * - ACP 进程段 → 挂钩渲染器（缺席退回原生）；
 * - 最终答案步 → 答案卡片；其余 → 原生。
 */
function makeAssistantStepWrapper(
  Native: ComponentType<AssistantStepProps>,
  host: { readonly slots: NodeSlots; readonly dshT: RuntimeT; readonly readers: MarkdownTurnReaders },
): ComponentType<AssistantStepProps> {
  return (props) => {
    const segment = props.node?.data?.acpProcessSegment
    if (segment !== undefined) {
      const renderer = segmentRendererOf(host.slots)
      if (renderer !== undefined) return createElement(renderer, { segment, t: props.t })
      // 挂钩缺席（acp-agent 没装）：退回原生，别让 ACP 段渲染成空白。
      return createElement(Native, props)
    }
    const answerStep = props.turnProcess?.spec?.answerStep
    const isAnswer = answerStep != null && answerStep === props.node?.data?.step
    const native = createElement(Native, props)
    if (!isAnswer) return native
    const blocks = props.node?.data?.blocks as readonly { kind: string; text?: string }[] | undefined
    const hasProse = blocks?.some(block =>
      (block.kind === 'text' || block.kind === 'reasoning') &&
      (block.text?.trim() ?? '') !== '') ?? false
    if (!hasProse) return native
    return createElement(AnswerCard, {
      blocks: props.node.data.blocks,
      sessionId: currentSessionIdFromDom(),
      readers: host.readers,
      t: host.dshT,
      children: native,
    })
  }
}

/** 把本包词典装进 host locale 注册中心；拿不到就安静退回。 */
function registerLocales(ctx: Surface): void {
  try {
    const service = ctx.get('locale')
    const register = service !== null && typeof service === 'object'
      ? (service as { register?: unknown }).register
      : undefined
    if (typeof register !== 'function') return
    (register as (dicts: Record<string, unknown>) => void)({ [NAMESPACE]: { zh: { ...zh }, en: {} } })
  } catch {
    // locale 注册失败不该连累其它功能
  }
}

/**
 * 注册会话尾部文件卡片 + 答案卡片 wrap。
 *
 * 本函数只管通用件；ACP 进程段渲染器由 acp-agent 注册进 {@link SEGMENT_RENDERER_SLOT}，
 * wrap 在渲染时按座位取名，故注册顺序无所谓。
 * @param ctx - 宿主上下文（slots / remote / locale）。
 */
export function registerConversationSurfaces(ctx: Surface): void {
  const slots = ctx.slots as NodeSlots
  const dshT: RuntimeT = localeBindOf(ctx) ?? fallbackT
  const readers: MarkdownTurnReaders = createMarkdownTurnReaders(() => ctx.get('remote'))

  registerLocales(ctx)

  // 会话尾部文件卡片：通用座位，排在官方改动卡片之后。
  registerMarkdownTurn(slots as unknown as Parameters<typeof registerMarkdownTurn>[0], readers)

  // 答案卡片 wrap：包住 assistant-step，与 acp-agent 的进程段渲染共用一个挂载点。
  let removeRenderer: (() => void) | undefined
  let originalComponent: unknown
  let installing = false
  const attachRenderer = (): void => {
    if (installing) return
    const entry = slots.entries(NODE_SLOT).find(
      candidate => candidate.options.key === NODE_KEY && (candidate.options.priority as number | undefined ?? 0) >= 0,
    )
    if (entry === undefined || entry.component === originalComponent) return
    installing = true
    try {
      removeRenderer?.()
      originalComponent = entry.component
      const Native = entry.component as ComponentType<AssistantStepProps>
      const Renderer = makeAssistantStepWrapper(Native, { slots, dshT, readers })
      removeRenderer = slots.register({
        name: NODE_SLOT, key: NODE_KEY, priority: WRAP_PRIORITY,
        ...(entry.locale === undefined ? {} : { locale: entry.locale }),
        ...(entry.inject === undefined ? {} : { inject: entry.inject }),
      }, Renderer)
    } finally { installing = false }
  }
  const unsubscribeRenderer = slots.subscribe(NODE_SLOT, attachRenderer)
  attachRenderer()
}
