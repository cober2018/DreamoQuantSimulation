import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { landingCopy } from './src/copy.js'

// 构建开关（默认都是 false）：BRIEF_LIVE=true 表示「每日要点」已上线（ZS-112 R2），介绍页改用现有功能的说法；
// SOCIAL_DRAFTS=true 表示把 ready=false 的自媒体卡片也构建进去（只给原型预览用）。
const BRIEF_LIVE = process.env.BRIEF_LIVE === 'true'
const SOCIAL_DRAFTS = process.env.SOCIAL_DRAFTS === 'true'
const copy = landingCopy(BRIEF_LIVE)

// 小程序 H5 预览：组件按 uni-app 习惯写 rpx，这里换算成 calc(N * var(--rpx))，--rpx 由小程序外壳按 750 设计稿给出
const rpx = () => ({
  postcssPlugin: 'zx-rpx',
  Declaration(d) { if (d.value.includes('rpx')) d.value = d.value.replace(/(-?\d*\.?\d+)rpx/g, (_, n) => `calc(${n} * var(--rpx, 0.5px))`) },
})

export default defineConfig({
  plugins: [
    vue(),
    { name: 'zx-copy', transformIndexHtml: (html) => html.replaceAll('%ZX_TITLE%', copy.title).replaceAll('%ZX_DESC%', copy.description) },
  ],
  define: { __BRIEF_LIVE__: JSON.stringify(BRIEF_LIVE), __SOCIAL_DRAFTS__: JSON.stringify(SOCIAL_DRAFTS) },
  resolve: {
    alias: {
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
      '@ds': fileURLToPath(new URL('../../../design-system', import.meta.url)),
    },
  },
  css: { postcss: { plugins: [rpx()] } },
  server: { port: 5391, fs: { allow: ['../../..'] } },
  preview: { port: 4391, strictPort: true },
  build: { target: 'es2020', modulePreload: { polyfill: false } },
})
