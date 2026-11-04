/**
 * 本机文件卡：顶栏「打开本机文件」→ 系统文件选择框 → 读入文本 → 在输入框
 * （composer）上方的 `conversation.input.overlay` 座位里展开成编辑卡片。
 *
 * 入口（会话头部）和卡片（composer）分属两个座位，靠本模块的**会话级共享
 * store** 连接：头部写入，卡片订阅。seq 每次写入自增，卡片组件以 seq 为 key
 * 重挂载——新选一个文件总是直接进入编辑态，不受上一次收起状态影响。
 *
 * 选 composer 的 overlay 座位放卡片的原因：它是会话作用域的 **list** 槽位、每会话
 * 必渲染（轮次尾的文件区在没有文件时整块不渲染，接不住「无文件会话里开本机文件」），
 * 且锚点就在输入框正上方——本机文件内容本来就是喂给会话的，放在那里语义顺。
 * 不能用 `conversation.input.attachments`：那是宿主附件区的 **single** 槽位，宿主
 * 附件区已占 priority 0，同优先级重复注册直接抛错——一抛就把同一函数里排在后面的
 * 答案卡片 wrap 一起带走（2026-11-04 现场：答案卡片没有框、没有编辑按钮）。
 */
import { useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { FileTypeIcon, IconChevronDownOutlineRegular, IconChevronUpOutlineRegular, IconCloseOutlineRegular, IconNewChatOutlineRegular, IconSendOutlineRegular, IconWarningOutlineRegular, Toast, classifyFileType } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MarkdownTurnReaders } from './markdown-turn-sources.ts'
import type { RuntimeT } from './locales.ts'
import { NAMESPACE } from './locales.ts'
import css from './markdown-turn.module.css'

/** 本机文件选择框可挑的类型：text/* 之外再加常用的代码 / 配置 / 文档后缀。 */
export const LOCAL_FILE_ACCEPT = [
  'text/*',
  '.md', '.markdown', '.txt', '.log', '.csv', '.tsv',
  '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.env',
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
  '.c', '.h', '.cpp', '.hpp', '.cs', '.php',
  '.sh', '.bash', '.zsh', '.sql',
  '.html', '.htm', '.css', '.scss', '.less', '.xml', '.svg',
].join(',')

/** 超过这个大小的本机文件不读入（几 MB 起编辑框就明显卡顿）。 */
export const LOCAL_FILE_MAX_BYTES = 5 * 1024 * 1024

/** 一份已读入的本机文件。seq 在每次写入时自增，用作卡片重挂载的 key。 */
export interface LocalFileDoc {
  readonly name: string
  readonly text: string
  readonly seq: number
}

let currentDoc: LocalFileDoc | null = null
let docSeq = 0
const docListeners = new Set<() => void>()

/** 订阅本机文件卡；退订函数照 useSyncExternalStore 的约定返回。 */
export function subscribeLocalFileDoc(listener: () => void): () => void {
  docListeners.add(listener)
  return () => { docListeners.delete(listener) }
}

/** 当前本机文件；没有为 null。返回引用稳定，可作 getSnapshot。 */
export function getLocalFileDoc(): LocalFileDoc | null {
  return currentDoc
}

/** 写入 / 清除本机文件；null 为关闭。写入即自增 seq，卡片会以编辑态重挂载。 */
export function setLocalFileDoc(doc: { readonly name: string; readonly text: string } | null): void {
  docSeq += 1
  currentDoc = doc === null ? null : { name: doc.name, text: doc.text, seq: docSeq }
  for (const listener of docListeners) listener()
}

/** 当前会话编号。composer 的座位 props 不带 sessionId，从会话根节点读。 */
function currentSessionIdFromDom(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const node = document.querySelector('[data-conversation-session]')
  const value = node?.getAttribute('data-conversation-session')
  return value === null || value === '' ? undefined : value
}

/**
 * composer 座位里的本机文件卡。doc 为 null 时不占位；编辑态是一张 composer
 * 风格的编辑卡（聚焦描边变色、动作行分隔线、圆发送钮），收起后是一条标题。
 */
export function LocalFileComposerCard(props: {
  readonly sessionId?: string
  readonly onClose?: () => void
  readonly onDraftChange?: (text: string) => void
  readonly onSent?: () => void
  readonly doc: LocalFileDoc
  readonly readers: MarkdownTurnReaders
  readonly t: RuntimeT
  /** overlay = 输入框上方的卡（默认，带收起/取消）；tab = 工具标签里的纯编辑卡。 */
  readonly variant?: 'overlay' | 'tab'
}): ReactNode {
  const variant = props.variant ?? 'overlay'
  const tabMode = variant === 'tab'
  const [editing, setEditing] = useState(true)
  const [toast, setToast] = useState<{ seq: number; text: string } | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState(props.doc.text)
  const t = props.t

  const send = (toNew: boolean): void => {
    const body = draft
    if (body.trim() === '') return
    const sessionId = props.sessionId ?? currentSessionIdFromDom()
    if (sessionId === undefined) return
    const header = t('markdownTurn.localFileHeader', { name: props.doc.name })
    const payload = `${header}\n\n${body}`
    let sending: Promise<void>
    if (toNew) {
      sending = props.readers.createSession()
        .then(newId => props.readers.sendToSession(newId, payload))
    } else {
      sending = props.readers.sendToSession(sessionId, payload)
    }
    void sending.then(() => { props.onSent?.() }).catch(() => {
      setToast({ seq: (toast?.seq ?? 0) + 1, text: t(toNew ? 'markdownTurn.newSessionFailed' : 'markdownTurn.sendFailed') })
    })
    if (!tabMode) setEditing(false)
  }

  return <>
    {editing
      ? <div className={css.editCard} data-local-doc="">
          <div className={css.localHead}>
            <span className={css.icon} data-file-icon={classifyFileType(props.doc.name)}>
              <FileTypeIcon path={props.doc.name} size={14} />
            </span>
            <span className={css.localName} title={props.doc.name}>{props.doc.name}</span>
            {!tabMode && <button
              type="button"
              className={css.iconButton}
              data-local-collapse=""
              aria-label={t('markdownTurn.collapse')}
              title={t('markdownTurn.collapse')}
              onClick={() => setEditing(false)}
            >
              <IconChevronUpOutlineRegular size={15} />
            </button>}
            {!tabMode && <button
              type="button"
              className={css.iconButton}
              data-local-close=""
              aria-label={t('markdownTurn.cancel')}
              title={t('markdownTurn.cancel')}
              onClick={() => props.onClose ? props.onClose() : setLocalFileDoc(null)}
            >
              <IconCloseOutlineRegular size={15} />
            </button>}
          </div>
          <textarea
            ref={inputRef}
            className={css.editInput}
            data-local-file-text=""
            value={draft}
            onChange={e => { setDraft(e.target.value); props.onDraftChange?.(e.target.value) }}
            autoFocus
            aria-label={t('markdownTurn.edit')}
            style={{ minHeight: '28dvh' }}
          />
          <div className={css.editActions}>
            {tabMode
              ? <>
                  <button type="button" className={css.tabSend} data-local-send="" onClick={() => send(false)}>发送到会话</button>
                  <button type="button" className={css.tabNewSession} data-local-new-session="" onClick={() => send(true)}>{t('markdownTurn.newSession')}</button>
                </>
              : <>
                  <button type="button" className={css.iconButton} aria-label="复制全文" onClick={() => {
                    void navigator.clipboard.writeText(draft).then(() => setToast({ seq: Date.now(), text: '已复制' }), () => setToast({ seq: Date.now(), text: '复制失败' }))
                  }}>复制全文</button>
                  <button
                    type="button"
                    className={css.editNewSession}
                    data-local-new-session=""
                    aria-label={t('markdownTurn.newSession')}
                    title={t('markdownTurn.newSession')}
                    onClick={() => send(true)}
                  >
                    <IconNewChatOutlineRegular size={15} /> {t('markdownTurn.newSession')}
                  </button>
                  <button
                    type="button"
                    className={css.editSend}
                    data-local-send=""
                    aria-label={t('markdownTurn.send')}
                    title={t('markdownTurn.send')}
                    onClick={() => send(false)}
                  >
                    <IconSendOutlineRegular size={16} />
                  </button>
                </>}
          </div>
        </div>
      : <div className={css.bar} data-local-doc="" data-collapsed="">
          <span className={css.icon} data-file-icon={classifyFileType(props.doc.name)}>
            <FileTypeIcon path={props.doc.name} size={16} />
          </span>
          <span className={css.name} title={props.doc.name}>{props.doc.name}</span>
          <button
            type="button"
            className={css.iconButton}
            data-local-expand=""
            aria-label={t('markdownTurn.expand')}
            title={t('markdownTurn.expand')}
            onClick={() => setEditing(true)}
          >
            <IconChevronDownOutlineRegular size={15} />
          </button>
          <button
            type="button"
            className={css.iconButton}
            data-local-close=""
            aria-label={t('markdownTurn.cancel')}
            title={t('markdownTurn.cancel')}
            onClick={() => props.onClose ? props.onClose() : setLocalFileDoc(null)}
          >
            <IconCloseOutlineRegular size={15} />
          </button>
        </div>}
    {toast !== null && <Toast
      key={toast.seq}
      text={toast.text}
      icon={<IconWarningOutlineRegular />}
      onDone={() => { setToast(null) }}
    />}
  </>
}

/** composer 座位条目宿主的最小结构类型。 */
interface ComposerSlotHost {
  inject(key: string, callback: () => unknown): unknown
  register(options: {
    name: string
    id?: string
    order?: number
    locale?: string
  }, component: unknown): () => void
}

/** composer attachments 座位里本条目的 id。 */
export const LOCAL_FILE_ID = 'chat-area-local-file'

/**
 * 把本机文件卡注册进 composer 的附件座位（会话作用域 list）。order 20 排在
 * 官方附件 chip（默认 0）之后、编辑框之上，看起来就是「待发送的一份内容」。
 * @param slots - 座位宿主（`ctx.slots`）。
 * @param readers - 发送 / 新建会话的口子。
 * @param t - 绑定本包词典的翻译函数。
 * @returns 注册的清理函数。
 */
export function registerLocalFileComposer(
  slots: ComposerSlotHost,
  readers: MarkdownTurnReaders,
  t: RuntimeT,
): () => void {
  return slots.inject('conversation.input.overlay', () => slots.register(
    {
      name: 'conversation.input.overlay',
      id: LOCAL_FILE_ID,
      order: 20,
      locale: NAMESPACE,
    },
    // 座位包装层订阅 store：选文件 / 关闭时这里先重渲染，卡片以 seq 为 key
    // 重挂载——新选一个文件总是直接回到编辑态。
    () => {
      const doc = useSyncExternalStore(subscribeLocalFileDoc, getLocalFileDoc, getLocalFileDoc)
      if (doc === null) return null
      return <LocalFileComposerCard key={doc.seq} doc={doc} readers={readers} t={t} />
    },
  )) as () => void
}
