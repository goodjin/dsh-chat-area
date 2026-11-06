/**
 * 座位与工厂的名字映射：会话区工具用私有座位，不碰宿主右侧栏的布局。
 *
 * 单独成文件，是因为文件树装饰也要用到同一套名字——两处各写一份字面量，
 * 就会像 2026-11-06 那次一样：一边改了另一边没改，装饰默默接不上。
 */

/** 宿主座位 → 私有座位：`sidebar.right.x` → `chat-power.tools.x`。 */
export const toolSlot = (name: string): string =>
  name.startsWith('sidebar.right.') ? `chat-power.tools.${name.slice('sidebar.right.'.length)}` : name

/**
 * 文件面板的工厂在宿主里是**全局唯一**的名字（文件树 / 导航器 / 导航开关）。
 *
 * 宿主 0.2.2 起把它们做成了工厂：会话区里再装一份文件面板，就不能再用同名
 * 工厂——撞名会当场抛错，文件面板整块起不来。私有作用域因此另起名字，
 * 自己那份工厂跟着私有作用域走（导航器要拿到的是会话区自己的标签）。
 */
const FILES_FACTORIES = new Set(['sidebar.files.navigator', 'sidebar.files.navigator.toggle'])

/** 工厂名：私有作用域里换名，避免与宿主那份撞名。 */
export const privateFactory = (name: string): string =>
  FILES_FACTORIES.has(name) ? `chat-power.tools.${name.slice('sidebar.files.'.length)}` : name

/** 渲染座位名：座位按 toolSlot 走，工厂按 privateFactory 走。 */
export const privateSlot = (name: string): string =>
  FILES_FACTORIES.has(name) ? privateFactory(name) : toolSlot(name)
