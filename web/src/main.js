import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './styles.css'
import { can, restore, session } from './auth'
import { PAGES } from './pageCatalog'

const PAGE_META = Object.fromEntries(PAGES.map((p) => [p.path, { title: p.title, page: p }]))
const routes = [
  { path: '/', redirect: '/overview' },
  { path: '/overview', component: () => import('./pages/Overview.vue') },
  { path: '/participation', component: () => import('./pages/Participation.vue') },
  { path: '/industries', component: () => import('./pages/Industries.vue') },
  { path: '/themes', component: () => import('./pages/Themes.vue') },
  { path: '/history', component: () => import('./pages/History.vue') },
  { path: '/calendar', component: () => import('./pages/Calendar.vue') },
  { path: '/locked/:key', component: () => import('./pages/Locked.vue'), meta: { title: '会员内容' } },
  { path: '/plans', component: () => import('./pages/Plans.vue'), meta: { title: '会员套餐' } },
  { path: '/about', component: () => import('./pages/About.vue'), meta: { title: '数据与内容说明' } },
  { path: '/account', component: () => import('./pages/Account.vue'), meta: { title: '我的账号' } },
  { path: '/admin', component: () => import('./pages/Admin.vue'), meta: { title: '管理后台', perm: 'admin.console' } },
  { path: '/login', component: () => import('./pages/Login.vue'), meta: { title: '登录', bare: true, public: true } },
  { path: '/terms', component: () => import('./pages/Terms.vue'), meta: { title: '用户协议与隐私政策', public: true, bare: true } },
]

for (const r of routes) if (PAGE_META[r.path]) r.meta = PAGE_META[r.path]

export const router = createRouter({ history: createWebHistory(), routes })
router.beforeEach(async (to) => {
  if (!session.ready) await restore()
  if (to.meta.public) return true
  if (!session.user) return { path: '/login', query: { next: to.fullPath } }
  if (session.user.must_change_password && to.path !== '/account') return '/account'
  if (to.meta.perm && !can(to.meta.perm)) return '/overview'
  // 无权限的数据页改走预告页, 预告不请求数据接口
  if (to.meta.page && !can(to.meta.page.perm)) return `/locked/${to.meta.page.key}`
  return true
})
router.afterEach((to) => { document.title = `${to.meta.title || ''} · 量化数据洞察` })

createApp(App).use(router).mount('#app')
