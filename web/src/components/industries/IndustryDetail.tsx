import { Link } from 'react-router'
import { Panel } from '@/components/shell/Panel'
import { EChart } from '@/components/charts/EChart'
import { SeriesChart } from '@/components/charts/SeriesChart'
import { payOn } from '@/lib/auth'
import { rollingMask } from '@/lib/industryPending'
import { useIndustrySeries } from '@/lib/industrySeries'
import { useTokens } from '@/lib/useTokens'

// 选中某一行后的近期序列：左为涨跌幅（柱）和净流入（线），右为 RS 轨迹
export function IndustryDetail({ code, name, endDate, rrgRef, canDetail, lockText }: { code: string; name: string; endDate: string; rrgRef: number; canDetail: boolean; lockText: string }) {
  const t = useTokens()
  const q = useIndustrySeries(code, endDate, canDetail)
  const series = q.data
  const pts = ((series?.data?.points || []) as any[])
  const data = pts.map((p) => ({ date: p.trade_date as string, ret: p.sector_return == null ? null : +(p.sector_return * 100).toFixed(2), flow: p.net_flow_1d ?? null }))
  const trail = pts.filter((p) => p.rs_ratio != null && !rollingMask(p.trade_date).rs).map((p) => [p.rs_ratio, p.rs_momentum, p.trade_date])
  const trailOption = {
    animationDuration: 800,
    tooltip: { formatter: (p: any) => `${p.data[2]}<br/>RS ${p.data[0]}<br/>Mom ${p.data[1]}` },
    grid: { left: 50, right: 30, top: 24, bottom: 40 },
    xAxis: { type: 'value', scale: true, name: '相对强度', nameLocation: 'middle', nameGap: 26 },
    yAxis: { type: 'value', scale: true },
    series: [{ type: 'line', symbolSize: 8, itemStyle: { color: t['viz-3'] }, lineStyle: { color: t['viz-3'] }, data: trail,
      markLine: { silent: true, symbol: 'none', lineStyle: { color: t['ink-3'], type: 'dashed' }, data: [{ xAxis: rrgRef }, { yAxis: rrgRef }] } }],
  }
  const status = series?.status
  return (
    <Panel title={<>{name} 近期序列{canDetail && <small className="ml-2 text-xs font-normal text-ink-3">{pts.length} / {series?.data?.requested_days || 5} 个交易日{status === 'partial' && '（不足，未插值）'}</small>}</>}>
      {!canDetail ? <div className="rounded-md border border-dashed px-4 py-3 text-sm text-ink-3">近期序列属于下钻明细，需要 {lockText}。{payOn() && <Link className="ml-2 text-primary underline" to="/plans">查看会员套餐</Link>}</div>
        : q.isPending ? <p className="text-sm text-ink-3">加载中…</p>
        : status && !['ok', 'partial', 'empty'].includes(status) ? <p className="text-sm text-ink-3">序列暂时无法加载，请稍后重试。</p>
        : !pts.length ? <p className="text-sm text-ink-3">没有可用序列。</p>
        : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="min-w-0">
              <div className="mb-1 flex gap-4 text-[11px] text-ink-3"><span className="flex items-center gap-1.5"><i className="inline-block size-2 rounded-[2px] bg-up" />涨跌幅 %（柱，红涨绿跌）</span><span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-3.5 rounded bg-[var(--c-viz-3)]" />净流入 亿元（线，右轴）</span></div>
              <SeriesChart data={data} xKey="date" height={260} xTickFormat={(d) => String(d).slice(5)}
                series={[{ key: 'ret', label: '涨跌幅%', color: 'var(--c-up)', type: 'bar', signColor: true }, { key: 'flow', label: '净流入(亿元)', color: 'var(--c-viz-3)', type: 'line', yAxisId: 'right' }]}
                valueFormat={(v) => `${v.toFixed(2)}%`} axisFormat={(v) => `${v}%`} rightFormat={(v) => v.toFixed(1)} />
            </div>
            <div className="min-w-0"><div className="mb-1 text-[11px] text-ink-3">相对强度轨迹（RS-Ratio 对 RS-Momentum，虚线为 {rrgRef}）</div><EChart option={trailOption} height={260} ariaLabel="相对强度轨迹" /></div>
          </div>
        )}
    </Panel>
  )
}
