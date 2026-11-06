/**
 * 工作区文件保存：浏览器侧的发送端。
 *
 * 只有一个动作：把编辑框里的文本 POST 给宿主侧的受限写回路由
 * （`/chat-power/workspace-file`，与 workspace-write.ts 同源同路径，
 * 见 workspace-write.spec 的同源钉子）。成功静默返回；失败抛错，
 * 由调用方提示并保留编辑框内容——保存失败不丢正文。
 */

/** 宿主侧写回路由；与 src/workspace-write.ts 的常量保持一致（测试钉住）。 */
export const WORKSPACE_FILE_ROUTE = '/chat-power/workspace-file'

/** 发一次保存；fetchImpl 可注入，测试不联网。 */
export async function saveWorkspaceText(
  sessionId: string,
  path: string,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(WORKSPACE_FILE_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, path, text }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
}
