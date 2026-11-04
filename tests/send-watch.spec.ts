/**
 * 发送侦测的纯观察逻辑（DOM 观察器与计时器可注入，仓库没有 jsdom）。
 *
 * 规则：观察器启动后一个窗口期内的用户消息节点都算「历史基线」（打开旧会话时
 * 历史是异步渲染的），窗口期之后新增的用户消息才算一次发送。steering（插话）
 * 也算发送。
 */
import { describe, expect, it, vi } from 'vitest'
import { SEND_BASELINE_WINDOW_MS, startSendWatch, USER_NODE_SELECTOR } from '../src/send-watch.ts'

/** 可注入的假观察面：直接记录回调，测试手工投递新增节点。 */
function fakeObserve() {
  let callback: ((added: readonly Element[]) => void) | undefined
  return {
    added(elements: readonly Element[]) { callback?.(elements) },
    face: (target: Element, cb: (added: readonly Element[]) => void) => {
      callback = cb
      return () => { callback = undefined }
    },
  }
}

const userNode = (): Element => ({ tag: 'user' } as unknown as Element)
const otherNode = (): Element => ({ tag: 'tool' } as unknown as Element)
const isUser = (el: Element): boolean => (el as { tag?: string }).tag === 'user'

describe('发送侦测', () => {
  it('窗口期内新增的用户节点是历史基线，不触发发送', () => {
    const { face, added } = fakeObserve()
    const onSend = vi.fn()
    const stop = startSendWatch({
      root: () => ({ querySelectorAll: () => [] }) as unknown as Element,
      isUserTurn: isUser,
      onSend,
      observe: face,
      windowMs: 1000,
      now: () => 0,
    })
    added([userNode()])
    expect(onSend).not.toHaveBeenCalled()
    stop()
  })
  it('窗口期之后新增的用户节点触发一次发送', () => {
    const { face, added } = fakeObserve()
    const onSend = vi.fn()
    let clock = 0
    const stop = startSendWatch({
      root: () => ({ querySelectorAll: () => [] }) as unknown as Element,
      isUserTurn: isUser,
      onSend,
      observe: face,
      windowMs: 1000,
      now: () => clock,
    })
    clock = 2000
    added([userNode()])
    expect(onSend).toHaveBeenCalledTimes(1)
    clock = 3000
    added([userNode()])
    expect(onSend).toHaveBeenCalledTimes(2)
    stop()
  })
  it('非用户节点永远不触发发送', () => {
    const { face, added } = fakeObserve()
    const onSend = vi.fn()
    let clock = 0
    const stop = startSendWatch({
      root: () => ({ querySelectorAll: () => [] }) as unknown as Element,
      isUserTurn: isUser,
      onSend,
      observe: face,
      windowMs: 1000,
      now: () => clock,
    })
    clock = 2000
    added([otherNode(), otherNode()])
    expect(onSend).not.toHaveBeenCalled()
    stop()
  })
  it('stop 之后不再触发', () => {
    const { face, added } = fakeObserve()
    const onSend = vi.fn()
    let clock = 0
    const stop = startSendWatch({
      root: () => ({ querySelectorAll: () => [] }) as unknown as Element,
      isUserTurn: isUser,
      onSend,
      observe: face,
      windowMs: 1000,
      now: () => clock,
    })
    clock = 2000
    stop()
    added([userNode()])
    expect(onSend).not.toHaveBeenCalled()
  })
  it('同一批里用户节点只触发一次发送', () => {
    const { face, added } = fakeObserve()
    const onSend = vi.fn()
    let clock = 0
    const stop = startSendWatch({
      root: () => ({ querySelectorAll: () => [] }) as unknown as Element,
      isUserTurn: isUser,
      onSend,
      observe: face,
      windowMs: 1000,
      now: () => clock,
    })
    clock = 2000
    added([userNode(), userNode()])
    expect(onSend).toHaveBeenCalledTimes(1)
    stop()
  })
  it('窗口期长度有默认值（钉住，防止误改成 0）', () => {
    const { face, added } = fakeObserve()
    const onSend = vi.fn()
    let clock = 0
    const stop = startSendWatch({ root: () => ({ querySelectorAll: () => [] }) as unknown as Element, isUserTurn: isUser, onSend, observe: face, now: () => clock })
    added([userNode()])
    expect(onSend).not.toHaveBeenCalled()
    clock = SEND_BASELINE_WINDOW_MS + 1
    added([userNode()])
    expect(onSend).toHaveBeenCalledTimes(1)
    stop()
  })
  it('用户节点选择器同时覆盖 user 与 steering', () => {
    expect(USER_NODE_SELECTOR).toContain('"user"')
    expect(USER_NODE_SELECTOR).toContain('"steering"')
  })
})
