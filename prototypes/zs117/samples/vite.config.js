import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
      '@ds': fileURLToPath(new URL('../../../design-system', import.meta.url)),
    },
  },
  server: { port: 5393, fs: { allow: ['../../..'] } },
  preview: { port: 4393, strictPort: true },
  build: { target: 'es2020', modulePreload: { polyfill: false } },
})
