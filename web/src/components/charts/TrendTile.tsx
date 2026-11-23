import NumberFlow from '@number-flow/react'
import { cn } from '@/lib/utils'
import { TrendSpark } from './TrendSpark'

// 「标签 + 大数字 + 较前一日 + 历史曲线」的标准格子。
// 同一面板里的多个格子共用 hover，移到任意一条曲线上，所有格子一起回看同一日（hover 和 onHover 由外层持有）。
// 红涨绿跌只用于带方向的数（tone），占比、分位、标准分不传 tone。
interface Props {
  label: string
  value?: number | null
  /** NumberFlow 的数字格式；传 text 时不用 */
  format?: Parameters<typeof NumberFlow>[0]['format']
  /** 自定义文本（例如「3 板」），优先于 value */
  text?: string
  unit?: string
  tone?: 'up' | 'down'
  sub?: string
  series?: (number | null | undefined)[]
  color?: string
  hover?: number | null
  onHover?: (i: number | null) => void
  muted?: boolean
  delay?: number
  className?: string
}

export function TrendTile({ label, value, format, text, unit, tone, sub, series, color = 'var(--c-viz-1)', hover = null, onHover, muted, delay = 0.3, className }: Props) {
  const toneClass = tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : ''
  return (
    <div className={cn('rounded-md border bg-background/50 p-3', className)}>
      <div className="flex items-baseline justify-between text-xs text-ink-3"><span>{label}</span>{unit && <span>{unit}</span>}</div>
      <div className={cn('num-display mt-1 text-[26px] leading-none', toneClass, muted && 'text-ink-3')}>
        {text != null ? text : value == null ? '—' : <NumberFlow value={value} format={format} />}
      </div>
      <div className="tnum mt-1 min-h-4 text-[11px] text-ink-3">{sub}</div>
      {series && series.length > 1 && (
        <div className="mt-1">
          <TrendSpark values={series} height={44} color={color} hover={hover} onHover={onHover} delay={delay} label={`${label}近 ${series.length} 日走势`} />
        </div>
      )}
    </div>
  )
}
