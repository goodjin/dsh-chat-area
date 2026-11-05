/**
 * 会话区选区弹条：选中一段文本后，在选中末尾弹出两个按钮——
 * 「添加到会话」（填进输入框草稿）与「发送会话」（直接作为新请求发出）。
 *
 * 纯 DOM 实现（同 mermaid.ts 的注入路数），不经 React：弹条的生命周期
 * 挂在 document 的 selectionchange / mousedown / scroll / keydown 上。
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
  '.dshca-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:70;',
  'padding:6px 14px;border-radius:8px;background:rgb(30 30 30 / 92%);color:#fff;font-size:12px;pointer-events:none}',
].join('')

/** 「添加到会话」按钮的加号图标（描边风格，颜色随文字）。 */
const ICON_PLUS = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'

/** 「发送会话」按钮的纸飞机图标（描边风格，颜色随文字）。 */
const ICON_SEND = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M14 2 7.7 8.3M14 2 9.8 14l-2.1-5.7L2 6.2 14 2Z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>'

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
function currentSessionIdFromDom(): string | undefined {
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

/**
 * 启动选区弹条：注入样式、挂监听、建弹条元素。
 * @param options - readers（发送口）与文案。
 * @returns 清理函数：摘掉监听并移除弹条元素。
 */
export function startSelectionActions(options: { readers: MarkdownTurnReaders; t: RuntimeT }): () => void {
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
  const divider = document.createElement('span')
  divider.className = 'dshca-divider'
  divider.setAttribute('aria-hidden', 'true')
  const sendButton = labeledButton('send-to-chat', ICON_SEND, options.t('selection.sendToChat'))
  root.append(fillButton, divider, sendButton)
  root.style.display = 'none'
  document.body.appendChild(root)

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
  const onResize = (): void => { hide() }
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') hide()
  }

  document.addEventListener('selectionchange', onSelectionChange)
  document.addEventListener('mousedown', onMouseDown, true)
  document.addEventListener('scroll', onScroll, true)
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', onResize)

  return () => {
    cancelAnimationFrame(raf)
    window.clearTimeout(showTimer)
    window.removeEventListener('resize', onResize)
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
): () => void {
  return startSelectionActions({ readers: createMarkdownTurnReaders(remote), t })
}
