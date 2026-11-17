import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: { port: 5174, fs: { allow: ['..'] } },
  build: {
    target: 'es2020',
    rollupOptions: { output: { manualChunks: (id) => (id.includes('node_modules/echarts') || id.includes('node_modules/zrender') ? 'echarts' : undefined) } },
  },
})
