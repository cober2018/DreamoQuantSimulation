import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { isWeekend, weekdayOf } from './calUtil'

// 日视图：一排日期按钮，可横向滚动；有事件的日子右上角标事件数，没有事件的灰显但可点
export function DayStrip({ dates, count, pageDate, selected, onSelect }: { dates: string[]; count: (d: string) => number; pageDate?: string; selected: string; onSelect: (d: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  // 选中变化时只滚动这一排，不滚动页面
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!box.current || !el) return
    box.current.scrollTo({ left: el.offsetLeft - box.current.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
  }, [selected])
  return (
    <div ref={box} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2" role="group" aria-label="选择日期">
      {dates.map((d) => {
        const n = count(d)
        const isSel = d === selected
        return (
          <button key={d} type="button" aria-pressed={isSel} onClick={() => onSelect(d)}
            className={cn('relative flex min-w-[56px] shrink-0 cursor-pointer flex-col items-center rounded-md border px-2 py-1.5 text-xs hover:bg-surface-hover', isWeekend(d) && 'bg-background', n === 0 && 'text-ink-3')}>
            {isSel && <motion.span layoutId="cal-day-sel" className="pointer-events-none absolute inset-0 rounded-md border border-primary bg-accent/50" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
            {n > 0 && <span className="tnum absolute -right-1 -top-1 z-10 rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">{n}</span>}
            <span className="relative z-10">{weekdayOf(d).replace('周', '')}</span>
            <strong className={cn('tnum relative z-10 mt-0.5 font-medium', d === pageDate && 'rounded-full bg-primary px-1.5 text-primary-foreground')}>{d.slice(5)}</strong>
          </button>
        )
      })}
    </div>
  )
}
