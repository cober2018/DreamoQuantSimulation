import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'INSIGHT_')
  const token = env.INSIGHT_ACCESS_TOKEN || process.env.INSIGHT_ACCESS_TOKEN || ''
  return {
    plugins: [vue()],
    build: { sourcemap: false, minify: 'esbuild' },
    esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : {},
    server: {
      host: '127.0.0.1',
      port: 5180,
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
