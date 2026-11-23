import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// 页面里的一块内容：标题说"是什么"，hint 说"回答什么问题"
export function Panel({ title, hint, action, className, children }: { title?: ReactNode; hint?: ReactNode; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn('rounded-lg border bg-card p-5 shadow-[var(--shadow-1)] sm:p-6', className)}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 sm:flex-nowrap">
          <div className="min-w-0">
            <h2 className="text-[15px] font-medium leading-snug">{title}</h2>
            {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
          </div>
          {action && <div className="-m-1 max-w-full shrink-0 overflow-x-auto p-1">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
