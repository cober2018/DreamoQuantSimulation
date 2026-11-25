import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Panel } from '@/components/shell/Panel'
import { Button } from '@/components/ui/button'
import { getModule } from '@/lib/api'
import { cn } from '@/lib/utils'

// 行业成分股统计：行业全部成分股，逐只列出由当日及以前数据算出的单项数值。
// 默认按股票代码排序；排序交给服务端，页面不做任何打分、名次或挑选，也不对任何一行做突出显示。
// 列的名称、单位、说明都用接口随数据返回的原文，页面不另写。
interface Col { key: string; label?: string | null; unit?: string | null; kind?: string | null; description?: string | null; sortable?: boolean }
type Row = Record<string, any>

const GROUPS: { name: string; keys: string[] }[] = [
  { name: '价格', keys: ['change_pct', 'change_5d_pct'] },
  { name: '行业内位置', keys: ['change_pct_percentile', 'change_5d_pct_percentile', 'days_above_industry_median_5d'] },
  { name: '近 5 日走势', keys: ['path_efficiency_5d', 'max_drawdown_5d_pct', 'top_day_gain_share_5d'] },
  { name: '当日分时', keys: ['intraday_path_efficiency', 'intraday_close_location', 'intraday_late_move_share', 'intraday_max_drawdown_pct'] },
  { name: '开盘', keys: ['open5_change_pct', 'after_open5_change_pct'] },
  { name: '资金', keys: ['large_order_net_5d', 'large_order_net_20d', 'large_order_net_positive_days', 'active_net_amount_ratio_pct'] },
  { name: '形态', keys: ['above_ma20', 'ma20_deviation_pct', 'is_3d_high'] },
]
// 默认显示的 10 列；其余按分组展开
const DEFAULT_KEYS = ['change_pct', 'change_5d_pct', 'change_pct_percentile', 'change_5d_pct_percentile', 'open5_change_pct', 'after_open5_change_pct',
  'large_order_net_5d', 'large_order_net_20d', 'large_order_net_positive_days', 'above_ma20']
// 带涨跌方向的列按红涨绿跌着色（只表示正负，不表示好坏）
const SIGNED = new Set(['change_pct', 'change_5d_pct', 'open5_change_pct', 'after_open5_change_pct', 'ma20_deviation_pct', 'active_net_amount_ratio_pct', 'large_order_net_5d', 'large_order_net_20d'])
const PAGE_SIZE = 50
const PENDING = '数据待更新'
// 这张表里单元格没有数值是口径规定的正常情况（例如窗口内有一天没有记录），统一显示「—」，原因写在各列说明里
const EMPTY = '—'

function cellText(c: Col, v: any): string {
  if (c.kind === 'boolean') return v ? '是' : '否'
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  const sign = SIGNED.has(c.key) && n > 0 ? '+' : ''
  if (c.unit === '%') return `${sign}${n.toFixed(2)}%`
  if (c.unit === '亿元') return `${sign}${n.toFixed(2)}`
  if (c.kind === 'integer') return String(Math.round(n))
  if (c.key.endsWith('_percentile')) return n.toFixed(1)
  return n.toFixed(2)
}

interface Props { code: string; name: string; idxType: string; tradeDate: string; allowed: boolean; lockText: string }

export function IndustryMembers({ code, name, idxType, tradeDate, allowed, lockText }: Props) {
  const [sortBy, setSortBy] = useState('stock_code')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<string[]>([])
  useEffect(() => { setPage(0) }, [code, idxType, tradeDate, sortBy, sortOrder])
  useEffect(() => { setSortBy('stock_code'); setSortOrder('asc') }, [code, idxType])

  const q = useQuery({
    queryKey: ['industry-members', tradeDate, idxType, code, sortBy, sortOrder, page],
    enabled: allowed && !!code && !!tradeDate, placeholderData: keepPreviousData, staleTime: 5 * 60_000,
    queryFn: () => getModule(`industries/${encodeURIComponent(code)}/members`, { trade_date: tradeDate, idx_type: idxType, sort_by: sortBy, sort_order: sortOrder, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) }),
  })
  const env = q.data
  const d = env?.data
  const cols: Col[] = ((d?.columns || []) as Col[]).filter((c) => c.label)
  const colOf = (key: string) => cols.find((c) => c.key === key)
  const rows: Row[] = d?.items || []
  const total: number = d?.pagination?.total ?? rows.length
  // 资金类数据的覆盖情况：接口没给（中台旧版本）时不显示
  const cov = d?.large_order_coverage as { with_daily_record?: number | null; with_5d_value?: number | null; member_count?: number | null } | null | undefined
  const covText = cov && cov.member_count != null && cov.with_daily_record != null
    ? `资金类数据：${cov.member_count} 只成分股中 ${cov.with_daily_record} 只有当日记录${cov.with_5d_value != null ? `，${cov.with_5d_value} 只有近 5 日累计` : ''}。`
    : null
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const allOpen = open.length === GROUPS.length
  const shownGroups = GROUPS.map((g) => ({ ...g, cols: g.keys.filter((k) => open.includes(g.name) || DEFAULT_KEYS.includes(k)).map(colOf).filter((c): c is Col => !!c) })).filter((g) => g.cols.length > 0)
  const shown = shownGroups.flatMap((g) => g.cols)
  const toggleGroup = (g: string) => setOpen((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]))
  const sort = (key: string) => {
    if (sortBy === key) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(key); setSortOrder(key === 'stock_code' ? 'asc' : 'desc') }
  }
  const arrow = (key: string) => (sortBy === key ? (sortOrder === 'desc' ? ' ↓' : ' ↑') : '')
  const ariaSort = (key: string) => (sortBy === key ? (sortOrder === 'desc' ? 'descending' : 'ascending') : 'none')

  const title = <>{name} 成分股统计{d && <small className="ml-2 text-xs font-normal text-ink-3">共 {total} 只{d.member_count != null && d.member_count !== total ? `（成分股 ${d.member_count} 只）` : ''} · 数据日 {env?.trade_date}</small>}</>
  return (
    <Panel title={title} hint="这个板块全部成分股的逐只历史统计。默认按股票代码排列，点列头可按任意一列排序">
      {!allowed ? <div className="rounded-md border border-dashed px-4 py-3 text-sm text-ink-3">成分股统计需要 {lockText}。</div>
        : q.isPending ? <p className="text-sm text-ink-3">加载中…</p>
        : !rows.length || !cols.length ? <p className="text-sm text-ink-3">成分股统计：{PENDING}。</p>
        : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="选择显示哪些分组的全部列">
              <span className="mr-1 text-ink-3">展开分组的全部列</span>
              {GROUPS.map((g) => (
                <button key={g.name} type="button" aria-pressed={open.includes(g.name)} onClick={() => toggleGroup(g.name)}
                  className={cn('cursor-pointer rounded-full border px-2.5 py-1', open.includes(g.name) ? 'border-primary bg-accent text-foreground' : 'text-ink-2 hover:bg-surface-hover')}>{g.name} <span className="tnum text-ink-3">{g.keys.length}</span></button>
              ))}
              <button type="button" onClick={() => setOpen(allOpen ? [] : GROUPS.map((g) => g.name))} className="cursor-pointer px-1.5 py-1 text-primary hover:underline">{allOpen ? '只看常用列' : '显示全部列'}</button>
            </div>
            <div className="-mx-2 overflow-x-auto" tabIndex={0} role="region" aria-label={`${name} 成分股统计表，可横向滚动`}>
              <table className={cn('w-full text-sm', q.isPlaceholderData && 'opacity-60')} style={{ minWidth: 260 + shown.length * 104 }}>
                <thead>
                  <tr className="text-[11px] text-ink-3">
                    <th colSpan={2} />
                    {shownGroups.map((g) => <th key={g.name} colSpan={g.cols.length} scope="colgroup" className="border-b border-l px-2 pb-1 pt-0 text-center font-normal">{g.name}</th>)}
                  </tr>
                  <tr className="border-b border-[var(--c-line-strong)] align-bottom text-xs text-ink-3">
                    <th scope="col" aria-sort={ariaSort('stock_code')} className="px-2 py-2 text-left font-normal"><button type="button" onClick={() => sort('stock_code')} className={cn('cursor-pointer whitespace-nowrap hover:text-foreground', sortBy === 'stock_code' && 'text-foreground')}>{colOf('stock_code')?.label || '代码'}{arrow('stock_code')}</button></th>
                    <th scope="col" className="px-2 py-2 text-left font-normal whitespace-nowrap">{colOf('stock_name')?.label || '名称'}</th>
                    {shown.map((c) => (
                      <th key={c.key} scope="col" aria-sort={ariaSort(c.key)} title={c.description || undefined} className="max-w-[112px] px-2 py-2 text-right font-normal">
                        <button type="button" onClick={() => sort(c.key)} className={cn('cursor-pointer text-right leading-snug hover:text-foreground', sortBy === c.key && 'text-foreground')}>{c.label}{c.unit && c.unit !== '%' ? `（${c.unit}）` : ''}{arrow(c.key)}</button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.stock_code} className="border-b last:border-0 transition-colors hover:bg-surface-hover">
                      <td className="tnum px-2 py-2 whitespace-nowrap text-ink-2">{r.stock_code}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{r.stock_name || <span className="text-ink-3">{EMPTY}</span>}</td>
                      {shown.map((c) => {
                        const v = r[c.key]
                        if (v == null) return <td key={c.key} className="px-2 text-right text-ink-3">{EMPTY}</td>
                        const tone = SIGNED.has(c.key) ? (v > 0 ? 'text-up' : v < 0 ? 'text-down' : '') : ''
                        return <td key={c.key} className={cn('tnum px-2 text-right whitespace-nowrap', tone)}>{cellText(c, v)}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="mt-3 flex items-center gap-3 text-sm">
                <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>上一页</Button>
                <span className="text-ink-3">第 {page + 1} / {pages} 页</span>
                <Button type="button" variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>下一页</Button>
              </div>
            )}
            <details className="mt-3 text-xs text-ink-3">
              <summary className="cursor-pointer text-primary">各列是怎么算的（当前显示的 {shown.length} 列）</summary>
              <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 lg:grid-cols-2">
                {shown.map((c) => <div key={c.key}><dt className="font-medium text-ink-2">{c.label}{c.unit ? `（${c.unit}）` : ''}</dt><dd className="mt-0.5 leading-relaxed">{c.description || '—'}</dd></div>)}
              </dl>
            </details>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
              「{EMPTY}」表示该项在数据日没有可用数值，原因见各列说明。把指针停在列头上可以看这一列的算法。
              {covText}
              资金分组里的超大单、大单是东方财富按单笔成交金额划分的口径，分档由第三方决定，不代表真实账户身份。红绿只表示数值的正负。
              按某一列排序时，没有数值的行排在最后。
            </p>
            <p className="mt-1 text-[11px] text-ink-3">{d?.note || '以上为历史数据统计，不构成投资建议。'}</p>
          </>
        )}
    </Panel>
  )
}
