/**
 * 会话区 UI 统一改造的基础件：共享主题样式、统一发送控制器。
 *
 * 本仓库没有 jsdom / react-dom，测试沿用仓库惯例：纯逻辑直接测，DOM 注入用
 * 假 document（createElement / head.appendChild / querySelector 的最小面）。
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  UI_THEME_CSS,
  UI_THEME_TAG,
  injectUiThemeCss,
  panelClass,
  statusNoticeClass,
  uiButtonClass,
} from '../src/ui-theme.ts'
import { createSendController } from '../src/send-actions.ts'

/** compose-card 尚无渲染器可测，按仓库惯例先钉住源码级契约（bundle.spec 同路数）。 */
const composeCardSource = (): string =>
  readFileSync(new URL('../src/compose-card.tsx', import.meta.url), 'utf8')

/** 手写Promise 门：让 send 挂起，控制 resolve / reject 时机。 */
function deferred<T = void>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

/** 微任务 + 宏任务都排空，保证 then 回调已执行。 */
const flush = (): Promise<void> => new Promise(resolve => { setTimeout(resolve, 0) })

describe('统一 UI 主题', () => {
  it('类名常量出现在共享样式里（类名与样式一体维护，不许漂移）', () => {
    for (const cls of [uiButtonClass, panelClass, statusNoticeClass]) {
      expect(UI_THEME_CSS).toContain(`.${cls}`)
    }
  })

  it('颜色首选宿主语义 token；不得写死整套白底/深色浮层（旧选区弹条的问题）', () => {
    expect(UI_THEME_CSS).toContain('--dsw-alias-')
    expect(UI_THEME_CSS).not.toContain('background:#fff')
    expect(UI_THEME_CSS).not.toContain('#2b2b30')
    expect(UI_THEME_CSS).not.toContain('prefers-color-scheme')
  })

  it('数值基线齐全：控件 6px 圆角、32px 点击区、12px 辅助文字', () => {
    expect(UI_THEME_CSS).toContain('border-radius:6px')
    expect(UI_THEME_CSS).toContain('width:32px')
    expect(UI_THEME_CSS).toContain('font-size:12px')
  })

  it('注入是幂等的：同一页面只注入一份，内容就是导出的样式', () => {
    const appended: Array<{ tag: string; css: string }> = []
    const doc = {
      querySelector(selector: string): unknown {
        const tag = /data-plugin-css="([^"]+)"/.exec(selector)?.[1]
        return appended.find(element => element.tag === tag) ?? null
      },
      createElement(): { dataset: Record<string, string>; textContent: string } {
        return { dataset: {}, textContent: '' }
      },
      head: { appendChild(element: { dataset: Record<string, string>; textContent: string }): void {
        appended.push({ tag: element.dataset['pluginCss'] ?? '', css: element.textContent })
      } },
    }
    injectUiThemeCss(doc as unknown as Document)
    injectUiThemeCss(doc as unknown as Document)
    expect(appended).toHaveLength(1)
    expect(appended[0]!.tag).toBe(UI_THEME_TAG)
    expect(appended[0]!.css).toBe(UI_THEME_CSS)
  })
})

describe('统一编辑卡外壳 ComposeCard', () => {
  /** 去掉注释后的源码，用于「不写死文案」类断言。 */
  const codeWithoutComments = (): string => composeCardSource().replace(/\/\*[\s\S]*?\*\//g, '')
  it('用统一面板类与稳定 data 属性（React 与纯 DOM 宿主都按同一套类名复用）', () => {
    const source = composeCardSource()
    expect(source).toContain('panelClass')
    expect(source).toContain('uiButtonClass')
    expect(source).toContain('data-compose-card')
    expect(source).toContain('data-compose-cancel')
    expect(source).toContain('data-compose-new-session')
    expect(source).toContain('data-compose-send')
  })

  it('取消在头部、新会话与发送在动作行右侧；发送在 pending 或空白时禁用', () => {
    const source = composeCardSource()
    expect(source).toContain('props.pending')
    expect(source).toContain('props.sendDisabled')
    expect(source.indexOf('data-compose-cancel')).toBeLessThan(source.indexOf('data-compose-send'))
    expect(source.indexOf('data-compose-new-session')).toBeLessThan(source.indexOf('data-compose-send'))
  })

  it('动作文案经由 labels 注入，不在组件里写死中文', () => {
    const source = composeCardSource()
    expect(source).toContain('labels.cancel')
    expect(source).toContain('labels.send')
    expect(source).toContain('labels.newSession')
    expect(codeWithoutComments()).not.toMatch(/[\u4e00-\u9fff]/)
  })
})

describe('统一编辑链路', () => {
  /** 四处编辑器：答案副本、本机文件、选区编辑、工作区文件（tab 复用本机文件组件）。 */
  const EDITORS = ['../src/answer-card.tsx', '../src/local-file.tsx', '../src/selection-edit-card.tsx']
  const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), 'utf8')

  it('答案编辑不再经全局 DOM 查询读值（多卡同开不串值）', () => {
    const source = read('../src/answer-card.tsx')
    expect(source).not.toContain("document.querySelector('[data-answer-edit-input]')")
    expect(source).toContain('useRef')
  })

  it('四处编辑器全部接统一发送控制器与统一外壳', () => {
    for (const file of EDITORS) {
      const source = read(file)
      expect(source).toContain('createSendController')
      expect(source).toContain('ComposeCard')
    }
    expect(read('../src/conversation-tools.tsx')).toContain('LocalFileComposerCard')
  })

  it('发送动作文案统一：发送到当前会话 / 新建会话并发送', () => {
    for (const file of EDITORS) {
      const source = read(file)
      expect(source).toContain('compose.sendCurrent')
      expect(source).toContain('compose.sendNewSession')
    }
  })

  it('只有发送成功才收起：收起逻辑落在 onSuccess 回调里', () => {
    for (const file of EDITORS) {
      expect(read(file)).toContain('onSuccess')
    }
  })

  it('发送副本语义有提示：编辑卡带 copyHint 说明', () => {
    for (const file of EDITORS) {
      expect(read(file)).toContain('compose.copyHint')
    }
  })
})

describe('统一发送控制器', () => {
  it('空白文本直接拒绝：不发起请求、不进入 pending、不回调', async () => {
    const sent: string[] = []
    const events: string[] = []
    const controller = createSendController({
      send: text => { sent.push(text); return Promise.resolve() },
      onSuccess: () => { events.push('success') },
      onFailure: () => { events.push('failure') },
      onPendingChange: pending => { events.push(`pending:${String(pending)}`) },
    })
    controller.submit('   ')
    await flush()
    expect(sent).toEqual([])
    expect(controller.pending).toBe(false)
    expect(events).toEqual([])
  })

  it('同一时刻只允许一次在途发送；上一笔完成后才能再发', async () => {
    const sent: string[] = []
    const succeeded: string[] = []
    const gate = deferred()
    const controller = createSendController({
      send: text => { sent.push(text); return gate.promise },
      onSuccess: text => { succeeded.push(text) },
    })
    controller.submit('第一笔')
    controller.submit('第二笔')
    expect(sent).toEqual(['第一笔'])
    expect(controller.pending).toBe(true)
    gate.resolve()
    await flush()
    expect(succeeded).toEqual(['第一笔'])
    expect(controller.pending).toBe(false)
    const gate2 = deferred()
    const sent2: string[] = []
    const controller2 = createSendController({ send: text => { sent2.push(text); return gate2.promise } })
    controller2.submit('第三笔')
    expect(sent2).toEqual(['第三笔'])
    gate2.resolve()
    await flush()
  })

  it('只有成功才报 onSuccess；失败走 onFailure 且原文交还（UI 据此保留草稿）', async () => {
    const outcomes: string[] = []
    const failureGate = deferred()
    const failing = createSendController({
      send: () => failureGate.promise,
      onSuccess: () => { outcomes.push('success') },
      onFailure: (_error, text) => { outcomes.push(`failure:${text}`) },
    })
    failing.submit('会失败的内容')
    failureGate.reject(new Error('网络断了'))
    await flush()
    expect(outcomes).toEqual(['failure:会失败的内容'])
    expect(failing.pending).toBe(false)

    const successGate = deferred()
    const succeeding = createSendController({
      send: () => successGate.promise,
      onSuccess: text => { outcomes.push(`success:${text}`) },
      onFailure: () => { outcomes.push('failure') },
    })
    succeeding.submit('会成功的内容')
    successGate.resolve()
    await flush()
    expect(outcomes.slice(1)).toEqual(['success:会成功的内容'])
    expect(succeeding.pending).toBe(false)
  })

  it('dispose 之后不再回报任何回调', async () => {
    const events: string[] = []
    const gate = deferred()
    const controller = createSendController({
      send: () => gate.promise,
      onSuccess: () => { events.push('success') },
      onFailure: () => { events.push('failure') },
      onPendingChange: pending => { events.push(`pending:${String(pending)}`) },
    })
    controller.submit('在途')
    expect(controller.pending).toBe(true)
    controller.dispose()
    expect(controller.pending).toBe(false)
    expect(events).toEqual(['pending:true', 'pending:false'])
    gate.resolve()
    await flush()
    expect(events).toEqual(['pending:true', 'pending:false'])
  })
})
