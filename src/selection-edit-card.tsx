/**
 * 选区编辑卡：弹条「编辑」/ 多选浮动「编辑」钮打开的编辑框。
 *
 * 展示形态（2026-11-05 用户要求）：**占满整个会话区域**——卡片用 fixed
 * 定位覆盖 `[data-conversation-scroll]` 的客户区（含 16px 内边距），不随
 * 消息滚动移动；窗口尺寸变化时重新对位。高度天然远超 10 行的下限。
 *
 * 文本来自 selection-actions.ts 的编辑卡 store：
 * - 单选编辑：初始为选中的文字，关闭/发送不影响多选收藏；
 * - 多选编辑：初始为收藏按原顺序、项间空行拼接的全文，关闭/发送后
 *   连同收藏与高亮一起清掉。
 *
 * 动作行与编辑卡一致——描边「新建会话」（新会话继承当前会话的工作目录）
 * + 圆形发送钮；头部右侧关闭钮退出编辑。
 */
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { IconCloseOutlineRegular, IconNewChatOutlineRegular, IconSendOutlineRegular, IconWarningOutlineRegular, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import { closeSelectionEdit, currentSessionIdFromDom, getSelectionEdit, subscribeSelectionEdit } from './selection-actions.ts'
import type { SelectionEditState } from './selection-actions.ts'
import type { MarkdownTurnReaders } from './markdown-turn-sources.ts'
import type { RuntimeT } from './locales.ts'
import { NAMESPACE } from './locales.ts'
import css from './markdown-turn.module.css'

export const SELECTION_EDIT_ID = 'chat-area-selection-edit'

/** 编辑卡覆盖会话区域时的内边距。 */
const COVER_PADDING = 16

function SelectionEditCard(props: {
  readonly state: SelectionEditState
  readonly readers: MarkdownTurnReaders
  readonly t: RuntimeT
}): ReactNode {
  const [toast, setToast] = useState<{ seq: number; text: string } | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const coverRef = useRef<HTMLDivElement>(null)
  const t = props.t

  // 覆盖层对位：跟随会话滚动容器的客户区；窗口尺寸变化时重算。
  useLayoutEffect(() => {
    const align = (): void => {
      const cover = coverRef.current
      if (cover === null) return
      const scroller = document.querySelector('[data-conversation-scroll]')
      if (scroller === null) return
      const rect = scroller.getBoundingClientRect()
      cover.style.left = `${rect.left + COVER_PADDING}px`
      cover.style.top = `${rect.top + COVER_PADDING}px`
      cover.style.width = `${rect.width - COVER_PADDING * 2}px`
      cover.style.height = `${rect.height - COVER_PADDING * 2}px`
    }
    align()
    window.addEventListener('resize', align)
    return () => { window.removeEventListener('resize', align) }
  }, [])

  const send = (toNew: boolean): void => {
    const body = inputRef.current?.value ?? ''
    if (body.trim() === '') return
    const sessionId = currentSessionIdFromDom()
    if (sessionId === undefined) {
      setToast({ seq: (toast?.seq ?? 0) + 1, text: t('markdownTurn.sendFailed') })
      return
    }
    let sending: Promise<void>
    if (toNew) {
      // 新会话继承当前会话的工作目录（与本机文件卡的发送一致）。
      sending = props.readers.createSession({ inheritCwdFrom: sessionId })
        .then(newId => props.readers.sendToSession(newId, body))
    } else {
      sending = props.readers.sendToSession(sessionId, body)
    }
    void sending.then(() => {
      closeSelectionEdit()
    }, () => {
      setToast({ seq: (toast?.seq ?? 0) + 1, text: t(toNew ? 'markdownTurn.newSessionFailed' : 'markdownTurn.sendFailed') })
    })
  }

  const title = t(props.state.multi ? 'selection.multiEditTitle' : 'selection.editTitle')

  return (
    <>
      {toast !== null && <Toast
        key={toast.seq}
        text={toast.text}
        icon={<IconWarningOutlineRegular />}
        onDone={() => { setToast(null) }}
      />}
      {/* fixed 覆盖会话区域：占满整个聊天视口，不随消息滚动移动。 */}
      <div
        ref={coverRef}
        className={css.editCard}
        data-selection-edit-cover=""
        style={{ position: 'fixed', zIndex: 40 }}
      >
        <div className={css.localHead}>
          <span className={css.localName}>{title}</span>
          <button
            type="button"
            className={css.iconButton}
            data-selection-edit-close=""
            aria-label={t('markdownTurn.cancel')}
            title={t('markdownTurn.cancel')}
            onClick={() => { closeSelectionEdit() }}
          >
            <IconCloseOutlineRegular size={15} />
          </button>
        </div>
        <textarea
          ref={inputRef}
          className={css.editInput}
          data-selection-edit-text=""
          defaultValue={props.state.text}
          autoFocus
          aria-label={t('selection.edit')}
          style={{ flex: 1, minHeight: '224px' }}
        />
        <div className={css.editActions}>
          <button
            type="button"
            className={css.editNewSession}
            data-selection-new-session=""
            aria-label={t('markdownTurn.newSession')}
            title={t('markdownTurn.newSession')}
            onClick={() => { send(true) }}
          >
            <IconNewChatOutlineRegular size={15} /> {t('markdownTurn.newSession')}
          </button>
          <button
            type="button"
            className={css.editSend}
            data-selection-send=""
            aria-label={t('markdownTurn.send')}
            title={t('markdownTurn.send')}
            onClick={() => { send(false) }}
          >
            <IconSendOutlineRegular size={16} />
          </button>
        </div>
      </div>
    </>
  )
}

/** overlay 座位宿主的最小结构类型。 */
interface OverlaySlotHost {
  inject(key: string, callback: () => unknown): unknown
  register(options: {
    name: string
    id?: string
    order?: number
    locale?: string
  }, component: unknown): () => void
}

/**
 * 把选区编辑卡注册进 overlay 座位（order 22，排本机文件卡之后）。
 * @param slots - 座位宿主（`ctx.slots`）。
 * @param readers - 发送 / 新建会话的口子。
 * @param t - 绑定本包词典的翻译函数。
 * @returns 注册的清理函数。
 */
export function registerSelectionEditComposer(
  slots: OverlaySlotHost,
  readers: MarkdownTurnReaders,
  t: RuntimeT,
): () => void {
  return slots.inject('conversation.input.overlay', () => slots.register(
    {
      name: 'conversation.input.overlay',
      id: SELECTION_EDIT_ID,
      order: 22,
      locale: NAMESPACE,
    },
    () => {
      const state = useSyncExternalStore(subscribeSelectionEdit, getSelectionEdit, getSelectionEdit)
      if (state === null) return null
      // 以 seq 为 key：每次打开都重挂载，textarea 回到初始文本与焦点。
      return <SelectionEditCard key={state.seq} state={state} readers={readers} t={t} />
    },
  )) as () => void
}
