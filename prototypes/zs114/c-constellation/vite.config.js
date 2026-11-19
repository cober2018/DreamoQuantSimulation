import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@data': fileURLToPath(new URL('../data', import.meta.url)) } },
  server: { port: 5193, fs: { allow: ['..'] } },
  build: { target: 'es2020', modulePreload: { polyfill: false } },
})
