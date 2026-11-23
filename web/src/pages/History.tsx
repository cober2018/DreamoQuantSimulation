import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageFrame } from '@/components/shell/PageFrame'
import { Panel } from '@/components/shell/Panel'
import { DateInput } from '@/components/shell/DateInput'
import { DateTag } from '@/components/shell/DateTag'
import { IndGate, ModuleGate } from '@/components/shell/Gates'
import { DayChip } from '@/components/charts/DayChip'
import { DivergingBars } from '@/components/charts/DivergingBars'
import { SeriesChart } from '@/components/charts/SeriesChart'
import { TrendTile } from '@/components/charts/TrendTile'
import { BlurFade } from '@/components/fx/blur-fade'
import { HaloSegmented } from '@/components/fx/halo-segmented'
import { fmt, getModule } from '@/lib/api'
import { useCan } from '@/lib/auth'
import { INDUSTRY_FLOOR, isPending } from '@/lib/industryPending'
import { useModule, useSupplementQuery } from '@/lib/queries'

const PERIODS = [{ value: '1d', label: '1 日' }, { value: '5d', label: '5 日' }, { value: '20d', label: '20 日' }]
// isPending 只按日期判定（成交额键），这里传入非空占位行，使判定只看日期下限
const belowFloor = (d?: string) => isPending('amount', { amount: 0 }, d)
const pctFmt = { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 } as const
const pending = '数据待更新'

const OPEN5 = [
  { key: 'coverage_ratio', label: '覆盖率', ind: 'history.open5.coverage_ratio', color: 'var(--c-viz-5)', sub: (r: any) => `${fmt.num(r.open5_ready_count, 0)} / ${fmt.num(r.expected_stock_count, 0)}` },
  { key: 'positive_open5_ratio', label: '开盘 5 分钟为正占比', ind: 'history.open5.positive_open5_ratio', color: 'var(--c-viz-1)', sub: (r: any) => `分母 ${fmt.num(r.open5_ready_count, 0)}` },
  { key: 'continuation_ratio', label: '收盘延续占比', ind: 'history.open5.continuation_ratio', color: 'var(--c-viz-3)', sub: (r: any) => `分母 ${fmt.num(r.close_ready_count, 0)}` },
  { key: 'over_response_ratio', label: '过度反应占比', ind: 'history.open5.over_response_ratio', color: 'var(--c-viz-2)', sub: (r: any) => `分母 ${fmt.num(r.close_ready_count, 0)}` },
] as const

export function Component() {
  const can = useCan()
  const [period, setPeriod] = useState('1d')
  const [tradeDate, setTradeDate] = useState('')
  const [hover, setHover] = useState<number | null>(null)
  const { env, loading, load } = useModule('history', { idx_type: '行业板块', trade_date: tradeDate || undefined, period })
  const day = env.trade_date || tradeDate
  const open5 = env.data?.open5 ?? null
  const open5Hist = ((useSupplementQuery('open5_history', env.trade_date).data?.rows || []) as any[]).slice().sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)))

  // 覆盖率未满 100% 时数值灰显，提示仅供参考；中台约定 null 表示未知，显示「数据待更新」，不能显示 0
  const partial = open5?.coverage_ratio != null && open5.coverage_ratio < 1
  const histRow = hover == null ? null : open5Hist[hover]
  const row = histRow ?? open5

  // 资金净流入排行：行数多时只取净流入前 10 和净流出前 10
  const ranking = ((env.data?.flow_ranking || []) as any[]).filter((r) => r.net_flow != null).sort((a, b) => b.net_flow - a.net_flow)
  const flowRows = (ranking.length > 20 ? [...ranking.slice(0, 10), ...ranking.slice(-10)] : ranking).map((r) => ({ name: r.sector_name, value: r.net_flow as number }))

  // 领涨行业：取板块日表（industries 列表），5 日序列沿用 industries/{code}/series。用 getModule 而非 useModule：后者会覆盖本页的模块权限状态
  const canIndustries = can('page.industries')
  const canDetail = can('data.detail')
  const leaders = useQuery({
    queryKey: ['history-leaders', day, canDetail],
    enabled: !!day && !belowFloor(day) && canIndustries,
    queryFn: async () => {
      const list = await getModule('industries', { idx_type: '行业板块', trade_date: day })
      const top = ((list?.data?.items || []) as any[]).filter((r) => r.sector_return != null).sort((a, b) => b.sector_return - a.sector_return).slice(0, 3)
      return Promise.all(top.map(async (r) => {
        const s = canDetail ? await getModule(`industries/${encodeURIComponent(r.sector_code)}/series`, { end_date: day }) : null
        const points = ((s?.data?.points || []) as any[]).map((p) => ({ date: String(p.trade_date), ret: p.sector_return == null || belowFloor(p.trade_date) ? null : +(p.sector_return * 100).toFixed(2) }))
        return { code: r.sector_code as string, name: r.sector_name as string, pct: r.sector_return as number, points }
      }))
    },
  })
  const charts = leaders.data || []
  // 三张小图共用纵轴刻度，才能互相比较
  const allRet = charts.flatMap((c) => c.points.map((p) => p.ret)).filter((v): v is number => v != null)
  const domain: [number, number] | undefined = allRet.length ? [Math.floor(Math.min(...allRet, 0)), Math.ceil(Math.max(...allRet, 0))] : undefined

  return (
    <PageFrame title="历史复盘" question="某一天的数据和历史对比是什么？" env={env} loading={loading} onRetry={load} onJump={setTradeDate}
      tools={<DateInput value={tradeDate} onChange={setTradeDate} />}>
      <div className="grid grid-cols-1 gap-4">
        {open5 && (
          <ModuleGate module="open5">
            <BlurFade delay={0.06}>
              <Panel title={<>开盘五分钟<DateTag date={open5.trade_date} pageDate={env.trade_date} /></>} hint="开盘时上涨的个股占多少，开盘方向是否延续到收盘"
                action={open5Hist.length > 1 ? <DayChip hover={hover} date={hover == null ? open5.trade_date : open5Hist[hover]?.trade_date} /> : undefined}>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {OPEN5.map((m, i) => {
                    const v = row?.[m.key] as number | null | undefined
                    const series = open5Hist.map((r) => r[m.key] as number | null)
                    return (
                      <IndGate key={m.key} ind={m.ind}>
                        <TrendTile label={m.label} value={v} text={v == null ? pending : undefined} format={pctFmt} muted={partial && hover == null} color={m.color} delay={0.3 + i * 0.07}
                          sub={row ? m.sub(row) : undefined} series={series.filter((x) => x != null).length >= 2 ? series : undefined} hover={hover} onHover={setHover} />
                      </IndGate>
                    )
                  })}
                </div>
                {partial && <p className="mt-3 text-xs text-ink-3">覆盖不全，仅供参考。</p>}
                {open5Hist.length > 1 && (
                  <div className="mt-4">
                    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-3">
                      <span>近 {open5Hist.length} 日对比</span>
                      {OPEN5.slice(1).map((m) => <span key={m.key} className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-3.5 rounded" style={{ background: m.color }} />{m.label}</span>)}
                    </div>
                    <SeriesChart data={open5Hist} xKey="trade_date" height={200}
                      series={OPEN5.slice(1).map((m) => ({ key: m.key, label: m.label, color: m.color, type: 'line' as const }))}
                      xTickFormat={(d) => String(d).slice(5)} yDomain={[0, 1]} valueFormat={(v) => `${(v * 100).toFixed(1)}%`} axisFormat={(v) => `${Math.round(v * 100)}%`} />
                  </div>
                )}
                <p className="mt-3 text-[11px] leading-relaxed text-ink-3">数据不完整的股票不计入分子，也不计入占比分母；覆盖率反映数据完整程度，不代表市场表现。</p>
              </Panel>
            </BlurFade>
          </ModuleGate>
        )}

        <ModuleGate module="flow">
          <BlurFade delay={0.12}>
            <Panel title="行业资金净流入排行" hint="净流入最多与净流出最多的行业，单位亿元"
              action={<HaloSegmented items={PERIODS} value={period} onValueChange={setPeriod} translucent={false} className="[&_button]:whitespace-nowrap" />}>
              {belowFloor(day) ? <p className="text-sm text-ink-3">数据待更新（行业数据从 {INDUSTRY_FLOOR} 起提供）</p>
                : !flowRows.length ? <p className="text-sm text-ink-3">没有可用的资金流数据。</p>
                : <DivergingBars rows={flowRows} />}
            </Panel>
          </BlurFade>
        </ModuleGate>

        <BlurFade delay={0.18}>
          <Panel title="领涨行业 5 日走势" hint="当日涨幅最大的 3 个行业，之前几天是否也在涨">
            {belowFloor(day) ? <p className="text-sm text-ink-3">数据待更新（行业数据从 {INDUSTRY_FLOOR} 起提供）</p>
              : !canIndustries ? <div className="rounded-md border border-dashed px-4 py-3 text-sm text-ink-3">领涨行业需要行业页权限。</div>
              : leaders.isPending ? <p className="text-sm text-ink-3">加载中…</p>
              : !charts.length ? <p className="text-sm text-ink-3">没有可用的领涨行业数据。</p>
              : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {charts.map((c) => (
                    <article key={c.code} className="min-w-0 rounded-md border p-3">
                      <header className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate">{c.name}</span><span className="tnum text-up">{fmt.pct(c.pct)}</span></header>
                      {c.points.length
                        ? <SeriesChart data={c.points} xKey="date" height={120} series={[{ key: 'ret', label: '涨跌幅', color: 'var(--c-viz-3)', type: 'line' }]}
                            xTickFormat={(d) => String(d).slice(5)} yDomain={domain} valueFormat={(v) => `${v}%`} />
                        : <p className="py-6 text-center text-xs text-ink-3">序列暂时无法加载。</p>}
                    </article>
                  ))}
                </div>
              )}
            <p className="mt-3 text-[11px] text-ink-3">三张图共用纵轴刻度，便于比较；早于下限的日期不画点。</p>
          </Panel>
        </BlurFade>
      </div>
    </PageFrame>
  )
}
