import { useState } from 'react'
import NumberFlow from '@number-flow/react'
import { motion } from 'motion/react'
import DonutChart from '@/components/fx/donut-chart'
import { cn } from '@/lib/utils'
import { TrendSpark } from './TrendSpark'

export interface BreadthRow { trade_date: string; up_count?: number | null; down_count?: number | null; up_ratio?: number | null }
interface Today { up_count?: number | null; down_count?: number | null; up_ratio?: number | null }

// 涨跌家数：环形是上涨占比，两根条是上涨、下跌家数，下面是上涨占比的历史曲线。
// 指针移到曲线上时，环形和家数一起切到那一日。show 对应各指标的权限，被裁掉的不渲染
export function BreadthCard({ today, rows, show, className }: { today: Today; rows: BreadthRow[]; show: (ind: 'up_ratio' | 'up_count' | 'down_count') => boolean; className?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const cur: Today = hover == null ? today : rows[hover] ?? {}
  const total = (cur.up_count || 0) + (cur.down_count || 0)
  const bars = [['up_count', '上涨', cur.up_count, 'bg-up', 'text-up'], ['down_count', '下跌', cur.down_count, 'bg-down', 'text-down']] as const
  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <div className="text-xs tracking-[0.08em] text-accent-ink">涨跌家数</div>
        {hover != null && <span className="tnum rounded-full border border-primary/50 bg-accent px-2 py-px text-[11px]">回看 {rows[hover]?.trade_date}</span>}
      </div>
      <div className="mt-3 flex items-center gap-5">
        {show('up_ratio') && (
          <DonutChart size={100} progress={(cur.up_ratio ?? 0) * 100} circleWidth={10} progressWidth={10} className="relative shrink-0" progressClassName="text-up duration-700 ease-out" trackClassName={cur.up_ratio == null ? 'text-secondary' : 'text-down/25'}>
            <div className="absolute inset-0 grid place-content-center text-center">
              <div className="num-display text-[21px] leading-none">{cur.up_ratio == null ? '—' : <NumberFlow value={cur.up_ratio} format={{ style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }} />}</div>
              <div className="mt-1 text-[11px] text-ink-3">上涨占比</div>
            </div>
          </DonutChart>
        )}
        <div className="min-w-0 flex-1 space-y-3">
          {bars.map(([ind, label, n, bar, text], i) => show(ind) && (
            <div key={ind}>
              <div className="flex items-baseline justify-between text-xs text-ink-3"><span>{label}</span><span className={cn('num-display text-xl', text)}>{n == null ? '—' : <NumberFlow value={n} />}</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                <motion.div className={cn('h-full rounded-full', bar)} initial={{ width: 0 }} animate={{ width: `${total ? ((n || 0) / total) * 100 : 0}%` }} transition={{ duration: hover == null ? 0.9 : 0.25, delay: hover == null ? 0.25 + i * 0.1 : 0, ease: [0.22, 1, 0.36, 1] }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {show('up_ratio') && (rows.length > 1 ? (
        <div className="mt-4">
          <TrendSpark values={rows.map((r) => r.up_ratio)} height={44} color="var(--c-viz-1)" hover={hover} onHover={setHover} delay={0.25} label={`上涨占比近 ${rows.length} 日走势`} />
          <div className="mt-1 text-[11px] text-ink-3">近 {rows.length} 日上涨占比 · 上涨 ÷（上涨 + 下跌）</div>
        </div>
      ) : <div className="mt-4 text-[11px] text-ink-3">上涨占比 = 上涨 ÷（上涨 + 下跌）</div>)}
    </div>
  )
}
