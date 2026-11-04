import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { IconFolderOpenOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { toolsState } from './tools-state.ts'
import { createToolsAdapter, toolSlot } from './tools-adapter.tsx'
import { LOCAL_FILE_ACCEPT, LOCAL_FILE_MAX_BYTES, LocalFileComposerCard } from './local-file.tsx'
import { createMarkdownTurnReaders, readMarkdownText } from './markdown-turn-sources.ts'
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
  function Toggle() {
    const id = useSyncExternalStore(ctx.get('uiSession').adapter.current.subscribe, currentId, currentId)
    const s = useSyncExternalStore(toolsState.subscribe, () => toolsState.get(id ?? ''), () => toolsState.get(id ?? ''))
    return <button type="button" className={css.toggle} disabled={!id} aria-label="打开文件与会话工具" title="打开文件与会话工具"
      aria-expanded={s.expanded} data-chat-tools-toggle="" onClick={() => { if (id) toolsState.toggle(id) }}><IconFolderOpenOutlineRegular size={16} /></button>
  }
  function ToolArea(props: any) {
    const id = props.sessionId as string
    const s = useSyncExternalStore(toolsState.subscribe, () => toolsState.get(id), () => toolsState.get(id))
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
      {error && <p role="alert">{error}</p>}
      <div className={css.tabs} role="tablist" aria-label="工具标签">
        {s.tabs.map(tab => <div className={css.tab} key={tab.id}>
          <button role="tab" aria-selected={s.active === tab.id} onClick={() => toolsState.select(id, tab.id)}>{tab.title}</button>
          <button aria-label={`关闭 ${tab.title}`} onClick={() => { adapter.close(id, tab.id); docs.delete(tab.id) }}>×</button>
        </div>)}
      </div>
      <div className={css.content}>
        <button className={css.collapse} aria-label="收起工具，返回会话" title="收起工具，返回会话" onClick={() => toolsState.collapse(id)}>→</button>
        {s.tabs.length === 0 && <div className={css.guide}>选择打开文件、浏览器或终端，直接在会话区域使用。</div>}
        {s.tabs.map(tab => {
          const visible = s.expanded && tab.id === s.active
          const definition = adapter.definitions.get(tab.kind)
          const info = adapter.tabInfo(id, tab, visible)
          return <div key={tab.id} hidden={!visible} className={css.body}>
            {tab.kind === 'local' && docs.has(tab.id)
              ? <LocalFileComposerCard doc={docs.get(tab.id)!} readers={readers} t={fallbackT} sessionId={id}
                  onDraftChange={text => { const doc = docs.get(tab.id); if (doc) docs.set(tab.id, { ...doc, text }) }}
                  onSent={() => toolsState.collapse(id)} onClose={() => { adapter.close(id, tab.id); docs.delete(tab.id) }} />
              : definition && props.renderSlot(BODY, {}, { entryKey: definition.id, hookContext: () => info })}
          </div>
        })}
      </div>
    </section>
  }
  // A portal places an independently owned session view in normal conversation
  // flow. We never reparent host React nodes or borrow their slot authorization.
  function PortalRoot(props: any) {
    const id = useSyncExternalStore(ctx.get('uiSession').adapter.current.subscribe, currentId, currentId)
    const s = useSyncExternalStore(toolsState.subscribe, () => toolsState.get(id ?? ''), () => toolsState.get(id ?? ''))
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
        body = document.createElement('div'); body.className = css.chat ?? ''; body.hidden = true
        body.dataset.chatToolsMount = ''
        root.append(body)
        setMounts({ button, body })
      }
      attach()
      const observer = new MutationObserver(attach)
      observer.observe(document.body, { childList: true, subtree: true })
      return () => { observer.disconnect(); button?.remove(); body?.remove() }
    }, [])
    useLayoutEffect(() => {
      if (!mounts) return
      const body = mounts.body
      body.hidden = !s.expanded || !id
      const siblings = [...(body.parentElement?.children ?? [])].filter((node): node is HTMLElement => node instanceof HTMLElement && node !== body && !node.querySelector('[data-conversation-header-leading]') && node.tagName !== 'HEADER')
      const previous = siblings.map(node => [node, node.style.display] as const)
      if (s.expanded && id) for (const node of siblings) node.style.display = 'none'
      return () => { for (const [node, display] of previous) node.style.display = display }
    }, [mounts, s.expanded, id])
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
        let size = 0
        const result = await readMarkdownText(async offset => {
          const page = await readers.readPage(sessionId, absolutePath, offset, signal)
          size += new TextEncoder().encode(page.text).length
          if (size > LOCAL_FILE_MAX_BYTES) throw new Error('文件超过 5 MB')
          return page
        }, 20000)
        if (signal.aborted) return
        if (result.truncated) throw new Error('文件超过 20000 行，无法完整复制或编辑')
        if (edit) {
          const name = absolutePath.split('/').at(-1) ?? absolutePath
          const tab = toolsState.open(sessionId, 'local', name, `edit://${absolutePath}`)
          docs.set(tab.id, { name, text: result.text, seq: Date.now() }); toolsState.select(sessionId, tab.id)
        } else { await navigator.clipboard.writeText(result.text); setStatus('已复制全文') }
      } catch (error) { if (!signal.aborted) setStatus(`操作失败：${String(error)}`) }
      finally { if (!signal.aborted) setBusy(false) }
    }
    return <><button disabled={busy} onClick={() => void run(false)}>复制全文</button><button disabled={busy} onClick={() => void run(true)}>编辑并发送</button><span role="status">{status}</span></>
  }
  ctx.slots.inject(toolSlot('sidebar.right.tab.document.actions'), () => ctx.slots.register({
    name: toolSlot('sidebar.right.tab.document.actions'), id: 'chat-area-document-actions',
  }, DocumentActions))
  adapter.install()
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
