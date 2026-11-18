import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import '@ds/dist/tokens.css'
import './theme/base.css'
import App from './App.vue'
import { COPY } from './config.js'

const STUBS = {
  pricing: { title: '价格与权益', desc: '网页版为会员服务；微信小程序提供免费版。档位和价格待公布，公布前这里不写任何金额。' },
  docs: { title: '文档', desc: '使用文档正在整理：开始使用、每日要点怎么读、六个明细页的口径、MCP 接入、字段口径表。' },
  blog: { title: '博客', desc: '市场数据方法论：口径怎么读、统计方法、怎样用 MCP 让大模型读数据。首批文章正在撰写。' },
  login: { title: '登录', desc: '原型阶段不接账号系统。网页版与小程序共用同一个账号。' },
  privacy: { title: '隐私政策', desc: '正式文本由法务定稿后发布。' },
  terms: { title: '用户协议', desc: '正式文本由法务定稿后发布。' },
}

const routes = [
  { path: '/', component: () => import('./pages/Landing.vue'), meta: { title: COPY.title } },
  { path: '/follow', component: () => import('./pages/Follow.vue'), meta: { title: '关注知数Talk 主理人 · 知数星耀' } },
  ...Object.entries(STUBS).map(([k, v]) => ({ path: '/' + k, component: () => import('./pages/Stub.vue'), props: { stubKey: k, ...v }, meta: { title: `${v.title} · 知数星耀` } })),
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
  { path: '/:rest(.*)*', component: () => import('./pages/Stub.vue'), props: { stubKey: '404', title: '没有这个页面', desc: '地址可能输错了，或者页面已经移走。' }, meta: { title: '没有这个页面 · 知数星耀' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to) => (to.hash ? { el: to.hash, top: 72 } : { top: 0 }),
})
router.afterEach((to) => { if (to.meta.title) document.title = to.meta.title })

createApp(App).use(router).mount('#app')
