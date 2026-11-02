/**
 * 构建产物能不能装进页面。
 *
 * 这是**唯一**能提前发现的致命错误：DSH 把 exports["./client"] 那个文件原样塞进
 * 页面的模块表，格式是「window.__ModuleLoader__.load({ id, factory })」。产物要是
 * 没套这层壳、id 写错、或者 factory 一执行就抛，页面在下次启动时会在装配审计里
 * 直接把整页判成失败——不是少一个功能，是打不开界面。
 *
 * 所以这里按页面的方式执行一遍产物：登记工厂 → 用页面给的 require 取 react →
 * 调 apply → 看它有没有把会话 ID 条注册进头部工具排。
 */

import { describe, expect, it } from 'vitest'
import { PANEL_ID, SLOT } from '../src/session-id-bar/register.ts'

/** 页面模块表里的一行。 */
type LoadedRow = { id: string; factory: (require: (specifier: string) => unknown) => Record<string, unknown> }

describe('lib/client.js 是页面能装的产物', () => {
  it('登记了正确的 id，factory 执行后 apply 能注册会话 ID 条', async () => {
    const rows: LoadedRow[] = []
    const globalWindow = { __ModuleLoader__: { load: (row: LoadedRow) => { rows.push(row) } } }
    const previous = (globalThis as { window?: unknown }).window
    ;(globalThis as { window?: unknown }).window = globalWindow
    try {
      const bundle = '../lib/client.js'
      await import(bundle)
    } finally {
      ;(globalThis as { window?: unknown }).window = previous
    }

    expect(rows.length, '产物必须调用一次 window.__ModuleLoader__.load').toBe(1)
    expect(rows[0]?.id).toBe('@goodjin2/dsh-chat-area')

    // 页面给的 require 只能取到模块表里有的东西；产物除了 react 不该再要别的。
    const react = await import('react')
    const loaded = rows[0]?.factory((specifier: string) => {
      if (specifier === 'react' || specifier === 'react/jsx-runtime') return react
      throw new Error(`产物请求了模块表外的模块：${specifier}`)
    })
    expect(typeof loaded?.apply, '产物必须导出 apply').toBe('function')

    const injected: string[] = []
    const registered: Record<string, unknown>[] = []
    const ctx = {
      slots: {
        inject: (key: string, callback: () => unknown) => { injected.push(key); return callback() },
        register: (options: Record<string, unknown>) => { registered.push(options); return () => {} },
      },
      logger: () => ({ info: () => {}, warn: () => {} }),
      effect: () => () => {},
      get: () => undefined,
    }
    ;(loaded?.apply as (ctx: unknown) => void)(ctx)
    expect(injected).toEqual([SLOT])
    expect(registered.map(options => options.id)).toEqual([PANEL_ID])
  })
})
