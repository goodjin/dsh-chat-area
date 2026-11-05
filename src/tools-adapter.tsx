/** Instantiate host feature factories against private services and private seats.
 * The host sidebar's registrations, stores, navigation and layout are untouched.
 */
import { createElement } from 'react'
import * as files from '@deepseek-ai/dsh-client-ui-sidebar-files'
import * as browser from '@deepseek-ai/dsh-client-ui-sidebar-browser'
import * as terminal from '@deepseek-ai/dsh-client-ui-sidebar-terminal'
import * as documentPreview from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview'
import { readDefaultLinkOpenMode, openInBrowser } from './link-open.ts'
import { toolsState, type ToolTab } from './tools-state.ts'
export const toolSlot = (name: string) => name.startsWith('sidebar.right.') ? `chat-area.tools.${name.slice('sidebar.right.'.length)}` : name
export const features = [files, browser, terminal, documentPreview]

export function createToolsAdapter(ctx: any) {
  const definitions = new Map<string, any>()
  const closeHandlers = new Map<string, any>()
  const privateServices = new Map<string, any>()
  const handles = new WeakMap<object, any>()
  const facadeCache = new WeakMap<object, any>()
  const hostSidebar = ctx.get('sidebarRight')
  const inventory = { subscribe: toolsState.subscribe, getSnapshot: () => toolsState.inventory() }
  const open = (sessionId: string, kind: string, options?: any) => {
    const definition = definitions.get(kind)
    if (!definition) throw new Error(`会话工具未加载：${kind}`)
    return toolsState.open(sessionId, kind, definition.title(`sidebar://${kind}`), `sidebar://${kind}`, options?.params,
      definition.multiple === true || options?.revealIfOpened === false)
  }
  const close = (sessionId: string, id: string) => {
    const tab = toolsState.get(sessionId).tabs.find(t => t.id === id)
    if (!tab) return
    closeHandlers.get(tab.kind)?.(sessionId, tab)
    toolsState.close(sessionId, id)
  }
  const openResource = (sessionId: string, address: string, options?: any) => {
    if (!address.startsWith('dsh-resource://file/')) throw new Error('此资源暂不支持在会话工具中打开')
    const tab = toolsState.open(sessionId, 'text', decodeURIComponent(address.split('/').at(-1) ?? '文件'), address, options?.params)
    ctx.get('resources').pin(address, tab.controller.signal)
    return tab
  }
  const actionsFor = (sessionId: string, tab: ToolTab) => ({
    bindCommands(commands: any) { tab.commands = commands; return () => { if (tab.commands === commands) tab.commands = {} } },
    openTab: (kind: string, options?: any) => {
      if (kind === 'browser' && options?.params?.url && readDefaultLinkOpenMode() === 'browser') {
        openInBrowser(options.params.url); return
      }
      open(sessionId, kind, options)
    },
    openResource: (address: string, options?: any) => openResource(sessionId, address, options),
    close: () => close(sessionId, tab.id),
  })
  const occurrences = new Map<string, any>()
  const occurrence = (sessionId: string, { id }: { id: string }) => {
    const tab = toolsState.get(sessionId).tabs.find(t => t.id === id)
    if (!tab) throw new Error(`会话工具标签已关闭：${id}`)
    if (!occurrences.has(id)) {
      const navigation = { address: tab.contentId, params: tab.params, revision: 0 }
      occurrences.set(id, { id, sessionId, tabId: id, signal: tab.controller.signal,
        navigation: { subscribe: () => () => {}, getSnapshot: () => navigation }, tabActions: actionsFor(sessionId, tab) })
      tab.controller.signal.addEventListener('abort', () => occurrences.delete(id), { once: true })
    }
    return occurrences.get(id)
  }
  privateServices.set('sidebarRight', {
    openTabs: inventory, tabDomain: { occurrence },
    openTabIn: open, openResourceIn: openResource, closeIn: close,
    registerCloseHandler(kind: string, fn: any) { closeHandlers.set(kind, fn); return () => closeHandlers.delete(kind) },
  })
  privateServices.set('sidebarRightTabs', {
    register(definition: any) { definitions.set(definition.kind, definition); return () => definitions.delete(definition.kind) },
  })
  const mappedStore = (handle: any) => {
    if (!handle) return undefined
    if (!handles.has(handle)) handles.set(handle, { ...handle, create: (key?: string) => handle.create(`chat-area.tools.${key ?? 'root'}`) })
    return handles.get(handle)
  }
  function facade(scope: any): any {
    if (facadeCache.has(scope)) return facadeCache.get(scope)
    const slots = new Proxy(scope.slots, { get(target, key) {
      if (key === 'register') return (options: any, Component: any) => {
        const children = options.children && Object.fromEntries(Object.entries(options.children).map(([name, spec]) => [toolSlot(name), spec]))
        return target.register({ ...options, name: toolSlot(options.name), children, store: mappedStore(options.store) }, (props: any) => {
          const shares = { ...props }
          for (const method of ['renderSlot', 'renderSlotChain', 'renderFactorySlot']) {
            if (props[method]) shares[method] = (name: string, ...args: any[]) => props[method](toolSlot(name), ...args)
          }
          return createElement(Component, shares)
        })
      }
      if (['inject', 'entries', 'entriesOfSlot', 'subscribe', 'specDynamic'].includes(String(key))) return (name: string, ...args: any[]) => target[key](toolSlot(name), ...args)
      const value = target[key]; return typeof value === 'function' ? value.bind(target) : value
    } })
    const proxy = new Proxy(scope, { get(target, key) {
      if (privateServices.has(String(key))) return privateServices.get(String(key))
      if (key === 'slots') return slots
      if (key === 'get') return (name: string) => privateServices.get(name) ?? target.get(name)
      if (key === 'reflect') return { provide(name: string, value: any) { privateServices.set(name, value); return () => privateServices.delete(name) } }
      if (key === 'locale') return new Proxy(target.locale, { get(locale, prop) { return prop === 'register' ? () => () => {} : typeof locale[prop] === 'function' ? locale[prop].bind(locale) : locale[prop] } })
      if (key === 'shortcuts') return new Proxy(target.shortcuts, { get(shortcuts, prop) { return prop === 'register' ? () => () => {} : shortcuts[prop] } })
      if (key === 'webTerminals') return new Proxy(target.webTerminals, { get(terminals, prop) {
        if (prop === 'retainTabs') return (tabs: any[]) => terminals.retainTabs([...(hostSidebar?.openTabs?.getSnapshot?.() ?? []).filter((t: any) => t.kind === 'terminal'), ...tabs])
        const value = terminals[prop]; return typeof value === 'function' ? value.bind(terminals) : value
      } })
      if (key === 'inject') return (names: string[], callback: any) => target.inject(names.filter(name => !privateServices.has(name)), (child: any) => callback(facade(child)))
      const value = target[key]; return typeof value === 'function' ? value.bind(target) : value
    } })
    facadeCache.set(scope, proxy)
    return proxy
  }
  const install = () => {
    const privateCtx = facade(ctx)
    for (const feature of features) privateCtx.inject(feature.inject, (scope: any) => feature.apply(scope))
    ctx.effect(() => {
      // sidebarRight 已经写进 inject，正常路径下一定在；这里仍判空，是因为工具区
      // 不该因为宿主少一个服务就整块起不来（失败了就只是不接管终端标签）。
      const openTabs = hostSidebar?.openTabs
      if (openTabs === undefined || typeof openTabs.subscribe !== 'function') return
      const sync = () => ctx.get('webTerminals')?.retainTabs([...openTabs.getSnapshot().filter((t: any) => t.kind === 'terminal'), ...toolsState.inventory().filter(t => t.kind === 'terminal')])
      const off = openTabs.subscribe(sync)
      return () => { off(); toolsState.dispose(); sync() }
    }, 'chat-area: independent tools lifetime')
  }
  return { install, definitions, open, close, openResource, occurrence,
    tabInfo(sessionId: string, tab: ToolTab, visible: boolean) {
      const held = occurrence(sessionId, tab)
      return { sidebar: { expanded: true, fullscreen: false }, panel: { id: 'chat-area-tools' },
        tab: { ...tab, visible, navigation: held.navigation.getSnapshot(), signal: held.signal, actions: held.tabActions } }
    },
  }
}
