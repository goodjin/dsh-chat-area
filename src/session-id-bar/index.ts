/**
 * 「会话 ID 条」模块的对外出口。
 *
 * 真正的实现在 register.ts；浏览器入口（src/index.ts）直接用它。这个文件保留
 * 是为了 package.json 里的 `./session-id-bar` 子路径依旧可用（别人按子路径引用
 * 时拿到的是同一份实现，而不是另一套占位）。
 */

export {
  PANEL_ID,
  PANEL_ORDER,
  SLOT,
  SessionIdBar,
  registerSessionIdBar,
  sessionBarView,
  shortSessionId,
} from './register.js'
export type { HeaderSlots, SessionBarViewInput, SessionIdBarProps } from './register.js'
