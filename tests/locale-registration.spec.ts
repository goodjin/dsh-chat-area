/**
 * 词典要按宿主认识的形状注册。
 *
 * 宿主 locale 服务的签名是 `register(namespace, { locale: dict })`。早先两个插件
 * 都按 `register({ [NAMESPACE]: {...} })` **单参数**调用：namespace 位置收到对象、
 * 第二参数是 undefined，服务内部 `Object.entries(undefined)` 抛 TypeError——外面
 * 那层 try/catch 吞掉后，座位的 `t` 永远解不出词条，界面上显示成
 * `panel.sessionBar.copy` 这样的键名（2026-11-03 现场：会话 ID 条的复制按钮）。
 *
 * 这条测试用假 locale 服务盯住调用形状，并断言中英词典都非空。
 */

import { describe, expect, it } from 'vitest'
import { registerConversationSurfaces } from '../src/conversation-surfaces.tsx'
import { NAMESPACE, en, zh } from '../src/locales.ts'

/** 记录 register 调用的假服务；形状照宿主那份（两参 + 返回 disposer）。 */
function fakeLocale(): { calls: unknown[][]; service: { register(...args: unknown[]): () => void } } {
  const calls: unknown[][] = []
  return {
    calls,
    service: {
      register(...args: unknown[]): () => void {
        calls.push(args)
        return () => {}
      },
    },
  }
}

/** 只回答 'locale' 的服务面，其余照最小需求给。 */
function surface(locale: unknown): Parameters<typeof registerConversationSurfaces>[0] {
  const slots = {
    inject: (_key: string, callback: () => unknown) => callback(),
    register: () => () => {},
    entries: () => [],
    subscribe: () => () => {},
  }
  return {
    slots,
    get: (name: string) => (name === 'locale' ? locale : undefined),
    effect: (callback: () => unknown) => callback(),
  } as unknown as Parameters<typeof registerConversationSurfaces>[0]
}

describe('会话区词典的注册形状', () => {
  it('按 (namespace, { zh, en }) 两参注册，中英都非空', () => {
    const fake = fakeLocale()
    registerConversationSurfaces(surface(fake.service))
    expect(fake.calls).toHaveLength(1)
    const [ns, dictionaries] = fake.calls[0] as [string, Record<string, Record<string, string>>]
    expect(ns).toBe(NAMESPACE)
    expect(Object.keys(dictionaries).sort()).toEqual(['en', 'zh'])
    expect(dictionaries['zh']?.['panel.sessionBar.copy']).toBe('复制')
    expect(dictionaries['en']?.['panel.sessionBar.copy']).toBe('Copy')
  })

  it('词典本体不是空的（英文字典曾经是 `{}`，英文界面就只剩键名）', () => {
    expect(Object.keys(zh).length).toBeGreaterThan(10)
    expect(Object.keys(en).length).toBe(Object.keys(zh).length)
  })

  it('locale 服务缺席时安静跳过，不抛', () => {
    expect(() => registerConversationSurfaces(surface(undefined))).not.toThrow()
  })
})
