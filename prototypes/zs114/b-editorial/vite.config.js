import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@data': fileURLToPath(new URL('../data', import.meta.url)) } },
  // 共享数据目录在包外，只读引用
  server: { port: 4791, host: "127.0.0.1", fs: { allow: ['..'] } },
  build: { target: 'es2020', cssCodeSplit: true },
})
