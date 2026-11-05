# Chat-Power 会话区 UI 统一改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 chat-power 的会话区功能统一成一套视觉、交互、发送与失败反馈机制，并保留现有功能边界。

**Architecture:** 新增共享 UI 主题、发送链路与编辑器组件；让工作台、文件树、文件卡片、选区、答案和 Mermaid 复用它们。纯 DOM 功能只替换样式入口和状态呈现，不改宿主右侧栏、ACP 分工与既有座位契约。

**Tech Stack:** TypeScript、React 18、CSS Modules、宿主 primitives、Vitest、tsdown。

**Spec:** docs/superpowers/specs/2026-11-06-chat-power-ui-unification-design.md

## Global Constraints

- 工作目录：`.worktrees/ui-unification`；提交粒度按任务。
- 保持现有功能：标签工作台、文件树引用、本机文件、答案复制/编辑、尾部文件、选区四动作、多签收集、段落批注、Mermaid、内置浏览器、终端、链接偏好、短会话 ID、宽表格。
- 所有颜色使用宿主语义 token；不得新增全局白/黑/独立蓝硬编码。局部深色媒体查询只能用于宿主没有 token 的兼容回退。
- 数值基线：间距 4/8/12/16/24px；正文 14px、辅助信息 12px；控件 6px、面板 10–12px；图标 16px、桌面点击区 32px；发送按钮保留圆形宿主特例。
- 发送：空白禁用；pending 防重复；成功后再收起/退出并清理；失败保留内容；取消/失败不销毁草稿。新建会话明确为“新建会话并发送”，不叫分支会话。
- 链接：集中偏好；浏览器地址栏外部打开只作用于本次；普通外链不关闭全部已有浏览器标签。
- 测试门禁：`npm test`、`npm run typecheck`、`npm run build`；不得破坏 117 项既有测试或座位契约。
- 不改宿主右侧栏、不引入账号/分屏/拖窗/扩展文件类型，不改变 ACP 座位优先级。

## Review Focus

1. 多个编辑器同时打开时，发送/取消必须只操作对应卡片，不得用全局 DOM 查询串值。
2. 发送失败、复制失败、Mermaid 加载/渲染失败、文件读取失败都必须可感知并可恢复；不能只写 console。
3. 窄窗口与多标签下工作台不能换行、遮正文，关闭含草稿的标签不能静默丢草稿。
4. 文件树 checkbox 与 composer chip 必须双向同步；写入/取消失败必须保留原状态并提示。
5. 浏览器/终端正文仍由宿主工厂渲染；聊天区改动不得把卡片样式错误覆盖到终端画布或网页正文。

---

### Task 1: 共享主题、发送与编辑器基础

**Files:**
- Create: `src/ui-theme.ts`, `src/send-actions.ts`, `src/compose-card.tsx`
- Modify: `src/index.ts`, `src/locales.ts`
- Test: `tests/ui-unification.spec.ts`

**Interfaces:**
- Produces: `uiButtonClass`, `panelClass`, `statusNoticeClass`, `createSendController`, `ComposeCard`.
- Consumes: `RuntimeT`, `MarkdownTurnReaders`.

- [ ] **Step 1: Write failing tests**

Create `tests/ui-unification.spec.ts` asserting: theme exports a complete CSS class string containing semantic token fallbacks and the exact base spacing; send controller rejects blank text, prevents duplicate pending submissions, preserves content on failure, and clears only after a successful send.

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/ui-unification.spec.ts`
Expected: FAIL because the three modules do not exist.

- [ ] **Step 3: Implement shared modules**

Implement CSS token helpers, a framework-agnostic async send controller with pending/failure/success callbacks, and a React `ComposeCard` with title, subtitle, body, cancel, new-session, and current-session actions. Reuse existing primitives and locale dictionaries.

- [ ] **Step 4: Run targeted tests**

Run: `npm test -- tests/ui-unification.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui-theme.ts src/send-actions.ts src/compose-card.tsx src/index.ts src/locales.ts tests/ui-unification.spec.ts
git commit -m "feat: add shared chat power UI primitives"
```

---

### Task 2: 统一答案、本机文件、选区和工作区文件编辑器

**Files:**
- Modify: `src/answer-card.tsx`, `src/local-file.tsx`, `src/selection-edit-card.tsx`, `src/conversation-tools.tsx`
- Modify: `src/answer-card.module.css`, `src/markdown-turn.module.css`, `src/conversation-tools.module.css`
- Test: `tests/ui-unification.spec.ts`

**Interfaces:**
- Consumes: `ComposeCard`, `createSendController`, theme classes.
- Produces: local refs for edit inputs; pending/disabled state; source labels.

- [ ] **Step 1: Add tests**

Extend the same spec to cover: answer edit reads a card-local textarea rather than a global selector; every editor disables send while pending and remains editable after a failed send; answer and file editors expose the same new-session/current-session action labels.

- [ ] **Step 2: Run targeted tests**

Run: `npm test -- tests/ui-unification.spec.ts`
Expected: FAIL before refactor and PASS after implementation.

- [ ] **Step 3: Refactor the four editor surfaces**

Replace inline action bars with `ComposeCard`; use local refs; add pending state and failure notices; clarify that edited content is a sending copy. Preserve existing tabs and overlay placement and the answer card's 50vh maximum-height cap.

- [ ] **Step 4: Run targeted tests and typecheck**

Run: `npm test -- tests/ui-unification.spec.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/answer-card.tsx src/local-file.tsx src/selection-edit-card.tsx src/conversation-tools.tsx src/answer-card.module.css src/markdown-turn.module.css src/conversation-tools.module.css tests/ui-unification.spec.ts
git commit -m "feat: unify conversation edit cards"
```

---

### Task 3: 工作台标签、链接偏好与文件树控件

**Files:**
- Modify: `src/conversation-tools.tsx`, `src/conversation-tools.module.css`
- Modify: `src/file-tree-augment.tsx`, `src/file-tree-augment.module.css`
- Modify: `src/link-open.ts`, `src/locales.ts`
- Test: `tests/tools-state.spec.ts`, `tests/file-tree-augment.spec.ts`

**Interfaces:**
- Consumes: existing `toolsState`, `createToolsAdapter`, `readDefaultLinkOpenMode`.
- Produces: two-level toolbar; centralized link menu action; checkbox state rollback and notice.

- [ ] **Step 1: Add tests**

Add state tests for preserving a draft flag when a tool tab closes and restoring/confirming when a draft tab is active; extend the tree test with a 32px hit-area assertion and existing checked-state rollback callback.

- [ ] **Step 2: Run targeted tests**

Run: `npm test -- tests/tools-state.spec.ts tests/file-tree-augment.spec.ts`
Expected: FAIL until state and UI hooks are added.

- [ ] **Step 3: Implement UI and behavior changes**

Split the toolbar into a fixed view row and single-line tab row, move link preference into a `更多` menu, and keep the native open-file button. Move link preference out of the file open split menu and reuse the browser tab instead of closing all browser tabs. Replace the text edit button with an icon button, add focus-within/touch visibility, and make checkbox failures visible while retaining the checked state.

- [ ] **Step 4: Run targeted tests**

Run: `npm test -- tests/tools-state.spec.ts tests/file-tree-augment.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/conversation-tools.tsx src/conversation-tools.module.css src/file-tree-augment.tsx src/file-tree-augment.module.css src/link-open.ts src/locales.ts tests/tools-state.spec.ts tests/file-tree-augment.spec.ts
git commit -m "feat: unify conversation workspace controls"
```

---

### Task 4: 文件卡片、批注、选区弹条与收集面板

**Files:**
- Modify: `src/markdown-turn.tsx`, `src/markdown-turn.module.css`, `src/selection-actions.ts`
- Modify: `src/locales.ts`
- Test: `tests/selection-actions.spec.ts`, `tests/ui-unification.spec.ts`

**Interfaces:**
- Consumes: shared send controller/theme.
- Produces: stable pending send state, anchored comments, summary count, unified selection toolbar classes.

- [ ] **Step 1: Add tests**

Pin: summary send is not cleared before the request succeeds; comment anchors stay attached after document changes; selection panel has a 24px minimum remove target and a capped internal-scroll height.

- [ ] **Step 2: Run targeted tests**

Run: `npm test -- tests/selection-actions.spec.ts tests/ui-unification.spec.ts`
Expected: FAIL before implementation and PASS after implementation.

- [ ] **Step 3: Implement unified surfaces**

Convert the file card header and actions to the shared panel, show `本轮文件 · n`, replace hard-coded dark colors with semantic tokens, anchor comments near their passages, show a pending summary action, and migrate the DOM selection styles to the shared theme while keeping current behavior and keyboard support.

- [ ] **Step 4: Run targeted tests**

Run: `npm test -- tests/selection-actions.spec.ts tests/ui-unification.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/markdown-turn.tsx src/markdown-turn.module.css src/selection-actions.ts src/locales.ts tests/selection-actions.spec.ts tests/ui-unification.spec.ts
git commit -m "feat: unify document and selection surfaces"
```

---

### Task 5: Mermaid、短 ID、宽表与浏览器/终端状态

**Files:**
- Modify: `src/mermaid.ts`, `src/session-id-bar/index.ts`, `src/session-id-bar/session-id-bar.module.css`, `src/table-pad.ts`
- Modify: `src/conversation-tools.tsx`, `src/locales.ts`
- Test: `tests/mermaid-route.spec.ts`, `tests/session-id-bar.spec.ts`, `tests/ui-unification.spec.ts`

**Interfaces:**
- Consumes: shared theme and status strings.
- Produces: Mermaid loading/retry/error UI, 32px session ID control, and a wide-table overflow affordance.

- [ ] **Step 1: Add tests**

Add assertions for Mermaid state classes containing retry and loading states; session ID copy reset behavior on session change; table pad selector retaining the existing `md-table-wide` rule.

- [ ] **Step 2: Run targeted tests**

Run: `npm test -- tests/mermaid-route.spec.ts tests/session-id-bar.spec.ts tests/ui-unification.spec.ts`
Expected: FAIL before implementation and PASS after implementation.

- [ ] **Step 3: Implement the remaining visual states**

Unify Mermaid preview toolbar and add loading/retry/error feedback without altering source copying or stream behavior. Use the shared session ID control and remove the whole-bar opacity. Add a wide-table edge affordance without hiding the scrollbar. Keep terminal/browser content untouched and use shared shell styling for labels/state only where chat-power owns it.

- [ ] **Step 4: Run full gates**

Run: `npm test && npm run typecheck && npm run build`
Expected: all existing 117 tests plus new tests pass; typecheck and build succeed.

- [ ] **Step 5: Commit**

```bash
git add src/mermaid.ts src/session-id-bar/index.ts src/session-id-bar/session-id-bar.module.css src/table-pad.ts src/conversation-tools.tsx src/locales.ts tests/mermaid-route.spec.ts tests/session-id-bar.spec.ts tests/ui-unification.spec.ts
git commit -m "feat: unify remaining conversation surfaces"
```
