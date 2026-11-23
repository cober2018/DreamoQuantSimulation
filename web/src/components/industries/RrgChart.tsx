import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Panel } from '@/components/shell/Panel'
import { EChart } from '@/components/charts/EChart'
import { industrySeriesQuery } from '@/lib/industrySeries'
import { rollingMask } from '@/lib/industryPending'
import { QUADRANTS, quadrantOf, quadrantToken } from '@/lib/rrg'
import { useTokens } from '@/lib/useTokens'

interface Props { items: any[]; day: string; inWindow: boolean; rrgRef: number; canDetail: boolean; lockText: string; selected: string; onSelect: (code: string) => void }
// 只有选中的行业画轨迹，回看近 5 个交易日；其余行业只画当日位置
const STAR_DAYS = 5
// 整条轨迹从起点画到当日位置的时长
const DRAW_MS = 260
// 图高跟随窗口高度
export const CHART_H = 'clamp(380px, 58vh, 640px)'

export function RrgChart({ items, day, inWindow, rrgRef, canDetail, lockText, selected, onSelect }: Props) {
  const t = useTokens()
  const points = inWindow ? [] : items.filter((r) => r.rs_ratio != null && r.rs_momentum != null)
    .map((r) => ({ code: r.sector_code as string, name: r.sector_name as string, x: r.rs_ratio as number, y: r.rs_momentum as number }))

  // 选中行业的轨迹单独取数。取 20 天是为了和表格迷你线共用同一份缓存，只用最后 STAR_DAYS 天
  const starOn = !!selected && canDetail && !inWindow
  const starQ = useQuery({ ...industrySeriesQuery(selected, day, 20), enabled: starOn && !!day })
  const star = !starOn ? [] : ((starQ.data?.data?.points || []) as any[])
    .filter((p) => p.rs_ratio != null && p.rs_momentum != null && !rollingMask(p.trade_date).rs).slice(-STAR_DAYS)
    .map((p) => ({ x: p.rs_ratio as number, y: p.rs_momentum as number, date: p.trade_date as string }))
  const n = star.length
  const selName = items.find((r) => r.sector_code === selected)?.sector_name || selected

  // 轨迹按日期连续画出：draw.t 是画到第几个点（带小数，每帧更新）。记下它属于哪个行业，换行业的那一帧不会闪出整条新轨迹
  const [draw, setDraw] = useState({ code: '', t: 0 })
  const [run, setRun] = useState(0)
  const at = draw.code === selected && n >= 2 ? Math.min(draw.t, n - 1) : -1
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    if (n < 2) return
    if (reduced) { setDraw({ code: selected, t: n - 1 }); return }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / DRAW_MS))
      // 先快后缓，落到当日位置时收住
      setDraw({ code: selected, t: (1 - (1 - p) ** 3) * (n - 1) })
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [selected, n, run, reduced])

  // 坐标范围只按当日全部行业的位置定，以参考线为中心对称并留 30% 余量；选中、连线都不会再改动坐标轴
  const half = (vals: number[]) => Math.max(2, Math.ceil(Math.max(0, ...vals.map((v) => Math.abs(v - rrgRef))) * 1.3))
  const hx = half(points.map((p) => p.x))
  const hy = half(points.map((p) => p.y))
  const outN = star.filter((p) => Math.abs(p.x - rrgRef) > hx || Math.abs(p.y - rrgRef) > hy).length

  // 起点日期标在背向下一个点的一侧，不压在连线上
  const dx = n > 1 ? star[1].x - star[0].x : 0
  const dy = n > 1 ? star[1].y - star[0].y : 0
  const startPos = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'left' : 'right') : dy > 0 ? 'bottom' : 'top'

  // 已到达的点照常画；线头在两点之间按比例插值，所以线是连续伸出去的，不是一段一段跳出来
  const reached = Math.floor(at)
  const tip = at >= 0 && reached < n - 1
    ? { x: star[reached].x + (star[reached + 1].x - star[reached].x) * (at - reached), y: star[reached].y + (star[reached + 1].y - star[reached].y) * (at - reached) }
    : null
  const starSeries = at < 0 ? [] : [{
    type: 'line', id: 'star', name: selName, z: 4, symbol: 'circle', clip: true,
    // 每帧自己给位置，不用图表库的过渡
    animation: false,
    lineStyle: { width: 2.5, color: t['ink-2'], opacity: 0.85 },
    data: [
      // 越近的点越大越实
      ...star.slice(0, reached + 1).map((p, i) => {
        const f = i / (n - 1)
        const c = t[quadrantToken(quadrantOf(p.x, p.y, rrgRef))]
        return {
          value: [p.x, p.y], name: selName, code: selected, date: p.date,
          symbolSize: 6 + 4 * f,
          itemStyle: { color: c, opacity: 0.4 + 0.6 * f, shadowBlur: 5, shadowColor: c },
          label: i === 0 ? { show: true, formatter: p.date.slice(5), position: startPos, color: t['ink-3'], fontSize: 10 } : { show: false },
        }
      }),
      // 线头：金色光点
      ...(tip ? [{ value: [tip.x, tip.y], name: selName, code: selected, symbolSize: 9, itemStyle: { color: t.accent, shadowBlur: 14, shadowColor: t.accent }, label: { show: false } }] : []),
    ],
  }]

  // 板块多（概念板块有几百个）时把点缩小，免得糊成一片
  const dot = points.length > 150 ? 6 : points.length > 60 ? 7 : 9
  const option = {
    animationDuration: 900,
    tooltip: { formatter: (p: any) => `${p.data.name}${p.data.date ? ` · ${p.data.date}` : ''}<br/>RS ${p.data.value[0].toFixed(2)}<br/>动量 ${p.data.value[1].toFixed(2)}` },
    grid: { left: 52, right: 24, top: 28, bottom: 44 },
    xAxis: { type: 'value', min: rrgRef - hx, max: rrgRef + hx, name: '相对强度', nameLocation: 'middle', nameGap: 28, splitLine: { lineStyle: { color: t.line } } },
    yAxis: { type: 'value', min: rrgRef - hy, max: rrgRef + hy, name: '相对动量', splitLine: { lineStyle: { color: t.line } } },
    series: [
      ...starSeries,
      {
        // 有选中时其余点透明度 0.2；选中的点交给下面的 sel 系列画
        type: 'scatter', id: 'today', symbolSize: dot, z: 3,
        data: points.filter((p) => p.code !== selected).map((p) => ({
          value: [p.x, p.y], name: p.name, code: p.code,
          itemStyle: { color: t[quadrantToken(quadrantOf(p.x, p.y, rrgRef))], opacity: selected ? 0.2 : points.length > 150 ? 0.65 : 0.85 },
        })),
        markLine: { silent: true, symbol: 'none', lineStyle: { color: t['ink-3'], type: 'dashed' }, data: [{ xAxis: rrgRef }, { yAxis: rrgRef }] },
      },
      // 选中的点：放大、金色光晕，立即出现（连线每走一步都会重设配置，入场过渡会被反复打断，所以关掉）；
      // 外圈金色涟漪单独一个系列画在它下面，持续扩散。系统设置了「减少动态效果」时不放涟漪
      ...points.filter((p) => p.code === selected).flatMap((p) => {
        const data = [{ value: [p.x, p.y], name: p.name, code: p.code }]
        return [
          ...(reduced ? [] : [{ type: 'effectScatter', id: 'sel-ripple', z: 5, symbolSize: 18, silent: true, itemStyle: { color: t.accent },
            rippleEffect: { color: t.accent, brushType: 'stroke', scale: 3.2, period: 2.4, number: 2 }, data }]),
          { type: 'scatter', id: 'sel', z: 6, symbolSize: 20, animation: false,
            itemStyle: { color: t[quadrantToken(quadrantOf(p.x, p.y, rrgRef))], opacity: 1, borderColor: t.surface, borderWidth: 2, shadowBlur: 18, shadowColor: t.accent },
            label: { show: true, formatter: p.name, position: 'top', distance: 12, color: t.ink, fontSize: 13, fontWeight: 700, textBorderColor: t.surface, textBorderWidth: 3 },
            data },
        ]
      }),
    ],
  }

  return (
    <Panel title="相对旋转图" hint="散点为当日位置。点选一个行业，按日期依次连出它近 5 个交易日的轨迹" className="h-full">
      {inWindow ? <div role="status" className="py-16 text-center text-sm text-ink-3">数据待更新</div> : (
        <>
          <EChart option={option} height={CHART_H} ariaLabel="相对旋转图" onClick={(p) => {
            if (p.data?.code) onSelect(p.data.code)
          }} />
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3" aria-label="象限图例">
            {QUADRANTS.map((q) => <li key={q.key} className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full" style={{ background: t[q.token] }} />{q.label}</li>)}
          </ul>
        </>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-ink-3">横轴为相对强度，纵轴为相对动量，参考线为 {rrgRef}。颜色只表示象限位置，图形仅呈现历史相对位置。</p>
      {inWindow ? <p className="mt-1 text-[11px] text-ink-3">该日期的 RS 指标窗口跨到 2026-09-18 之前，数据待更新，图中留空。</p>
        : !canDetail ? <p className="mt-1 text-[11px] text-ink-3">5 日轨迹需要 {lockText} 等级，当前只显示当日位置。</p>
        : <p className="mt-1 text-[11px] text-ink-3">选中的行业显示近 {STAR_DAYS} 个交易日的轨迹，其余行业只显示当日位置。</p>}
      {starOn && n >= 2 && (
        <p className="mt-1 text-[11px] text-ink-2" aria-live="polite">
          已选 {selName}：{star[0].date.slice(5)} 至 {star[n - 1].date.slice(5)}，共 {n} 个交易日，越近的点越大。{outN > 0 && `其中 ${outN} 个点超出图框，未显示。`}
          <button type="button" className="ml-2 cursor-pointer text-primary underline" onClick={() => setRun((v) => v + 1)}>重播</button>
        </p>
      )}
      {starOn && starQ.isSuccess && n < 2 && <p className="mt-1 text-[11px] text-ink-3">{selName} 可用的相对强度历史不足 2 个交易日，无法连线。</p>}
    </Panel>
  )
}
