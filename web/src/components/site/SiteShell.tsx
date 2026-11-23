// 页头 + 正文 + 页脚的外壳，关注页和占位页共用。含「跳到正文」链接
import type { ReactNode } from 'react'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'
import { SKIP_LINK, WRAP } from './wrap'
import { cn } from '@/lib/utils'

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--c-bg)] text-foreground">
      <a className={SKIP_LINK} href="#main">跳到正文</a>
      <SiteHeader />
      <main id="main" className={cn(WRAP, 'flex-1 py-[var(--s-8)] max-sm:py-[var(--s-6)]')}>{children}</main>
      <SiteFooter />
    </div>
  )
}
