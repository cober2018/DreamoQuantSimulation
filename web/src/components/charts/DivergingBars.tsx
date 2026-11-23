import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

// 左右对开的横条：正值向右（红），负值向左（绿），中间一条竖线。条长按本组绝对值最大者归一
// code / selected / onSelect：行业联动。value 为 null 的行（选中行业本项数据为空）显示「数据待更新」；pinned 的行排在分隔线之后，标「已选」
export interface BarRow { name: string; value: number | null; code?: string; pinned?: boolean }

export function DivergingBars({ rows, unit = '亿元', digits = 1, selected, onSelect }: { rows: BarRow[]; unit?: string; digits?: number; selected?: string; onSelect?: (code: string) => void }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value ?? 0)), 1e-9)
  const fmt = (v: number) => v.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const dimOthers = !!selected
  return (
    <div role="group" aria-label={`净流入排行，单位${unit}`}>
      <ul className="space-y-1">
        {rows.map((r, i) => {
          const w = (Math.abs(r.value ?? 0) / max) * 50
          const up = (r.value ?? 0) >= 0
          const isSel = !!r.code && r.code === selected
          const interactive = !!r.code && !!onSelect
          return (
            <li key={`${r.code ?? r.name}-${i}`} className={cn(r.pinned && !rows[i - 1]?.pinned && 'mt-2 border-t border-dashed pt-2')}>
              <div
                role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} aria-pressed={interactive ? isSel : undefined}
                onClick={interactive ? () => onSelect!(r.code!) : undefined}
                onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect!(r.code!) } } : undefined}
                className={cn('flex items-center gap-2 rounded-[3px] px-1 py-0.5 text-xs transition-opacity', interactive && 'cursor-pointer outline-offset-1 hover:bg-surface-hover', isSel && 'bg-accent', dimOthers && !isSel && 'opacity-40')}>
                <span className={cn('w-[88px] shrink-0 truncate text-ink-2', isSel && 'font-semibold text-foreground')} title={r.name}>{r.pinned && <em className="mr-1 text-[10px] not-italic text-primary">已选</em>}{r.name}</span>
                <span className="relative h-4 min-w-0 flex-1">
                  <i className="absolute inset-y-0 left-1/2 w-px bg-[var(--c-line-strong)]" />
                  {r.value != null && (
                    <motion.i className="absolute top-0.5 bottom-0.5 rounded-[2px]" style={{ [up ? 'left' : 'right']: '50%', background: up ? 'var(--c-up)' : 'var(--c-down)', opacity: 0.85 }}
                      initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.6, delay: Math.min(i * 0.02, 0.4), ease: [0.22, 1, 0.36, 1] }} />
                  )}
                </span>
                {r.value == null
                  ? <span className="w-14 shrink-0 text-right text-[11px] text-ink-3">数据待更新</span>
                  : <span className={`tnum w-14 shrink-0 text-right ${up ? 'text-up' : 'text-down'}`}>{fmt(r.value)}</span>}
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-2 text-right text-[11px] text-ink-3">单位：{unit}</div>
    </div>
  )
}
