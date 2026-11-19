import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './styles.css'
import { can, restore, session } from './auth'
import { PAGES } from './pageCatalog'
import { moduleAccess } from './useModule'

const PAGE_META = Object.fromEntries(PAGES.map((p) => [p.path, { title: p.title, page: p }]))
const routes = [
  { path: '/', component: () => import('./intro/pages/Landing.vue'), meta: { title: '知数星耀', public: true, bare: true } },
  { path: '/follow', component: () => import('./intro/pages/Follow.vue'), meta: { title: '关注知数Talk 主理人', public: true, bare: true } },
  { path: '/pricing', component: () => import('./intro/pages/Stub.vue'), props: { stubKey: 'pricing', title: '价格与权益', desc: '价格待公布。免费试用期内所有内容开放，正式档位和价格将另行公布。' }, meta: { title: '价格与权益', public: true, bare: true } },
  { path: '/mp', component: () => import('./intro/pages/Stub.vue'), props: { stubKey: 'mp', title: '小程序', desc: '小程序版本单独排期，暂未开放。' }, meta: { title: '小程序', public: true, bare: true } },
  { path: '/docs', component: () => import('./intro/pages/Stub.vue'), props: { stubKey: 'docs', title: '文档', desc: '文档即将推出。开始使用、每日要点和 MCP 说明会陆续发布。' }, meta: { title: '文档', public: true, bare: true } },
  { path: '/blog', component: () => import('./intro/pages/Stub.vue'), props: { stubKey: 'blog', title: '博客', desc: '博客即将推出。首批文章会围绕指标口径和统计方法。' }, meta: { title: '博客', public: true, bare: true } },
  { path: '/privacy', redirect: '/terms' },
  { path: '/app', redirect: '/overview' },
  { path: '/app/states', redirect: '/overview' },
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
  // 介绍页只给未登录访客；已登录直接进平台，旧的根域名书签行为不变
  if (to.path === '/' && session.user) return '/overview'
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
