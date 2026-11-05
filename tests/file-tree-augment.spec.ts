/**
 * 文件树行控件：wrap 注册契约与纯判定。
 *
 * 宿主文件树行上没有预留座位；chat-power 在私有座位
 * `chat-power.tools.sidebar.right.pane.tab` 上重注册 FilesBody（降优先级、同 key），
 * 在外层补挂多选框与悬浮编辑按钮。这里钉住 wrap 注册契约和行/路径判定。
 */
import { describe, expect, it } from 'vitest'
import {
  FILES_ACTIONS_CHILD, FILES_PANE_SLOT, filesRowPath, hasHistoryForPhase, isWorkspaceFilesEntry,
} from '../src/file-tree-augment.tsx'

describe('工作区文件 wrap 注册契约', () => {
  it('宿主 files 条目按 children 里的文件动作座位识别', () => {
    const filesEntry = {
      options: { key: 'files-abc', priority: 0, children: { [FILES_ACTIONS_CHILD]: { kind: 'list', scope: 'session' } } },
      component: () => null,
    }
    const browserEntry = {
      options: { key: 'browser-abc', priority: 0 },
      component: () => null,
    }
    expect(isWorkspaceFilesEntry(filesEntry as never)).toBe(true)
    expect(isWorkspaceFilesEntry(browserEntry as never)).toBe(false)
  })
  it('私有座位名映射正确（不碰宿主右侧栏的槽位）', () => {
    expect(FILES_PANE_SLOT).toBe('chat-power.tools.sidebar.right.pane.tab')
    expect(FILES_ACTIONS_CHILD).toBe('chat-power.tools.sidebar.right.tab.files.actions')
  })
})

describe('文件行判定', () => {
  it('从文件行上读出工作区相对路径', () => {
    const li = { getAttribute: (name: string) => name === 'data-files-path' ? 'src/a.ts' : null }
    expect(filesRowPath(li as never)).toBe('src/a.ts')
  })
  it('没有路径标记的行返回 undefined', () => {
    const li = { getAttribute: () => null }
    expect(filesRowPath(li as never)).toBeUndefined()
  })
})

describe('新会话/旧会话判定', () => {
  it('hero 阶段是没有历史的新会话', () => {
    expect(hasHistoryForPhase('hero')).toBe(false)
  })
  it('active 阶段是有内容的旧会话', () => {
    expect(hasHistoryForPhase('active')).toBe(true)
  })
  it('settling 与未知阶段不判定（返回 undefined，等下一个相位）', () => {
    expect(hasHistoryForPhase('settling')).toBeUndefined()
    expect(hasHistoryForPhase(undefined)).toBeUndefined()
    expect(hasHistoryForPhase(null)).toBeUndefined()
  })
})
