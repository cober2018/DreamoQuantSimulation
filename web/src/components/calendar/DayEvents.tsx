import { cn } from '@/lib/utils'
import { byImportance, importance, isImportant, PUB, weekdayOf, type Ev } from './calUtil'

function V({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return <div className="min-w-0"><dt className="text-[11px] text-ink-3">{label}</dt><dd className={cn('tnum mt-0.5 text-xs', strong ? 'text-sm font-medium' : 'truncate')}>{children}</dd></div>
}

// 选中日期的事件明细：时间、数据、重要性、前值、市场预期、公布值与状态
export function DayEvents({ date, events, hiddenCount = 0 }: { date: string; events: Ev[]; hiddenCount?: number }) {
  const list = [...events].sort(byImportance)
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium"><span className="tnum">{date}</span> {weekdayOf(date)} 的事件 · {list.length} 条</h3>
      {!list.length ? <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-ink-3">{hiddenCount > 0 ? `当前筛选下当日没有事件（另有 ${hiddenCount} 条被筛选隐藏，可在上方调整国家或重要程度）。` : '当日暂无事件。'}</p> : (
        <ul className="space-y-2">
          {list.map((e) => {
            const n = importance(e)
            return (
              <li key={e.event_id} className={cn('rounded-md border bg-background/50 p-3', isImportant(e) && 'border-l-2 border-l-primary')}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="tnum w-10 shrink-0 text-xs text-ink-3">{e.event_time || '待定'}</span>
                  <span className="text-xs text-ink-3">{[e.country, e.event_type_label].filter(Boolean).join(' · ') || '—'}</span>
                  <strong className="font-medium">{e.title || '—'}</strong>
                  {e.ai_curated === true && <span className="rounded-full border px-1.5 text-[10px] text-ink-3">AI 整理</span>}
                  <span className="ml-auto text-xs text-primary" title="来源重要性（数据源自身评级）">{n == null ? <span className="text-ink-3">暂无评级</span> : n === 0 ? '—' : '★'.repeat(n)}</span>
                </div>
                <p className="mt-1 text-xs text-ink-3">{[e.period, e.unit].filter(Boolean).join(' · ')}</p>
                <dl className="mt-2 grid grid-cols-3 gap-x-3 text-xs">
                  <V label="前值">{e.previous_value || '—'}</V>
                  <V label="市场预期*">{e.consensus_value || '—'}</V>
                  <V label="公布值" strong>{e.actual_value || '未公布'}<span className="mt-0.5 block w-fit rounded-full border px-1.5 text-[10px] font-normal text-ink-2">{PUB[e.publication_status] || '—'}</span></V>
                </dl>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
