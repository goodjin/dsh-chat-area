import { vi } from 'vitest'

/**
 * 测试里把 `@deepseek-ai/dsh-client-ui-primitives` 换成哑代理。
 *
 * 迁入答案卡片 / 文件阅读区后，`src/index.ts` 的静态图会经 conversation-surfaces
 * 拉到 primitives；而真实包在 Node/vitest 里加载会连带它的 `.module.css`（vite 不
 * 处理 node_modules 里的 CSS）和未声明的 clsx 依赖。测试只验证注册与逻辑、不渲染
 * 真组件，故用「任何具名导出都取到一个哑组件」的代理顶上。
 *
 * 包执行测试（bundle.spec.ts）走的是产物里运行时 require，不经 vitest 模块图，
 * 不受这里影响；那条测试另在自己的 mock require 里给 primitives 喂哑值。
 */
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({}))
vi.mock('react-dom', () => ({ createPortal: () => null }))
vi.mock('@deepseek-ai/dsh-client-ui-sidebar-files', () => ({ apply: () => {}, inject: [] }))
vi.mock('@deepseek-ai/dsh-client-ui-sidebar-browser', () => ({ apply: () => {}, inject: [] }))
vi.mock('@deepseek-ai/dsh-client-ui-sidebar-terminal', () => ({ apply: () => {}, inject: [] }))
vi.mock('@deepseek-ai/dsh-client-ui-sidebar-documentpreview', () => ({ apply: () => {}, inject: [] }))
