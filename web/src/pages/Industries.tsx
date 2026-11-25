import { useEffect, useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { PageFrame } from '@/components/shell/PageFrame'
import { Panel } from '@/components/shell/Panel'
import { DateInput } from '@/components/shell/DateInput'
import { ModuleGate } from '@/components/shell/Gates'
import { Dumbbell, type DumbbellRow } from '@/components/charts/Dumbbell'
import { DivergingBars, type BarRow } from '@/components/charts/DivergingBars'
import { SeriesChart } from '@/components/charts/SeriesChart'
import { IndustryDetail } from '@/components/industries/IndustryDetail'
import { IndustryTable } from '@/components/industries/IndustryTable'
import { RrgChart } from '@/components/industries/RrgChart'
import { SelectionBar } from '@/components/industries/SelectionBar'
import { TreemapPanel } from '@/components/industries/TreemapPanel'
import { BlurFade } from '@/components/fx/blur-fade'
import { HaloSegmented } from '@/components/fx/halo-segmented'
import { Input } from '@/components/ui/input'
import { fmt } from '@/lib/api'
import { useCan, useSession } from '@/lib/auth'
import { INDUSTRY_FLOOR, rollingMask } from '@/lib/industryPending'
import { cellPending } from '@/lib/industryPending'
import { industrySeriesQuery } from '@/lib/industrySeries'
import { useModule } from '@/lib/queries'

const IDX_TYPES = ['行业板块', '概念板块', '地域板块'].map((t) => ({ value: t, label: t }))
const FLOW_PERIODS = [{ value: '1d', label: '1 日' }, { value: '5d', label: '5 日' }, { value: '20d', label: '20 日' }]
const LEVEL_NAMES: Record<string, string> = { '1': '一级行业', '2': '二级行业', '3': '三级行业' }
const TOP_N = 10
const CAP = 20
// 扩散度排行、领涨行业只在成分股不少于这个数的行业里取：成分股太少时占比只有 0%、50%、100% 几档，排行没有意义
const MIN_MEMBERS = 10
const LEADERS = 3
const big = (r: any) => (r.member_count ?? 0) >= MIN_MEMBERS

export function Component() {
  const can = useCan()
  const user = useSession((s) => s.user)
  const canDetail = can('data.detail')
  const lockText = user?.perm_min_role?.['data.detail'] || '更高等级'

  const [idxType, setIdxType] = useState('行业板块')
  const [level, setLevel] = useState('1')
  const [tradeDate, setTradeDate] = useState('')
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState('')
  const [flowPeriod, setFlowPeriod] = useState('1d')
  const { env, loading, load } = useModule('industries', { idx_type: idxType, trade_date: tradeDate || undefined })
  const all: any[] = useMemo(() => env.data?.items || [], [env.data])
  // 行业板块按东财一、二、三级分开看，默认一级；概念、地域板块没有级别。级别由中台给出，某个交易日没有级别数据时显示全部并注明
  const isIndustry = idxType === '行业板块'
  const levelCount = (lv: string) => all.filter((r) => String(r.level) === lv).length
  const hasLevel = isIndustry && all.some((r) => r.level != null)
  const levelItems = Object.keys(LEVEL_NAMES).filter((lv) => levelCount(lv) > 0).map((lv) => ({ value: lv, label: `${LEVEL_NAMES[lv]} ${levelCount(lv)}` }))
  const curLevel = levelItems.some((x) => x.value === level) ? level : levelItems[0]?.value
  const items: any[] = useMemo(() => (hasLevel ? all.filter((r) => String(r.level) === curLevel) : all), [all, hasLevel, curLevel])
  const scopeName = hasLevel ? LEVEL_NAMES[curLevel!] : isIndustry ? '行业' : idxType

  const wide = items.length > 60 ? 'xl:col-span-2' : undefined
  const day = env.trade_date || ''
  const rrgRef = Number(env.data?.rrg_reference ?? 0)
  // 相对强度窗口跨到下限之前时，旋转图整体待更新
  const inWindow = rollingMask(day).rs
  useEffect(() => { setSelected('') }, [idxType, curLevel, keyword, tradeDate])
  // 再点一次同一个行业取消选中；Esc 也取消
  const toggle = (code: string) => setSelected((cur) => (cur === code ? '' : code))
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected('') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  // 前 10 个净流入在上，前 10 个净流出在下；按周期取值，空值跳过
  const flowKey = `net_flow_${flowPeriod}`
  const ranked = items.filter((r) => r[flowKey] != null).map((r) => ({ code: r.sector_code as string, name: r.sector_name as string, value: r[flowKey] + 0 })).sort((a, b) => b.value - a.value)
  const flowShown: BarRow[] = [...ranked.filter((r) => r.value > 0).slice(0, TOP_N), ...ranked.filter((r) => r.value < 0).slice(-TOP_N)]
  const selectedItem = items.find((r) => r.sector_code === selected) || null
  // 选中的行业不在前后 10 名里：列表末尾单独补一行「已选」，本项为空则显示「数据待更新」
  const flowRows: BarRow[] = selectedItem && !flowShown.some((r) => r.code === selected)
    ? [...flowShown, { code: selected, name: selectedItem.sector_name, value: selectedItem[flowKey] == null || cellPending(flowKey, selectedItem, day) ? null : selectedItem[flowKey] + 0, pinned: true }]
    : flowShown

  const sorted = items.filter((r) => r.di != null && big(r)).sort((a, b) => b.di - a.di)
  const smallN = items.filter((r) => r.di != null && !big(r)).length
  const toDumb = (r: any, pinned = false): DumbbellRow => ({ code: r.sector_code, name: r.sector_name, a: r.above_ma20_ratio ?? null, b: r.new_high_20d_ratio ?? null, di: r.di ?? null, pinned })
  const diffusionShown = (sorted.length > CAP * 2 ? [...sorted.slice(0, CAP), ...sorted.slice(-CAP)] : sorted).map((r) => toDumb(r))
  const diffusionRows = selectedItem && !diffusionShown.some((r) => r.code === selected) ? [...diffusionShown, toDumb(selectedItem, true)] : diffusionShown

  // 领涨行业：当前级别里当日涨幅最大的 3 个（成分股不少于 MIN_MEMBERS 只），看之前几天是否也在涨。序列与近期序列面板共用缓存
  const leaders = useMemo(() => items.filter((r) => r.sector_return != null && big(r)).sort((a, b) => b.sector_return - a.sector_return).slice(0, LEADERS), [items])
  const leaderQs = useQueries({ queries: leaders.map((r) => ({ ...industrySeriesQuery(r.sector_code, day), enabled: canDetail && !!day })) })
  const leaderCharts = leaders.map((r, i) => ({
    code: r.sector_code as string, name: r.sector_name as string, pct: r.sector_return as number, pending: leaderQs[i]?.isPending,
    points: ((leaderQs[i]?.data?.data?.points || []) as any[]).map((p) => ({ date: String(p.trade_date), ret: p.sector_return == null || p.trade_date < INDUSTRY_FLOOR ? null : +(p.sector_return * 100).toFixed(2) })),
  }))
  // 三张小图共用纵轴刻度，才能互相比较
  const allRet = leaderCharts.flatMap((c) => c.points.map((p) => p.ret)).filter((v): v is number => v != null)
  const leaderDomain: [number, number] | undefined = allRet.length ? [Math.floor(Math.min(...allRet, 0)), Math.ceil(Math.max(...allRet, 0))] : undefined

  // 搜索只在当前级别里找；别的级别里有匹配时给出入口，不让人以为没有这个行业
  const kw = keyword.trim()
  const otherHits = hasLevel && kw ? levelItems.filter((x) => x.value !== curLevel).map((x) => ({ lv: x.value, n: all.filter((r) => String(r.level) === x.value && (r.sector_name?.includes(kw) || r.sector_code?.includes(kw))).length })).filter((x) => x.n > 0) : []

  const selectedName = selectedItem?.sector_name || selected
  const flowLabel = FLOW_PERIODS.find((p) => p.value === flowPeriod)?.label.replace(' ', '') || ''

  return (
    <PageFrame title="行业比较与轮动" question="不同板块已发生的表现有什么差异？" env={env} loading={loading} onRetry={load} onJump={setTradeDate}
      tools={
        <div className="flex flex-wrap items-center gap-2">
          <HaloSegmented items={IDX_TYPES} value={idxType} onValueChange={setIdxType} translucent={false} className="[&_button]:whitespace-nowrap" />
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索名称或代码" aria-label="搜索行业名称或代码" className="w-44" />
          <DateInput value={tradeDate} onChange={setTradeDate} min={INDUSTRY_FLOOR} />
        </div>
      }>
      <div className="-mt-2 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {hasLevel && levelItems.length > 1 && <HaloSegmented items={levelItems} value={curLevel!} onValueChange={setLevel} translucent={false} className="[&_button]:whitespace-nowrap" />}
        <p className="text-xs text-ink-3">
          行业数据从 {INDUSTRY_FLOOR} 起提供。
          {hasLevel && `行业板块按一、二、三级分开显示，下面的图和表都只含${LEVEL_NAMES[curLevel!]}。`}
          {isIndustry && !hasLevel && all.length > 0 && '该交易日的行业级别数据待更新，暂时显示全部行业（一、二、三级在一起）。'}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* 板块多（概念板块有几百个）时，旋转图和成交地图各占一整行，否则点和色块挤不下 */}
        <ModuleGate module="rrg">
          <BlurFade className={wide}><RrgChart items={items} day={day} inWindow={inWindow} rrgRef={rrgRef} canDetail={canDetail} lockText={lockText} selected={selected} onSelect={toggle} /></BlurFade>
        </ModuleGate>
        <BlurFade delay={0.06} className={wide}><TreemapPanel items={items} day={day} selected={selected} onSelect={toggle} /></BlurFade>

        <BlurFade delay={0.12}>
          <Panel title="资金净流入" hint={`${scopeName}里净流入最多与净流出最多的各 10 个，单位亿元`} className="h-full" action={<HaloSegmented items={FLOW_PERIODS} value={flowPeriod} onValueChange={setFlowPeriod} translucent={false} className="[&_button]:whitespace-nowrap" />}>
            {flowRows.length ? <DivergingBars rows={flowRows} digits={1} selected={selected} onSelect={toggle} /> : <div role="status" className="py-10 text-center text-sm text-ink-3">没有可用的净流入数据</div>}
            <p className="mt-3 text-[11px] text-ink-3">红色为净流入，绿色为净流出。净流入为空的行业不计入，不以 0 计。</p>
          </Panel>
        </BlurFade>
        <BlurFade delay={0.18}>
          <Panel title="扩散度" hint={`${scopeName}按扩散度从高到低排列，只排成分股不少于 ${MIN_MEMBERS} 只的`} className="h-full">
            {diffusionRows.length ? <Dumbbell rows={diffusionRows} selected={selected} onSelect={toggle} /> : <div role="status" className="py-10 text-center text-sm text-ink-3">没有可用的扩散度数据</div>}
            <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
              两点分别是站上 20 日线的成分股占比和创 20 日新高的成分股占比，连线为两者的差；为空的不画点。
              {smallN > 0 && `成分股少于 ${MIN_MEMBERS} 只的 ${smallN} 个不参与排行（占比只有少数几档，容易出现 0% 或 100%），在下方表格里仍可查看。`}
              {sorted.length > CAP * 2 && `数量较多时显示扩散度最高 ${CAP} 个与最低 ${CAP} 个。`}
            </p>
          </Panel>
        </BlurFade>

        <BlurFade delay={0.21} className="xl:col-span-2">
          <Panel title="领涨行业 5 日走势" hint={`${scopeName}里当日涨幅最大的 ${LEADERS} 个（成分股不少于 ${MIN_MEMBERS} 只），之前几天是否也在涨`}>
            {!canDetail ? <div className="rounded-md border border-dashed px-4 py-3 text-sm text-ink-3">5 日走势属于下钻明细，需要 {lockText}。</div>
              : !leaderCharts.length ? <p className="text-sm text-ink-3">没有可用的领涨行业数据。</p>
              : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {leaderCharts.map((c) => (
                    <article key={c.code} className="min-w-0 rounded-md border p-3">
                      <header className="mb-1 flex justify-between gap-2 text-sm">
                        <button type="button" onClick={() => toggle(c.code)} className="cursor-pointer truncate hover:underline">{c.name}</button>
                        <span className={`tnum ${fmt.dir(c.pct) === 'rise' ? 'text-up' : fmt.dir(c.pct) === 'fall' ? 'text-down' : ''}`}>{fmt.pct(c.pct)}</span>
                      </header>
                      {c.points.length
                        ? <SeriesChart data={c.points} xKey="date" height={120} series={[{ key: 'ret', label: '当日涨跌幅', color: 'var(--c-up)', type: 'bar', signColor: true }]}
                            xTickFormat={(d) => String(d).slice(5)} yDomain={leaderDomain} valueFormat={(v) => `${v}%`} />
                        : <p className="py-6 text-center text-xs text-ink-3">{c.pending ? '加载中…' : '数据待更新'}</p>}
                    </article>
                  ))}
                </div>
              )}
            <p className="mt-3 text-[11px] text-ink-3">柱为每个交易日的涨跌幅（红涨绿跌），三张图共用纵轴刻度，便于比较。只列出已发生的涨跌。</p>
          </Panel>
        </BlurFade>

        <BlurFade delay={0.24} className="xl:col-span-2">
          <IndustryTable title={hasLevel ? `${LEVEL_NAMES[curLevel!]}表` : isIndustry ? '全行业表' : `${idxType}表`} items={items} keyword={keyword} day={day} endDate={day} canDetail={canDetail} lockText={lockText} selected={selected} onSelect={toggle}
            note={otherHits.length > 0 && (
              <p className="mb-3 text-xs text-ink-3">其他级别里也有匹配「{kw}」的行业：
                {otherHits.map((h) => <button key={h.lv} type="button" onClick={() => setLevel(h.lv)} className="ml-2 cursor-pointer text-primary underline">{LEVEL_NAMES[h.lv]} {h.n} 个</button>)}
              </p>
            )} />
        </BlurFade>

        {selected && (
          <BlurFade className="xl:col-span-2" >
            <div id="industry-detail" className="scroll-mt-4" />
            <IndustryDetail code={selected} name={selectedName} endDate={env.trade_date || ''} rrgRef={rrgRef} canDetail={canDetail} lockText={lockText} />
          </BlurFade>
        )}
      </div>
      <SelectionBar row={selectedItem} day={day} flowKey={flowKey} flowLabel={flowLabel} rrgRef={rrgRef} rsOk={!inWindow} canDetail={canDetail}
        onClose={() => setSelected('')} onJumpDetail={() => document.getElementById('industry-detail')?.scrollIntoView({ behavior: 'smooth' })} />
    </PageFrame>
  )
}
