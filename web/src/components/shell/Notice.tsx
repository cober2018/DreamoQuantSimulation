import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// 面板内的提示条：info 中性、warn 琥珀、error 红
export function Notice({ tone = 'info', className, children }: { tone?: 'info' | 'warn' | 'error'; className?: string; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-md border px-3.5 py-2.5 text-sm leading-relaxed',
      tone === 'error' ? 'border-destructive/40 bg-destructive/10' : tone === 'warn' ? 'border-[var(--c-warn)]/40 bg-[var(--c-warn)]/10' : 'bg-secondary', className)}>{children}</div>
  )
}
