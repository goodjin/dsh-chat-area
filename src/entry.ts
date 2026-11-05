/**
 * 宿主侧的挂载行：什么都不做。
 *
 * DSH 找浏览器半边的方式不是读 package.json 的 dsh.client，而是扫 Loader 的行：
 * 只有某一行的 name 恰好等于包名（裸包名）时，那个包才会进 window.__DSH_BOOT__
 * （`ClientModuleRegistry.resolveMeta` 经 `locatePkgJson` 解析；带子路径的名字
 * 不算客户端行）。所以本包需要一条以裸包名挂载的行，而那条行导入的就是这个文件。
 *
 * 它必须能在 node 里安全 import：浏览器代码（React、DOM）放到 lib/client.js，
 * 由 exports["./client"] 下发。这与 DSH 自己那些 `dsh.client` 包的做法一致——
 * 「空的 apply 只为让这一行出现在宿主 Loader 里」。
 */

/** Loader 行与诊断里看到的插件名。 */
export const name = 'dsh-chat-power'

/** 宿主侧没有行为：会话区的一切都在浏览器半边。 */
export function apply(): void {}
