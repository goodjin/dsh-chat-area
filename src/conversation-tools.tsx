import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { IconFolderOpenOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { toolsState } from './tools-state.ts'
import { createToolsAdapter, toolSlot } from './tools-adapter.tsx'
import { attachFilesTreeAugment, hasHistoryForPhase, type AugmentHandlers } from './file-tree-augment.tsx'
import { checkedFiles, toolsNotice } from './checked-files.ts'
import { createReferenceApplier } from './composer-references.ts'
import { readEntireWorkspaceText } from './workspace-text.ts'
import { startSendWatch, USER_NODE_SELECTOR } from './send-watch.ts'
import { LOCAL_FILE_ACCEPT, LOCAL_FILE_MAX_BYTES, LocalFileComposerCard } from './local-file.tsx'
import { createMarkdownTurnReaders } from './markdown-turn-sources.ts'
import { fallbackT } from './locales.ts'
import { readDefaultLinkOpenMode, writeDefaultLinkOpenMode, openInBrowser } from './link-open.ts'
import css from './conversation-tools.module.css'
const ROOT = 'chat-area.tools'
const BODY = toolSlot('sidebar.right.pane.tab')

export function registerConversationTools(ctx: any) {
  if (typeof ctx.inject !== 'function') return
  const adapter = createToolsAdapter(ctx)
  const readers = createMarkdownTurnReaders(() => ctx.get('remote'))
  const docs = new Map<string, { name: string; text: string; seq: number }>()
  const currentId = () => ctx.get('uiSession')?.adapter.current.getSnapshot().key as string | undefined
  // 勾选 → 输入框引用：优先走宿主输入外壳（引用渲染成卡片 chip），
  // 外壳不可达退回 execCommand 插入纯文本提及（选区弹条同款通道）。
  const applyReference = createReferenceApplier({
    shellOf: sessionId => {
      const conversation = ctx.get('conversation') as any
      const shell = conversation?.input?.shell?.(sessionId)
      return typeof shell === 'object' && shell !== null ? shell : undefined
    },
    insertViaCommand: text => {
      const composer = document.querySelector<HTMLElement>('[data-composer-input]')
      if (composer === null || typeof document.execCommand !== 'function') return false
      composer.focus()
      return document.execCommand('insertText', false, text)
    },
  })
  // 文件行编辑：读整篇（5 MB / 20000 行上限）→ 打开本机文件卡编辑标签。
  const openWorkspaceEditor = (sessionId: string, path: string): void => {
    const controller = new AbortController()
    void readEntireWorkspaceText(sessionId, path,
      offset => readers.readPage(sessionId, path, offset, controller.signal),
      controller.signal,
    ).then(text => {
      const name = path.split('/').at(-1) ?? path
      const tab = toolsState.open(sessionId, 'local', name, `edit://${path}`)
      docs.set(tab.id, { name, text, seq: Date.now() })
      toolsState.select(sessionId, tab.id)
      toolsNotice.clear(sessionId)
    }, error => {
      toolsNotice.set(sessionId, `读取失败：${String(error)}`)
    })
  }
  const augmentHandlers = (): AugmentHandlers => ({
    checked: path => { const id = currentId(); return id !== undefined && checkedFiles.has(id, path) },
    onToggle: (path, checked) => {
      const id = currentId()
      if (id === undefined) return
      if (!applyReference(id, path, checked)) {
        toolsNotice.set(id, checked ? '暂时无法写入输入框引用' : '输入框暂不可访问，未能移除该引用')
        return
      }
      checkedFiles.toggle(id, path, checked)
      toolsNotice.clear(id)
    },
    onEdit: path => { const id = currentId(); if (id !== undefined) openWorkspaceEditor(id, path) },
    subscribeChanges: listener => checkedFiles.subscribe(listener),
  })
  function Toggle() {
    const id = useSyncExternalStore(ctx.get('uiSession').adapter.current.subscribe, currentId, currentId)
    const s = useSyncExternalStore(toolsState.subscribe, () => toolsState.get(id ?? ''), () => toolsState.get(id ?? ''))
    const activeTab = s.tabs.find(t => t.id === s.active)
    const toolActive = activeTab !== undefined && activeTab.kind !== 'chat'
    return <button type="button" className={css.toggle} disabled={!id} aria-label="打开工作区文件" title="打开工作区文件"
      aria-expanded={toolActive} data-chat-tools-toggle="" onClick={() => { if (id) toolsState.open(id, 'files', '工作区文件') }}><IconFolderOpenOutlineRegular size={16} /></button>
  }
  function ToolArea(props: any) {
    const id = props.sessionId as string
    const s = useSyncExternalStore(toolsState.subscribe, () => toolsState.get(id), () => toolsState.get(id))
    const notice = useSyncExternalStore(toolsNotice.subscribe, () => toolsNotice.get(id), () => toolsNotice.get(id))
    const pick = useRef<HTMLInputElement>(null)
    const [error, setError] = useState('')
    const [mode, setMode] = useState(readDefaultLinkOpenMode)
    const selectFile = async (file?: File) => {
      if (!file) return
      if (file.size > LOCAL_FILE_MAX_BYTES) { setError('文件超过 5 MB，请选择较小的文本文件。'); return }
      try {
        const text = await file.text()
        const tab = toolsState.open(id, 'local', file.name, `local://${crypto.randomUUID()}`)
        docs.set(tab.id, { name: file.name, text, seq: Date.now() })
        toolsState.select(id, tab.id)
        setError('')
      } catch (err) { setError(`读取失败：${String(err)}`) }
    }
    return <section className={css.tools} data-chat-tools="" aria-label="会话工具">
      <div className={css.toolbar}>
        <button onClick={() => pick.current?.click()}>打开本机文件</button>
        {(['files', 'browser', 'terminal'] as const).map(kind => <button key={kind} onClick={() => {
          try { adapter.open(id, kind) } catch (err) { setError(String(err)) }
        }}>{({ files: '工作区文件', browser: '浏览器', terminal: '终端' })[kind]}</button>)}
        <label className={css.preference}>链接默认打开 <select aria-label="链接默认打开方式" value={mode} onChange={e => {
          const value = e.target.value as 'right' | 'browser'; writeDefaultLinkOpenMode(value); setMode(value)
        }}><option value="right">内置浏览器</option><option value="browser">外部浏览器</option></select></label>
        <input ref={pick} hidden type="file" accept={LOCAL_FILE_ACCEPT} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void selectFile(f) }} />
      </div>
      {(error !== '' || notice !== '') && <p role="alert">{error !== '' ? error : notice}</p>}
      <div className={css.tabs} role="tablist" aria-label="会话区标签">
        {s.tabs.map(tab => <div className={css.tab} key={tab.id}>
          <button role="tab" aria-selected={s.active === tab.id} onClick={() => toolsState.select(id, tab.id)}>{tab.title}</button>
          {tab.kind !== 'chat' && <button aria-label={`关闭 ${tab.title}`} onClick={() => { adapter.close(id, tab.id); docs.delete(tab.id) }}>×</button>}
        </div>)}
      </div>
      <div className={css.content} data-chat-tools-bodies="">
        {s.tabs.map(tab => {
          if (tab.kind === 'chat') return null
          const visible = tab.id === s.active
          const definition = adapter.definitions.get(tab.kind)
          const info = adapter.tabInfo(id, tab, visible)
          return <div key={tab.id} hidden={!visible} className={css.body}>
            {tab.kind === 'local' && docs.has(tab.id)
              ? <LocalFileComposerCard doc={docs.get(tab.id)!} readers={readers} t={fallbackT} sessionId={id}
                  onDraftChange={text => { const doc = docs.get(tab.id); if (doc) docs.set(tab.id, { ...doc, text }) }}
                  onSent={() => toolsState.activateChat(id)} onClose={() => { adapter.close(id, tab.id); docs.delete(tab.id) }} />
              : definition && props.renderSlot(BODY, {}, { entryKey: definition.id, hookContext: () => info })}
          </div>
        })}
      </div>
    </section>
  }
  // The tab strip is an independently owned session view in normal conversation
  // flow, inserted before the conversation content. We never reparent host React
  // nodes or borrow their slot authorization.
  function PortalRoot(props: any) {
    const id = useSyncExternalStore(ctx.get('uiSession').adapter.current.subscribe, currentId, currentId)
    const s = useSyncExternalStore(toolsState.subscribe, () => toolsState.get(id ?? ''), () => toolsState.get(id ?? ''))
    const activeTab = s.tabs.find(t => t.id === s.active)
    const toolActive = activeTab !== undefined && activeTab.kind !== 'chat'
    const [mounts, setMounts] = useState<{ button: HTMLElement; body: HTMLElement } | null>(null)
    const [reference, setReference] = useState<any>(null)
    useEffect(() => {
      if (!id) { setReference(null); return }
      const ref = ctx.get('sessions').retain(id, { source: 'chatAreaTools' })
      setReference({ id, ref })
      void ref.ready.catch((error: unknown) => console.error('Conversation tools session:', error))
      return () => ref.release()
    }, [id])
    useLayoutEffect(() => {
      let attached: HTMLElement | null = null
      let button: HTMLElement | null = null
      let body: HTMLElement | null = null
      const attach = () => {
        const leading = document.querySelector<HTMLElement>('[data-conversation-header-leading]')
        let root = leading?.closest('header')?.parentElement
        while (root && !root.querySelector('[data-conversation-content]')) root = root.parentElement
        if (!leading || !root || attached === root) return
        button?.remove(); body?.remove()
        attached = root
        button = document.createElement('span'); button.style.display = 'inline-flex'
        leading.prepend(button)
        body = document.createElement('div'); body.className = css.chat ?? ''
        body.dataset.chatToolsMount = ''
        const content = root.querySelector('[data-conversation-content]')
        if (content) root.insertBefore(body, content); else root.append(body)
        setMounts({ button, body })
      }
      attach()
      const observer = new MutationObserver(attach)
      observer.observe(document.body, { childList: true, subtree: true })
      return () => { observer.disconnect(); button?.remove(); body?.remove() }
    }, [])
    // 会话接线：首次见到会话时按内容相位定默认标签（hero=新会话→工作区文件；
    // active=旧会话→会话标签），并侦测发送（聊天流新增用户消息→切到会话标签）。
    useEffect(() => {
      if (!id || !mounts) return
      const root = mounts.body.parentElement
      if (!root) return
      let observer: MutationObserver | undefined
      let fallback: ReturnType<typeof setTimeout> | undefined
      const teardown = (): void => {
        observer?.disconnect(); observer = undefined
        if (fallback !== undefined) { clearTimeout(fallback); fallback = undefined }
      }
      const decide = (): void => {
        const content = root.querySelector('[data-conversation-content]')
        const decision = hasHistoryForPhase(content?.getAttribute('data-content-phase'))
        if (decision !== undefined) { toolsState.seed(id, decision); teardown(); return }
        if (observer === undefined && content !== null) {
          observer = new MutationObserver(decide)
          observer.observe(content, { attributes: true, attributeFilter: ['data-content-phase'] })
        }
      }
      // 兜底：相位迟迟不定（宿主变化）就按聊天流里已有的用户消息判定。
      fallback = setTimeout(() => {
        toolsState.seed(id, root.querySelectorAll(USER_NODE_SELECTOR).length > 0)
        teardown()
      }, 5000)
      decide()
      const stopWatch = startSendWatch({
        root: () => root.querySelector('[data-conversation-scroll]'),
        isUserTurn: node => node.matches?.(USER_NODE_SELECTOR) === true || node.querySelector?.(USER_NODE_SELECTOR) !== null,
        onSend: () => { toolsState.activateChat(id); checkedFiles.clear(id) },
      })
      return () => { teardown(); stopWatch() }
    }, [id, mounts])
    // 布局切换：工具标签激活时收起聊天消息（composer 留在下方），工具条带撑满；
    // 会话标签激活时恢复宿主布局，条带缩回工具行 + 标签行的高度。
    useLayoutEffect(() => {
      if (!mounts) return
      const body = mounts.body
      body.hidden = !id
      const root = body.parentElement
      const content = root?.querySelector<HTMLElement>('[data-conversation-content]') ?? null
      const scroll = content?.querySelector<HTMLElement>('[data-conversation-scroll]') ?? null
      const isMessage = (node: Element): boolean => node.getAttribute('data-composer-seat') === null
      const hide = (node: HTMLElement): void => { node.style.display = 'none' }
      const messages = scroll === null ? [] : [...scroll.children].filter((node): node is HTMLElement =>
        node instanceof HTMLElement && isMessage(node))
      const previous = messages.map(node => [node, node.style.display] as const)
      const previousFlex = content === null ? null : content.style.flex
      let guard: MutationObserver | undefined
      if (toolActive && id) {
        for (const node of messages) hide(node)
        if (content !== null) content.style.flex = '0 0 auto'
        body.dataset.chatStripLive = ''
        // 兜底：工具标签激活期间宿主补渲染的新消息节点也要收起。
        if (scroll !== null && typeof MutationObserver !== 'undefined') {
          guard = new MutationObserver(records => {
            for (const record of records) {
              for (const node of record.addedNodes) {
                if (node instanceof HTMLElement && isMessage(node)) hide(node)
              }
            }
          })
          guard.observe(scroll, { childList: true })
        }
      } else {
        delete body.dataset.chatStripLive
      }
      return () => {
        guard?.disconnect()
        for (const [node, display] of previous) node.style.display = display
        if (content !== null) {
          if (previousFlex === '') content.style.removeProperty('flex')
          else if (previousFlex !== null) content.style.flex = previousFlex
        }
      }
    }, [mounts, toolActive, id])
    if (!mounts) return null
    return <>
      {createPortal(<Toggle />, mounts.button)}
      {reference && reference.id === id && createPortal(
        <props.SessionProvider session={reference.ref}>{props.renderSlot(ROOT, {})}</props.SessionProvider>, mounts.body)}
    </>
  }
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'chat-area-tools-portal',
    children: { [ROOT]: { kind: 'single', scope: 'session' } },
  }, PortalRoot))
  ctx.slots.inject(ROOT, () => ctx.slots.register({ name: ROOT, children: {
    [BODY]: { kind: 'keyed', scope: 'session', inject: { hooks: { tabInfo: (_: any, hook: any) => hook } } },
    [toolSlot('sidebar.right.pane.tab.title')]: { kind: 'keyed', scope: 'session', inject: { hooks: { tabInfo: (_: any, hook: any) => hook } } },
    [toolSlot('sidebar.right.tab.guide.entry')]: { kind: 'keyed', scope: 'session' },
  } }, ToolArea))
  function DocumentActions({ sessionId, absolutePath }: { sessionId: string; absolutePath: string }) {
    const [status, setStatus] = useState('')
    const [busy, setBusy] = useState(false)
    const lifetime = useRef<AbortController>()
    useEffect(() => { const c = new AbortController(); lifetime.current = c; return () => c.abort() }, [])
    const run = async (edit: boolean) => {
      if (busy || !lifetime.current) return
      const signal = lifetime.current.signal
      setBusy(true); setStatus('')
      try {
        const text = await readEntireWorkspaceText(sessionId, absolutePath,
          offset => readers.readPage(sessionId, absolutePath, offset, signal), signal)
        if (edit) {
          const name = absolutePath.split('/').at(-1) ?? absolutePath
          const tab = toolsState.open(sessionId, 'local', name, `edit://${absolutePath}`)
          docs.set(tab.id, { name, text, seq: Date.now() }); toolsState.select(sessionId, tab.id)
        } else { await navigator.clipboard.writeText(text); setStatus('已复制全文') }
      } catch (error) { if (!signal.aborted) setStatus(`操作失败：${String(error)}`) }
      finally { if (!signal.aborted) setBusy(false) }
    }
    return <><button disabled={busy} onClick={() => void run(false)}>复制全文</button><button disabled={busy} onClick={() => void run(true)}>编辑并发送</button><span role="status">{status}</span></>
  }
  ctx.slots.inject(toolSlot('sidebar.right.tab.document.actions'), () => ctx.slots.register({
    name: toolSlot('sidebar.right.tab.document.actions'), id: 'chat-area-document-actions',
  }, DocumentActions))
  adapter.install()
  // 文件树行控件：在私有座位上重注册 FilesBody，补挂多选框与悬浮编辑按钮。
  ctx.effect(() => attachFilesTreeAugment(ctx.slots, augmentHandlers), 'chat-area: files tree augment')
  // One policy for ordinary HTTP links across the application. Explicit modifiers
  // retain browser conventions. Native browser's external button remains explicit.
  ctx.effect(() => {
    const click = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, location.href)
      if (!['https:', 'http:'].includes(url.protocol) || url.origin === location.origin) return
      const id = currentId(); if (!id) return
      event.preventDefault(); event.stopImmediatePropagation()
      if (readDefaultLinkOpenMode() === 'browser') openInBrowser(url.href)
      else adapter.open(id, 'browser', { params: { url: url.href }, revealIfOpened: false })
    }
    document.addEventListener('click', click, true)
    return () => document.removeEventListener('click', click, true)
  })
}
