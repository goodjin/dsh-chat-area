/**
 * 工作区文件树的行控件：多选框（勾选 → 输入框文件引用）+ 悬浮编辑按钮。
 *
 * 宿主 FilesBody 的行上没有预留座位；这里在**私有**座位
 * `chat-power.tools.sidebar.right.pane.tab` 上把 FilesBody 重注册一遍（同 key、
 * 优先级更低从而在外层），渲染原生组件并在容器上补挂控件：
 *
 * - 行控件是挂在行元素上的绝对定位覆盖层（不是 React 受管子节点的插队），
 *   行自身的排序、更新不受影响；树刷新后由容器级 MutationObserver 重新补挂。
 * - 事件用容器级委托处理，控件元素不挂自己的监听。
 * - 只装本包时这个 wrap 才生效；卸载时恢复原条目。
 */
import { createElement, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import augmentCss from './file-tree-augment.module.css'
import { fallbackT } from './locales.ts'

/** 私有座位名（宿主 `sidebar.right.pane.tab` 经 toolSlot 映射后的名字）。 */
export const FILES_PANE_SLOT = 'chat-power.tools.sidebar.right.pane.tab'
/** 宿主 files 条目独有的 children 座位名（映射后），用作识别标记。 */
export const FILES_ACTIONS_CHILD = 'chat-power.tools.sidebar.right.tab.files.actions'

/** 插槽注册表里一个条目的最小结构。 */
interface SlotEntry {
  options: { key?: string; priority?: number; children?: Record<string, unknown>; locale?: string; inject?: unknown; store?: unknown }
  component: unknown
}

/** 宿主插槽表 chat-power 用到的最小面。 */
interface AugmentSlots {
  entries(key: string): readonly SlotEntry[]
  subscribe(key: string, fn: () => void): () => void
  register(options: Record<string, unknown>, component: unknown): () => void
}

/** 条目的 children 里带文件动作座位 → 它是 FilesBody。 */
export function isWorkspaceFilesEntry(entry: SlotEntry): boolean {
  return entry.options.children?.[FILES_ACTIONS_CHILD] !== undefined
}

/** 行元素上的工作区相对路径（宿主写好的 data-files-path）。 */
export function filesRowPath(row: Element): string | undefined {
  const value = row.getAttribute('data-files-path')
  return value === null || value === '' ? undefined : value
}

/** 会话内容相位 → 是否有历史：hero 是空新会话；settling/未知时不判定。 */
export function hasHistoryForPhase(phase: string | null | undefined): boolean | undefined {
  if (phase === 'hero') return false
  if (phase === 'active') return true
  return undefined
}

export interface AugmentHandlers {
  /** 该会话里某路径是否处于勾选状态。 */
  checked(path: string): boolean
  /** 勾选状态变化：checked=true 追加引用，false 移除。 */
  onToggle(path: string, checked: boolean): void
  /** 点击悬浮编辑按钮。 */
  onEdit(path: string): void
  /** 订阅勾选状态变化（发送清空、跨标签改动）以回同步勾选框；可选。 */
  subscribeChanges?(listener: () => void): () => void
}

/** 挂钩插槽表：找到 FilesBody 条目并以更低优先级重注册 wrap。 */
export function attachFilesTreeAugment(slots: AugmentSlots, handlers: () => AugmentHandlers): () => void {
  let removeWrap: (() => void) | undefined
  let native: unknown
  let key: string | undefined
  let locale: string | undefined
  let inject: unknown
  let store: unknown
  let installing = false
  const attach = (): void => {
    if (installing) return
    const entry = slots.entries(FILES_PANE_SLOT).find(isWorkspaceFilesEntry)
    if (entry === undefined || entry.component === undefined) return
    if (entry.component === native && removeWrap !== undefined) return
    installing = true
    try {
      removeWrap?.()
      native = entry.component
      key = entry.options.key
      locale = typeof entry.options.locale === 'string' ? entry.options.locale : undefined
      inject = entry.options.inject
      store = entry.options.store
      const Native = entry.component as (props: Record<string, unknown>) => ReactNode
      const Wrapper = (props: Record<string, unknown>): ReactNode => createElement(FilesTreeAugment, {
        handlers: handlers(),
        children: createElement(Native, props),
      })
      removeWrap = slots.register({
        name: FILES_PANE_SLOT, key, priority: -10,
        ...(locale === undefined ? {} : { locale }),
        ...(inject === undefined ? {} : { inject }),
        ...(store === undefined ? {} : { store }),
        ...(entry.options.children === undefined ? {} : { children: entry.options.children }),
      }, Wrapper)
    } finally { installing = false }
  }
  const unsubscribe = slots.subscribe(FILES_PANE_SLOT, attach)
  attach()
  return () => {
    unsubscribe()
    removeWrap?.()
    removeWrap = undefined
    native = undefined
  }
}

const CHECK_ATTR = 'data-chat-file-check'
const EDIT_ATTR = 'data-chat-file-edit'

/** 「编辑副本」的铅笔描边图标（与选区弹条同款风格，颜色随文字）。 */
const EDIT_ICON_SVG = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M11.2 2.2a1.6 1.6 0 0 1 2.6 2.6L6 12.5l-3.5.9.9-3.5 7.8-7.7Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>'

/**
 * 文件树容器：渲染原生 FilesBody，并给每个文件行补挂多选框与悬浮编辑按钮。
 * 重新装饰靠 MutationObserver；事件在容器上委托。
 */
export function FilesTreeAugment(props: { handlers: AugmentHandlers; children?: ReactNode }): ReactNode {
  const container = useRef<HTMLDivElement | null>(null)
  const handlersRef = useRef(props.handlers)
  handlersRef.current = props.handlers
  useEffect(() => {
    const root = container.current
    if (root === null || typeof MutationObserver === 'undefined') return
    const decorate = (): void => {
      for (const row of root.querySelectorAll('li[data-files-entry="file"]')) {
        if (row.querySelector(`:scope > [${CHECK_ATTR}]`) !== null) continue
        const path = filesRowPath(row)
        if (path === undefined) continue
        row.classList.add(augmentCss.row ?? '')
        const check = document.createElement('input')
        check.type = 'checkbox'
        check.setAttribute(CHECK_ATTR, '')
        check.checked = handlersRef.current.checked(path)
        check.setAttribute('data-chat-file-path', path)
        check.setAttribute('aria-label', fallbackT('fileTree.reference', { path }))
        const edit = document.createElement('button')
        edit.type = 'button'
        edit.setAttribute(EDIT_ATTR, '')
        edit.setAttribute('data-chat-file-path', path)
        edit.setAttribute('aria-label', fallbackT('fileTree.editCopy', { path }))
        edit.title = fallbackT('fileTree.editCopy', { path })
        edit.innerHTML = EDIT_ICON_SVG
        row.prepend(check)
        row.append(edit)
      }
    }
    // 勾选状态在会话状态一侧变化（发送清空、跨标签改动）时回同步已挂的勾选框。
    const sync = (): void => {
      for (const check of root.querySelectorAll<HTMLInputElement>(`[${CHECK_ATTR}]`)) {
        const path = check.getAttribute('data-chat-file-path')
        if (path !== null) check.checked = handlersRef.current.checked(path)
      }
    }
    decorate()
    const unsubscribeChanges = handlersRef.current.subscribeChanges?.(sync)
    const observer = new MutationObserver(decorate)
    observer.observe(root, { childList: true, subtree: true })
    const click = (event: Event): void => {
      const target = event.target as Element | null
      if (target === null) return
      const edit = target.closest(`[${EDIT_ATTR}]`)
      if (edit !== null) {
        const path = edit.getAttribute('data-chat-file-path')
        if (path !== null) handlersRef.current.onEdit(path)
        return
      }
      const check = target.closest(`[${CHECK_ATTR}]`)
      if (check instanceof HTMLInputElement) {
        const path = check.getAttribute('data-chat-file-path')
        if (path !== null) handlersRef.current.onToggle(path, check.checked)
        // 写入失败时以会话状态为准回拨（成功时两者一致，重设无害）。
        if (path !== null) check.checked = handlersRef.current.checked(path)
      }
    }
    root.addEventListener('click', click)
    return () => {
      unsubscribeChanges?.()
      observer.disconnect()
      root.removeEventListener('click', click)
    }
  }, [])
  return <div ref={container} className={augmentCss.root ?? ''} data-chat-files-augment="">{props.children}</div>
}
