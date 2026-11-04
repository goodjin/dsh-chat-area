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
 * 通道）；「添加到会话」聚焦 composer 的 contenteditable 后走 insertText
 * 命令——Lexical 经 beforeinput 正确接住，草稿与未发送提示保持原生行为。
 */
import { createMarkdownTurnReaders } from './markdown-turn-sources.ts'
import type { MarkdownTurnReaders } from './markdown-turn-sources.ts'
import type { RuntimeT } from './locales.ts'

/** 选中停下多少毫秒后才弹条：拖拽选择期间不弹，停下 1 秒才出现。 */
export const SELECTION_SHOW_DELAY_MS = 1000

/** 弹条与提示的样式；类名带 dshca- 前缀避免与页面样式冲突。 */
const BAR_CSS = [
  '.dshca-selbar{position:fixed;z-index:60;display:flex;gap:2px;padding:2px;',
  'border-radius:8px;background:rgb(30 30 30 / 88%);box-shadow:0 2px 8px rgb(0 0 0 / 25%)}',
  // 尖角：默认在弹条下方（朝下指向选区）；data-arrow="up" 时翻到上方。
  // 水平位置由 JS 写入 --dshca-arrow-x（对准选区行的中心）。
  '.dshca-selbar::after{content:"";position:absolute;bottom:-6px;left:var(--dshca-arrow-x,16px);',
  'margin-left:-6px;border:6px solid transparent;border-top-color:rgb(30 30 30 / 88%);border-bottom:0}',
  '.dshca-selbar[data-arrow="up"]::after{bottom:auto;top:-6px;',
  'border-top:0;border-bottom:6px solid rgb(30 30 30 / 88%)}',
  '.dshca-selbar button{border:none;background:transparent;color:rgb(255 255 255 / 92%);',
  'font:inherit;font-size:12px;line-height:18px;padding:4px 10px;border-radius:6px;cursor:pointer;white-space:nowrap}',
  '.dshca-selbar button:hover{background:rgb(255 255 255 / 14%)}',
  '.dshca-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:70;',
  'padding:6px 14px;border-radius:8px;background:rgb(30 30 30 / 92%);color:#fff;font-size:12px;pointer-events:none}',
].join('')

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
 * 计算弹条位置：放在选区**首行**的上一行，带一个尖角指向选中内容。
 *
 * - 默认在首行上方（箭头朝下）；首行贴近视口顶时翻到行下方（箭头朝上）。
 * - 水平上弹条左缘先对齐选区行首，出右视口往左收；尖角指向该行选区的
 *   水平中心（钳在弹条内，别探出边缘）。
 * @param rect - 选区首行的客户区矩形。
 * @param viewport - 视口尺寸。
 * @param bar - 弹条尺寸。
 * @returns 定位坐标、箭头水平偏移（相对弹条左缘）与箭头方向。
 */
export function selectionBarPosition(
  rect: { left: number; right: number; top: number; bottom: number; width: number; height: number },
  viewport: { width: number; height: number },
  bar: { width: number; height: number },
): { left: number; top: number; arrowOffset: number; arrow: 'down' | 'up' } {
  const margin = 8
  const gap = 6
  let arrow: 'down' | 'up' = 'down'
  let top = rect.top - bar.height - gap
  if (top < margin) {
    // 首行贴近视口顶：翻到选区行下方，尖角朝上。
    arrow = 'up'
    top = rect.bottom + gap
  }
  if (top + bar.height + margin > viewport.height) top = viewport.height - margin - bar.height
  let left = rect.left
  if (left + bar.width + margin > viewport.width) left = viewport.width - margin - bar.width
  if (left < margin) left = margin
  const arrowX = rect.left + rect.width / 2
  const arrowOffset = Math.min(Math.max(arrowX - left, 10), bar.width - 10)
  return { left, top, arrowOffset, arrow }
}

/** 当前会话编号：会话根节点上框架写的 data-conversation-session。 */
function currentSessionIdFromDom(): string | undefined {
  const node = document.querySelector('[data-conversation-session]')
  const value = node?.getAttribute('data-conversation-session')
  return value === null || value === '' ? undefined : value
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
  const fillButton = document.createElement('button')
  fillButton.type = 'button'
  fillButton.dataset.action = 'add-to-chat'
  fillButton.textContent = options.t('selection.addToChat')
  const sendButton = document.createElement('button')
  sendButton.type = 'button'
  sendButton.dataset.action = 'send-to-chat'
  sendButton.textContent = options.t('selection.sendToChat')
  root.append(fillButton, sendButton)
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
    // Lexical 绑在 contenteditable 的 beforeinput 上，insertText 会被它正确接住。
    const ok = document.execCommand('insertText', false, text)
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
    const rects = range.getClientRects()
    const rect = rects.length > 0 ? rects[0]! : range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) { hide(); return }
    const position = selectionBarPosition(
      { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
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
