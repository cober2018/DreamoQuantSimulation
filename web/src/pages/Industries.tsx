import { useEffect, useState } from 'react'
import { PageFrame } from '@/components/shell/PageFrame'
import { Panel } from '@/components/shell/Panel'
import { DateInput } from '@/components/shell/DateInput'
import { ModuleGate } from '@/components/shell/Gates'
import { Dumbbell, type DumbbellRow } from '@/components/charts/Dumbbell'
import { DivergingBars, type BarRow } from '@/components/charts/DivergingBars'
import { IndustryDetail } from '@/components/industries/IndustryDetail'
import { IndustryTable } from '@/components/industries/IndustryTable'
import { RrgChart } from '@/components/industries/RrgChart'
import { SelectionBar } from '@/components/industries/SelectionBar'
import { TreemapPanel } from '@/components/industries/TreemapPanel'
import { BlurFade } from '@/components/fx/blur-fade'
import { HaloSegmented } from '@/components/fx/halo-segmented'
import { Input } from '@/components/ui/input'
import { useCan, useSession } from '@/lib/auth'
import { INDUSTRY_FLOOR, rollingMask } from '@/lib/industryPending'
import { cellPending } from '@/lib/industryPending'
import { useModule } from '@/lib/queries'

const IDX_TYPES = ['行业板块', '概念板块', '地域板块'].map((t) => ({ value: t, label: t }))
const FLOW_PERIODS = [{ value: '1d', label: '1 日' }, { value: '5d', label: '5 日' }, { value: '20d', label: '20 日' }]
const TOP_N = 10
const CAP = 20

export function Component() {
  const can = useCan()
  const user = useSession((s) => s.user)
  const canDetail = can('data.detail')
  const lockText = user?.perm_min_role?.['data.detail'] || '更高等级'

  const [idxType, setIdxType] = useState('行业板块')
  const [tradeDate, setTradeDate] = useState('')
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState('')
  const [flowPeriod, setFlowPeriod] = useState('1d')
  const { env, loading, load } = useModule('industries', { idx_type: idxType, trade_date: tradeDate || undefined })
  const items: any[] = env.data?.items || []
  const wide = items.length > 60 ? 'xl:col-span-2' : undefined
  const day = env.trade_date || ''
  const rrgRef = Number(env.data?.rrg_reference) || 100
  // RS 指标窗口跨到下限之前时，RRG 整体待更新
  const inWindow = rollingMask(day).rs
  useEffect(() => { setSelected('') }, [idxType, keyword, tradeDate])
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

  const sorted = items.filter((r) => r.di != null).sort((a, b) => b.di - a.di)
  const toDumb = (r: any, pinned = false): DumbbellRow => ({ code: r.sector_code, name: r.sector_name, a: r.above_ma20_ratio ?? null, b: r.new_high_20d_ratio ?? null, di: r.di ?? null, pinned })
  const diffusionShown = (sorted.length > CAP * 2 ? [...sorted.slice(0, CAP), ...sorted.slice(-CAP)] : sorted).map((r) => toDumb(r))
  const diffusionRows = selectedItem && !diffusionShown.some((r) => r.code === selected) ? [...diffusionShown, toDumb(selectedItem, true)] : diffusionShown

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
      <p className="-mt-2 mb-4 text-xs text-ink-3">行业数据从 {INDUSTRY_FLOOR} 起提供。</p>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* 板块多（概念板块有几百个）时，旋转图和成交地图各占一整行，否则点和色块挤不下 */}
        <ModuleGate module="rrg">
          <BlurFade className={wide}><RrgChart items={items} day={day} inWindow={inWindow} rrgRef={rrgRef} canDetail={canDetail} lockText={lockText} selected={selected} onSelect={toggle} /></BlurFade>
        </ModuleGate>
        <BlurFade delay={0.06} className={wide}><TreemapPanel items={items} day={day} selected={selected} onSelect={toggle} /></BlurFade>

        <BlurFade delay={0.12}>
          <Panel title="资金净流入" hint="前后各 10 个行业，单位亿元" className="h-full" action={<HaloSegmented items={FLOW_PERIODS} value={flowPeriod} onValueChange={setFlowPeriod} translucent={false} className="[&_button]:whitespace-nowrap" />}>
            {flowRows.length ? <DivergingBars rows={flowRows} digits={1} selected={selected} onSelect={toggle} /> : <div role="status" className="py-10 text-center text-sm text-ink-3">没有可用的净流入数据</div>}
            <p className="mt-3 text-[11px] text-ink-3">红色为净流入，绿色为净流出。净流入为空的行业不计入，不以 0 计。</p>
          </Panel>
        </BlurFade>
        <BlurFade delay={0.18}>
          <Panel title="扩散度" hint="按扩散度 di 从高到低排列" className="h-full">
            {diffusionRows.length ? <Dumbbell rows={diffusionRows} selected={selected} onSelect={toggle} /> : <div role="status" className="py-10 text-center text-sm text-ink-3">没有可用的扩散度数据</div>}
            <p className="mt-3 text-[11px] leading-relaxed text-ink-3">两点之间的连线为两个占比的差。站上 20 日线占比、20 日新高占比为空的行业不画点。行业较多时显示 di 最高 20 个与最低 20 个。</p>
          </Panel>
        </BlurFade>

        <BlurFade delay={0.24} className="xl:col-span-2">
          <IndustryTable items={items} keyword={keyword} day={day} endDate={day} canDetail={canDetail} lockText={lockText} selected={selected} onSelect={toggle} />
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
