/**
 * 发送侦测：聊天流里出现新的用户消息节点即视为一次发送。
 *
 * 窗口期规则：观察器启动后的 {@link SEND_BASELINE_WINDOW_MS} 内出现的用户节点
 * 都算「历史基线」——打开旧会话时历史是异步渲染的，那批节点不是发送。窗口期
 * 之后新增的用户消息（含 steering 插话）才算一次发送。编辑卡发送也走聊天流，
 * 自然覆盖。DOM 观察器与计时器可注入，纯逻辑在 Node 测试里验证。
 */

/** 用户消息节点在聊天流 DOM 上的标记（含插话）。 */
export const USER_NODE_SELECTOR = '[data-chat-flow-kind="user"],[data-chat-flow-kind="steering"]'

/** 启动后的历史基线窗口长度：本地历史渲染远快于此，真实发送都晚于它。 */
export const SEND_BASELINE_WINDOW_MS = 1500

export interface SendWatchOptions {
  /** 聊天流容器；尚未挂载时返回 null，等下一次观察回调再试。 */
  root: () => Element | null
  /** 判定一个元素是不是用户消息节点。 */
  isUserTurn: (element: Element) => boolean
  /** 确认一次发送。 */
  onSend: () => void
  /** 历史基线窗口；缺省 {@link SEND_BASELINE_WINDOW_MS}。 */
  windowMs?: number
  /** 注入 DOM 观察：目标元素上挂回调，返回退订。缺省用 MutationObserver。 */
  observe?: (target: Element, callback: (added: readonly Element[]) => void) => () => void
  /** 注入时钟。 */
  now?: () => number
}

/** 启动发送侦测；返回停止函数（幂等）。 */
export function startSendWatch(options: SendWatchOptions): () => void {
  const windowMs = options.windowMs ?? SEND_BASELINE_WINDOW_MS
  const now = options.now ?? (() => Date.now())
  const observe = options.observe ?? ((target, callback) => {
    const observer = new MutationObserver(mutations => {
      const added: Element[] = []
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) added.push(node)
        }
      }
      if (added.length > 0) callback(added)
    })
    observer.observe(target, { childList: true, subtree: true })
    return () => observer.disconnect()
  })
  const startedAt = now()
  const seen = new Set<Element>()
  let stopped = false
  let stopObserving: (() => void) | undefined
  const attach = (): void => {
    const root = options.root()
    if (root === null || stopped) return
    // 已挂载的用户节点全部算作已见：无论落在窗口期内还是外。
    for (const node of root.querySelectorAll(USER_NODE_SELECTOR)) seen.add(node)
    stopObserving = observe(root, added => {
      if (stopped) return
      for (const node of added) {
        if (seen.has(node)) continue
        seen.add(node)
        // 命中节点自身或其子树里的用户消息标记都算；兜底走注入判定。
        const matchesSelector = typeof node.matches === 'function' && node.matches(USER_NODE_SELECTOR)
        const containsSelector = typeof node.querySelector === 'function' && node.querySelector(USER_NODE_SELECTOR) !== null
        if (!matchesSelector && !containsSelector && !options.isUserTurn(node)) continue
        // 窗口期内出现的一律是历史渲染；窗口期后才是发送。
        if (now() - startedAt <= windowMs) continue
        options.onSend()
        return
      }
    })
  }
  attach()
  // 容器晚挂载（会话内容后渲染）时靠调用方重试：由调用方在会话视图变化时
  // 重建侦测器。这里只需要覆盖「启动时已挂载」这一情形。
  return () => {
    stopped = true
    stopObserving?.()
  }
}
