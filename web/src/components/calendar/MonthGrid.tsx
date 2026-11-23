import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { addDays, byImportance, isImportant, isWeekend, mondayIndex, monthLabel, monthOf, shiftMonth, WEEK_MON_FIRST, type Ev } from './calUtil'

// 月视图：7 列格子，每格最多 3 条事件标题（来源重要性高的在前），超出显示「+N 个」；窄屏只显示日期和事件数
interface Props {
  month: string
  onMonth: (m: string) => void
  months: string[]            // 窗口内有日期的月份，用于判断上一月、下一月是否可点
  inRange: (d: string) => boolean
  eventsOf: (d: string) => Ev[]
  unlockCount: (d: string) => number
  pageDate?: string
  selected: string
  onSelect: (d: string) => void
}

export function MonthGrid({ month, onMonth, months, inRange, eventsOf, unlockCount, pageDate, selected, onSelect }: Props) {
  const first = `${month}-01`
  const lead = mondayIndex(first)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i - lead))
  const rows = Math.ceil((lead + new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 0)).getUTCDate()) / 7)
  const prev = shiftMonth(month, -1)
  const next = shiftMonth(month, 1)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" disabled={!months.includes(prev)} onClick={() => onMonth(prev)} className="cursor-pointer rounded border px-2.5 py-1 text-xs hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40">上一月</button>
        <strong className="text-sm font-medium">{monthLabel(month)}</strong>
        <button type="button" disabled={!months.includes(next)} onClick={() => onMonth(next)} className="cursor-pointer rounded border px-2.5 py-1 text-xs hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40">下一月</button>
      </div>
      <div className="grid grid-cols-7 gap-px text-center text-[11px] text-ink-3">{WEEK_MON_FIRST.map((w) => <span key={w} className="py-1">{w}</span>)}</div>
      <motion.div key={month} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
        className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-[var(--c-line)]">
        {cells.slice(0, rows * 7).map((d) => {
          const here = monthOf(d) === month
          const ok = here && inRange(d)
          const evs = ok ? [...eventsOf(d)].sort(byImportance) : []
          const unlock = ok ? unlockCount(d) : 0
          const isSel = ok && d === selected
          return (
            !here ? <span key={d} aria-hidden className="bg-card" /> :
            <button key={d} type="button" disabled={!ok} onClick={() => onSelect(d)} aria-pressed={isSel} aria-label={ok ? `${d}，${evs.length} 条事件` : undefined}
              className={cn('relative flex min-h-[64px] flex-col items-stretch gap-0.5 bg-card p-1.5 text-left sm:min-h-[92px]',
                !ok && 'cursor-default bg-background text-ink-3', ok && 'cursor-pointer hover:bg-surface-hover', ok && isWeekend(d) && 'bg-background')}>
              {isSel && <motion.span layoutId="cal-month-sel" className="pointer-events-none absolute inset-0 z-10 border border-primary bg-accent/40" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <span className="relative z-20 flex items-center justify-between">
                <span className={cn('tnum inline-flex size-5 items-center justify-center rounded-full text-xs', d === pageDate ? 'bg-primary text-primary-foreground' : ok && !evs.length ? 'text-ink-3' : '')}>{Number(d.slice(8))}</span>
                {ok && evs.length > 0 && <span className="tnum rounded-full bg-secondary px-1.5 text-[10px] text-ink-2 sm:hidden">{evs.length}</span>}
              </span>
              <span className="relative z-20 hidden min-w-0 flex-col gap-0.5 sm:flex">
                {evs.slice(0, 3).map((e) => (
                  <span key={e.event_id} title={e.title} className={cn('truncate border-l-2 pl-1 text-[11px] leading-snug', isImportant(e) ? 'border-primary text-foreground' : 'border-transparent text-ink-2')}>{e.title || '—'}</span>
                ))}
                {evs.length > 3 && <span className="text-[10px] text-ink-3">+{evs.length - 3} 个</span>}
              </span>
              {unlock > 0 && <span className="relative z-20 mt-auto truncate rounded-[3px] px-1 text-[10px] text-[var(--c-viz-1)] sm:bg-[var(--c-viz-1)]/10" title={`限售股解禁 ${unlock} 只`}>解禁 {unlock} 只</span>}
            </button>
          )
        })}
      </motion.div>
    </div>
  )
}
