import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'INSIGHT_')
  const token = env.INSIGHT_ACCESS_TOKEN || process.env.INSIGHT_ACCESS_TOKEN || ''
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    build: {
      sourcemap: false,
      // 生产包去掉 console / debugger（对应旧版 esbuild.drop）
      rolldownOptions: { output: { minify: { compress: { dropConsole: true, dropDebugger: true } } } },
    },
    server: {
      host: '127.0.0.1',
      port: 5181,
      proxy: {
        '/api': {
          target: env.INSIGHT_API_TARGET || 'http://127.0.0.1:8090',
          changeOrigin: false, // 保留浏览器 Host, 登录接口按 Origin 与 Host 同源校验
          // 令牌只在开发代理（Node 侧）注入，不进入浏览器包
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      },
    },
  }
})
