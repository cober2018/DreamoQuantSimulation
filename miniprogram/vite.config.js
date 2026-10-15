import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// H5 预览 (无微信开发者工具时用于渲染截图): /api 代理到本地网关
export default defineConfig({
  plugins: [uni.default ? uni.default() : uni()],
  server: { host: '127.0.0.1', port: 5190, proxy: { '/api': { target: 'http://127.0.0.1:8090', changeOrigin: false } } },
  preview: { host: '127.0.0.1', port: 5190, proxy: { '/api': { target: 'http://127.0.0.1:8090', changeOrigin: false } } },
})
