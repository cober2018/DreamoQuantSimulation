import { useState } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

// 梯队看板（涨停、跌停共用）：最高档在上、首档在下；每档一行 = 档名、家数、短条、个股名称标签。
// 名称取自接口 stocks[]；接口没给名单时只显示家数和短条。档名、连续天数都以接口为准，前端不推算。
export interface TierStock { stock_code?: string; stock_name?: string; pct_chg_pct?: number | null; first_seal_time?: string | null }
export interface Tier { tier: string; count: number | null; stocks?: TierStock[] | null }

const FOLD = 12

const stockTip = (s: TierStock) => [s.stock_code, s.pct_chg_pct == null ? null : `${s.pct_chg_pct > 0 ? '+' : ''}${s.pct_chg_pct.toFixed(2)}%`, s.first_seal_time ? `首封 ${s.first_seal_time}` : null].filter(Boolean).join(' · ')

export function TierBoard({ tiers, kind, keyword, label }: { tiers: Tier[]; kind: 'up' | 'down'; keyword: string; label: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const rows = [...tiers].reverse() // 接口按首档到最高档给出，这里最高档在上
  const max = Math.max(...rows.map((r) => r.count ?? 0), 1)
  const kw = keyword.trim()
  const color = kind === 'up' ? 'var(--c-up)' : 'var(--c-down)'
  return (
    <ul className="space-y-3" role="group" aria-label={label}>
      {rows.map((r, i) => {
        const fromBottom = rows.length - 1 - i
        const alpha = rows.length > 1 ? 0.45 + 0.55 * (1 - fromBottom / (rows.length - 1)) : 1
        const stocks = r.stocks ?? []
        const expanded = !!open[r.tier]
        const shown = expanded ? stocks : stocks.slice(0, FOLD)
        const truncated = r.count != null && stocks.length > 0 && r.count > stocks.length
        return (
          <li key={r.tier} className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
            <div className="flex shrink-0 items-center gap-3 sm:w-[288px]">
              <span className="w-[88px] shrink-0 text-xs text-ink-2">{r.tier}</span>
              <span className="num-display w-10 shrink-0 text-right text-base">{r.count ?? '—'}</span>
              <span className="relative h-4 w-[120px] max-w-full min-w-0 flex-1 sm:flex-none">
                <motion.i className="absolute inset-y-0 left-0 rounded-[2px]" style={{ background: color, opacity: alpha }}
                  initial={{ width: 0 }} animate={{ width: `${((r.count ?? 0) / max) * 100}%` }} transition={{ duration: 0.6, delay: 0.1 + fromBottom * 0.09, ease: [0.22, 1, 0.36, 1] }} />
              </span>
            </div>
            {stocks.length > 0 && (
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5">
                  {shown.map((s, k) => {
                    const hit = !!kw && !!s.stock_name?.includes(kw)
                    return (
                      <span key={`${s.stock_code ?? s.stock_name}-${k}`} title={stockTip(s)}
                        className={cn('rounded border px-1.5 py-0.5 text-xs leading-none transition-opacity', hit ? 'border-primary bg-accent font-medium' : 'bg-background/60', kw && !hit && 'opacity-45')}>
                        {s.stock_name || s.stock_code || '—'}
                      </span>
                    )
                  })}
                  {stocks.length > FOLD && (
                    <button type="button" onClick={() => setOpen((o) => ({ ...o, [r.tier]: !expanded }))} className="cursor-pointer rounded px-1.5 py-0.5 text-xs text-primary hover:underline">
                      {expanded ? '收起' : `展开全部 ${stocks.length} 只`}
                    </button>
                  )}
                </div>
                {truncated && <p className="mt-1 text-[11px] text-ink-3">共 {r.count} 只，名单仅列出前 {stocks.length} 只。</p>}
              </div>
            )}
          </li>
        )
      })}
      <li className="text-right text-[11px] text-ink-3">单位：只</li>
    </ul>
  )
}
