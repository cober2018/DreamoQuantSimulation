import { useState } from 'react'
import { Panel } from '@/components/shell/Panel'
import { RankBars } from '@/components/charts/RankBars'
import { fmt } from '@/lib/api'

type Item = Record<string, any>

// 一个解禁日的卡片：三项事实加前 5 只个股。只列事实，不代表对股价的判断
export function UnlockCard({ u, defaultOpen }: { u: Item; defaultOpen?: boolean }) {
  return (
                <details open={defaultOpen} className="group rounded-md border bg-background/50 px-3 py-2.5">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <strong className="font-medium">{u.display_title || '限售股解禁'}</strong>
                    <span className="rounded-full border px-2 py-px text-xs text-ink-2">{u.publication_status_label || '—'}</span>
                    <span className="tnum ml-auto text-xs text-ink-3">{u.event_date}</span>
                  </summary>
                  <dl className="my-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                    <div><dt className="text-xs text-ink-3">解禁股票</dt><dd className="tnum mt-0.5">{fmt.num(u.stock_count, 0)} 只</dd></div>
                    <div><dt className="text-xs text-ink-3">解禁股数</dt><dd className="tnum mt-0.5">{u.total_float_shares == null ? '—' : `${fmt.num(u.total_float_shares / 10000, 2)} 万股`}</dd></div>
                    <div><dt className="text-xs text-ink-3">参考市值</dt><dd className="tnum mt-0.5">{u.total_float_value_ref == null ? '—' : `${fmt.num(u.total_float_value_ref / 1e8, 2)} 亿元`}<span className="ml-1.5 text-[11px] text-ink-3">按 {u.ref_close_date || '—'} 收盘价估算</span></dd></div>
                  </dl>
                  {(u.top_stocks || []).length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] text-xs">
                        <thead><tr className="border-b text-ink-3"><th className="py-1.5 text-left font-normal">代码</th><th className="text-left font-normal">名称</th><th className="text-right font-normal">解禁股数（万股）</th><th className="text-right font-normal">占总股本（%）</th><th className="text-right font-normal">参考市值（亿元）</th></tr></thead>
                        <tbody>
                          {u.top_stocks.slice(0, 5).map((s: Item) => (
                            <tr key={s.stock_code} className="border-b last:border-0">
                              <td className="tnum py-1.5">{s.stock_code}</td><td>{s.stock_name}</td>
                              <td className="tnum text-right">{s.float_shares == null ? '—' : fmt.num(s.float_shares / 10000, 2)}</td>
                              <td className="tnum text-right">{s.float_ratio_pct == null ? '—' : fmt.num(s.float_ratio_pct, 2)}</td>
                              <td className="tnum text-right">{s.float_value_ref == null ? '—' : fmt.num(s.float_value_ref / 1e8, 2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-ink-3">只列事实：解禁日期、股数、占比和估算市值。不代表对股价的判断。</p>
                </details>
  )
}

// 限售股解禁：顶部按解禁日画参考市值，下面是可展开的卡片。只列事实：解禁日期、股数、占比和估算市值，不代表对股价的判断
const FOLD = 6
export function ShareUnlock({ unlocks, label, selectedDate, fromDate, onPickDate }: { unlocks: Item[] | null; label?: string; selectedDate?: string; fromDate?: string; onPickDate?: (date: string) => void }) {
  const [open, setOpen] = useState(false)
  // 卡片默认只列数据日及之后最近的几个解禁日，其余（含已过去的）展开后看；上方的图始终画全部日期
  const upcoming = (unlocks || []).filter((u) => !fromDate || String(u.event_date) >= fromDate)
  const cards = open ? unlocks || [] : upcoming.slice(0, FOLD)
  const withValue = (unlocks || []).filter((u) => u.total_float_value_ref != null)
  const bars = withValue.map((u) => ({ name: String(u.event_date).slice(5), value: u.total_float_value_ref / 1e8 }))
  return (
    <Panel title="限售股解禁" hint="按解禁日汇总，参考市值为估算值">
      {unlocks === null ? <p className="text-sm text-ink-3">限售股解禁数据暂缺，稍后再试。</p>
        : !unlocks.length ? <p className="text-sm text-ink-3">所选窗口内暂无限售股解禁。</p>
        : (
          <>
            {label && <p className="mb-3 text-[11px] leading-relaxed text-ink-3">{label}</p>}
            <div className="grid grid-cols-1 items-start gap-x-6 gap-y-4 lg:grid-cols-2">
              {bars.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] text-ink-3">各解禁日参考市值（亿元），点一行查看当天的宏观事件和解禁明细</div>
                  <RankBars rows={bars} color="var(--c-viz-1)" format={(v) => fmt.num(v, 1)} label="各解禁日参考市值"
                    onSelect={onPickDate ? (i) => onPickDate(String(withValue[i].event_date)) : undefined} selectedIndex={selectedDate ? withValue.findIndex((u) => u.event_date === selectedDate) : null} />
                </div>
              )}
              <div>
                <div className="mb-2 text-[11px] text-ink-3">{open ? `全部 ${cards.length} 个解禁日` : `${fromDate || '数据日'} 起最近 ${cards.length} 个解禁日`}，点开看个股</div>
                <div className="space-y-2">
                  {cards.map((u) => <UnlockCard key={u.event_date + u.display_title} u={u} />)}
                  {!cards.length && <p className="text-sm text-ink-3">数据日之后暂无限售股解禁。</p>}
                </div>
                {(unlocks.length > cards.length || open) && (
                  <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2 cursor-pointer text-xs text-primary hover:underline">{open ? '收起' : `展开全部 ${unlocks.length} 个解禁日`}</button>
                )}
              </div>
            </div>
          </>
        )}
    </Panel>
  )
}
