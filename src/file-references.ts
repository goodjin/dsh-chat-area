/**
 * 文件勾选 → 输入框文件引用的纯逻辑。
 *
 * 宿主输入框把 `@路径`（含空格时 `@"路径"`）识别成文件引用卡片；这里的快照
 * 形状对齐 conversation 的 DraftSnapshot 契约：references 有序、不重叠，区间
 * 文本等于 clipboardText，且都排在领先命令 token 之后。勾选即追加引用，
 * 取消勾选即按 ref 找回这条引用并移除（连带它后面的分隔空格；末尾没有空格
 * 就吃掉前面的一个），后面的引用/引文区间整体前移。
 */

/** 宿主草稿引用区间里 chat-power 依赖的字段。 */
export interface FileRefSpan {
  source: string
  ref: string
  offset: number
  length: number
  label: string
  appearance?: 'session' | 'file' | 'folder'
  clipboardText: string
}

/** 宿主草稿快照里 chat-power 读写的字段子集（结构对齐 DraftSnapshot）。 */
export interface FileRefSnapshot {
  text: string
  references: readonly FileRefSpan[]
  command?: { token: string }
  quotes?: readonly { offset: number; length: number; text: string }[]
}

/** 文件路径的 @提及拼写：含空白才加引号，与宿主 file-reference 语法一致。 */
export function fileMention(path: string): string {
  if (/[\u0000-\u001f\u007f-\u009f"]/u.test(path)) return `@"${path}"`
  return /\s/u.test(path) ? `@"${path}"` : `@${path}`
}

/** 追加一条文件引用：非空白结尾先补一个空格，引用后留一个空格。 */
export function fileReferenceInsert(snapshot: FileRefSnapshot, path: string): FileRefSnapshot {
  const mention = fileMention(path)
  const name = path.split('/').at(-1) ?? path
  const needsSeparator = snapshot.text !== '' && !/\s$/u.test(snapshot.text)
  const insertAt = snapshot.text.length + (needsSeparator ? 1 : 0)
  return {
    ...snapshot,
    text: `${snapshot.text}${needsSeparator ? ' ' : ''}${mention} `,
    references: [...snapshot.references, {
      source: 'reference', ref: mention, offset: insertAt, length: mention.length,
      label: name, appearance: 'file', clipboardText: mention,
    }],
  }
}

/** 移除 ref 匹配的那条文件引用；引用不存在时草稿原样返回。 */
export function fileReferenceRemove(snapshot: FileRefSnapshot, path: string): FileRefSnapshot {
  const mention = fileMention(path)
  const index = snapshot.references.findIndex(reference => reference.ref === mention)
  const removed = index < 0 ? undefined : snapshot.references[index]
  if (index < 0 || removed === undefined) return snapshot
  const spanStart = removed.offset
  const spanEnd = spanStart + removed.length
  // 优先吃掉引用后面的分隔空格；末尾没有就吃掉前面的一个。
  let removeStart = spanStart
  let removeEnd = spanEnd
  if (snapshot.text[removeEnd] === ' ') removeEnd += 1
  else if (removeStart > 0 && snapshot.text[removeStart - 1] === ' ') removeStart -= 1
  const delta = removeEnd - removeStart
  const shifted = (offset: number): number => offset >= spanEnd ? offset - delta : offset
  const next: FileRefSnapshot = {
    ...snapshot,
    text: snapshot.text.slice(0, removeStart) + snapshot.text.slice(removeEnd),
    references: [
      ...snapshot.references.slice(0, index),
      ...snapshot.references.slice(index + 1).map(reference => ({ ...reference, offset: shifted(reference.offset) })),
    ],
  }
  if (snapshot.quotes !== undefined) {
    next.quotes = snapshot.quotes.map(quote => ({ ...quote, offset: shifted(quote.offset) }))
  }
  return next
}
