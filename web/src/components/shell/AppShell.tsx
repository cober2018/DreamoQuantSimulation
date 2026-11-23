import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { CreditCard, Info, Menu, ShieldCheck, UserRound, X } from 'lucide-react'
import { motion } from 'motion/react'
import type { ComponentType } from 'react'
import { PAGES } from '@/lib/pageCatalog'
import { payOn, trialText, useCan, useSession } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { BrandMark } from './BrandMark'
import { DialogHost } from './DialogHost'
import { PAGE_ICONS } from './pageIcons'
import { ThemeToggle } from './ThemeToggle'
import { Watermark } from './Watermark'

function NavItem({ to, active, icon: Icon, children, onClick }: { to: string; active: boolean; icon: ComponentType<{ size?: number }>; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick} aria-current={active ? 'page' : undefined}
      className={cn('relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink-2 transition-colors hover:text-foreground', active ? 'font-medium text-foreground' : 'hover:bg-surface-hover')}>
      {/* 选中底色在导航项之间滑动（共享 layoutId），金色细条是官网"当前项"的标记 */}
      {active && (
        <motion.span layoutId="nav-active" className="absolute inset-0 rounded-md bg-accent" transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }}>
          <span className="absolute inset-y-2.5 left-0 w-0.5 rounded bg-primary" />
        </motion.span>
      )}
      <span className={cn('relative', active && 'text-primary')}><Icon size={16} /></span>
      <span className="relative flex min-w-0 flex-1 items-center">{children}</span>
    </Link>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const user = useSession((s) => s.user)
  const can = useCan()
  const [open, setOpen] = useState(false)
  const selected = pathname.startsWith('/locked/') ? `/${pathname.split('/')[2]}` : pathname
  const close = () => setOpen(false)
  // 入口对所有登录用户可见并标锁, 用作会员内容预告; 真正的权限边界在服务端
  const minRole = (perm: string) => user?.perm_min_role?.[perm] || '会员'

  const expireDays = (() => {
    const t = user?.member_expires_at
    if (!t) return null
    const d = Math.ceil((t * 1000 - Date.now()) / 86400000)
    return d >= 0 && d <= 7 ? d : null
  })()
  const expireDate = user?.member_expires_at ? new Date(user.member_expires_at * 1000).toLocaleDateString('zh-CN') : ''

  return (
    <div className="min-h-screen bg-background lg:flex">
      <div className="flex items-center gap-3 border-b px-4 py-3 lg:hidden">
        <button type="button" aria-label="打开导航" onClick={() => setOpen(true)} className="grid size-9 place-items-center rounded-md border"><Menu size={18} /></button>
        <BrandMark size={24} /><span style={{ fontFamily: 'var(--font-display)' }} className="text-lg">知数星耀</span>
      </div>
      {open && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={close} />}
      <aside className={cn('fixed inset-y-0 left-0 z-50 flex w-[232px] shrink-0 flex-col overflow-y-auto border-r bg-background transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center gap-2.5 py-5 pl-5 pr-3">
          <BrandMark size={28} />
          <div className="min-w-0 flex-1">
            <div className="text-lg leading-tight" style={{ fontFamily: 'var(--font-display)' }}>知数星耀</div>
            <div className="text-[11px] text-ink-3">市场事实与历史统计</div>
          </div>
          <ThemeToggle className="!size-8" />
          <button type="button" aria-label="关闭导航" onClick={close} className="grid size-8 place-items-center rounded-md lg:hidden"><X size={16} /></button>
        </div>
        <nav className="flex flex-col gap-0.5 px-3">
          {PAGES.map((p) => (
            <NavItem key={p.path} to={p.path} icon={PAGE_ICONS[p.key]} active={selected === p.path} onClick={close}>
              <span>{p.title}</span>
              {!can(p.perm) && <span className="ml-auto text-[11px] text-ink-3">{minRole(p.perm)}</span>}
            </NavItem>
          ))}
          <NavItem to="/about" icon={Info} active={selected === '/about'} onClick={close}>数据与内容说明</NavItem>
        </nav>
        <div className="mt-4 border-t px-3 pt-2">
          {trialText(user) && <div className="px-3 py-2 text-xs text-ink-3">{trialText(user)}</div>}
          <div className="flex flex-col gap-0.5">
            {payOn() && <NavItem to="/plans" icon={CreditCard} active={selected === '/plans'} onClick={close}>会员套餐</NavItem>}
            <NavItem to="/account" icon={UserRound} active={selected === '/account'} onClick={close}>我的账号 · {user?.role_label}</NavItem>
            {can('admin.console') && <NavItem to="/admin" icon={ShieldCheck} active={selected === '/admin'} onClick={close}>管理后台</NavItem>}
          </div>
        </div>
      </aside>
      <main className="dot-field min-w-0 flex-1"><div className="mx-auto w-full max-w-[1920px] px-4 py-4 sm:px-9 sm:py-7">
        {expireDays !== null && (
          <div className="mb-4 rounded-md border border-[var(--c-warn)]/40 bg-[var(--c-warn)]/10 px-4 py-3 text-sm">
            {user?.role_label} 将于 {expireDays} 天后到期（{expireDate}）{payOn() && <> · <Link className="underline" to="/plans">续期请查看会员套餐</Link></>}
          </div>
        )}
        <Outlet />
      </div></main>
      <Watermark />
      <DialogHost />
    </div>
  )
}
