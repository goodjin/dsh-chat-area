# dsh-chat-area

DSH 会话区增强插件：与跑哪种 agent 无关的会话区功能都归这里。

## 装上会发生什么

- **会话工具区**：顶部文件夹按钮移到左侧下拉入口左边。点击后在会话内容区
  展示本机文件、工作区文件、浏览器和终端；再点一次或点击左边缘中间的 → 返回聊天。
  工具区使用正常布局，不覆盖会话，不展开、搬动或修改宿主右侧栏。
- **文件编辑与发送**：本机文本文件打开后直接进入编辑卡片，支持复制全文、发送到当前
  会话、新建会话发送。工作区文件保留宿主预览能力，文本预览头部增加「复制全文」和
  「编辑并发送」。编辑的是待发送副本，不会覆盖磁盘文件。收起工具区保留标签和草稿。
  本机文件限制 5 MB；工作区复制/编辑限制 5 MB / 20000 行，超过限制明确报错，不复制残缺正文。
- **链接偏好**：工具栏选择内置 / 外部浏览器，普通 HTTP(S) 超链接统一遵循此设置；
  修饰键点击、下载链接、应用自身导航保持标准行为。浏览器地址栏右端保留宿主的外部打开按钮。
- **短会话 ID + 复制**：仍位于会话标题栏右侧工具行。
- **答案卡片**：一轮的最终回答外面套一层卡片，带编辑 / 复制 / 另存为新会话任务。
  编辑态仿输入框的组合条：取消按钮占住卡片头部的编辑位置（编辑时就是它替换了
  编辑图标），新建会话是描边文字按钮、与发送钮之间留大间距避免误点，发送是一枚
  圆形图标按钮——常态铺品牌色，hover 才转浅，和输入框的发送钮一致。
- **会话尾部文件卡片**：从一轮的输出里认出文件路径，就地展开阅读、编辑、
  发送回会话、用桌面应用打开；超过四个折叠。
- **Mermaid 图渲染**：把 Markdown 里的 ` ```mermaid ` 代码块画成 SVG，可切「图表 /
  源码」。运行时 3.5 MB 不内联进客户端包，第一次遇到图时才从宿主路由
  `/threadharbor/mermaid.js` 懒加载。

| 功能 | 注册位置 |
| --- | --- |
| 会话工具区 | `shell.overlay` 管理生命周期，React portal 插入会话正文的正常布局 |
| 短会话 ID + 复制 | `conversation.session.header.utilities`（会话作用域 list） |
| 答案卡片 | 包住 `conversation.chat.node` 的 `assistant-step`（优先级 -50） |
| 会话尾部文件卡片 | `conversation.chat.turnTail` |
| Mermaid | DOM 级（扫已渲染的 Markdown）+ 宿主路由 `/threadharbor/mermaid.js` |

## 与 dsh-acp-agent 的关系（两个包都装时）

ACP 的**进程段**（工具调用/思考的过程卡片）是 agent 专属的，仍留在
`@goodjin2/dsh-acp-agent`。两个包通过一个跨包座位接起来：

1. 本包在重注册 `assistant-step` 包装时**声明**座位
   `conversation.chat.node.acp-segment-renderer`（`children` 表，list 类型）。
2. acp-agent 发现座位存在后，把它的 `AcpProcessBlock` 注册进来。
3. 本包的包装在渲染时按座位取名：带 `acpProcessSegment` 的节点交给它，其余步骤
   走答案卡片。

`assistant-step` 的规则是「优先级最低的那条渲染」。本包用 **-50**、acp-agent 的
兜底用 **-40**，所以本包恒在外层；只装 acp-agent 时它那层生效，ACP 段照样完整。
改优先级必须两个包一起改——`tests/wrap-priority.spec.ts` 钉住了这个先后关系。

## 安装与挂载

```sh
npm install @goodjin2/dsh-chat-area
```

在 profile 的 `dsh.profile.bundles` 里加上 `@goodjin2/dsh-chat-area` 即可。本包自带
`cordis.patch.yml`（`dsh.bundle.patch`），里面包含：

- `chat-area-client`：以**裸包名**挂载本包，浏览器半边靠它被扫进
  `window.__DSH_BOOT__`。这一行不是可有可无的：DSH 不按 `package.json` 的
  `dsh.client` 自动装载浏览器包，只看 Loader 的行名是否恰好等于包名
  （`ClientModuleRegistry.resolveMeta` 经 `locatePkgJson` 解析；带子路径的名字
  一律不算客户端行）。少了它，插件装上也什么都不发生，宿主日志里一个字都没有。
- `threadharbor-mermaid-asset`：宿主侧 `/threadharbor/mermaid.js` 这条 exact 路由，
  供浏览器半边懒加载 mermaid 运行时。

## 迁移说明（0.3.0）

mermaid 渲染、答案卡片、会话尾部文件卡片在 0.3.0 从 `@goodjin2/dsh-acp-agent`
迁到本包（agent 无关的通用会话区功能归本包，ACP 专属留在那边）。对应的旧行
`@goodjin2/dsh-acp-agent/mermaid-asset` 在 acp-agent 0.3.0 已删除；从旧版本升上来
时，把 profile 里这条旧行换成 `@goodjin2/dsh-chat-area/mermaid-asset`（或直接删掉，
由本包的 bundle patch 提供）。

## 开发

```sh
npm run typecheck   # tsc --noEmit
npm test            # vitest（含产物的装载冒烟测试）
npm run build       # tsc -p tsconfig.json && tsdown → lib/client.js
```

`tests/bundle.spec.ts` 会把 `lib/client.js` 按页面的方式执行一遍（模拟
`window.__ModuleLoader__`、用页面给的 `require` 取 react / primitives、调 `apply`）：
产物格式或 id 写错时，这里会先红，而不是等页面在装配审计里判失败。

构建是**可复现**的：同一份源码连建两次产物字节相同（CSS module 哈希按基名算），
所以 `lib/client.js` 入库后，重建不会平白弄脏工作区，也不会触发无意义的页面热替换。

## Requirements

- DSH >= 0.2.0-rc.2
- 会话工具需要宿主自带的文件、浏览器、终端、文档预览客户端模块（已声明 `dsh.client.external`）。
- 以 DSH 0.2.1-rc.3 验证；这些模块的工厂和座位接口变化时需运行浏览器验收。

## License

MIT

## 会话工具实现与迁移

`conversation-tools.tsx` 负责入口和正文视图；`tools-state.ts` 管理每会话独立的标签及
AbortSignal；`tools-adapter.tsx` 在私有服务和 `chat-area.tools.*` 座位中装配宿主功能工厂。
浏览器持久化使用独立作用域，终端关闭调用资源清理，不与原右侧栏共享导航状态。
为支持 Web profile，bundle patch 启用宿主浏览器模块（Web 使用 iframe，网页可能拒绝嵌入，
这时可以使用外部打开按钮）。

`dsh-rightbar-overlay` 已退役，应从 profile 的 dependencies / bundles 和 node_modules
链接中移除。不得与本方案一起用来改写会话布局。浏览器中的旧 localStorage 开关键不再读取。

验收：展开/收起、空会话、文本文件编辑保留、工作区预览/复制/编辑、浏览器内外打开、
终端启动/关闭；检查宿主右侧栏未随新入口展开。构建产物随源码提交，桌面 App 重启后加载。
