import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/shell/Notice'

// 管理后台各标签页统一的加载中 / 失败 / 内容
export function QueryState({ q, children }: { q: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown }; children: ReactNode }) {
  if (q.isPending) return <p className="py-8 text-center text-sm text-ink-3">加载中…</p>
  if (q.isError) return <Notice tone="error" className="flex flex-wrap items-center gap-3"><span>{(q.error as Error)?.message || '加载失败'}</span><Button size="xs" variant="outline" onClick={() => q.refetch()}>重试</Button></Notice>
  return <>{children}</>
}
