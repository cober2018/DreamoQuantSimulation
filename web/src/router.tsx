import { useEffect } from 'react'
import { createBrowserRouter, Navigate, Outlet, redirect, useLocation, useMatches, type RouteObject } from 'react-router'
import { can, restore, useSession } from '@/lib/auth'
import { PAGES, type PageDef } from '@/lib/pageCatalog'
import { AppShell } from '@/components/shell/AppShell'

// 路由元信息：对应旧版 main.js 里的 meta
interface Handle { title?: string; public?: boolean; bare?: boolean; perm?: string; page?: PageDef }

const page = (path: string) => PAGES.find((p) => p.path === path)
const lazyPage = (load: () => Promise<{ Component: React.ComponentType }>) => ({ lazy: async () => ({ Component: (await load()).Component }) })

const dataPage = (path: string): RouteObject => ({ path, handle: { title: page(path)!.title, page: page(path) } satisfies Handle })
const stub = (path: string, title: string): RouteObject => ({ path, ...lazyPage(() => import('./pages/Stub')), handle: { title, public: true, bare: true } satisfies Handle })

// 对应旧版 router.beforeEach；返回要跳转的地址，null 表示放行
function guard(pathname: string, search: string, h: Handle): string | null {
  const { user } = useSession.getState()
  // 介绍页只给未登录访客；已登录直接进平台，旧的根域名书签行为不变
  if (pathname === '/' && user) return '/overview'
  if (h.public) return null
  if (!user) return `/login?next=${encodeURIComponent(pathname + search)}`
  if (user.must_change_password && pathname !== '/account') return '/account'
  if (pathname === '/plans' && !user.payment_enabled) return '/overview'
  if (h.perm && !can(h.perm)) return '/overview'
  // 无权限的数据页改走预告页, 预告不请求数据接口
  if (h.page && !can(h.page.perm)) return `/locked/${h.page.key}`
  return null
}

function Root() {
  const ready = useSession((s) => s.ready)
  const user = useSession((s) => s.user)
  const { pathname, search } = useLocation()
  const h = (useMatches().at(-1)?.handle ?? {}) as Handle
  useEffect(() => { if (!useSession.getState().ready) void restore() }, [])
  useEffect(() => { document.title = `${h.title || ''} · 知数星耀量化平台` }, [h.title])
  if (!ready) return null
  const to = guard(pathname, search, h)
  if (to) return <Navigate to={to} replace />
  void user // 会话变化（登录、退出）时重新跑守卫
  return h.bare ? <Outlet /> : <AppShell />
}

export const router = createBrowserRouter([{
  element: <Root />,
  children: [
    { path: '/', ...lazyPage(() => import('./pages/Landing')), handle: { title: '知数星耀', public: true, bare: true } satisfies Handle },
    { path: '/follow', ...lazyPage(() => import('./pages/Follow')), handle: { title: '关注知数Talk 主理人', public: true, bare: true } satisfies Handle },
    stub('/pricing', '价格与权益'), stub('/mp', '小程序'), stub('/docs', '文档'), stub('/blog', '博客'),
    { path: '/privacy', loader: () => redirect('/terms') },
    { path: '/app', loader: () => redirect('/overview') },
    { path: '/app/states', loader: () => redirect('/overview') },
    { ...dataPage('/overview'), ...lazyPage(() => import('./pages/Overview')) },
    { ...dataPage('/themes'), ...lazyPage(() => import('./pages/Themes')) },
    { ...dataPage('/history'), ...lazyPage(() => import('./pages/History')) },
    { ...dataPage('/participation'), ...lazyPage(() => import('./pages/Participation')) },
    { ...dataPage('/industries'), ...lazyPage(() => import('./pages/Industries')) },
    { ...dataPage('/calendar'), ...lazyPage(() => import('./pages/Calendar')) },
    { path: '/locked/:key', ...lazyPage(() => import('./pages/Locked')), handle: { title: '会员内容' } satisfies Handle },
    { path: '/plans', ...lazyPage(() => import('./pages/Plans')), handle: { title: '会员套餐' } satisfies Handle },
    { path: '/about', ...lazyPage(() => import('./pages/About')), handle: { title: '数据与内容说明' } satisfies Handle },
    { path: '/account', ...lazyPage(() => import('./pages/Account')), handle: { title: '我的账号' } satisfies Handle },
    { path: '/admin', ...lazyPage(() => import('./pages/Admin')), handle: { title: '管理后台', perm: 'admin.console' } satisfies Handle },
    { path: '/login', ...lazyPage(() => import('./pages/Login')), handle: { title: '登录', bare: true, public: true } satisfies Handle },
    { path: '/terms', ...lazyPage(() => import('./pages/Terms')), handle: { title: '用户协议与隐私政策', public: true, bare: true } satisfies Handle },
    // 不存在的地址：显示「没有这个页面」，不用框架自带的英文报错页
    stub('*', '没有这个页面'),
  ],
}])
