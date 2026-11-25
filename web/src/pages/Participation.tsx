import { useMemo, useState, type ReactNode } from 'react'
import { PageFrame } from '@/components/shell/PageFrame'
import { Panel } from '@/components/shell/Panel'
import { DateInput } from '@/components/shell/DateInput'
import { DateTag } from '@/components/shell/DateTag'
import { IndGate, ModuleGate } from '@/components/shell/Gates'
import { BulletBar } from '@/components/charts/BulletBar'
import { DayChip } from '@/components/charts/DayChip'
import { PercentileBand } from '@/components/charts/PercentileBand'
import { SeriesChart } from '@/components/charts/SeriesChart'
import { TrendTile } from '@/components/charts/TrendTile'
import { TurnoverChart } from '@/components/charts/TurnoverChart'
import { ZRuler, zText, type RulerRow } from '@/components/charts/ZRuler'
import { BlurFade } from '@/components/fx/blur-fade'
import { HaloSegmented } from '@/components/fx/halo-segmented'
import { useQuery } from '@tanstack/react-query'
import { fmt, getModule } from '@/lib/api'
import { useCan } from '@/lib/auth'
import { useModule, useSupplementQuery } from '@/lib/queries'
import { useOpenText } from '@/stores/moduleAccess'

// 上游 *_pct 字段已是百分数；分位为 0–100 的数值，缺失多因历史样本不足
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const pctPoint = (v: unknown) => (num(v) == null ? '—' : `${num(v)!.toFixed(2)}%`)
const pp = (v: unknown) => (num(v) == null ? '—' : `${num(v)! > 0 ? '+' : ''}${num(v)!.toFixed(2)} pp`)
const PENDING = '数据待更新'
const pctFmt = { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 } as const

const INST_LABEL: Record<string, string> = { HS300: '沪深300', CSI500: '中证500', SSE50: '上证50', CSI1000: '中证1000', STAR50: '科创50' }
// 近 60 日标准分历史（注意：成交持仓比在历史视图里的键名与当日视图不同）
const DH_METRICS = [
  { value: 'basis_zscore_60d', label: '基差标准分' },
  { value: 'pcr_zscore_60d', label: '认沽认购比标准分' },
  { value: 'oi_volume_ratio_zscore_60d', label: '成交持仓比标准分' },
]
const DH_INSTRUMENTS = ['HS300', 'SSE50', 'CSI500', 'CSI1000', 'STAR50']
// 历史视图与当日视图里同一指标的键名对应；要点行用的短名
const TODAY_KEY: Record<string, string> = { basis_zscore_60d: 'basis_zscore_60d', pcr_zscore_60d: 'pcr_zscore_60d', oi_volume_ratio_zscore_60d: 'oi_volume_crowding_zscore_60d' }
const METRIC_SHORT: Record<string, string> = { basis_zscore_60d: '基差', pcr_zscore_60d: '认沽认购比', oi_volume_ratio_zscore_60d: '成交持仓比' }
const DH_COLORS = ['var(--c-viz-1)', 'var(--c-viz-2)', 'var(--c-viz-3)', 'var(--c-viz-4)', 'var(--c-viz-5)']
const STYLE_COLORS = ['var(--c-viz-1)', 'var(--c-viz-2)', 'var(--c-viz-3)', 'var(--c-viz-4)']

// 开盘五分钟（原历史复盘页的一块，2026-11 搬到本页）
const OPEN5 = [
  { key: 'coverage_ratio', label: '覆盖率', color: 'var(--c-viz-5)', sub: (r: any) => `${fmt.num(r.open5_ready_count, 0)} / ${fmt.num(r.expected_stock_count, 0)} 只` },
  { key: 'positive_open5_ratio', label: '09:35 高于前收的个股占比', color: 'var(--c-viz-1)', sub: (r: any) => `分母 ${fmt.num(r.open5_ready_count, 0)} 只` },
  { key: 'continuation_ratio', label: '延续占比（两段都不跌）', color: 'var(--c-viz-3)', sub: (r: any) => `分母 ${fmt.num(r.close_ready_count, 0)} 只` },
  { key: 'over_response_ratio', label: '过度反应占比（先不跌后跌）', color: 'var(--c-viz-2)', sub: (r: any) => `分母 ${fmt.num(r.close_ready_count, 0)} 只` },
] as const
// 近 n 个点的均值；窗口里有效值不足 3 个时不给，不拿更少的点凑
const movingMean = (vals: (number | null)[], n: number) => vals.map((_, i) => {
  const w = vals.slice(Math.max(0, i - n + 1), i + 1).filter((v): v is number => v != null)
  return i >= n - 1 && w.length >= 3 ? +(w.reduce((a, b) => a + b, 0) / w.length).toFixed(1) : null
})

const Note = ({ children }: { children: ReactNode }) => <p className="mt-3 text-[11px] leading-relaxed text-ink-3">{children}</p>
const Muted = ({ children }: { children: ReactNode }) => <p className="text-sm text-ink-3">{children}</p>
const th = 'px-2 py-2 text-right font-normal'
const td = 'tnum px-2 py-2 text-right'

export function Component() {
  const openText = useOpenText()
  const can = useCan()
  const [tradeDate, setTradeDate] = useState('')
  const [dhMetric, setDhMetric] = useState(DH_METRICS[0].value)
  const [dhHover, setDhHover] = useState<number | null>(null)
  const [dhFocus, setDhFocus] = useState<string | null>(null)
  const [styleHover, setStyleHover] = useState<number | null>(null)
  const [o5Hover, setO5Hover] = useState<number | null>(null)
  const { env, loading, load } = useModule('participation', { trade_date: tradeDate || undefined })
  const ready = !!env.trade_date
  const partHist = (useSupplementQuery('participation_history', env.trade_date, ready).data?.rows || []) as any[]
  const compHist = (useSupplementQuery('compensation_history', env.trade_date, ready).data?.rows || []) as any[]
  // 开盘五分钟沿用原接口和原权限点；用 getModule 而非 useModule：后者会覆盖本页的模块权限状态
  const canOpen5 = can('page.history')
  const open5 = useQuery({ queryKey: ['open5', env.trade_date], enabled: ready && canOpen5, queryFn: async () => (await getModule('history', { trade_date: env.trade_date }))?.data?.open5 ?? null }).data ?? null
  const open5Hist = ((useSupplementQuery('open5_history', env.trade_date, ready && canOpen5).data?.rows || []) as any[]).slice().sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)))
  const o5Row = o5Hover == null ? open5 : open5Hist[o5Hover] ?? open5
  const o5Partial = open5?.coverage_ratio != null && open5.coverage_ratio < 1
  // 卖压相对强度是 20 日分位，单日跳动大；叠一条 5 日均值看趋势
  const pressureRaw = partHist.map((r) => num(r.selling_pressure_pct))
  const pressureMean = movingMean(pressureRaw, 5)
  const pressureData = partHist.map((r, i) => ({ date: r.date, raw: pressureRaw[i], mean: pressureMean[i] }))

  const d = env.data
  const obs = d?.participation_observation || {}
  const erp = d?.erp || {}
  const deriv: any[] = d?.derivatives || []
  const val = d?.valuation || {}
  const bc = d?.bottom_conditions || null
  const style = d?.style_strength || null
  const camps: any[] = style?.camps || []
  const dhRows: any[] = d?.derivatives_history || []
  const valHasData = Object.values(val).some((v) => v != null)

  const dhDates = [...new Set(dhRows.map((r) => String(r.trade_date)))].sort()
  const dhCell = (ins: string, dt: string) => dhRows.find((r) => r.instrument === ins && String(r.trade_date) === dt) || null
  const todayRow = (ins: string) => deriv.find((r) => r.instrument === ins) || null
  const rulerIns = DH_INSTRUMENTS.filter((i) => todayRow(i) || dhRows.some((r) => r.instrument === i))
  const todayKey = TODAY_KEY[dhMetric]
  // 当日位置取当日数据；指针移到折线上时，取那一天的历史值
  const rulerRows: RulerRow[] = rulerIns.map((ins) => {
    const hist = dhDates.map((dt) => num(dhCell(ins, dt)?.[dhMetric])).filter((v): v is number => v != null)
    const row = todayRow(ins)
    const value = dhHover == null ? num(row?.[todayKey]) : num(dhCell(ins, dhDates[dhHover])?.[dhMetric])
    return { key: ins, label: INST_LABEL[ins] || ins, value, min: hist.length >= 2 ? Math.min(...hist) : null, max: hist.length >= 2 ? Math.max(...hist) : null, missingReason: row?.missing_reason || null }
  })
  // 要点：当日三个指标里 |标准分| ≥ 1 的项，按绝对值从大到小。STAR50 基差为代理值不显示，不计入待更新
  const highlights = useMemo(() => {
    const out: { ins: string; metric: string; v: number }[] = []
    let missing = 0
    for (const ins of rulerIns) for (const m of DH_METRICS) {
      if (ins === 'STAR50' && m.value === 'basis_zscore_60d') continue
      const v = num(todayRow(ins)?.[TODAY_KEY[m.value]])
      if (v == null) missing++
      else if (Math.abs(v) >= 1) out.push({ ins, metric: m.value, v })
    }
    out.sort((x, y) => Math.abs(y.v) - Math.abs(x.v))
    return { items: out, missing, total: rulerIns.length * DH_METRICS.length - (rulerIns.includes('STAR50') ? 1 : 0) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deriv, dhRows])
  const matrixGaps = deriv.filter((r) => r.missing_reason).map((r) => ({ key: r.instrument, label: INST_LABEL[r.instrument] || r.instrument, missingReason: r.missing_reason }))
  const dhChartData = dhDates.map((dt) => ({ date: dt, ...Object.fromEntries(rulerIns.map((ins) => [ins, num(dhCell(ins, dt)?.[dhMetric])])) }))
  const dhVals = dhChartData.flatMap((r) => rulerIns.map((i) => (r as any)[i] as number | null)).filter((v): v is number => v != null)
  const dhDomain: [number, number] = [Math.min(-3, Math.floor(Math.min(0, ...dhVals))), Math.max(3, Math.ceil(Math.max(0, ...dhVals)))]
  const dhChipDate = dhHover == null ? env.trade_date : dhDates[dhHover]

  const seriesN = Math.max(0, ...camps.map((c) => c.strength_series?.length || 0))
  const campsWithSeries = camps.filter((c) => c.strength_series?.length)
  // 横轴用序列自带的实际日期；旧快照没有日期时退回观测序号
  const styleDates: (string | null)[] | null = campsWithSeries.find((c) => Array.isArray(c.series_dates) && c.series_dates.length === seriesN)?.series_dates ?? null
  const styleX = (i: number) => styleDates?.[i] || `#${i + 1}`
  const styleData = Array.from({ length: seriesN }, (_, i) => ({ n: styleX(i), ...Object.fromEntries(campsWithSeries.map((c) => [c.key, typeof c.strength_series[i] === 'number' ? c.strength_series[i] : null])) }))

  let order = 0
  const delay = () => Math.min(order++ * 0.06, 0.4)

  return (
    <PageFrame title="参与度与资金环境" question="参与和资金结构相对历史怎样变化？" env={env} loading={loading} onRetry={load} onJump={setTradeDate}
      tools={<DateInput value={tradeDate} onChange={setTradeDate} />}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        <ModuleGate module="observation">
          <BlurFade delay={delay()} className="lg:col-span-2">
            <Panel title={<>参与热度与成交<DateTag date={obs.trade_date} pageDate={env.trade_date} /></>} hint="参与是在升温还是降温，低参与持续了几天">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="grid grid-cols-2 gap-3 lg:col-span-5">
                  <IndGate ind="participation.observation.total_amount_billion">
                    <TrendTile label="全市场成交额" unit="亿元" value={num(obs.total_amount_billion)} format={{ maximumFractionDigits: 0 }} sub={`${fmt.num(obs.count_stocks, 0)} 只股票 · 与总览同一口径`} />
                  </IndGate>
                  <IndGate ind="participation.observation.amount_ratio_20d">
                    <TrendTile label="成交额 / 前 20 日中位数" unit="倍" value={num(obs.amount_ratio_20d)} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} series={partHist.map((r) => r.relative_turnover)} />
                  </IndGate>
                  <IndGate ind="participation.observation.participation_pctile_60d">
                    <TrendTile label="成交额分位（60 日）" value={num(obs.participation_pctile_60d)} format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} sub="0–100，不含当日" />
                  </IndGate>
                  <IndGate ind="participation.observation.low_participation_streak">
                    <TrendTile label="低参与连续天数" unit="交易日" value={num(obs.low_participation_streak)} format={{ maximumFractionDigits: 0 }} series={partHist.map((r) => r.low_participation_days)} />
                  </IndGate>
                </div>
                <div className="min-w-0 lg:col-span-7">
                  {partHist.length > 0 ? (
                    <>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-3">
                        <span>近 {partHist.length} 个交易日 · 单位：亿元</span>
                        <span className="flex items-center gap-4"><span className="flex items-center gap-1.5"><i className="inline-block size-2 rounded-[2px] bg-primary" />最新一日</span><span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-3.5 rounded bg-[var(--c-viz-1)]" />20 日均值</span></span>
                      </div>
                      <TurnoverChart rows={partHist} height={230} />
                    </>
                  ) : <Muted>暂无成交额历史。</Muted>}
                </div>
              </div>
            </Panel>
          </BlurFade>
        </ModuleGate>

        <ModuleGate module="observation">
          <BlurFade delay={delay()}>
            <Panel title="卖压相对强度" hint="抛售压力在高位还是低位，最近是增强还是缓和" className="h-full">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <IndGate ind="participation.observation.active_sell_ratio">
                  <TrendTile label="主动卖出占比" value={num(obs.active_sell_ratio)} format={pctFmt} series={partHist.map((r) => r.selling_share_reference_pct)} />
                </IndGate>
                <IndGate ind="participation.observation.sell_pressure_change_1d">
                  <TrendTile label="卖压缓和程度（1 日变化，正值为缓和）" text={num(obs.sell_pressure_change_1d) == null ? '—' : fmt.signed(obs.sell_pressure_change_1d, 3)} />
                </IndGate>
                <IndGate ind="participation.observation.sell_pressure_change_3d">
                  <TrendTile label="近 3 日卖压趋势（斜率，正值为缓和）" text={num(obs.sell_pressure_change_3d) == null ? '—' : fmt.signed(obs.sell_pressure_change_3d, 4)} />
                </IndGate>
              </div>
              {partHist.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-3">
                    <span>近 {partHist.length} 个交易日 · 数值越高压力越强（0–100，虚线为 30 和 70）</span>
                    <span className="flex items-center gap-4"><span className="flex items-center gap-1.5"><i className="inline-block h-[3px] w-3.5 rounded bg-[var(--c-viz-1)]" />5 日均值</span><span className="flex items-center gap-1.5"><i className="inline-block h-px w-3.5 bg-[var(--c-viz-5)]" />每日值</span></span>
                  </div>
                  <SeriesChart data={pressureData} xKey="date" height={200}
                    series={[{ key: 'raw', label: '每日值', color: 'var(--c-viz-5)', type: 'line', opacity: 0.45, width: 1 }, { key: 'mean', label: '5 日均值', color: 'var(--c-viz-1)', type: 'line', width: 2.6 }]}
                    yDomain={[0, 100]} refLines={[{ y: 30 }, { y: 70 }]} xTickFormat={(v) => String(v).slice(5)} valueFormat={(v) => v.toFixed(1)} axisFormat={(v) => String(Math.round(v))} />
                </div>
              )}
              <Note>卖压相对强度是当日主动卖出占比在近 20 个交易日里的排位（0 最低，100 最高），不是卖出占比本身。它每天重新排位，单日数值跳动大，所以看趋势用粗线（5 日均值），细线是每日值。</Note>
            </Panel>
          </BlurFade>
        </ModuleGate>

        <ModuleGate module="erp">
          <BlurFade delay={delay()}>
            <Panel title="股债收益差" hint={<>股票相对债券的收益补偿处在历史什么位置{openText('erp')}</>} className="h-full">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <IndGate ind="participation.erp.erp_value_pct">
                  <TrendTile label="股债收益差" text={pctPoint(erp.erp_value_pct)} sub={`盈利收益率 ${fmt.ratio(erp.earnings_yield, 2)} · 10 年期国债 ${pctPoint(erp.yield_10y)}`} />
                </IndGate>
                <IndGate ind="participation.erp.erp_change_5d_pct"><TrendTile label="5 日变化" text={pp(erp.erp_change_5d_pct)} /></IndGate>
                <IndGate ind="participation.erp.erp_change_20d_pct"><TrendTile label="20 日变化" text={pp(erp.erp_change_20d_pct)} /></IndGate>
              </div>
              <div className="mt-4 space-y-2" aria-label="股债收益差历史位置">
                {[['erp_percentile_252d', '近 252 日'], ['erp_percentile_3y', '近 3 年'], ['erp_percentile_5y', '近 5 年']].map(([key, label]) => (
                  <IndGate key={key} ind={`participation.erp.${key}`}><PercentileBand label={label} value={num(erp[key])} /></IndGate>
                ))}
                <p className="text-[11px] text-ink-3">历史位置为近各窗口内的分位（0 最低，100 最高），只描述历史相对水平。</p>
              </div>
              {compHist.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1 text-[11px] text-ink-3">股权风险补偿（逐日）· 盈利收益率 − 10 年期国债收益率 · 单位：%</div>
                  <SeriesChart data={compHist} xKey="date" height={170} series={[{ key: 'compensation_pct', label: '股权风险补偿', color: 'var(--c-viz-2)', type: 'line' }]}
                    xTickFormat={(v) => String(v).slice(5)} valueFormat={(v) => `${v.toFixed(2)}%`} axisFormat={(v) => v.toFixed(1)} />
                </div>
              )}
            </Panel>
          </BlurFade>
        </ModuleGate>

        <ModuleGate module="derivatives">
          <BlurFade delay={delay()} className="lg:col-span-2">
            <Panel title="衍生品标准分" hint="今天的数值和它自己近 60 日相比，处在什么位置。0 是近 60 日的平均水平，±1 以内是多数交易日所在的范围。"
              action={dhDates.length > 0 ? <DayChip hover={dhHover} date={dhChipDate} /> : undefined}>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                {highlights.items.length > 0 ? highlights.items.map((h) => (
                  <button key={`${h.ins}-${h.metric}`} type="button" onClick={() => { setDhMetric(h.metric); setDhFocus(h.ins) }}
                    className="cursor-pointer rounded-full border px-2.5 py-0.5 hover:bg-surface-hover" style={{ borderColor: h.v > 0 ? 'hsl(28 85% 50% / .6)' : 'hsl(214 70% 48% / .6)' }}>
                    {INST_LABEL[h.ins] || h.ins} · {METRIC_SHORT[h.metric]} <span className="tnum">{zText(h.v)}</span>
                  </button>
                )) : rulerIns.length > 0 && <span className="text-ink-3">当日 {highlights.total - highlights.missing} 项全部在 ±1 以内。</span>}
                {highlights.missing > 0 && <span className="text-ink-3">另有 {highlights.missing} 项{PENDING}。</span>}
              </div>
              <div className="-mx-1 mb-2 flex justify-start overflow-x-auto px-1 py-1">
                <HaloSegmented items={DH_METRICS} value={dhMetric} onValueChange={setDhMetric} translucent={false} className="max-w-full [&_button]:whitespace-nowrap [&_button]:px-3" />
              </div>
              {rulerRows.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <div className="min-w-0 lg:col-span-5">
                    <div className="mb-2 text-xs text-ink-3">{dhHover == null ? '当日位置' : `${dhChipDate} 位置`}</div>
                    <ZRuler rows={rulerRows} focus={dhFocus} onFocus={setDhFocus} />
                  </div>
                  <div className="min-w-0 lg:col-span-7">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-3">
                      <span>近 {dhDates.length || 60} 个交易日走势</span>
                      <span className="flex flex-wrap gap-x-3 gap-y-1">{rulerIns.map((ins, i) => <span key={ins} className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-3.5 rounded" style={{ background: DH_COLORS[i] }} />{INST_LABEL[ins] || ins}</span>)}</span>
                    </div>
                    {dhDates.length > 0 ? (
                      <SeriesChart data={dhChartData} xKey="date" height={260} yDomain={dhDomain} xTickFormat={(d) => String(d).slice(5)} valueFormat={(v) => v.toFixed(2)} axisFormat={(v) => (v > 0 ? `+${v}` : String(v))}
                        bands={[{ y1: -1, y2: 1 }]} refLines={[{ y: -2 }, { y: 0 }, { y: 2 }]} onHover={setDhHover}
                        series={rulerIns.map((ins, i) => ({ key: ins, label: INST_LABEL[ins] || ins, color: DH_COLORS[i], type: 'line' as const, opacity: dhFocus && dhFocus !== ins ? 0.2 : 1, width: dhFocus === ins ? 2.8 : 1.5 }))} />
                    ) : <Muted>暂无标准分历史。</Muted>}
                  </div>
                </div>
              ) : <Muted>当日衍生品标准分暂缺（{PENDING}）。</Muted>}
              {matrixGaps.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-ink-3">{matrixGaps.map((g) => <li key={g.key}>{g.label}：{g.missingReason}</li>)}</ul>}
              <Note>标准分为 60 日标准分；缺值显示「{PENDING}」，不按 0 处理。橙色为偏高，蓝色为偏低，颜色不代表好坏。科创50 没有对应的股指期货，基差不显示。</Note>
            </Panel>
          </BlurFade>
        </ModuleGate>

        <ModuleGate module="style">
          <BlurFade delay={delay()} className="lg:col-span-2">
            <Panel title={<>风格强弱<DateTag date={camps[0]?.source_date} pageDate={env.trade_date} /></>} hint="成长、红利、大盘三类风格谁强谁弱，近期怎么变"
              action={campsWithSeries.length > 0 ? <DayChip hover={styleHover} date={styleHover == null ? camps[0]?.source_date : styleX(styleHover)} /> : undefined}>
              {camps.length > 0 && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-5 lg:grid-cols-1 xl:grid-cols-3">
                    {camps.map((c, i) => {
                      const sv = Array.isArray(c.strength_series) ? (c.strength_series as unknown[]).map((x) => (typeof x === 'number' ? x : null)) : undefined
                      const v = styleHover != null && sv ? sv[styleHover] : num(c.strength_score)
                      return (
                        <TrendTile key={c.key} label={`${c.label}${c.index_name ? ` · ${c.index_name}` : ''}`} value={v} format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} color={STYLE_COLORS[i % STYLE_COLORS.length]}
                          sub={styleHover == null ? `标准分（20 日） ${fmt.signed(c.z_score, 3)}` : styleX(styleHover)} series={sv} hover={styleHover} onHover={setStyleHover} delay={0.3 + i * 0.07} />
                      )
                    })}
                  </div>
                  <div className="min-w-0 lg:col-span-7">
                    {campsWithSeries.length > 0 && (
                      <>
                        <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-3">
                          {campsWithSeries.map((c, i) => <span key={c.key} className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-3.5 rounded" style={{ background: STYLE_COLORS[camps.indexOf(c) % STYLE_COLORS.length] }} />{c.label}</span>)}
                        </div>
                        <SeriesChart data={styleData} xKey="n" height={220} series={campsWithSeries.map((c) => ({ key: c.key, label: c.label, color: STYLE_COLORS[camps.indexOf(c) % STYLE_COLORS.length], type: 'line' as const }))}
                          valueFormat={(v) => v.toFixed(1)} yDomain={[0, 100]} onHover={setStyleHover} xTickFormat={(v) => (/^\d{4}-/.test(String(v)) ? String(v).slice(5) : String(v))} />
                      </>
                    )}
                  </div>
                </div>
              )}
              <Note>{style?.definition || '强度分为阵营指数相对强度的历史评分（0–100）'}；缺数的交易日不连线、不补值；三类风格按固定顺序展示，不按强度排序，只呈现已发生的相对强弱。</Note>
            </Panel>
          </BlurFade>
        </ModuleGate>

        {canOpen5 && open5 && (
          <BlurFade delay={delay()} className="lg:col-span-2">
            <Panel title={<>开盘五分钟<DateTag date={open5.trade_date} pageDate={env.trade_date} /></>} hint="开盘 5 分钟有多少股票在涨，这个方向有没有保持到收盘"
              action={open5Hist.length > 1 ? <DayChip hover={o5Hover} date={o5Hover == null ? open5.trade_date : open5Hist[o5Hover]?.trade_date} /> : undefined}>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {OPEN5.map((m, i) => {
                  const v = o5Row?.[m.key] as number | null | undefined
                  const series = open5Hist.map((r) => r[m.key] as number | null)
                  return (
                    <TrendTile key={m.key} label={m.label} value={v} text={v == null ? PENDING : undefined} format={pctFmt} muted={o5Partial && o5Hover == null} color={m.color} delay={0.3 + i * 0.07}
                      sub={o5Row ? m.sub(o5Row) : undefined} series={series.filter((x) => x != null).length >= 2 ? series : undefined} hover={o5Hover} onHover={setO5Hover} />
                  )
                })}
              </div>
              {o5Partial && <p className="mt-3 text-xs text-ink-3">当日覆盖不全（覆盖率低于 100%），数值仅供参考。</p>}
              <Note>怎么读：每只股票分两段看，第一段是 09:35 的价格相对前一交易日收盘（含开盘跳空），第二段是收盘相对 09:35 的价格，持平按不跌算。两段都不跌记为「延续」，第一段不跌、第二段下跌记为「过度反应」，这两个占比的分母都是收盘数据完整的股票数。另外两类（第一段下跌、第二段不跌；两段都跌）没有单独给出，合计约为 1 − 延续占比 − 过度反应占比。第二项是 09:35 价格严格高于前收的股票数 ÷ 开盘五分钟数据完整的股票数。数据不完整的股票不计入分子和分母；覆盖率只反映数据完整程度，不代表市场表现。</Note>
            </Panel>
          </BlurFade>
        )}

        {valHasData && (
          <ModuleGate module="valuation">
            <BlurFade delay={delay()}>
              <Panel title="估值端统计" hint="全市场股票现在的估值，和近 90 日比是高还是低" className="h-full">
                <BulletBar label="全市场市盈率中位数" value={num(val.current_pe_median)} marker={num(val.hist_90d_pe_median)} markerLabel="近 90 日中位数" format={(v) => fmt.num(v)} />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <TrendTile label="破净股占比" text={val.break_ratio_pct == null ? PENDING : `${fmt.num(val.break_ratio_pct, 2)}%`} />
                  <TrendTile label="相对近 90 日中位数的折价" text={val.discount_pct == null ? PENDING : `${fmt.num(val.discount_pct, 2)}%`} />
                </div>
                <Note>破净股占比：当日市净率大于 0 且小于 1 的股票数 ÷ 市净率大于 0 的股票数（市净率为负或缺失的不计入）。折价比例：当前全市场市盈率中位数比近 90 日中位数低多少，即（近 90 日中位数 − 当前值）÷ 近 90 日中位数；正值表示当前低于近 90 日水平，负值表示高于。</Note>
              </Panel>
            </BlurFade>
          </ModuleGate>
        )}

        {bc && (
          <ModuleGate module="bottom">
            <BlurFade delay={delay()}>
              <Panel title="底部条件观察" hint={`三项观察值各自和固定阈值的对比 · 样本 ${fmt.num(bc.history_obs, 0)} 个交易日`} className="h-full">
                <div className="space-y-4">
                  {(bc.conditions || []).map((c: any) => <BulletBar key={c.key} label={c.condition_label ? `${c.label} · ${c.condition_label}` : c.label} value={num(c.value)} marker={num(c.threshold)} markerLabel="阈值" format={(v) => fmt.num(v, 1)} />)}
                </div>
                <Note>怎么读：横条是当日观察值，金色刻度是阈值，名称后面标出比较结果。三项观察值都是 0–100，越高表示该项的压力越低：宽度承接由下跌家数占比、炸板与跌停扩散两项算出；风险偏好由宽基股指期货与期权的压力算出；流动性由融资余额回撤、大单净流出、单一行业最大净流出、散户资金极值四项算出。阈值取该项在数据日之前最近 60 个有效交易日观察值的分位数（宽度承接、风险偏好取 60% 分位，流动性取 55% 分位，并限制在 30–70 之间），是固定规则，没有用历史收益校准。观察值不低于阈值为「已达到阈值」，低于但差距在 5 以内为「接近阈值」，低于超过 5 为「未达到阈值」，观察值或阈值缺失为「数据不足」。{bc.note || '只说明当日数值在阈值的哪一侧，不构成状态预测'}。</Note>
              </Panel>
            </BlurFade>
          </ModuleGate>
        )}

        {deriv.length > 0 && (
          <ModuleGate module="derivatives">
            <BlurFade delay={delay()} className="lg:col-span-2">
              <Panel title="股指衍生品原始指标" hint={`原始值与标准分，缺失显示「${PENDING}」`}>
                <div className="-mx-2 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-[var(--c-line-strong)] text-xs text-ink-3">
                        <th className="px-2 py-2 text-left font-normal">品种</th><th className={th}>基差</th><th className={th}>基差标准分（60 日）</th><th className={th}>持仓比</th>
                        <th className={th}>认沽认购比</th><th className={th}>认沽认购比标准分（60 日）</th><th className={th}>成交持仓比标准分（60 日）</th><th className="px-2 py-2 text-left font-normal">数据日</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deriv.map((r) => {
                        const cell = (v: unknown, digits: number) => (v == null ? <span className="text-ink-3">{PENDING}</span> : fmt.num(v as number, digits))
                        return (
                          <tr key={r.instrument} className="border-b last:border-0 transition-colors hover:bg-surface-hover">
                            <td className="px-2 py-2">{INST_LABEL[r.instrument] || r.instrument}</td>
                            <td className={td}>{cell(r.basis_value, 3)}</td><td className={td}>{cell(r.basis_zscore_60d, 2)}</td><td className={td}>{cell(r.position_ratio, 3)}</td>
                            <td className={td}>{cell(r.pcr_value, 3)}</td><td className={td}>{cell(r.pcr_zscore_60d, 2)}</td><td className={td}>{cell(r.oi_volume_crowding_zscore_60d, 2)}</td>
                            <td className="tnum px-2 py-2">{r.basis_source_date || r.position_source_date || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <Note>z 分为相对近 60 个交易日的标准化位置，仅描述历史相对水平。</Note>
              </Panel>
            </BlurFade>
          </ModuleGate>
        )}
      </div>
    </PageFrame>
  )
}
