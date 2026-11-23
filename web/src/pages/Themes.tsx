import { useState } from 'react'
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
import { sealRate, tierHeight } from '@/lib/limitStructure'
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

  const topThemes = themes.filter((t) => t.up_count != null).sort((a, b) => b.up_count - a.up_count).slice(0, 15)
  const shownDate = hover == null ? env.trade_date : recent[hover]?.trade_date

  return (
    <PageFrame title="题材与涨跌结构" question="当日涨停、跌停、炸板如何分布，连板和题材集中在哪里？" env={env} loading={loading} onRetry={load} onJump={setTradeDate}
      tools={<DateInput value={tradeDate} onChange={setTradeDate} />}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {defs.length > 0 && (
          <ModuleGate module="structure">
            <BlurFade className="lg:col-span-2">
              <Panel title="涨停结构" hint="涨停、跌停、炸板、封板率、最高连板，附前一日对比与近 10 日走势" action={recent.length > 1 ? <DayChip hover={hover} date={shownDate} /> : undefined}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                  {defs.map((k, i) => {
                    // 指针在曲线上时回看那一日；否则用当日值，前一日取接口历史里的前一条
                    const cur = hover == null ? k.cur : k.field(recent[hover])
                    const prev = hover == null ? (prevDay ? k.field(prevDay) : null) : hover > 0 ? k.field(recent[hover - 1]) : null
                    const series = recent.map(k.field)
                    let sub = '较前一日：—'
                    if (cur != null && prev != null) {
                      const d = k.kind === 'rate' ? (cur - prev) * 100 : cur - prev
                      const unit = k.kind === 'rate' ? ' 个百分点' : k.kind === 'board' ? ' 板' : ''
                      sub = `较前一日 ${d > 0 ? '+' : ''}${fmt.num(d, k.kind === 'rate' ? 1 : 0)}${unit}`
                    }
                    return (
                      <IndGate key={k.key} ind={k.ind}>
                        <TrendTile label={k.label} value={cur} tone={k.tone} color={k.color} delay={0.3 + i * 0.07} sub={sub}
                          format={k.kind === 'rate' ? { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 } : undefined}
                          text={k.kind === 'board' && cur != null ? `${cur} 板` : undefined}
                          series={series.filter((v) => v != null).length >= 2 ? series : undefined} hover={hover} onHover={setHover} />
                      </IndGate>
                    )
                  })}
                </div>
                {recent.length > 1 && <p className="mt-3 text-[11px] text-ink-3">移到曲线上可回看近 {recent.length} 日中的任意一天。封板率 = 涨停 ÷（涨停 + 炸板）。</p>}
              </Panel>
            </BlurFade>
          </ModuleGate>
        )}

        <ModuleGate module="structure">
          <BlurFade delay={0.08} className="lg:col-span-2">
            <Panel title={<>涨停梯队{kw.trim() && <small className="ml-2 text-xs font-normal text-primary">匹配 {matchN} 只</small>}</>} hint="1 板到最高板各有多少家，附个股名称；移到名称上看代码、涨幅和首封时间"
              action={hasNames ? <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="按名称高亮，如 东方" aria-label="按名称高亮" className="h-8 w-44 text-xs" /> : undefined}>
              {tiers.length ? <TierBoard tiers={tiers} kind="up" keyword={kw} label="涨停梯队" /> : <p className="text-sm text-ink-3">当日暂无连板数据。</p>}
              {tiers.length > 0 && !hasNames && <p className="mt-3 text-[11px] text-ink-3">个股名称待数据接入。</p>}
            </Panel>
          </BlurFade>
          <BlurFade delay={0.11} className="lg:col-span-2">
            <Panel title="跌停梯队" hint="首次跌停到连续跌停各有多少家，附个股名称">
              {downTiers === null ? <p className="text-sm text-ink-3">跌停梯队数据待接入。</p>
                : downTiers.length === 0 ? <p className="text-sm text-ink-3">当日没有跌停个股。</p>
                : <TierBoard tiers={downTiers} kind="down" keyword={kw} label="跌停梯队" />}
            </Panel>
          </BlurFade>
        </ModuleGate>

        <ModuleGate module="themes">
          <BlurFade delay={0.14} className="lg:col-span-2">
            <Panel title="题材涨停数" hint="涨停只数前 15 的题材" className="h-full">
              {topThemes.length
                ? <RankBars rows={topThemes.map((t) => ({ name: t.industry, value: t.up_count, tag: t.highest_tier ?? '' }))} label="题材涨停只数排行" />
                : <p className="text-sm text-ink-3">当日没有进入题材榜的行业。</p>}
              {data?.theme_member_rule && <p className="mt-3 text-[11px] leading-relaxed text-ink-3">{data.theme_member_rule}</p>}
            </Panel>
          </BlurFade>
        </ModuleGate>
      </div>
    </PageFrame>
  )
}
