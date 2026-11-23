import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

// 哑铃图：每行一条 0–100% 的轨道，两个点加一条连线；任一值为空则该行不画点
export interface DumbbellRow { name: string; a: number | null; b: number | null; di: number | null; code?: string; pinned?: boolean }

const A = 'var(--c-viz-3)'
const B = 'var(--c-viz-2)'
const TICKS = [0, 25, 50, 75, 100]

export function Dumbbell({ rows, aLabel = '站上 20 日线占比', bLabel = '20 日新高占比', selected, onSelect }: { rows: DumbbellRow[]; aLabel?: string; bLabel?: string; selected?: string; onSelect?: (code: string) => void }) {
  const pct = (v: number) => `${Math.max(0, Math.min(1, v)) * 100}%`
  return (
    <div role="group" aria-label="扩散度哑铃图">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5"><i className="inline-block size-2 rounded-full" style={{ background: A }} />{aLabel}</span>
        <span className="flex items-center gap-1.5"><i className="inline-block size-2 rounded-full" style={{ background: B }} />{bLabel}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-ink-3">
        <span className="w-[88px] shrink-0" />
        <span className="relative h-3 min-w-0 flex-1">{TICKS.map((t) => <span key={t} className="tnum absolute -translate-x-1/2" style={{ left: `${t}%` }}>{t}%</span>)}</span>
        <span className="w-12 shrink-0 text-right">扩散度</span>
      </div>
      <ul className="mt-1 space-y-1">
        {rows.map((r, i) => {
          const both = r.a != null && r.b != null
          const isSel = !!r.code && r.code === selected
          const interactive = !!r.code && !!onSelect
          return (
            <li key={`${r.code ?? r.name}-${i}`} className={cn(r.pinned && !rows[i - 1]?.pinned && 'mt-2 border-t border-dashed pt-2')}>
              <div
                role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} aria-pressed={interactive ? isSel : undefined}
                onClick={interactive ? () => onSelect!(r.code!) : undefined}
                onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect!(r.code!) } } : undefined}
                className={cn('flex items-center gap-2 rounded-[3px] px-1 text-xs transition-opacity', interactive && 'cursor-pointer outline-offset-1 hover:bg-surface-hover', isSel && 'bg-accent', !!selected && !isSel && 'opacity-40')}>
                <span className={cn('w-[88px] shrink-0 truncate text-ink-2', isSel && 'font-semibold text-foreground')} title={r.name}>{r.pinned && <em className="mr-1 text-[10px] not-italic text-primary">已选</em>}{r.name}</span>
                <span className="relative h-5 min-w-0 flex-1">
                  {TICKS.map((t) => <i key={t} className="absolute inset-y-0 w-px bg-[var(--c-line)]" style={{ left: `${t}%`, opacity: t === 0 || t === 100 ? 0.9 : 0.45 }} />)}
                  {both && (
                    <>
                      <motion.i className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded bg-[var(--c-line-strong)]" style={{ left: pct(Math.min(r.a!, r.b!)) }}
                        initial={{ width: 0 }} animate={{ width: `${Math.abs(r.a! - r.b!) * 100}%` }} transition={{ duration: 0.5, delay: Math.min(i * 0.015, 0.4) }} />
                      <i className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: pct(r.a!), background: A }} />
                      <i className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: pct(r.b!), background: B }} />
                    </>
                  )}
                  {!both && <span className="absolute inset-0 flex items-center text-[11px] text-ink-3">数据待更新</span>}
                </span>
                <span className="tnum w-12 shrink-0 text-right">{r.di == null ? '—' : r.di.toFixed(3)}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
