# dsh-chat-area

DSH 会话区增强插件。现在只做一件事：**会话头部右端的短会话 ID + 复制按钮**。

## 装上会发生什么

会话标题栏右端多出一枚工具：显示去掉 `session-` 前缀的前 8 位会话 ID，完整 id 在
`title` 里；旁边一个「复制」按钮，复制成功后短暂显示「已复制」。它注册进
`conversation.session.header.utilities`（会话作用域的 list 插槽，由 DSH 的
`ui-conversation` 声明），所以每个会话各画一份，会话 id 由框架作为 props 传入。

## 这个包为什么只剩一项功能

仓库历史上声称四项功能（文件查看、mermaid、答案编辑、会话 ID 条），但前三项一直
只有占位实现：文件查看的组件返回 `null`、`createFileReaders` 直接抛
`Not yet implemented`、mermaid 去插一条当前 DSH 里并不存在的
`/threadharbor/mermaid.js`、答案编辑是空函数。

它们的**真实实现**活在 `@goodjin2/dsh-acp-agent` 的浏览器半边——会话尾部文件卡片
（含编辑、另存、open-with）、mermaid 渲染、答案卡片——并且随那个插件一起装载。
两套 UI 同时注册只会打架，所以那三份占位实现已被删除，本包收敛为会话 ID 条。

| 功能 | 现在由谁提供 |
| --- | --- |
| 会话尾部文件查看 / 编辑 / open-with | `@goodjin2/dsh-acp-agent`（`conversation.chat.turnTail`） |
| Mermaid 图渲染 | `@goodjin2/dsh-acp-agent` |
| 答案卡片（编辑 / 复制 / 另存为任务） | `@goodjin2/dsh-acp-agent`（ACP 过程视图内） |
| 短会话 ID + 复制 | **本包** |

## 安装与挂载

```sh
npm install @goodjin2/dsh-chat-area
```

在 profile 的 `dsh.profile.bundles` 里加上 `@goodjin2/dsh-chat-area` 即可：本包自带
`cordis.patch.yml`（`dsh.bundle.patch`），里面有一行以**裸包名**挂载本包。

那一行不是可有可无的：DSH 找浏览器半边的依据是 Loader 的行，不是 `package.json`
的 `dsh.client`——只有行名恰好等于包名时，包才会进 `window.__DSH_BOOT__`
（`ClientModuleRegistry.resolveMeta` 经 `locatePkgJson` 解析；带子路径的名字一律
不算客户端行）。少了它，插件装上也什么都不发生，宿主日志里一个字都没有。
推送到 npm 前请确认 `lib/client.js` 是新的：`npm run build` 会先 tsc 再打包。

## 开发

```sh
npm run typecheck   # tsc --noEmit
npm test            # vitest（含产物的装载冒烟测试）
npm run build       # tsc -p tsconfig.json && tsdown → lib/client.js
```

`tests/bundle.spec.ts` 会把 `lib/client.js` 按页面的方式执行一遍（模拟
`window.__ModuleLoader__`、用页面给的 `require` 取 react、调 `apply`）：产物格式
或 id 写错时，这里会先红，而不是等页面在装配审计里判失败。

## Requirements

- DSH >= 0.2.0-rc.2
- 不需要宿主服务：会话 id 来自框架 props，复制走浏览器剪贴板

## License

MIT
