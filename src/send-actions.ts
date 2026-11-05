/**
 * 统一发送控制器：答案、本机文件、选区、批注共用的一条发送链路。
 *
 * 规约（specs/2026-11-06-chat-power-ui-unification-design.md）：
 * - 空白文本直接拒绝，不发起请求；
 * - 同一时刻只允许一笔在途发送（防重复提交）；
 * - 只有成功才报 onSuccess（UI 在这里才收起 / 清空）；失败报 onFailure 并把
 *   原文交还（UI 据此保留草稿与收集内容）；
 * - dispose 之后不再回报任何回调。
 *
 * 框架无关（纯 Promise），React 组件与纯 DOM 功能都能接。
 */

export interface SendControllerOptions {
  /** 发送请求本体；resolve 即成功。 */
  send(text: string): Promise<void>
  /** 空白判定；缺省为 trim 后为空。 */
  isEmpty?(text: string): boolean
  /** pending 状态变化（UI 用来禁用按钮 / 显示进行中）。 */
  onPendingChange?(pending: boolean): void
  /** 发送成功；只在此处收起编辑、清空草稿。 */
  onSuccess?(text: string): void
  /** 发送失败；UI 据此保留内容并给出可重试反馈。 */
  onFailure?(error: unknown, text: string): void
}

export interface SendController {
  /** 提交一段文本；空白或在途时静默忽略。 */
  submit(text: string): void
  /** 当前是否有一笔在途发送。 */
  readonly pending: boolean
  /** 作废控制器；在途回调不再回报。 */
  dispose(): void
}

/** 复制到剪贴板的统一入口：成功 true / 失败 false，绝不抛错。 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const clipboard = globalThis.navigator?.clipboard
  if (clipboard === undefined) return false
  try {
    await clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function createSendController(options: SendControllerOptions): SendController {  const isEmpty = options.isEmpty ?? ((text: string): boolean => text.trim() === '')
  let pending = false
  let disposed = false
  // 代际号：dispose / 后续提交后，迟到的前一笔响应不再回报。
  let generation = 0
  const setPending = (value: boolean): void => {
    if (pending === value) return
    pending = value
    options.onPendingChange?.(value)
  }
  return {
    submit(text: string): void {
      if (disposed || pending) return
      if (isEmpty(text)) return
      setPending(true)
      const current = ++generation
      void options.send(text).then(
        () => {
          if (disposed || current !== generation) return
          setPending(false)
          options.onSuccess?.(text)
        },
        (error: unknown) => {
          if (disposed || current !== generation) return
          setPending(false)
          options.onFailure?.(error, text)
        },
      )
    },
    get pending(): boolean { return pending },
    dispose(): void {
      if (disposed) return
      disposed = true
      setPending(false)
    },
  }
}
