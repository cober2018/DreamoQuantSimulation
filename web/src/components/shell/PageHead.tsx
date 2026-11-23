import type { ReactNode } from 'react'

// 账号、套餐、后台这类非数据页的页头：标题 + 一行说明（数据页用 PageFrame）
export function PageHead({ title, sub, badge }: { title: string; sub?: ReactNode; badge?: ReactNode }) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-[30px] font-normal leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{title}</h1>
        {badge}
      </div>
      {sub && <p className="mt-1.5 text-sm text-ink-3">{sub}</p>}
    </header>
  )
}
