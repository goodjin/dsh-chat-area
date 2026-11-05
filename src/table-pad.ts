/**
 * 宽表格末列的右边距。
 *
 * 官方 markdown 表格样式（`MarkdownText.module.css` 的 `.tableScroll`）把
 * 末列的右内边距清零——那是给「占满列宽、与正文右缘对齐」的窄表格设计的。
 * 但宽表格（渲染器打 `md-table-wide` 标记、横向滚动的那些）滚到最右时，
 * 末格文字紧贴滚动容器右缘，看起来像被裁掉。
 *
 * 这里注入一条全局覆盖：只对「会横向滚动的宽表」（tableScroll 与
 * md-table-wide 同元素）的末格补回与其它单元格一致的 16px 右边距；
 * 窄表格（tableFill）不受影响，贴边对齐保持原样。
 *
 * 选择器用 `[class*="tableScroll"]` 而不是编译后的哈希类名——CSS module
 * 的哈希随构建变化，子串匹配对哈希稳定；`md-table-wide` 是渲染器写在
 * 同一元素上的原样类，直接可用。
 */
const TABLE_PAD_CSS = '[class*="tableScroll"].md-table-wide td:last-child{padding-right:16px}'

/** 本条注入在 head 里的标记，重复注入与诊断都靠它。 */
export const TABLE_PAD_TAG = 'dsh-chat-power/table-pad'

/** 往页面 head 注入覆盖样式；已注入过则跳过，非浏览器环境安静返回。 */
export function injectTablePadCss(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css="${TABLE_PAD_TAG}"]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-chat-power'
  tag.dataset.pluginCss = TABLE_PAD_TAG
  tag.textContent = TABLE_PAD_CSS
  document.head.appendChild(tag)
}
