import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './styles.css'
import { can, restore, session } from './auth'
import { PAGES } from './pageCatalog'
import { moduleAccess } from './useModule'

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
  if (to.path === '/plans' && !session.user.payment_enabled) return '/overview'
  if (to.meta.perm && !can(to.meta.perm)) return '/overview'
  // 无权限的数据页改走预告页, 预告不请求数据接口
  if (to.meta.page && !can(to.meta.page.perm)) return `/locked/${to.meta.page.key}`
  return true
})
router.afterEach((to) => { document.title = `${to.meta.title || ''} · 知数星耀量化平台` })

// 后端已裁掉无权限指标；整块无权限的模块在前端隐藏（以后端裁剪为准）
const applyModule = (el, binding) => { el.style.display = moduleAccess.map[binding.value] === 'none' ? 'none' : '' }
const vModule = { mounted: applyModule, updated: applyModule }
// 单个指标被裁掉时隐藏对应数值卡片，避免把"无权限"显示成"暂无数据"
const applyInd = (el, binding) => { el.style.display = moduleAccess.restricted.includes(binding.value) ? 'none' : '' }
const vInd = { mounted: applyInd, updated: applyInd }

createApp(App).directive('module', vModule).directive('ind', vInd).use(router).mount('#app')
