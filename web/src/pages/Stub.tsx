// 导航占位页（价格 / 小程序 / 文档 / 博客）和「没有这个页面」兜底。只说明状态，不写任何价格数字。
import { Link, useLocation } from 'react-router'
import { EmptyState } from '@/components/site/EmptyState'
import { SiteShell } from '@/components/site/SiteShell'
import { Button } from '@/components/ui/button'
import { NOT_FOUND, STUBS } from '@/intro/content'

export function Component() {
  const { pathname } = useLocation()
  const stub = STUBS[pathname.replace(/\/+$/, '') || '/']
  const { title, desc } = stub ?? NOT_FOUND
  return (
    <SiteShell>
      <h1 className="text-[clamp(32px,4vw,48px)] font-normal leading-[1.15]" style={{ fontFamily: 'var(--font-display)' }}>{title}</h1>
      <EmptyState title={stub ? '这一页还在准备' : NOT_FOUND.title} desc={desc}>
        <Button asChild variant="outline" size="sm"><Link to="/">回到首页</Link></Button>
      </EmptyState>
    </SiteShell>
  )
}
