# 把 mermaid 渲染从 dsh-acp-agent 迁到 dsh-chat-area 实施方案

> **给执行者：** 必用子技能：subagent-driven-development（推荐）或 executing-plans 逐任务实现。
> 步骤用 `- [ ]` 复选框跟踪。本方案跨两个仓库：`dsh-chat-area`（搬入方）与 `dsh-acp-agent`（搬出方），
> 动手前先按 using-git-worktrees 各建独立工作区。

**Goal:** 把「会话区 Mermaid 图渲染」这个功能从 `@goodjin2/dsh-acp-agent` 整体迁到 `@goodjin2/dsh-chat-area`，让 chat-area 成为通用会话区功能的唯一归属，同时保持桌面版 / web 版安装后图形照常渲染。

**Architecture:** mermaid 由两半组成，都自包含、与 ACP 渲染引擎零耦合：
- **浏览器半边** `mermaid.ts`：入口 `startMermaidDiagrams(deps)` 只吃 `{ document, window, t, log }`，扫 DOM 里的 mermaid 代码块渲染成 SVG，带「图表 / 源码」切换。不需要 cordis ctx、不碰 markdown 插槽。
- **宿主半边** `mermaid-asset.ts`：注册 exact 路由 `/threadharbor/mermaid.js`，从本包 `mermaid` 依赖读 `dist/mermaid.min.js`（懒解析、字节 + ETag 缓存、`no-cache` 走 304），经 `connection.admit` 做同一登录准入。

两半各走各的装载行：浏览器半边经 chat-area 现有的裸包名客户端行；宿主半边新增一条 `@goodjin2/dsh-chat-area/mermaid-asset` 宿主行（照抄 acp-agent 现在的做法）。

**Tech Stack:** TypeScript（ESM）、DSH cordis 插件装载（`cordis.patch.yml` + `exports` 子路径）、vitest、node 内置（`crypto`/`fs`/`http`/`module`）。mermaid 运行时依赖 `mermaid` ^11.16。

**Spec:** 本方案无独立 spec；依据是两处源码现状与用户决定（chat-area 是通用会话区功能的归属）。核对时间 2026-11-02。

## 全局约束

- **跨插件改动。** 本任务同时改 `dsh-chat-area` 与 `dsh-acp-agent` 两个独立仓库。容器规范（dsh-plugins/AGENTS.md）要求子仓间不互跨改代码；本任务是用户明确要求的例外，两处改动须在同一批提交里保持可发布、可从 GitHub 正常安装（包名、版本、`main` 可发布状态、远程指向都要对）。
- **路由路径不变。** `/threadharbor/mermaid.js` 这个 exact 路径必须原样保留——浏览器半边和宿主半边都靠它对齐，改动会断链。
- **行名规则。** DSH 只把 `name` 恰好等于**裸包名**的行认成客户端行；宿主半边走独立子路径行。chat-area 现有的裸包名客户端行（`chat-area-client`）不能动，否则会重演「整块浏览器界面安静消失」的装载坑。
- **桌面版即改即生效，web 版走 GitHub 安装。** 桌面版 link 本地仓即时生效；web 版要验证必须先把改动提交并 push 到对应仓库远程，再走正常安装流程。
- **提交纪律。** 两处各自的门禁（typecheck / test / build）全绿再提交；每仓保持 `main` 可部署。

## 范围与分步顺序（先看这段）

用户要迁的三样，耦合程度差别很大，因此拆成两期：

- **第一期（本方案主体，可执行）：只搬 mermaid。** 自包含、低风险、可整体拎走。
- **第二期（需独立立项，本方案只给方向，不进可执行步骤）：答案卡片 + 会话尾部文件卡片。** 这两者不是独立功能，而是长在 `dsh-acp-agent/src/client/markdown-turn.tsx`（33KB）这个 ACP 整轮渲染引擎里，与 `acp-process-surface.tsx`、`markdown-turn-sources.ts` 绑死，在 `acp-process-surface.tsx:219` 被内联渲染。把它们归到 chat-area 等于把通用渲染件从 ACP 引擎里解耦——是一次重构，有把 ACP 渲染搞坏的真实风险，须先 brainstorm 出 spec 再写计划。**本方案不包含第二期的可执行步骤。**

执行顺序：先做第一期（mermaid）。第二期待用户对方案表态后另起计划。

---

## 文件结构

**dsh-chat-area（搬入方）新增 / 修改：**
- 新增 `src/mermaid.ts` —— 从 acp-agent 原样迁入的浏览器半边（含 `MERMAID_ROUTE_PATH`、`startMermaidDiagrams`、`resolveMermaidAssetUrl`）。
- 新增 `src/mermaid.ts` 配套的 i18n：迁入 4 个 `mermaid.*` key（见 Task 3）。
- 新增 `src/mermaid-asset.ts` —— 从 acp-agent 原样迁入的宿主半边（只依赖 node 内置，可原样搬）。
- 修改 `src/index.ts` —— 在 `apply` 里注册 mermaid 浏览器半边。
- 修改 `src/entry.ts` —— 保持空壳（裸包名客户端行仍靠它），不动。
- 修改 `package.json` —— 加 `mermaid` 依赖、加 `./mermaid-asset` 子路径 export。
- 修改 `cordis.patch.yml` —— 加一条 `@goodjin2/dsh-chat-area/mermaid-asset` 宿主行。
- 新增测试：`tests/mermaid.spec.ts`、`tests/mermaid-asset.spec.ts`、`tests/mermaid-route.spec.ts`。

**dsh-acp-agent（搬出方）删除 / 修改：**
- 删除 `src/client/mermaid.ts`、`src/mermaid-asset.ts`。
- 修改 `src/client/index.ts` —— 移除 mermaid 的 import 与注册块。
- 修改 `src/client/locales.ts` —— 移除 4 个 `mermaid.*` key（中英各 4）。
- 修改 `package.json` —— 若 mermaid 不再被别处用，移除 `mermaid` 依赖与 `./mermaid-asset` 子路径。
- 修改 `cordis.patch.yml` —— 移除 `threadharbor-mermaid-asset` 行。
- 删除/迁移测试：`tests/mermaid-asset.spec.ts`、`tests/mermaid-route.spec.ts`。

---

## 第一期：搬 mermaid

### Task 1: 宿主半边路由迁入 chat-area

**Files:**
- Create: `dsh-chat-area/src/mermaid-asset.ts`（从 `dsh-acp-agent/src/mermaid-asset.ts` 原样迁入）
- Modify: `dsh-chat-area/package.json`（加依赖 + 子路径 export）
- Modify: `dsh-chat-area/cordis.patch.yml`（加宿主行）
- Test: `dsh-chat-area/tests/mermaid-asset.spec.ts`（从 acp-agent 迁入，改 import 路径）

**Interfaces:**
- Consumes: 无（模块只依赖 node 内置 `crypto`/`fs`/`http`/`module`）。
- Produces:
  - `export const name = 'threadharbor-mermaid-asset'`
  - `export const MERMAID_ROUTE_PATH = '/threadharbor/mermaid.js'`
  - `export function apply(ctx: MermaidAssetContext): void`
  - `export function registerMermaidAssetRoute(ctx, deps?): void`
  - `export interface MermaidAssetContext`、`MermaidAssetRouteDeps`

- [ ] **Step 1: 把 acp-agent 的 `mermaid-asset.spec.ts` 复制为 chat-area 的 `tests/mermaid-asset.spec.ts`**，把被测 import 从 `'../src/mermaid-asset.ts'`（相对不变）保留，其余断言原样保留（它已覆盖：注册 exact 路由、`connection.admit` 拒绝分支原样状态码、非 GET 405、读资产成功路径、缺资产时 warn + 500 `mermaid asset unavailable`、`dist/mermaid.min.js` >1MB 解析）。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd dsh-chat-area && npx vitest run tests/mermaid-asset.spec.ts`
Expected: FAIL（`Cannot find module '../src/mermaid-asset.ts'`）

- [ ] **Step 3: 创建 `src/mermaid-asset.ts`**，把 acp-agent 的 `src/mermaid-asset.ts` 全文粘入（模块自包含，无需改动，`name`/常量/`apply`/两个函数/两个 interface 原样）。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd dsh-chat-area && npx vitest run tests/mermaid-asset.spec.ts`
Expected: PASS

- [ ] **Step 5: 在 `package.json` 加依赖与子路径**

在 `dependencies` 加 `"mermaid": "^11.16.0"`（chat-area 当前无 dependencies 段则新建）。在 `exports` 加：
```json
"./mermaid-asset": {
  "types": "./src/mermaid-asset.ts",
  "default": "./src/mermaid-asset.ts"
}
```

- [ ] **Step 6: 在 `cordis.patch.yml` 加宿主行**（照 acp-agent 现写法）：
```yaml
- insert:
    - id: threadharbor-mermaid-asset
      name: '@goodjin2/dsh-chat-area/mermaid-asset'
```
保留文件里原有的裸包名客户端行（`chat-area-client`）不动。

- [ ] **Step 7: 安装并确认 mermaid 能解析**

Run: `cd dsh-chat-area && pnpm install`
Expected: 成功，`node_modules/mermaid/package.json` 存在。

- [ ] **Step 8: 提交**

```bash
git -C dsh-chat-area add src/mermaid-asset.ts tests/mermaid-asset.spec.ts package.json cordis.patch.yml pnpm-lock.yaml
git -C dsh-chat-area commit -m "feat(chat-area): 迁入 mermaid 宿主资源路由 /threadharbor/mermaid.js"
```

### Task 2: 浏览器半边渲染迁入 chat-area

**Files:**
- Create: `dsh-chat-area/src/mermaid.ts`（从 acp-agent 原样迁入）
- Modify: `dsh-chat-area/src/index.ts`（注册）
- Test: `dsh-chat-area/tests/mermaid.spec.ts`（从 acp-agent 迁入或新建）

**Interfaces:**
- Consumes: Task 3 的 i18n（`t`）；Task 1 的 `MERMAID_ROUTE_PATH`（同文件内）。
- Produces:
  - `export const MERMAID_ROUTE_PATH = '/threadharbor/mermaid.js'`
  - `export function startMermaidDiagrams(deps?: MermaidDiagramsDeps): MermaidDiagrams`
  - `export function resolveMermaidAssetUrl(document, window): string`
  - `MermaidDiagramsDeps`（含 `document`/`window`/`t`/`log`/`loadApi`/`scanDelayMs`/`settleMs` 等可选字段）

- [ ] **Step 1: 写失败测试** `tests/mermaid.spec.ts`，至少钉住：`resolveMermaidAssetUrl` 在无 `<base href>` 时返回 `http://<origin>/threadharbor/mermaid.js`；有 `<base href="/threadharbor/gateway/<id>/">` 时返回网关子路径下的 `mermaid.js`。用 `happy-dom` 或 jsdom 造 `document`/`window`（chat-area 现有测试若无 DOM 环境，按 acp-agent 的做法起 vitest 环境）。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd dsh-chat-area && npx vitest run tests/mermaid.spec.ts`
Expected: FAIL（`Cannot find module '../src/mermaid.ts'`）

- [ ] **Step 3: 创建 `src/mermaid.ts`**，把 acp-agent 的 `src/client/mermaid.ts` 全文粘入（它只 import `./locales.ts` 的 `fallbackT`/`RuntimeT`——Task 3 会在 chat-area 补上这两个导出；若不想引 locales，可把 `fallbackT` 换成本地最小实现，见 Task 3 说明）。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd dsh-chat-area && npx vitest run tests/mermaid.spec.ts`
Expected: PASS

- [ ] **Step 5: 在 `src/index.ts` 注册**

在 `apply(ctx)` 里、`registerSessionIdBar(ctx.slots)` 之后，加一段独立注册（mermaid 不需要 `ctx.slots`，只要 `window`/`document`）：
```ts
import { startMermaidDiagrams } from './mermaid.ts'
// ...apply 内：
try {
  startMermaidDiagrams({ window, document: window.document, t, log })
  log.info('mermaid: registered')
} catch (error) {
  log.warn(`mermaid: registration failed — ${error instanceof Error ? error.message : String(error)}`)
}
```
其中 `t` 取自 Task 3 的 i18n；chat-area 的 `PluginContext` 目前只有 `slots`，需要给 `apply` 的 ctx 类型补 `window`/`document`/`t`/`log` 的取法（参考 acp-agent 客户端 ctx 的构造，或直接在浏览器半边用全局 `window`/`document`，mermaid.ts 内部已有 `typeof document === 'undefined'` 兜底）。

- [ ] **Step 6: 提交**

```bash
git -C dsh-chat-area add src/mermaid.ts src/index.ts tests/mermaid.spec.ts
git -C dsh-chat-area commit -m "feat(chat-area): 迁入 mermaid 浏览器渲染（扫 DOM + 图表/源码切换）"
```

### Task 3: mermaid 文案迁入 chat-area

**Files:**
- Modify: `dsh-chat-area/src/locales.ts`（新建，迁入 `mermaid.*` + 最小 `fallbackT`）
- Modify: `dsh-chat-area/src/index.ts`（把 `t`/`fallbackT` 传给 mermaid）

**Interfaces:**
- Produces: `fallbackT(key: string): string`；含 4 个 key 的对象；`zh`/`en` 两套。

- [ ] **Step 1: 写失败测试** `tests/mermaid.spec.ts` 追加：`fallbackT('mermaid.diagram')` 在中文环境返回「图表」、英文环境返回「Diagram」。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd dsh-chat-area && npx vitest run tests/mermaid.spec.ts`
Expected: FAIL

- [ ] **Step 3: 新建 `src/locales.ts`**，从 acp-agent `src/client/locales.ts` 摘出 4 个 `mermaid.*` key（中英各 4：label=Mermaid、diagram=图表/Diagram、source=源码/Source、toggleNamed=切换 Mermaid 图与源码/Switch between the Mermaid diagram and its source）与最小 `fallbackT`（找不到 key 时原样返回 key）。

- [ ] **Step 4: 在 `src/index.ts` 接上 `t`/`fallbackT`** 传给 Task 2 Step 5 的注册调用。

- [ ] **Step 5: 跑测试确认通过**

Run: `cd dsh-chat-area && npx vitest run tests/mermaid.spec.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git -C dsh-chat-area add src/locales.ts src/index.ts tests/mermaid.spec.ts
git -C dsh-chat-area commit -m "feat(chat-area): 迁入 mermaid 文案（中英）"
```

### Task 4: 从 acp-agent 移除 mermaid

**Files:**
- Delete: `dsh-acp-agent/src/client/mermaid.ts`、`dsh-acp-agent/src/mermaid-asset.ts`
- Modify: `dsh-acp-agent/src/client/index.ts`、`src/client/locales.ts`、`package.json`、`cordis.patch.yml`
- Delete: `dsh-acp-agent/tests/mermaid-asset.spec.ts`、`tests/mermaid-route.spec.ts`

- [ ] **Step 1: 从 `src/client/index.ts` 移除** `import { startMermaidDiagrams } from './mermaid.ts'`（第 39 行）与 `// Mermaid diagrams` 注册块（约 124–127 行）。

- [ ] **Step 2: 从 `src/client/locales.ts` 移除** 4 个 `mermaid.*` key（类型联合第 41 行 + zh 第 130–133 行 + en 第 236–239 行）。

- [ ] **Step 3: 从 `cordis.patch.yml` 移除** `threadharbor-mermaid-asset` 行（约 55–56 行）。

- [ ] **Step 4: 在 `package.json` 移除 `./mermaid-asset` 子路径 export（57–59 行）；确认 `mermaid` 依赖是否还被别处用**——若仅 mermaid-asset 用，则一并从 `dependencies` 删除。

- [ ] **Step 5: 删除 `src/client/mermaid.ts`、`src/mermaid-asset.ts` 及两个 mermaid 测试文件**（测试已迁到 chat-area）。若 `tests/mermaid-route.spec.ts` 断言的是「两边 ROUTE 常量相等」，迁到 chat-area 后该断言改指在 chat-area 内部（`src/mermaid.ts` 与 `src/mermaid-asset.ts` 同仓，断言仍成立）。

- [ ] **Step 6: 跑全量门禁**

Run: `cd dsh-acp-agent && pnpm typecheck && pnpm test`
Expected: 全绿（无残留对 mermaid 的 import；`mermaid-route.spec.ts` 若保留则指向 chat-area 路径或直接删除）。

- [ ] **Step 7: 提交**

```bash
git -C dsh-acp-agent add -A
git -C dsh-acp-agent commit -m "refactor(acp-agent): 移除已迁往 chat-area 的 mermaid 渲染"
```

### Task 5: 端到端验证（桌面版即改即生效）

**Files:** 无（验证任务）

- [ ] **Step 1: 重建 chat-area 客户端产物**

Run: `cd dsh-chat-area && npm run build`
Expected: `tsc` + `tsdown` 无错，`lib/client.js` 更新。

- [ ] **Step 2: 确认路由可达。** 在装了两仓 link 的桌面 profile 下，浏览器直接请求 `/threadharbor/mermaid.js`（带登录 cookie），应 200 且返回 mermaid 运行时；带 `If-None-match` 再请求应 304。

- [ ] **Step 3: 确认渲染。** 会话区贴一段 ```mermaid 代码块，第一次出现时应见它懒加载运行时并画成 SVG，预览头可切「图表 / 源码」。

- [ ] **Step 4: 确认 acp-agent 侧无回归。** 确认 acp-agent 其余功能（quota 胶囊、roster-filter、ACP 进程表面、handover 等）照常。

---

## Review Focus

（这几处最容易在评审时被当成「没问题」却真的会咬人，各配了 owning task 的测试去钉）

- **装载坑（最可能咬人）：** chat-area 的裸包名客户端行 `chat-area-client` 若被误改或漏掉，整块浏览器界面会安静消失且无报错。Task 1 Step 6 明确保留该行；建议 Task 5 加一条装配审计测试（参考 acp-agent `tests/bundle.spec.ts`：把 `lib/client.js` 按页面方式执行一遍），确认 mermaid 注册也进产物。
- **路由路径漂移：** `/threadharbor/mermaid.js` 一旦在某一侧被改动，两半断链、图形永远加载失败。Task 1 与 Task 2 都产出同名常量；建议保留一条「两侧 ROUTE 常量相等」的断言（迁到 chat-area 后内部自洽）。
- **mermaid 依赖解析：** `installedMermaidAssetPath` 依赖 `mermaid/package.json` 与 `dist/mermaid.min.js` 真实存在（>1MB）。chat-area 若没装 mermaid 或子路径导出不同，运行时 500、图形降级成代码块。Task 1 Step 7 的 `pnpm install` + acp-agent 原有那条「>1MB 解析」测试已覆盖。
- **i18n key 缺失：** mermaid 的 `fallbackT` 找不到 key 会原样显示 `mermaid.diagram` 这种字符串。Task 3 的中英各 4 key 测试钉住。
- **web 版安装回归：** 改动必须保持两仓可从 GitHub 正常安装（包名/版本/`main` 可发布/远程指向）。Task 4 后若要验证 web 版，须先 push 再走安装流程，不能只靠桌面版 link。

---

## 第二期方向（答案卡片 + 会话尾部文件卡片）——需独立立项，不进本计划可执行步骤

用户已明确希望这两项也归 chat-area。但它们当前是 `dsh-acp-agent/src/client/markdown-turn.tsx`（33KB，ACP 整轮渲染引擎）的一部分，通过 `acp-process-surface.tsx:219` 内联渲染 `AnswerCard`，并依赖 `markdown-turn-sources.ts` 的 readers 状态、`link-open.ts`、`markdown-turn.module.css` 等。要迁出必须先 brainstorm 出解耦 spec，回答：

1. **通用件与 ACP 件的边界在哪？** `markdown-turn.tsx` 里哪些是「会话区通用渲染」（文件卡片、答案卡片），哪些是「ACP 进程表面专属」（可见性过滤、handover、lost-input）？前者要拆出来，后者留 acp-agent。
2. **readers 状态怎么分家？** `markdown-turn-sources.ts` 的 `MarkdownTurnReaders` 目前同时服务 ACP 表面与文件卡片；拆件时要决定它随哪边走、还是共享。
3. **宿主半边要不要长进 chat-area？** 文件卡片的「展开/编辑/打开方式」若也涉及宿主路由，chat-area 已在本方案长出 host 半边（mermaid-asset），可复用同一模式。
4. **去重与回归。** 拆完后 acp-agent 的 ACP 表面会少一块渲染，须保证 ACP agent 的输出卡片照常；chat-area 侧须有装配测试防「功能消失」。

待用户对第一期方案表态后，另起一份 brainstorm→plan。
