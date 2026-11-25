import { useState } from 'react'
import { Link } from 'react-router'
import { PageFrame } from '@/components/shell/PageFrame'
import { Panel } from '@/components/shell/Panel'
import { DateInput } from '@/components/shell/DateInput'
import { IndGate, ModuleGate } from '@/components/shell/Gates'
import { DayChip } from '@/components/charts/DayChip'
import { TierBoard, type Tier } from '@/components/charts/TierBoard'
import { Input } from '@/components/ui/input'
import { RankBars } from '@/components/charts/RankBars'
import { TrendTile } from '@/components/charts/TrendTile'
import { BlurFade } from '@/components/fx/blur-fade'
import { fmt } from '@/lib/api'
import { HIGH_TIER, sealRate, tierHeight } from '@/lib/limitStructure'
import { useModule } from '@/lib/queries'

type Hist = { trade_date: string; limit_up_count?: number | null; limit_down_count?: number | null; broken_board_count?: number | null; max_ladder?: string | null }
type Kind = 'count' | 'rate' | 'board'

export function Component() {
  const [tradeDate, setTradeDate] = useState('')
  const [hover, setHover] = useState<number | null>(null)
  const { env, loading, load } = useModule('themes', { trade_date: tradeDate || undefined })
  const data = env.data
  const st = data?.structure ?? null
  const tiers: Tier[] = data?.board_tiers || []
  // 跌停梯队与名单由中台字段提供；接口没有该字段时为 undefined，页面显示「待接入」，不当作没有跌停
  const downTiers: Tier[] | null = Array.isArray(data?.limit_down_tiers) ? data.limit_down_tiers : null
  const [kw, setKw] = useState('')
  const [allThemes, setAllThemes] = useState(false)
  const matchN = [...tiers, ...(downTiers || [])].reduce((n, t) => n + (kw.trim() ? (t.stocks || []).filter((s) => s.stock_name?.includes(kw.trim())).length : 0), 0)
  const hasNames = [...tiers, ...(downTiers || [])].some((t) => (t.stocks || []).length > 0)
  const themes: any[] = data?.themes || []

  // 历史按交易日升序；前一日取当前交易日的前一条，缺当日记录时不做对比
  const hist: Hist[] = [...(data?.history || [])].sort((a: Hist, b: Hist) => a.trade_date.localeCompare(b.trade_date))
  const recent = hist.slice(-10)
  const prevIdx = hist.findIndex((h) => h.trade_date === env.trade_date)
  const prevDay = prevIdx > 0 ? hist[prevIdx - 1] : null
  const maxBoard = (() => {
    const hs = tiers.filter((t) => (t.count ?? 0) > 0).map((t) => tierHeight(t.tier)).filter((n): n is number => n != null)
    return hs.length ? Math.max(...hs) : null
  })()

  const defs: { key: string; label: string; ind: string; kind: Kind; tone?: 'up' | 'down'; color: string; cur: number | null; field: (h: Hist) => number | null }[] = st ? [
    { key: 'limit-up', label: '涨停', ind: 'themes.structure.limit_up_count', kind: 'count', tone: 'up', color: 'var(--c-up)', cur: st.limit_up_count, field: (h) => h.limit_up_count ?? null },
    { key: 'limit-down', label: '跌停', ind: 'themes.structure.limit_down_count', kind: 'count', tone: 'down', color: 'var(--c-down)', cur: st.limit_down_count, field: (h) => h.limit_down_count ?? null },
    { key: 'broken', label: '炸板', ind: 'themes.structure.broken_board_count', kind: 'count', color: 'var(--c-viz-1)', cur: st.broken_board_count, field: (h) => h.broken_board_count ?? null },
    { key: 'seal-rate', label: '封板率', ind: 'themes.structure.broken_board_rate', kind: 'rate', color: 'var(--c-viz-3)', cur: sealRate(st.limit_up_count, st.broken_board_count), field: (h) => sealRate(h.limit_up_count, h.broken_board_count) },
    { key: 'max-board', label: '最高连板', ind: 'themes.structure.ladder', kind: 'board', color: 'var(--c-viz-2)', cur: maxBoard, field: (h) => tierHeight(h.max_ladder) },
  ] : []

  // 涨停个股按所属行业归类，覆盖当日全部涨停股；默认列前 15 个行业，其余可展开
  const rankedThemes = themes.filter((t) => t.up_count != null).sort((a, b) => b.up_count - a.up_count)
  const topThemes = allThemes ? rankedThemes : rankedThemes.slice(0, 15)
  const coverage = data?.theme_coverage as { classified?: number | null; total?: number | null } | undefined
  const counts = defs.filter((k) => k.kind === 'count')
  const tiles = defs.filter((k) => k.kind !== 'count')
  const subOf = (k: (typeof defs)[number], cur: number | null, prev: number | null) => {
    // 前一日没有数据时只写「—」；没有变化时写「与前一日相同」，不写「0 板」「+0」
    if (cur == null || prev == null) return '—'
    const d = k.kind === 'rate' ? (cur - prev) * 100 : cur - prev
    if (Number(d.toFixed(k.kind === 'rate' ? 1 : 0)) === 0) return '与前一日相同'
    const unit = k.kind === 'rate' ? ' 个百分点' : k.kind === 'board' ? ' 板' : ''
    return `较前一日 ${d > 0 ? '+' : ''}${fmt.num(d, k.kind === 'rate' ? 1 : 0)}${unit}`
  }
  const curOf = (k: (typeof defs)[number]) => (hover == null ? k.cur : k.field(recent[hover]))
  const prevOf = (k: (typeof defs)[number]) => (hover == null ? (prevDay ? k.field(prevDay) : null) : hover > 0 ? k.field(recent[hover - 1]) : null)
  const shownDate = hover == null ? env.trade_date : recent[hover]?.trade_date

  return (
    <PageFrame title="题材与涨跌结构" question="当日涨停、跌停、炸板如何分布，连板和涨停集中在哪些行业？" env={env} loading={loading} onRetry={load} onJump={setTradeDate}
      tools={<DateInput value={tradeDate} onChange={setTradeDate} />}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {defs.length > 0 && (
          <ModuleGate module="structure">
            <BlurFade className="lg:col-span-2">
              <Panel title="涨停结构" hint="当日涨停、跌停、炸板家数，以及封板率和最高连板的近 10 日走势" action={recent.length > 1 ? <DayChip hover={hover} date={shownDate} /> : undefined}>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                  {/* 涨停、跌停、炸板的家数和走势在市场总览已有，这里只留一行数字 */}
                  <dl className="grid grid-cols-3 gap-3 rounded-md border bg-background/50 p-3 lg:col-span-5">
                    {counts.map((k) => (
                      <IndGate key={k.key} ind={k.ind}>
                        <div>
                          <dt className="text-xs text-ink-3">{k.label}</dt>
                          <dd className={`num-display mt-1 text-[26px] leading-none ${k.tone === 'up' ? 'text-up' : k.tone === 'down' ? 'text-down' : ''}`}>{curOf(k) ?? <span className="text-sm text-ink-3">数据待更新</span>}</dd>
                          <dd className="tnum mt-1 text-[11px] text-ink-3">{subOf(k, curOf(k), prevOf(k))}</dd>
                        </div>
                      </IndGate>
                    ))}
                    <p className="col-span-3 text-[11px] text-ink-3">单位：只。三项的近 20 日走势见<Link to="/overview" className="mx-0.5 text-primary underline">市场总览</Link>。</p>
                  </dl>
                  <div className="grid grid-cols-2 gap-3 lg:col-span-7">
                    {tiles.map((k, i) => {
                      const cur = curOf(k)
                      const series = recent.map(k.field)
                      return (
                        <IndGate key={k.key} ind={k.ind}>
                          <TrendTile label={k.label} value={cur} color={k.color} delay={0.3 + i * 0.07} sub={subOf(k, cur, prevOf(k))}
                            format={k.kind === 'rate' ? { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 } : undefined}
                            text={k.kind === 'board' && cur != null ? `${cur} 板${cur >= HIGH_TIER ? '及以上' : ''}` : undefined}
                            series={series.filter((v) => v != null).length >= 2 ? series : undefined} hover={hover} onHover={setHover} />
                        </IndGate>
                      )
                    })}
                  </div>
                </div>
                {recent.length > 1 && <p className="mt-3 text-[11px] text-ink-3">移到曲线上可回看近 {recent.length} 日中的任意一天。封板率 = 涨停 ÷（涨停 + 炸板）。最高连板按梯队取，梯队最高一档是「高板」（4 板及以上），所以最多显示到「4 板及以上」。</p>}
              </Panel>
            </BlurFade>
          </ModuleGate>
        )}

        <ModuleGate module="structure">
          <BlurFade delay={0.08} className="lg:col-span-2">
            <Panel title={<>涨停梯队{kw.trim() && <small className="ml-2 text-xs font-normal text-primary">匹配 {matchN} 只</small>}</>} hint={hasNames ? '1 板到最高板各有多少家，附个股名称；移到名称上看代码、涨幅和首封时间' : '1 板到最高板各有多少家'}
              action={hasNames ? <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="按名称高亮，如 东方" aria-label="按名称高亮" className="h-8 w-44 text-xs" /> : undefined}>
              {tiers.length ? <TierBoard tiers={tiers} kind="up" keyword={kw} label="涨停梯队" /> : <p className="text-sm text-ink-3">当日暂无连板数据。</p>}
              {tiers.length > 0 && !hasNames && <p className="mt-3 text-[11px] text-ink-3">涨停个股名单（代码、名称、涨幅、首封时间）：数据待更新。</p>}
            </Panel>
          </BlurFade>
          <BlurFade delay={0.11} className="lg:col-span-2">
            <Panel title="跌停梯队" hint="首次跌停到连续跌停各有多少家">
              {downTiers === null ? <p className="text-sm text-ink-3">{st?.limit_down_count != null && <>当日跌停 <b className="tnum font-medium text-down">{st.limit_down_count}</b> 只。</>}连续跌停天数和跌停个股名单：数据待更新。</p>
                : downTiers.length === 0 ? <p className="text-sm text-ink-3">当日没有跌停个股。</p>
                : <TierBoard tiers={downTiers} kind="down" keyword={kw} label="跌停梯队" />}
            </Panel>
          </BlurFade>
        </ModuleGate>

        <ModuleGate module="themes">
          <BlurFade delay={0.14} className="lg:col-span-2">
            <Panel title="涨停个股的行业分布" className="h-full"
              hint={coverage?.total ? `按涨停个股所属行业归类，共 ${rankedThemes.length} 个行业，覆盖当日 ${coverage.classified ?? '—'} / ${coverage.total} 只涨停股` : `按涨停个股所属行业归类，共 ${rankedThemes.length} 个行业`}>
              {topThemes.length
                ? <RankBars rows={topThemes.map((t) => ({ name: t.industry, value: t.up_count }))} label="各行业涨停只数" />
                : <p className="text-sm text-ink-3">当日没有涨停个股的行业归类数据。</p>}
              {rankedThemes.length > 15 && (
                <button type="button" onClick={() => setAllThemes((v) => !v)} className="mt-3 cursor-pointer text-xs text-primary hover:underline">
                  {allThemes ? '只看前 15 个行业' : `展开全部 ${rankedThemes.length} 个行业（其余 ${rankedThemes.length - 15} 个合计 ${rankedThemes.slice(15).reduce((n, t) => n + t.up_count, 0)} 只）`}
                </button>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-ink-3">单位：只。{data?.theme_member_rule || '按涨停个股所属行业归类（行业分类口径，不是概念题材）'}。个别行业名称在数据源里被截成 4 个字，按原样显示。</p>
            </Panel>
          </BlurFade>
        </ModuleGate>
      </div>
    </PageFrame>
  )
}
