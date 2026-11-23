import { useState } from 'react'
import { Panel } from '@/components/shell/Panel'
import { DayChip } from './DayChip'
import { TrendTile } from './TrendTile'

export interface LimitRow { trade_date: string; limit_up_count?: number | null; broken_board_count?: number | null; limit_down_count?: number | null; broken_board_rate?: number | null }

// 只有带方向的数着色（涨停红、跌停绿）；炸板数和炸板率不代表好坏，用墨色
const METRICS = [
  { key: 'limit_up_count', label: '涨停数', unit: '只', color: 'var(--c-up)', tone: 'up', pct: false },
  { key: 'limit_down_count', label: '跌停数', unit: '只', color: 'var(--c-down)', tone: 'down', pct: false },
  { key: 'broken_board_count', label: '炸板数', unit: '只', color: 'var(--c-viz-1)', tone: undefined, pct: false },
  { key: 'broken_board_rate', label: '炸板率', unit: '', color: 'var(--c-viz-3)', tone: undefined, pct: true },
] as const

// 涨停、跌停、炸板的当日值和近 20 日曲线。四条曲线共用一个指针位置：移到任意一条上，四个数字同时切到那一日
export function LimitPanel({ rows, className }: { rows: LimitRow[]; className?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const at = hover ?? rows.length - 1
  const row = rows[at], prev = rows[at - 1]
  return (
    <Panel title="涨跌停与炸板" hint="极端涨跌个股有多少" className={className} action={<DayChip hover={hover} date={row?.trade_date} />}>
      <div className="grid grid-cols-2 gap-3">
        {METRICS.map((m, i) => {
          const v = row?.[m.key], p = prev?.[m.key]
          const diff = v != null && p != null ? v - p : null
          return (
            <TrendTile key={m.key} label={m.label} unit={m.unit} value={v} tone={m.tone} color={m.color} delay={0.3 + i * 0.08}
              format={m.pct ? { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 } : undefined}
              sub={diff == null ? '' : `较前一日 ${diff > 0 ? '+' : ''}${m.pct ? `${(diff * 100).toFixed(1)} 个百分点` : diff}`}
              series={rows.map((r) => r[m.key])} hover={hover} onHover={setHover} />
          )
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-3">近 {rows.length} 日曲线，移到曲线上可回看任意一日。炸板率 = 炸板数 ÷（涨停数 + 炸板数）。</p>
    </Panel>
  )
}
