import { defineConfig } from 'vitest/config'

/**
 * 只跑源码里的测试。lib/ 下是 tsc 的中间产物（lib/src）和打包结果（lib/client.js），
 * 编译后的测试副本再跑一遍没有意义，还会让同一断言失败两次。
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    exclude: ['lib/**', 'node_modules/**'],
    setupFiles: ['./tests/setup.ts'],
  },
})
