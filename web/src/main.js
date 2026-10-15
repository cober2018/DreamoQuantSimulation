import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './styles.css'
import { can, restore, session } from './auth'

const routes = [
  { path: '/', redirect: '/overview' },
  { path: '/overview', component: () => import('./pages/Overview.vue'), meta: { title: '市场总览' } },
  { path: '/participation', component: () => import('./pages/Participation.vue'), meta: { title: '参与度与资金环境' } },
  { path: '/industries', component: () => import('./pages/Industries.vue'), meta: { title: '行业比较与轮动' } },
  { path: '/themes', component: () => import('./pages/Themes.vue'), meta: { title: '题材与涨跌结构' } },
  { path: '/history', component: () => import('./pages/History.vue'), meta: { title: '历史复盘' } },
  { path: '/calendar', component: () => import('./pages/Calendar.vue'), meta: { title: '事件日历' } },
  { path: '/about', component: () => import('./pages/About.vue'), meta: { title: '数据与内容说明' } },
  { path: '/account', component: () => import('./pages/Account.vue'), meta: { title: '我的账号' } },
  { path: '/admin', component: () => import('./pages/Admin.vue'), meta: { title: '管理后台', perm: 'admin.console' } },
  { path: '/login', component: () => import('./pages/Login.vue'), meta: { title: '登录', bare: true, public: true } },
  { path: '/terms', component: () => import('./pages/Terms.vue'), meta: { title: '用户协议与隐私政策', public: true, bare: true } },
]

export const router = createRouter({ history: createWebHistory(), routes })
router.beforeEach(async (to) => {
  if (!session.ready) await restore()
  if (to.meta.public) return true
  if (!session.user) return { path: '/login', query: { next: to.fullPath } }
  if (session.user.must_change_password && to.path !== '/account') return '/account'
  if (to.meta.perm && !can(to.meta.perm)) return '/overview'
  return true
})
router.afterEach((to) => { document.title = `${to.meta.title || ''} · 量化数据洞察` })

createApp(App).use(router).mount('#app')
