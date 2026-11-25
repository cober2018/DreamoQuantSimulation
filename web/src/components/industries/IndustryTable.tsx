import { useEffect, useMemo, useRef, useState } from 'react'
import { useInView } from 'motion/react'
import {
  createPaginatedRowModel, createSortedRowModel, rowPaginationFeature, rowSortingFeature, sortFn_basic, tableFeatures, useTable,
  type ColumnDef, type PaginationState, type SortingState,
} from '@tanstack/react-table'
import { Panel } from '@/components/shell/Panel'
import { Sparkline } from '@/components/charts/Sparkline'
import { Button } from '@/components/ui/button'
import { fmt } from '@/lib/api'
import { cellPending } from '@/lib/industryPending'
import { useIndustrySeries } from '@/lib/industrySeries'
import { cn } from '@/lib/utils'

const features = tableFeatures({
  rowSortingFeature, rowPaginationFeature,
  sortedRowModel: createSortedRowModel(), paginatedRowModel: createPaginatedRowModel(),
  sortFns: { basic: sortFn_basic },
})
type Row = Record<string, any>

// bar：在数字后加一根单元格内细条，按本页最大值归一
const COLS = [
  { key: 'sector_return', label: '涨跌幅', f: (v: number) => fmt.pct(v), signed: true },
  { key: 'sector_return_5d', label: '5日', f: (v: number) => fmt.pct(v), signed: true },
  { key: 'sector_return_20d', label: '20日', f: (v: number) => fmt.pct(v), signed: true },
  { key: 'amount', label: '成交额', f: (v: number) => fmt.num(v, 1), bar: true },
  { key: 'turnover_rate', label: '换手率%', f: (v: number) => fmt.num(v) },
  { key: 'up_stock_ratio', label: '上涨成分占比', f: (v: number) => fmt.ratio(v), bar: true },
  { key: 'above_ma20_ratio', label: '站上MA20占比', f: (v: number) => fmt.ratio(v) },
  { key: 'new_high_20d_ratio', label: '20日新高占比', f: (v: number) => fmt.ratio(v) },
  { key: 'di', label: '扩散度', f: (v: number) => fmt.num(v, 3) },
  { key: 'amount_ratio_ma20', label: '量比MA20', f: (v: number) => fmt.num(v) },
  { key: 'net_flow_1d', label: '净流入1日', f: (v: number) => fmt.num(v), signed: true },
  { key: 'net_flow_5d', label: '净流入5日', f: (v: number) => fmt.num(v), signed: true },
  { key: 'net_flow_20d', label: '净流入20日', f: (v: number) => fmt.num(v), signed: true },
]
const PAGE_SIZE = 50

// 待更新与 null 统一显示「数据待更新」，不显示 0 或 -0
// 上游 field_status：更正中（06-01 前成交额、接缝期的量比与拥挤分位）；真缺数「数据待更新」；说明不可用单独标注
const CORRECTING = ['amount_pre_correction', 'insufficient_lookback']
// 上游字段名与页面字段名不同的别名（净流入：上游 net_inflow_*，页面 net_flow_*）
const STATUS_ALIAS: Record<string, string[]> = { net_flow_1d: ['net_inflow_1d'], net_flow_5d: ['net_inflow_5d'], net_flow_20d: ['net_inflow_20d'] }
const statusText = (key: string, r: Row): string | null => {
  const st = [key, ...(STATUS_ALIAS[key] || [])].map((k) => r.field_status?.[k]).find(Boolean)
  if (st && CORRECTING.includes(st)) return '更正中'
  if (st === 'explanation_unavailable') return '说明暂不可用'
  if (st === 'unavailable') return '数据待更新'
  return null
}

// 近 20 日累计涨跌的迷你线：进入视口才取数；累计涨跌幅自窗口首日起算，缺值日不计入累计，不当作 0
function SparkCell({ code, name, endDate, canDetail }: { code: string; name: string; endDate: string; canDetail: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const seen = useInView(ref, { once: true, margin: '160px' })
  const q = useIndustrySeries(code, endDate, canDetail && seen, 20)
  const vals = useMemo(() => {
    let cum = 1
    return ((q.data?.data?.points || []) as any[]).map((p) => { if (p.sector_return != null) cum *= 1 + p.sector_return; return cum - 1 })
  }, [q.data])
  return (
    <span ref={ref} className="inline-flex h-7 w-24 items-center justify-center">
      {vals.length >= 2 ? <Sparkline values={vals} width={96} height={28} label={`${name} 近 ${vals.length} 日累计涨跌幅`} />
        : !canDetail ? <span className="text-xs text-ink-3">需更高等级</span>
        // 迷你线逐行取数：取到之前显示加载中的细条，取完仍不足 2 个点才写「数据待更新」，两种情况不混在一起
        : q.isSuccess ? <span className="text-xs text-ink-3">数据待更新</span>
        : <span role="status" aria-label="加载中" className="h-0.5 w-16 animate-pulse rounded bg-[var(--c-line-strong)]" />}
    </span>
  )
}

interface Props { title?: string; note?: React.ReactNode; items: Row[]; keyword: string; day: string; endDate: string; canDetail: boolean; lockText: string; selected: string; onSelect: (code: string) => void }

export function IndustryTable({ title = '全行业表', note, items, keyword, day, endDate, canDetail, lockText, selected, onSelect }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'sector_return', desc: true }])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE })
  const kw = keyword.trim()
  const data = useMemo(() => (kw ? items.filter((r) => r.sector_name?.includes(kw) || r.sector_code?.includes(kw)) : items), [items, kw])
  useEffect(() => { setPagination((p) => ({ ...p, pageIndex: 0 })) }, [items, kw])

  const maxOf = useMemo(() => Object.fromEntries(COLS.filter((c) => c.bar).map((c) => [c.key, Math.max(...items.map((r) => (cellPending(c.key, r, day) ? 0 : Number(r[c.key]) || 0)), 1e-9)])), [items, day])
  const columns = useMemo<ColumnDef<typeof features, Row>[]>(() => COLS.map((c) => ({
    id: c.key,
    header: c.label,
    // 待更新的值按 undefined 处理，排序时始终排在最后
    accessorFn: (r: Row) => (cellPending(c.key, r, day) ? undefined : r[c.key] + 0),
    sortFn: 'basic',
    sortUndefined: 'last',
    cell: ({ row }) => {
      const r = row.original
      const st = statusText(c.key, r)
      const pending = !st && cellPending(c.key, r, day)
      if (st || pending) return <span className="text-ink-3">{st || '数据待更新'}</span>
      const v = r[c.key] + 0
      const tone = c.signed ? fmt.dir(r[c.key]) : ''
      return (
        <span className={cn('inline-flex items-center justify-end gap-2', tone === 'rise' && 'text-up', tone === 'fall' && 'text-down')}>
          {c.f(v)}
          {c.bar && <i className="inline-block h-1 w-12 shrink-0 overflow-hidden rounded-full bg-secondary"><i className="block h-full rounded-full bg-[var(--c-viz-5)]" style={{ width: `${Math.min(Math.max(v / maxOf[c.key], 0), 1) * 100}%` }} /></i>}
        </span>
      )
    },
  })), [day, maxOf])

  const table = useTable({
    features, columns, data, getRowId: (r) => r.sector_code,
    state: { sorting, pagination }, onSortingChange: setSorting, onPaginationChange: setPagination,
  })
  const rows = table.getRowModel().rows
  // 从图上选中行业时，表格翻到它所在的页（不滚动页面）；在表里点本页的行，页码不变
  const preRows = table.getPrePaginatedRowModel().rows
  useEffect(() => {
    if (!selected) return
    const i = preRows.findIndex((r) => r.id === selected)
    if (i >= 0) setPagination((p) => (Math.floor(i / PAGE_SIZE) === p.pageIndex ? p : { ...p, pageIndex: Math.floor(i / PAGE_SIZE) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])
  const pages = Math.max(1, Math.ceil(data.length / PAGE_SIZE))
  const sort = sorting[0]
  const sortBy = (id: string) => setSorting(sort?.id === id ? [{ id, desc: !sort.desc }] : [{ id, desc: true }])

  return (
    <Panel title={title} hint={`${data.length} / ${items.length} 个，点击列头排序，点击名称查看近期序列`}>
      {note}
      <div className="-mx-2 overflow-x-auto" tabIndex={0} role="region" aria-label="全行业表，可横向滚动">
        <table className="w-full min-w-[1260px] text-sm">
          <thead>
            <tr className="border-b border-[var(--c-line-strong)] text-xs text-ink-3">
              <th scope="col" className="px-2 py-2 text-left font-normal">板块</th>
              <th scope="col" className="px-2 py-2 text-right font-normal whitespace-nowrap">成分股数</th>
              {COLS.map((c) => (
                <th key={c.key} scope="col" aria-sort={sort?.id === c.key ? (sort.desc ? 'descending' : 'ascending') : 'none'} className="px-2 py-2 text-right font-normal">
                  <button type="button" onClick={() => sortBy(c.key)} className={cn('cursor-pointer whitespace-nowrap hover:text-foreground', sort?.id === c.key && 'text-foreground')}>{c.label}{sort?.id === c.key ? (sort.desc ? ' ↓' : ' ↑') : ''}</button>
                </th>
              ))}
              <th scope="col" className="px-2 py-2 text-center font-normal whitespace-nowrap">近 20 日累计涨跌</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const r = row.original
              return (
                <tr key={row.id} className={cn('border-b last:border-0 transition-colors hover:bg-surface-hover', r.sector_code === selected && 'bg-accent')}>
                  <td className="px-2 py-2.5 whitespace-nowrap">
                    <button type="button" aria-pressed={r.sector_code === selected} onClick={() => onSelect(r.sector_code)} className="cursor-pointer hover:underline">{r.sector_name}</button>
                    <span className="tnum ml-1.5 text-xs text-ink-3">{r.sector_code}</span>
                  </td>
                  <td className="tnum px-2 text-right text-ink-2">{r.member_count ?? <span className="text-ink-3">—</span>}</td>
                  {row.getAllCells().map((cell) => <td key={cell.id} className="tnum px-2 text-right whitespace-nowrap"><table.FlexRender cell={cell} /></td>)}
                  <td className="px-2 text-center"><SparkCell key={`${endDate}|${r.sector_code}`} code={r.sector_code} name={r.sector_name} endDate={endDate} canDetail={canDetail} /></td>
                </tr>
              )
            })}
            {!rows.length && <tr><td colSpan={COLS.length + 3} className="px-2 py-6 text-center text-ink-3">没有匹配的板块</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <Button type="button" variant="outline" size="sm" disabled={pagination.pageIndex === 0} onClick={() => setPagination((p) => ({ ...p, pageIndex: p.pageIndex - 1 }))}>上一页</Button>
          <span className="text-ink-3">第 {pagination.pageIndex + 1} / {pages} 页</span>
          <Button type="button" variant="outline" size="sm" disabled={pagination.pageIndex >= pages - 1} onClick={() => setPagination((p) => ({ ...p, pageIndex: p.pageIndex + 1 }))}>下一页</Button>
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-ink-3">涨跌幅为小数口径换算的百分比；资金净流入单位为亿元。最后一列的迷你线滚动到可见时逐行加载。扩散度、成交额占比等指标的精确公式以数据中台定义为准。{!canDetail && `迷你折线和近期序列需要 ${lockText} 等级。`}</p>
    </Panel>
  )
}
