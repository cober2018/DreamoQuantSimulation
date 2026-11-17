import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import './theme/tokens.css'
import './theme/base.css'
import App from './App.vue'

const routes = [
  { path: '/', component: () => import('./pages/Landing.vue'), meta: { title: '知数星耀 · A 股盘后数据与每日事实要点' } },
  {
    path: '/app',
    component: () => import('./components/AppShell.vue'),
    children: [
      { path: '', name: 'home', component: () => import('./pages/web/Home.vue'), meta: { title: '今日要点 · 知数星耀' } },
      { path: 'industries', name: 'industries', component: () => import('./pages/web/Industries.vue'), meta: { title: '行业比较与轮动 · 知数星耀' } },
      { path: 'states', name: 'states', component: () => import('./pages/web/States.vue'), meta: { title: '状态样张 · 知数星耀' } },
      { path: 'p/:key', name: 'placeholder', component: () => import('./pages/web/Placeholder.vue'), meta: { title: '知数星耀' } },
    ],
  },
  { path: '/mp', component: () => import('./pages/mp/MpHome.vue'), meta: { title: '知数星耀 · 小程序' } },
  { path: '/mp/industries', component: () => import('./pages/mp/MpIndustries.vue'), meta: { title: '知数星耀 · 小程序' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to) => (to.hash ? { el: to.hash, top: 72 } : { top: 0 }),
})
router.afterEach((to) => { if (to.meta.title) document.title = to.meta.title })

createApp(App).use(router).mount('#app')
