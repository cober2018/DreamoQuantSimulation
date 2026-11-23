import { Button } from '@/components/ui/button'

export const PAGE_SIZE = 50

// 前端分页：接口一次返回全部，这里按页切片
export function Pager({ total, page, onPage }: { total: number; page: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (total <= PAGE_SIZE) return <p className="mt-2 text-xs text-ink-3">共 {total} 条</p>
  const from = page * PAGE_SIZE + 1
  const to = Math.min(total, (page + 1) * PAGE_SIZE)
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-3">
      <span className="tnum">第 {from}–{to} 条，共 {total} 条</span>
      <div className="flex items-center gap-2">
        <Button size="xs" variant="outline" disabled={page <= 0} onClick={() => onPage(page - 1)}>上一页</Button>
        <span className="tnum">{page + 1} / {pages}</span>
        <Button size="xs" variant="outline" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>下一页</Button>
      </div>
    </div>
  )
}
