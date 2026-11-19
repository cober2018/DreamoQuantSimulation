import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import '@ds/dist/tokens.css'
import './theme/base.css'
import App from './App.vue'

const routes = [
  { path: '/', redirect: '/participation' },
  {
    path: '/',
    component: () => import('./components/AppShell.vue'),
    children: [
      { path: 'participation', component: () => import('./pages/Participation.vue'), meta: { title: '参与度与资金环境 · 知数星耀' } },
      { path: 'industries', component: () => import('./pages/Industries.vue'), meta: { title: '行业比较与轮动 · 知数星耀' } },
    ],
  },
  { path: '/:rest(.*)*', redirect: '/participation' },
]

const router = createRouter({ history: createWebHistory(), routes, scrollBehavior: () => ({ top: 0 }) })
router.afterEach((to) => { if (to.meta.title) document.title = to.meta.title })

createApp(App).use(router).mount('#app')
