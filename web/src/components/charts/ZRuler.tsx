import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

// 标准分「常态尺」：一把 −3 到 +3 的尺子，中间一段 ±1 是平常范围，圆点是当日位置，细线是近 60 日的最小到最大。
// 颜色只表示偏离方向和幅度（橙偏高、蓝偏低），不代表好坏，也不用涨跌色。缺值用斜线底纹，不画点，不当 0。
export const zText = (v: number | null | undefined) => (v == null ? '数据待更新' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`)

const HIGH = 'hsl(28 85% 50%)'
const LOW = 'hsl(214 70% 48%)'
const HATCH = 'repeating-linear-gradient(135deg, transparent 0 3px, var(--c-line) 3px 4px)'
const DOMAIN = 3
const pos = (v: number) => `${((Math.max(-DOMAIN, Math.min(DOMAIN, v)) + DOMAIN) / (DOMAIN * 2)) * 100}%`
export const zColor = (v: number) => (v >= 1 ? HIGH : v <= -1 ? LOW : 'var(--c-ink-2)')

export interface RulerRow {
  key: string
  label: string
  value: number | null
  /** 近 60 日范围；历史不足 2 个值时不画 */
  min?: number | null
  max?: number | null
  missingReason?: string | null
}

export function ZRuler({ rows, focus, onFocus }: { rows: RulerRow[]; focus: string | null; onFocus: (key: string | null) => void }) {
  return (
    <div role="group" aria-label="标准分当日位置" onPointerLeave={() => onFocus(null)}>
      <ul className="space-y-0.5">
        {rows.map((r) => {
          const isFocus = focus === r.key
          const over = r.value != null && Math.abs(r.value) > DOMAIN
          return (
            <li key={r.key} onPointerEnter={() => onFocus(r.key)}
              className={cn('flex items-center gap-2 rounded-[3px] px-1.5 py-1.5 text-xs transition-colors', isFocus && 'bg-accent')}>
              <span className="w-[68px] shrink-0 text-ink-2">{r.label}</span>
              <span className="relative h-6 min-w-0 flex-1" title={r.value == null ? r.missingReason || '上游未提供该值' : undefined}>
                <i className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={{ background: r.value == null ? HATCH : 'color-mix(in srgb, var(--c-line) 40%, transparent)' }} />
                <i className="absolute top-1/2 h-1.5 -translate-y-1/2 bg-[var(--c-ink-3)]/20" style={{ left: pos(-1), width: `${(2 / (DOMAIN * 2)) * 100}%` }} />
                {[-2, 2].map((t) => <i key={t} className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 border-l border-dashed border-[var(--c-line-strong)]" style={{ left: pos(t) }} />)}
                <i className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-[var(--c-ink-3)]" style={{ left: pos(0) }} />
                {r.min != null && r.max != null && (
                  <i className="absolute top-[calc(50%-8px)] h-0.5 rounded bg-[var(--c-ink-3)]/60" style={{ left: pos(r.min), width: `calc(${pos(r.max)} - ${pos(r.min)})` }} />
                )}
                {r.value != null && (
                  <motion.i className="absolute top-1/2 -ml-[5px] -mt-[5px] size-2.5 rounded-full ring-2 ring-[var(--c-surface)]" style={{ background: zColor(r.value) }}
                    initial={false} animate={{ left: pos(r.value) }} transition={{ type: 'spring', stiffness: 220, damping: 26 }} />
                )}
                {over && <i className="absolute top-1/2 -mt-[3px] border-y-[3px] border-y-transparent" style={r.value! > 0 ? { right: -6, borderLeft: `5px solid ${HIGH}` } : { left: -6, borderRight: `5px solid ${LOW}` }} />}
              </span>
              <span className={cn('tnum w-[84px] shrink-0 text-right', r.value == null && 'text-[11px] text-ink-3')}>{zText(r.value)}</span>
            </li>
          )
        })}
      </ul>
      <div className="tnum mt-1 flex items-center gap-2 px-1.5 text-[10px] text-ink-3">
        <span className="w-[68px] shrink-0" />
        <span className="relative h-3 min-w-0 flex-1">
          {[-3, -1, 0, 1, 3].map((t) => <span key={t} className="absolute -translate-x-1/2" style={{ left: pos(t) }}>{t > 0 ? `+${t}` : t}</span>)}
        </span>
        <span className="w-[84px] shrink-0" />
      </div>
    </div>
  )
}
