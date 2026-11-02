/**
 * 会话区通用 UI 的文案（中英）。
 *
 * 从 `@goodjin2/dsh-acp-agent` 的浏览器半边随功能一起迁来。这里只放与会话区
 * 通用功能相关的 key——mermaid 图渲染、答案卡片、会话尾部文件卡片——与具体 agent
 * 无关。装进 host 的 locale 注册中心（见 index.ts），运行时找不到 key 就退回
 * `fallbackT`（中文），再退到 key 原文。
 */

export type Params = Record<string, string | number>

/** 翻译函数形状：key + 可选插值参数。 */
export type RuntimeT = (key: string, params?: Params) => string

export const NAMESPACE = 'threadharborChatArea'

export type ChatAreaLocaleKey =
  | 'mermaid.label' | 'mermaid.diagram' | 'mermaid.source' | 'mermaid.toggleNamed'

export const zh: Record<ChatAreaLocaleKey, string> = {
  'mermaid.label': 'Mermaid',
  'mermaid.diagram': '图表',
  'mermaid.source': '源码',
  'mermaid.toggleNamed': '切换 Mermaid 图与源码',
}

const en: Record<ChatAreaLocaleKey, string> = {
  'mermaid.label': 'Mermaid',
  'mermaid.diagram': 'Diagram',
  'mermaid.source': 'Source',
  'mermaid.toggleNamed': 'Switch between the Mermaid diagram and its source',
}

/** `{name}` 形式的参数插值；模板里没有对应参数时原样保留占位符。 */
function interpolate(template: string, params?: Params): string {
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`))
}

/** 缺 key 时退回中文，再退回 key 原文——绝不抛错。 */
export const fallbackT: RuntimeT = (key, params) => {
  const k = key as ChatAreaLocaleKey
  return interpolate(zh[k] ?? key, params)
}

/** 运行时 locale 感知的翻译；拿不到注册表时退回 {@link fallbackT}。 */
export function makeT(dict: Record<string, string>): RuntimeT {
  return (key, params) => {
    const k = key as ChatAreaLocaleKey
    return interpolate(dict[k] ?? zh[k] ?? key, params)
  }
}
