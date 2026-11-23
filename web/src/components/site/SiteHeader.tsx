// 公开站页头：产品 / 价格 / 文档 / 博客 / 登录。窄屏收成一个展开菜单。
// overlay：首页用，固定在顶部、背景透明盖在星图上，滚过 24px 后换成毛玻璃底和分隔线。其他公开页是实底，不固定。
import { useEffect, useState, type Ref } from 'react'
import { Link, useLocation } from 'react-router'
import { BrandMark } from '@/components/shell/BrandMark'
import { ThemeToggle } from '@/components/shell/ThemeToggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { WRAP } from './wrap'

const LINKS = [
  { key: 'product', label: '产品', to: '/' },
  { key: 'pricing', label: '价格', to: '/pricing' },
  { key: 'docs', label: '文档', to: '/docs' },
  { key: 'blog', label: '博客', to: '/blog' },
]

export function SiteHeader({ overlay, ref }: { overlay?: boolean; ref?: Ref<HTMLElement> }) {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    if (!overlay) return
    const on = () => setScrolled(window.scrollY > 24)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [overlay])

  return (
    <header ref={ref} className={cn('z-[var(--z-header)] border-b transition-[background-color,border-color] duration-200',
      overlay ? 'fixed inset-x-0 top-0' : 'relative bg-[var(--c-bg)] border-[var(--c-line)]',
      overlay && (scrolled ? 'border-[var(--c-line)] bg-[color-mix(in_srgb,var(--c-bg)_85%,transparent)] backdrop-blur-md' : 'border-transparent bg-transparent'))}>
      <div className={cn(WRAP, 'flex h-[72px] items-center gap-6 max-[899px]:h-14 max-[899px]:gap-3')}>
        <Link to="/" aria-label="知数星耀 首页" className="inline-flex items-center gap-2 text-[18px] text-foreground">
          <BrandMark size={28} /><span style={{ fontFamily: 'var(--font-display)' }}>知数星耀</span>
        </Link>
        <nav id="site-nav" aria-label="主导航"
          className={cn('ml-2 flex gap-1',
            'max-[899px]:absolute max-[899px]:inset-x-4 max-[899px]:top-[60px] max-[899px]:ml-0 max-[899px]:flex-col max-[899px]:rounded-[var(--r-3)] max-[899px]:border max-[899px]:border-[var(--c-line-strong)] max-[899px]:bg-[var(--c-surface)] max-[899px]:p-2 max-[899px]:shadow-[var(--shadow-2)]',
            !open && 'max-[899px]:hidden')}>
          {LINKS.map((l) => {
            const cur = pathname === l.to
            return (
              <Link key={l.key} id={`nav-${l.key}`} to={l.to} aria-current={cur ? 'page' : undefined} onClick={() => setOpen(false)}
                className={cn('relative inline-flex h-9 items-center rounded-[var(--r-2)] px-3 text-[length:var(--fs-sm)] text-ink-2 transition-colors hover:bg-surface-hover hover:text-foreground',
                  'max-[899px]:h-11 max-[899px]:text-[length:var(--fs-md)]',
                  cur && 'text-foreground after:absolute after:inset-x-3 after:bottom-1 after:h-px after:bg-[var(--c-accent)] max-[899px]:after:inset-x-auto max-[899px]:after:bottom-3 max-[899px]:after:left-0 max-[899px]:after:top-3 max-[899px]:after:h-auto max-[899px]:after:w-0.5')}>
                {l.label}
              </Link>
            )
          })}
          <Link id="nav-login-m" to="/login" onClick={() => setOpen(false)}
            className="hidden h-11 items-center rounded-none border-t border-[var(--c-line)] px-3 text-[length:var(--fs-md)] text-ink-2 hover:text-foreground max-[899px]:mt-1 max-[899px]:inline-flex">登录</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="outline" size="sm" className="max-[899px]:hidden"><Link id="nav-login" to="/login">登录</Link></Button>
          <button id="nav-toggle" type="button" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((v) => !v)}
            className="hidden size-9 place-items-center rounded-[var(--r-2)] border border-[var(--c-line)] max-[899px]:grid">
            <span className="sr-only">{open ? '收起菜单' : '展开菜单'}</span>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d={open ? 'M4 4l10 10M14 4L4 14' : 'M3 6h12M3 12h12'} /></svg>
          </button>
        </div>
      </div>
    </header>
  )
}
