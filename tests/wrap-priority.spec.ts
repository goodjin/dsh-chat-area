/**
 * 两包同时装时，谁在外层。
 *
 * `conversation.chat.node` 是 keyed 插槽：同一个格子（key = `assistant-step`）里
 * 可以有多个 wrap，规则是**优先级最低的那条渲染**（`entriesOfSlot` 按升序取每个
 * 格子的第一条；DSH 自己的模型标签也是用 -10 盖住 0）。
 *
 * 两个包都包这个格子：
 * - `@goodjin2/dsh-chat-area`（本包）：答案卡片 + 把 ACP 段交给座位渲染；
 * - `@goodjin2/dsh-acp-agent`：只装它而没有本包时的兜底。
 *
 * 所以本包必须严格更外层（数值更小），否则 acp-agent 的兜底会盖住本包，答案卡片
 * 整块不出现——2026-11-03 就是这样（本包 -20、acp-agent -40），而且 acp-agent 的
 * 注释里还写着本包是 -30，两边从没对过数。
 *
 * 这里钉住：本包 < acp-agent 的字面量 -40。改优先级时两个包一起改。
 */

import { describe, expect, it } from 'vitest'
import { ACP_AGENT_FALLBACK_PRIORITY, ASSISTANT_STEP_WRAP_PRIORITY } from '../src/conversation-surfaces.tsx'

describe('assistant-step 的两层 wrap', () => {
  it('本包在外层（数值更小），acp-agent 的兜底层在内层', () => {
    expect(ASSISTANT_STEP_WRAP_PRIORITY).toBeLessThan(ACP_AGENT_FALLBACK_PRIORITY)
  })

  it('acp-agent 的兜底优先级与它仓库里的常量一致（-40）', () => {
    // 跨包不能共享常量，这一行是「对过数」的证据；改 acp-agent 时这里也要改。
    expect(ACP_AGENT_FALLBACK_PRIORITY).toBe(-40)
  })
})
