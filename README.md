# dsh-chat-area

DSH 会话区增强插件：与跑哪种 agent 无关的会话区功能都归这里。

## 装上会发生什么

- **短会话 ID + 复制**：会话标题栏右端一枚工具，「打开本机文件」图标钮 + 短 ID
  （去掉 `session-` 前缀的前 8 位，完整 id 在 `title` 里）+ 复制图标按钮。
  点「打开本机文件」弹系统文件选择框挑一个本机文本文件，读入后内容出现在
  输入框上方：一张 composer 风格的编辑卡片，直接进入编辑态，可发送回会话或
  发去新会话；卡片可收起 / 再展开 / 关闭（超过 5 MB 不读入）。
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
`cordis.patch.yml`（`dsh.bundle.patch`），里面有两行：

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
- 不需要宿主服务：会话 id 来自框架 props，复制走浏览器剪贴板

## License

MIT
