import { motion } from 'motion/react'

// 单向横条排行：名称、条、数值，可选右侧小标签（例如该题材的最高连板）
export interface RankRow { name: string; value: number; tag?: string | null }

export function RankBars({ rows, color = 'var(--c-up)', format = (v) => String(v), label = '排行', onSelect, selectedIndex }: { rows: RankRow[]; color?: string; format?: (v: number) => string; label?: string; onSelect?: (index: number) => void; selectedIndex?: number | null }) {
  const max = Math.max(...rows.map((r) => r.value), 1e-9)
  return (
    <ul className="space-y-1.5" role={onSelect ? 'group' : 'img'} aria-label={label}>
      {rows.map((r, i) => (
        <li key={`${r.name}-${i}`} className={`flex items-center gap-2 rounded-[3px] text-xs ${onSelect ? 'cursor-pointer hover:bg-surface-hover' : ''} ${selectedIndex === i ? 'bg-accent' : ''}`}
          role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} aria-pressed={onSelect ? selectedIndex === i : undefined}
          onClick={onSelect ? () => onSelect(i) : undefined} onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i) } } : undefined}>
          <span className="w-[88px] shrink-0 truncate text-ink-2" title={r.name}>{r.name}</span>
          <span className="relative h-4 min-w-0 flex-1">
            <motion.i className="absolute inset-y-0.5 left-0 rounded-[2px]" style={{ background: color, opacity: 0.85 }}
              initial={{ width: 0 }} animate={{ width: `${(r.value / max) * 100}%` }} transition={{ duration: 0.6, delay: Math.min(i * 0.025, 0.4), ease: [0.22, 1, 0.36, 1] }} />
          </span>
          <span className="tnum w-10 shrink-0 text-right">{format(r.value)}</span>
          {r.tag !== undefined && <span className="w-12 shrink-0 text-[11px] text-ink-3">{r.tag || ''}</span>}
        </li>
      ))}
    </ul>
  )
}
