import { createRouter, createWebHistory } from 'vue-router'
import Landing from './pages/Landing.vue'
import AppShell from './components/AppShell.vue'
import Home from './pages/web/Home.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Landing, meta: { title: '知数星耀 · A 股盘后数据' } },
    {
      path: '/app', component: AppShell,
      children: [
        { path: '', component: Home, meta: { section: 'brief', title: '今日要点 · 知数星耀' } },
        { path: 'industries', component: () => import('./pages/web/Industries.vue'), meta: { section: 'industries', title: '行业比较与轮动 · 知数星耀' } },
        { path: 'states', component: () => import('./pages/web/States.vue'), meta: { section: 'states', title: '状态设计 · 知数星耀' } },
        { path: 's/:key', component: () => import('./pages/web/Stub.vue'), meta: { title: '明细 · 知数星耀' } },
      ],
    },
    { path: '/mp', component: () => import('./pages/mp/MpHome.vue'), meta: { title: '小程序 · 今日要点' } },
    { path: '/mp/industries', component: () => import('./pages/mp/MpIndustries.vue'), meta: { title: '小程序 · 行业' } },
    { path: '/:p(.*)*', redirect: '/' },
  ],
  scrollBehavior: (to, from, saved) => saved || (to.path !== from.path ? { top: 0 } : undefined),
})
router.afterEach((to) => { document.title = to.meta.title || '知数星耀' })
