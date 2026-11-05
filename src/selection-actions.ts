/**
 * 会话区选区弹条：选中一段文本后，在选中末尾弹出四个按钮——
 * 「添加到会话」（填进输入框草稿）、「发送会话」（直接作为新请求发出）、
 * 「编辑」（把选中内容展开成会话区的编辑卡）与「多选」（把选中内容加入
 * 多选收藏，保持高亮；收集后浮动「编辑」钮可整体进编辑卡，按原顺序、
 * 项间空行拼接）。
 *
 * 纯 DOM 实现（同 mermaid.ts 的注入路数），不经 React：弹条的生命周期
 * 挂在 document 的 selectionchange / mousedown / scroll / keydown 上。
 * 编辑卡本体在 selection-edit-card.tsx（React，挂 overlay 座位），两边经
 * 本文件的 store 连接。
 *
 * 范围与排除：
 * - 只在会话滚动容器（`[data-conversation-scroll]`）里生效；
 * - 输入框、textarea、contenteditable 里的选区不弹（用户在编辑自己的草稿）；
 * - 文件阅读区正文（`[data-markdown-interactive]`）不弹——那里已有自己的
 *   选区工具条，避免双重弹条；
 * - 弹条自身内部的选区不弹。
 *
 * 「发送」复用 remote.session.prompt（队列模式，与文件阅读区的发送同一条
 * 通道）；「添加到会话」把光标塌缩到 composer 末尾后走 insertText 追加
 * 命令——Lexical 经 beforeinput 正确接住，草稿与未发送提示保持原生行为。
 */
import { createMarkdownTurnReaders } from './markdown-turn-sources.ts'
import type { MarkdownTurnReaders } from './markdown-turn-sources.ts'
import type { RuntimeT } from './locales.ts'

/** 选中停下多少毫秒后才弹条：拖拽选择期间不弹，停下 1 秒才出现。 */
export const SELECTION_SHOW_DELAY_MS = 1000

/** 弹条与提示的样式；类名带 dshca- 前缀避免与页面样式冲突。 */
const BAR_CSS = [
  // 卡片：白底圆角、轻描边、柔和投影；暗色主题换深色浮层材质。
  '.dshca-selbar{position:fixed;z-index:60;display:flex;align-items:center;gap:2px;padding:4px;',
  'border-radius:10px;background:#fff;border:1px solid rgb(0 0 0 / 8%);box-shadow:0 4px 16px rgb(0 0 0 / 16%)}',
  '@media (prefers-color-scheme:dark){.dshca-selbar{background:#2b2b30;border-color:rgb(255 255 255 / 10%);',
  'box-shadow:0 4px 16px rgb(0 0 0 / 45%)}}',
  // 尖角：默认在弹条下方（朝下指向选区）；data-arrow="up" 时翻到上方，
  // 材质与卡片一致。水平位置由 JS 写入 --dshca-arrow-x。
  '.dshca-selbar::after{content:"";position:absolute;bottom:-5px;left:var(--dshca-arrow-x,16px);',
  'margin-left:-5px;border:5px solid transparent;border-top-color:#fff;border-bottom:0}',
  '@media (prefers-color-scheme:dark){.dshca-selbar::after{border-top-color:#2b2b30}}',
  '.dshca-selbar[data-arrow="up"]::after{bottom:auto;top:-5px;',
  'border-top:0;border-bottom:5px solid #fff}',
  '@media (prefers-color-scheme:dark){.dshca-selbar[data-arrow="up"]::after{border-bottom-color:#2b2b30}}',
  // 按钮：图标 + 文字，浅色字，hover 铺一层淡底。
  '.dshca-selbar button{display:inline-flex;align-items:center;gap:6px;border:none;background:transparent;',
  'color:rgb(0 0 0 / 78%);font:inherit;font-size:12.5px;line-height:18px;padding:5px 12px;',
  'border-radius:7px;cursor:pointer;white-space:nowrap}',
  '.dshca-selbar button svg{flex:none}',
  '.dshca-selbar button:hover{background:rgb(0 0 0 / 6%)}',
  '@media (prefers-color-scheme:dark){.dshca-selbar button{color:rgb(255 255 255 / 85%)}',
  '.dshca-selbar button:hover{background:rgb(255 255 255 / 10%)}}',
  // 两个按钮之间的细分隔线。
  '.dshca-selbar .dshca-divider{width:1px;height:16px;flex:none;background:rgb(0 0 0 / 10%)}',
  '@media (prefers-color-scheme:dark){.dshca-selbar .dshca-divider{background:rgb(255 255 255 / 12%)}}',
  // 多选高亮：CSS Custom Highlight API（Chromium），不动宿主 DOM；缺席时
  // 只收藏文本、不做视觉标记。
  `::highlight(dshca-multi){background-color:rgb(59 130 246 / 32%)}`,
  // 多选浮动条：每条独立、圆角、贴会话区域顶部纵向堆叠（间距 2px），
  // 宽度为会话区域的一半；编辑是小按钮，压在最后一条的右下方（间距 5px）。
  '.dshca-bar{position:fixed;z-index:90;display:flex;align-items:center;gap:6px;',
  'height:28px;padding:0 10px;border-radius:8px;background:#fff;',
  'border:1px solid rgb(0 0 0 / 8%);box-shadow:0 4px 16px rgb(0 0 0 / 16%);box-sizing:border-box}',
  '@media (prefers-color-scheme:dark){.dshca-bar{background:#2b2b30;border-color:rgb(255 255 255 / 10%);',
  'box-shadow:0 4px 16px rgb(0 0 0 / 45%)}}',
  '.dshca-bar-text{text-overflow:ellipsis;white-space:nowrap;color:rgb(0 0 0 / 75%);',
  'flex:1;min-width:0;font-size:12px;line-height:20px;overflow:hidden}',
  '@media (prefers-color-scheme:dark){.dshca-bar-text{color:rgb(255 255 255 / 80%)}}',
  '.dshca-bar-remove{color:rgb(0 0 0 / 45%);cursor:pointer;background:0 0;border:none;',
  'border-radius:4px;flex:none;width:18px;height:18px;font-size:14px;line-height:1}',
  '.dshca-bar-remove:hover{background:rgb(0 0 0 / 8%);color:rgb(0 0 0 / 70%)}',
  '@media (prefers-color-scheme:dark){.dshca-bar-remove{color:rgb(255 255 255 / 50%)}',
  '.dshca-bar-remove:hover{background:rgb(255 255 255 / 12%);color:rgb(255 255 255 / 80%)}}',
  '.dshca-bar-edit{position:fixed;z-index:90;border:none;background:#fff;color:rgb(0 0 0 / 78%);',
  'font:inherit;font-size:12px;line-height:18px;padding:2px 10px;border-radius:6px;cursor:pointer;',
  'white-space:nowrap;border:1px solid rgb(0 0 0 / 8%);box-shadow:0 4px 16px rgb(0 0 0 / 16%);box-sizing:border-box}',
  '.dshca-bar-edit:hover{background:rgb(0 0 0 / 6%)}',
  '@media (prefers-color-scheme:dark){.dshca-bar-edit{background:#2b2b30;border-color:rgb(255 255 255 / 10%);',
  'color:rgb(255 255 255 / 85%);box-shadow:0 4px 16px rgb(0 0 0 / 45%)}}',
  '@media (prefers-color-scheme:dark){.dshca-bar-edit:hover{background:rgb(255 255 255 / 10%)}}',
  '.dshca-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:70;',
  'padding:6px 14px;border-radius:8px;background:rgb(30 30 30 / 92%);color:#fff;font-size:12px;pointer-events:none}',
].join('')

/** 「添加到会话」按钮的加号图标（描边风格，颜色随文字）。 */
const ICON_PLUS = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'

/** 「发送会话」按钮的纸飞机图标（描边风格，颜色随文字）。 */
const ICON_SEND = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M14 2 7.7 8.3M14 2 9.8 14l-2.1-5.7L2 6.2 14 2Z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>'

/** 「编辑」按钮的铅笔图标（描边风格，颜色随文字）。 */
const ICON_EDIT = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M11.2 2.2a1.6 1.6 0 0 1 2.6 2.6L6 12.5l-3.5.9.9-3.5 7.8-7.7Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>'

/** 「多选」按钮的叠层图标（描边风格，颜色随文字）。 */
const ICON_LAYERS = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M3 10.5V3.8C3 3.4 3.4 3 3.8 3h6.7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>'

/** 选区锚点要满足的结构面（Element 的最小子集，便于测试）。 */
export interface SelectionAnchor {
  closest(selector: string): Element | null
}

/**
 * 判断一个选区是否该弹条：必须在会话滚动容器里，且不在输入框、
 * 编辑框（textarea/input/contenteditable）、文件阅读区正文或弹条自身里。
 * @param anchor - 选区锚点所在元素。
 * @param barInDocument - 弹条当前是否已挂到页面（挂载期间排除自身）。
 * @returns 该选区是否应该弹条。
 */
export function selectionAllowed(anchor: SelectionAnchor | null, barInDocument: boolean): boolean {
  if (anchor === null) return false
  if (anchor.closest('[data-composer-input]') !== null) return false
  if (anchor.closest('textarea, input, [contenteditable="true"]') !== null) return false
  if (anchor.closest('[data-markdown-interactive]') !== null) return false
  if (barInDocument && anchor.closest('.dshca-selbar') !== null) return false
  return anchor.closest('[data-conversation-scroll]') !== null
}

/**
 * 计算弹条位置：垂直放在选区**首行**的上一行，水平贴在选中内容**最右边**。
 *
 * - 默认在首行上方（箭头朝下）；首行贴近视口顶时翻到行下方（箭头朝上）。
 * - 弹条右缘对齐选区**末行**的右缘（单行选区即该行右端），出右视口往左收；
 *   尖角水平上对准末行右端（钳在弹条内，别探出边缘）。
 * @param firstRect - 选区首行的客户区矩形（决定垂直位置）。
 * @param lastRect - 选区末行的客户区矩形（决定水平位置）。
 * @param viewport - 视口尺寸。
 * @param bar - 弹条尺寸。
 * @returns 定位坐标、箭头水平偏移（相对弹条左缘）与箭头方向。
 */
export function selectionBarPosition(
  firstRect: { left: number; right: number; top: number; bottom: number; height: number },
  lastRect: { left: number; right: number },
  viewport: { width: number; height: number },
  bar: { width: number; height: number },
): { left: number; top: number; arrowOffset: number; arrow: 'down' | 'up' } {
  const margin = 8
  const gap = 6
  let arrow: 'down' | 'up' = 'down'
  let top = firstRect.top - bar.height - gap
  if (top < margin) {
    // 首行贴近视口顶：翻到选区行下方，尖角朝上。
    arrow = 'up'
    top = firstRect.bottom + gap
  }
  if (top + bar.height + margin > viewport.height) top = viewport.height - margin - bar.height
  let left = lastRect.right - bar.width
  if (left + bar.width + margin > viewport.width) left = viewport.width - margin - bar.width
  if (left < margin) left = margin
  const arrowOffset = Math.min(Math.max(lastRect.right - left, 10), bar.width - 10)
  return { left, top, arrowOffset, arrow }
}

/** 当前会话编号：会话根节点上框架写的 data-conversation-session。 */
export function currentSessionIdFromDom(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const node = document.querySelector('[data-conversation-session]')
  const value = node?.getAttribute('data-conversation-session')
  return value === null || value === '' ? undefined : value
}

/**
 * 计算要**追加**到输入框末尾的文本：已有草稿时先隔**三个空格**再接选中
 * 内容，最末尾补**一个空格**（方便用户接着往下输入）；草稿为空时直接填
 * 选中内容加尾空格。
 * @param existing - 输入框里已有的草稿文本（contenteditable 的可见文本）。
 * @param text - 选中的文字。
 * @returns 应追加的文本。
 */
export function composeFillAppend(existing: string, text: string): string {
  return existing === '' ? `${text} ` : `   ${text} `
}

/** 多选收藏里的一条：捕获时的文本。 */
export interface MultiItem {
  readonly id: number
  readonly text: string
}

let multiSeq = 0
let multiItems: readonly MultiItem[] = []
let multiRanges: Range[] = []
/** 收藏归属的会话：浮动条只在当前激活会话 == 它时显示。 */
let multiSessionId: string | undefined = undefined
const multiListeners = new Set<() => void>()
const MULTI_HIGHLIGHT = 'dshca-multi'

/** 订阅多选收藏变化（浮动「编辑」钮走它）。 */
export function subscribeMultiItems(listener: () => void): () => void {
  multiListeners.add(listener)
  return () => { multiListeners.delete(listener) }
}

/** 当前多选收藏（引用稳定，可作 getSnapshot）。 */
export function getMultiItems(): readonly MultiItem[] {
  return multiItems
}

/** 把收藏里的 Range 重新刷进 Custom Highlight 注册表；API 缺席时安静跳过。 */
function applyMultiHighlight(): void {
  const holder = globalThis as {
    CSS?: { highlights?: Map<string, unknown> }
    Highlight?: unknown
  }
  if (holder.CSS?.highlights === undefined || holder.Highlight === undefined) {
    console.info('[threadharbor-chat-area] CSS Custom Highlight API unavailable; multi-select keeps text only')
    return
  }
  // 已失效（塌缩）的 Range 直接淘汰。
  multiRanges = multiRanges.filter(range => range.collapsed === false)
  if (multiRanges.length === 0) {
    holder.CSS.highlights.delete(MULTI_HIGHLIGHT)
    return
  }
  // Highlight 构造器的 lib.dom 签名（rest AbstractRange[]）与我们的封装
  // 对不上，这层浏览器 API 鸿沟用断言跨过；运行时是 **rest 参数**
  // new Highlight(...ranges)——不展开的话数组本身会被当成第一个 Range，
  // 构造器直接抛「not of type AbstractRange」（2026-11-05 现场）。
  const HighlightCtor = holder.Highlight as unknown as new (...ranges: Range[]) => unknown
  holder.CSS.highlights.set(MULTI_HIGHLIGHT, new HighlightCtor(...multiRanges))
}

/** 把当前选区加入多选收藏并保持高亮。 */
export function addMultiItem(text: string, range: Range, sessionId?: string): MultiItem {
  // 收藏绑定到收集时的会话：换会话收集会清掉旧会话的收藏流，重开一份。
  if (multiSessionId !== undefined && multiSessionId !== sessionId) clearMultiItems()
  if (multiSessionId === undefined) multiSessionId = sessionId
  multiSeq += 1
  const item: MultiItem = { id: multiSeq, text }
  multiItems = [...multiItems, item]
  multiRanges = [...multiRanges, range]
  applyMultiHighlight()
  for (const listener of multiListeners) listener()
  return item
}

/** 移除一条多选收藏（对应的高亮一并撤掉，其余条目保持原顺序）。 */
export function removeMultiItem(id: number): void {
  const index = multiItems.findIndex(item => item.id === id)
  if (index < 0) return
  multiItems = multiItems.filter(item => item.id !== id)
  multiRanges = multiRanges.filter((_, position) => position !== index)
  applyMultiHighlight()
  for (const listener of multiListeners) listener()
}

/** 清空多选收藏（高亮与归属会话一并清掉）。 */
export function clearMultiItems(): void {
  multiItems = []
  multiRanges = []
  multiSessionId = undefined
  applyMultiHighlight()
  for (const listener of multiListeners) listener()
}

/** 多选收藏按原顺序拼接，项与项之间用一个空行隔开。 */
export function joinMultiTexts(items: readonly MultiItem[]): string {
  return items.map(item => item.text).join('\n\n')
}

/** 编辑卡状态：open 时的文本、所属会话、是否来自多选收藏、以及重挂载用的 seq。 */
export interface SelectionEditState {
  readonly text: string
  readonly sessionId: string | undefined
  readonly multi: boolean
  readonly seq: number
}

let editSeq = 0
let editState: SelectionEditState | null = null
const editListeners = new Set<() => void>()

/** 订阅编辑卡状态（React 卡片走它）。 */
export function subscribeSelectionEdit(listener: () => void): () => void {
  editListeners.add(listener)
  return () => { editListeners.delete(listener) }
}

/** 当前编辑卡状态；null 为关闭（引用稳定，可作 getSnapshot）。 */
export function getSelectionEdit(): SelectionEditState | null {
  return editState
}

/**
 * 编辑卡是否该在当前视图渲染：状态存在，且（能读到激活会话时）只属于
 * 打开时的那个会话——overlay 座位是会话作用域，不滤的话每个打开过的
 * 会话都会渲染同一张卡、盖住各自的输入框。
 * @param state - 编辑卡状态。
 * @param activeKey - 当前激活会话的 key（读不到时放行，避免整卡消失）。
 * @returns 当前视图是否应渲染编辑卡。
 */
export function selectionEditVisible(state: SelectionEditState | null, activeKey: string | undefined): boolean {
  if (state === null) return false
  return boundToActiveSession(state.sessionId, activeKey)
}

/**
 * 「绑定会话的浮层」是否该在当前视图显示：绑定会话或激活会话读不到时
 * 放行（避免整块消失），否则只在绑定会话 == 激活会话时显示。
 */
export function boundToActiveSession(boundId: string | undefined, activeKey: string | undefined): boolean {
  if (activeKey === undefined) return true
  // 绑定时读不到会话归属：无法判定，放行。
  if (boundId === undefined) return true
  return boundId === activeKey
}

/**
 * 打开编辑卡。sessionId 记录打开时的激活会话：卡片只在该会话的视图里
 * 显示（见 selectionEditVisible）。multi=true 表示内容来自多选收藏：
 * 关闭/发送后连同收藏与高亮一起清掉；单选编辑不影响收藏。
 */
export function openSelectionEdit(text: string, multi: boolean, sessionId: string | undefined): void {
  editSeq += 1
  editState = { text, sessionId, multi, seq: editSeq }
  for (const listener of editListeners) listener()
}

/** 关闭编辑卡；多选来源的关闭会连多选收藏与高亮一起清掉。 */
export function closeSelectionEdit(): void {
  const fromMulti = editState?.multi === true
  editState = null
  if (fromMulti) clearMultiItems()
  for (const listener of editListeners) listener()
}

/**
 * 从宿主 uiSession 服务组装「当前激活会话 key」的读取/订阅器；
 * 服务缺席时 getKey 落回 DOM 属性、订阅退化为空。
 * @param ctx - 宿主上下文（任意持有 uiSession 服务的对象）。
 * @returns getKey / subscribeKey 一对访问器。
 */
export function sessionKeyAccessorsOf(ctx: unknown): {
  getKey: () => string | undefined
  subscribeKey: (listener: () => void) => () => void
} {
  type UiSessionHolder = {
    uiSession?: {
      adapter?: {
        current?: {
          getSnapshot?: () => { key?: string }
          subscribe?: (listener: () => void) => () => void
        }
      }
    }
  }
  const holder = (): UiSessionHolder | undefined => {
    // 宿主契约：ctx.get 只允许读入口 inject 声明过的服务；未声明时直接抛错
    // 而不是返回 undefined——这里吞掉并落回 undefined，调用方走 DOM 兜底。
    try {
      return ctx as UiSessionHolder | undefined
    } catch {
      return undefined
    }
  }
  return {
    getKey: () => {
      const key = holder()?.uiSession?.adapter?.current?.getSnapshot?.()?.key
      if (key !== undefined && key !== '') return key
      return currentSessionIdFromDom()
    },
    subscribeKey: listener => {
      const subscribe = holder()?.uiSession?.adapter?.current?.subscribe
      return typeof subscribe === 'function' ? subscribe(listener) : () => {}
    },
  }
}

/**
 * 启动选区弹条：注入样式、挂监听、建弹条元素。
 * @param options - readers（发送口）与文案。
 * @returns 清理函数：摘掉监听并移除弹条元素。
 */
export function startSelectionActions(options: {
  readers: MarkdownTurnReaders
  t: RuntimeT
  /** 当前激活会话 key 的读取器；打开编辑卡/多选收藏时记录归属会话。 */
  currentSessionKey?: () => string | undefined
  /** 激活会话变化的订阅；用于切换会话时隐/显多选浮动条。 */
  subscribeSessionKey?: (listener: () => void) => () => void
}): () => void {
  if (typeof document === 'undefined') return () => {}
  const style = document.createElement('style')
  style.dataset.plugin = 'threadharbor-chat-area'
  style.dataset.pluginCss = 'threadharbor-chat-area/selection-bar'
  style.textContent = BAR_CSS
  document.head.appendChild(style)

  const root = document.createElement('div')
  root.className = 'dshca-selbar'
  root.dataset.dshcaSelbar = ''
  const labeledButton = (action: string, icon: string, label: string): HTMLButtonElement => {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.action = action
    button.setAttribute('aria-label', label)
    const iconSpan = document.createElement('span')
    iconSpan.style.display = 'inline-flex'
    iconSpan.innerHTML = icon
    const labelSpan = document.createElement('span')
    labelSpan.textContent = label
    button.append(iconSpan, labelSpan)
    return button
  }
  const fillButton = labeledButton('add-to-chat', ICON_PLUS, options.t('selection.addToChat'))
  const sendButton = labeledButton('send-to-chat', ICON_SEND, options.t('selection.sendToChat'))
  const editButton = labeledButton('edit-selection', ICON_EDIT, options.t('selection.edit'))
  const multiButton = labeledButton('multi-add', ICON_LAYERS, options.t('selection.multiAdd'))
  const divider = (): HTMLSpanElement => {
    const span = document.createElement('span')
    span.className = 'dshca-divider'
    span.setAttribute('aria-hidden', 'true')
    return span
  }
  root.append(fillButton, divider(), sendButton, divider(), editButton, multiButton)
  root.style.display = 'none'
  document.body.appendChild(root)

  // 多选浮动条：每条独立浮在会话区域顶部（宽取会话区域一半、纵向堆叠
  // 间距 2px），条上有预览与移除钮；小「编辑 (n)」钮压在最后一条右下
  // 方（间距 5px），点了进编辑卡。
  const BAR_TOP_GAP = 8
  const BAR_HEIGHT = 28
  const BAR_GAP = 2
  const EDIT_GAP = 5
  const LEFT_PAD = 16
  const multiBarEls: HTMLElement[] = []
  const removeMultiBars = (): void => {
    for (const el of multiBarEls) el.remove()
    multiBarEls.length = 0
  }
  const rebuildPanel = (): void => {
    removeMultiBars()
    const items = getMultiItems()
    if (items.length === 0) return
    // 会话绑定：浮动条只出现在收藏归属的那个会话视图里。
    if (!boundToActiveSession(multiSessionId, options.currentSessionKey?.())) return
    const scroller = document.querySelector('[data-conversation-scroll]')
    if (scroller === null) return
    const rect = scroller.getBoundingClientRect()
    const left = rect.left + LEFT_PAD
    const width = Math.max((rect.width - LEFT_PAD * 2) / 2, 240)
    const barTop = (index: number): number => rect.top + BAR_TOP_GAP + index * (BAR_HEIGHT + BAR_GAP)
    for (const [index, item] of items.entries()) {
      const bar = document.createElement('div')
      bar.className = 'dshca-bar'
      bar.dataset.dshcaBar = ''
      bar.style.left = `${left}px`
      bar.style.top = `${barTop(index)}px`
      bar.style.width = `${width}px`
      const preview = document.createElement('span')
      preview.className = 'dshca-bar-text'
      const flat = item.text.replace(/\s+/g, ' ')
      preview.textContent = flat.length > 60 ? `${flat.slice(0, 60)}…` : flat
      preview.title = item.text
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'dshca-bar-remove'
      remove.dataset.action = 'remove-multi'
      remove.setAttribute('aria-label', options.t('selection.removeItem'))
      remove.title = options.t('selection.removeItem')
      remove.textContent = '×'
      remove.addEventListener('click', () => { removeMultiItem(item.id) })
      bar.append(preview, remove)
      document.body.appendChild(bar)
      multiBarEls.push(bar)
    }
    // 小编辑钮：最后一条的右下方（间距 5px），右缘与最后一条对齐。
    const edit = document.createElement('button')
    edit.type = 'button'
    edit.className = 'dshca-bar-edit'
    edit.dataset.action = 'edit-multi'
    edit.textContent = options.t('selection.editCount', { count: String(items.length) })
    edit.addEventListener('click', () => {
      openSelectionEdit(joinMultiTexts(getMultiItems()), true, options.currentSessionKey?.())
    })
    document.body.appendChild(edit)
    edit.style.top = `${barTop(items.length) + EDIT_GAP}px`
    edit.style.right = `${window.innerWidth - (left + width)}px`
    multiBarEls.push(edit)
  }
  rebuildPanel()
  const unsubscribeChip = subscribeMultiItems(rebuildPanel)

  let showTimer = 0
  const hide = (): void => {
    window.clearTimeout(showTimer)
    root.style.display = 'none'
  }
  const clearSelection = (): void => {
    try { window.getSelection()?.removeAllRanges() } catch { /* 有的实现会抛，落下去 */ }
    hide()
  }
  const toast = (text: string): void => {
    const el = document.createElement('div')
    el.className = 'dshca-toast'
    el.textContent = text
    document.body.appendChild(el)
    window.setTimeout(() => { el.remove() }, 2200)
  }
  const selectedText = (): string => {
    const sel = window.getSelection()
    return sel === null ? '' : sel.toString().trim()
  }

  fillButton.addEventListener('click', () => {
    const text = selectedText()
    if (text === '') { hide(); return }
    const composer = document.querySelector<HTMLElement>('[data-composer-input]')
    if (composer === null || typeof document.execCommand !== 'function') {
      toast(options.t('selection.fillFailed'))
      return
    }
    composer.focus()
    // 把光标塌缩到 composer 内容的**末尾**，再走 insertText 追加。
    // 不能用「全选 + 整段替换」：Lexical 维护自己的内容模型，DOM 层的
    // 范围替换会被它的模型校验拒绝并回滚（草稿非空时表现为没生效）；
    // 塌缩光标处的 insertText 则会被它的 beforeinput 正确接住。
    const range = document.createRange()
    range.selectNodeContents(composer)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    const existing = composer.textContent ?? ''
    const ok = document.execCommand('insertText', false, composeFillAppend(existing, text))
    if (!ok) toast(options.t('selection.fillFailed'))
    clearSelection()
  })

  sendButton.addEventListener('click', () => {
    const text = selectedText()
    const sessionId = currentSessionIdFromDom()
    if (text === '' || sessionId === undefined) {
      toast(options.t('markdownTurn.sendFailed'))
      return
    }
    void options.readers.sendToSession(sessionId, text).then(() => {
      clearSelection()
    }, () => {
      toast(options.t('markdownTurn.sendFailed'))
    })
  })

  editButton.addEventListener('click', () => {
    const text = selectedText()
    if (text === '') { hide(); return }
    // 单选编辑：进编辑卡，不影响多选收藏。
    openSelectionEdit(text, false, options.currentSessionKey?.())
    clearSelection()
  })

  multiButton.addEventListener('click', () => {
    const sel = window.getSelection()
    const text = sel === null ? '' : sel.toString().trim()
    if (text === '' || sel === null || sel.rangeCount === 0) { hide(); return }
    // 多选加入：捕获 Range 的副本供持续高亮，浏览器选区随后自然塌缩。
    const item = addMultiItem(text, sel.getRangeAt(0).cloneRange(), options.currentSessionKey?.())
    toast(options.t('selection.multiAdded', { count: String(item.id) }))
    hide()
  })

  let raf = 0
  const evaluate = (): void => {
    const sel = window.getSelection()
    if (sel === null || sel.isCollapsed || sel.rangeCount === 0) { hide(); return }
    const range = sel.getRangeAt(0)
    const anchorElement = (range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement) as SelectionAnchor | null
    if (!selectionAllowed(anchorElement, root.isConnected)) { hide(); return }
    const text = sel.toString().trim()
    if (text === '') { hide(); return }
    // 首行矩形：弹条放在选区第一行的上一行，尖角指向选中内容。
    // 首行矩形定垂直位置（首行上方），末行右缘定水平位置（贴选中内容最右边）。
    const rects = range.getClientRects()
    const firstRect = rects.length > 0 ? rects[0]! : range.getBoundingClientRect()
    const lastRect = rects.length > 0 ? rects[rects.length - 1]! : firstRect
    if (firstRect.width === 0 && firstRect.height === 0) { hide(); return }
    const position = selectionBarPosition(
      { left: firstRect.left, right: firstRect.right, top: firstRect.top, bottom: firstRect.bottom, height: firstRect.height },
      { left: lastRect.left, right: lastRect.right },
      { width: window.innerWidth, height: window.innerHeight },
      { width: root.offsetWidth || 160, height: root.offsetHeight || 30 },
    )
    // 选区已稳定，但**停顿 SELECTION_SHOW_DELAY_MS 后才出现**；期间任何
    // 选择变化（继续拖选、点别处塌缩）都会清掉这个定时器并先收起。
    window.clearTimeout(showTimer)
    showTimer = window.setTimeout(() => {
      root.style.left = `${position.left}px`
      root.style.top = `${position.top}px`
      root.style.setProperty('--dshca-arrow-x', `${position.arrowOffset}px`)
      root.dataset.arrow = position.arrow
      root.style.display = 'flex'
    }, SELECTION_SHOW_DELAY_MS)
  }
  const onSelectionChange = (): void => {
    cancelAnimationFrame(raf)
    // 选择还在变化（拖拽中）立即收起，并重排稳定计时——松手停下 1 秒后才弹。
    hide()
    raf = requestAnimationFrame(evaluate)
  }
  const onMouseDown = (event: MouseEvent): void => {
    if (root.contains(event.target as Node)) {
      // 按下弹条不塌缩选区，否则 click 时选区已空、按钮拿不到文本。
      event.preventDefault()
      return
    }
    hide()
  }
  const onScroll = (): void => { hide() }
  const onResize = (): void => { hide(); rebuildPanel() }
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') hide()
  }

  document.addEventListener('selectionchange', onSelectionChange)
  document.addEventListener('mousedown', onMouseDown, true)
  document.addEventListener('scroll', onScroll, true)
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', onResize)
  const unsubscribeSessionKey = options.subscribeSessionKey?.(rebuildPanel)

  return () => {
    cancelAnimationFrame(raf)
    window.clearTimeout(showTimer)
    window.removeEventListener('resize', onResize)
    unsubscribeSessionKey?.()
    unsubscribeChip()
    removeMultiBars()
    document.removeEventListener('selectionchange', onSelectionChange)
    document.removeEventListener('mousedown', onMouseDown, true)
    document.removeEventListener('scroll', onScroll, true)
    document.removeEventListener('keydown', onKeyDown)
    root.remove()
    style.remove()
  }
}

/** 便捷入口：从 remote 服务构建 readers 并启动（apply 里用）。 */
export function startSelectionActionsFromRemote(
  remote: () => unknown,
  t: RuntimeT,
  sessionKey?: {
    getKey: () => string | undefined
    subscribeKey: (listener: () => void) => () => void
  },
): () => void {
  return startSelectionActions({
    readers: createMarkdownTurnReaders(remote),
    t,
    ...(sessionKey === undefined ? {} : { currentSessionKey: sessionKey.getKey, subscribeSessionKey: sessionKey.subscribeKey }),
  })
}
