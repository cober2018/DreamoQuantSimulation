import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './styles/tokens.css'
import './styles/base.css'
import { loadSerif } from './lib/fonts.js'
import Home from './pages/Home.vue'
import Landing from './pages/Landing.vue'

const routes = [
  { path: '/', component: Home, meta: { title: '今日要点' } },
  { path: '/industries', component: () => import('./pages/Industries.vue'), meta: { title: '行业比较与轮动' } },
  { path: '/states', component: () => import('./pages/States.vue'), meta: { title: '状态样张' } },
  { path: '/p/:key', component: () => import('./pages/Stub.vue'), meta: { title: '明细页' } },
  { path: '/landing', component: Landing, meta: { title: '介绍', bare: true } },
  { path: '/mp', component: () => import('./pages/mp/MpHome.vue'), meta: { title: '小程序 · 要点', bare: true } },
  { path: '/mp/industries', component: () => import('./pages/mp/MpIndustries.vue'), meta: { title: '小程序 · 行业', bare: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to) => (to.hash ? { el: to.hash, top: 96, behavior: 'smooth' } : { top: 0 }),
})
router.afterEach((to) => { document.title = `${to.meta.title} · 知数星耀` })

// 等首个路由（含懒加载页）就绪再挂载，避免先渲染空壳再把页脚推下去造成布局偏移
const app = createApp(App).use(router)
router.isReady().then(() => { app.mount('#app'); loadSerif() })
