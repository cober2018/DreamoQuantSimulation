import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

// 通用时间序列图：线 / 面积 / 柱可以叠在一起，右轴给量纲不同的序列用。缺值不连线、不补 0。
export interface SeriesDef {
  key: string
  label: string
  color: string
  type?: 'line' | 'area' | 'bar'
  yAxisId?: 'left' | 'right'
  /** 柱按正负着色：正红负绿（只用于带方向的数） */
  signColor?: boolean
  /** 聚焦时其余线调淡、聚焦线加粗 */
  opacity?: number
  width?: number
}
interface Props {
  data: Record<string, any>[]
  xKey: string
  series: SeriesDef[]
  height?: number
  yDomain?: [number | 'auto', number | 'auto']
  rightDomain?: [number | 'auto', number | 'auto']
  refLines?: { y: number; label?: string }[]
  /** 水平色带（如标准分 ±1 的平常范围） */
  bands?: { y1: number; y2: number }[]
  /** 指针在第几个点上；离开时为 null（用于和别的图共用回看） */
  onHover?: (index: number | null) => void
  valueFormat?: (v: number) => string
  /** 坐标轴刻度的格式；不传则同 valueFormat（提示框用 valueFormat 保留更多小数） */
  axisFormat?: (v: number) => string
  rightFormat?: (v: number) => string
  xTickFormat?: (v: any) => string
  yUnit?: string
  /** 在该横坐标画一条金色竖虚线（首页演示用：标出选中的那一天） */
  markX?: string | number | null
}

const defaultFmt = (v: number) => v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })

export function SeriesChart({ data, xKey, series, height = 220, yDomain, rightDomain, refLines, bands, onHover, valueFormat = defaultFmt, axisFormat, rightFormat, xTickFormat, yUnit, markX }: Props) {
  const config = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) as ChartConfig
  const hasRight = series.some((s) => s.yAxisId === 'right')
  const rightKeys = new Set(series.filter((s) => s.yAxisId === 'right').map((s) => s.key))
  const tick = { fill: 'var(--c-ink-3)', fontSize: 11 }
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <ComposedChart data={data} margin={{ top: 8, right: hasRight ? 0 : 4, bottom: 0, left: 0 }} barCategoryGap="22%"
        onMouseMove={onHover ? (st: any) => { const i = Number(st?.activeTooltipIndex); onHover(Number.isFinite(i) ? i : null) } : undefined}
        onMouseLeave={onHover ? () => onHover(null) : undefined}>
        <CartesianGrid vertical={false} stroke="var(--c-line)" strokeDasharray="2 4" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} minTickGap={40} tickFormatter={xTickFormat} tick={tick} />
        <YAxis yAxisId="left" tickLine={false} axisLine={false} width={48} domain={yDomain} tickFormatter={axisFormat ?? valueFormat} tick={tick} unit={yUnit} />
        {hasRight && <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={48} domain={rightDomain} tickFormatter={rightFormat ?? axisFormat ?? valueFormat} tick={tick} />}
        <ChartTooltip cursor={{ stroke: 'var(--c-line-strong)', strokeDasharray: '2 3' }}
          content={<ChartTooltipContent hideIndicator labelFormatter={(l) => (xTickFormat ? xTickFormat(l) : String(l))}
            formatter={(value, name, item) => (
              <div className="flex w-full items-center gap-2">
                <i className="size-2 shrink-0 rounded-[2px]" style={{ background: (item as any).color }} />
                <span className="text-muted-foreground">{config[String(name)]?.label ?? name}</span>
                <span className="tnum ml-auto pl-3 font-medium">{typeof value === 'number' ? (rightKeys.has(String(name)) && rightFormat ? rightFormat(value) : valueFormat(value)) : '—'}</span>
              </div>
            )} />} />
        {bands?.map((b) => <ReferenceArea key={`${b.y1}-${b.y2}`} yAxisId="left" y1={b.y1} y2={b.y2} fill="var(--c-ink-3)" fillOpacity={0.1} ifOverflow="extendDomain" />)}
        {refLines?.map((r) => (
          <ReferenceLine key={r.y} yAxisId="left" y={r.y} stroke="var(--c-line-strong)" strokeDasharray="4 4"
            label={r.label ? { value: r.label, position: 'insideTopRight', fill: 'var(--c-ink-3)', fontSize: 10 } : { value: String(r.y), position: 'insideTopRight', fill: 'var(--c-ink-3)', fontSize: 10 }} />
        ))}
        {markX != null && <ReferenceLine yAxisId="left" x={markX} stroke="var(--c-accent)" strokeDasharray="4 3" strokeWidth={1.5} />}
        {series.map((s) => {
          const id = s.yAxisId ?? 'left'
          if (s.type === 'bar') {
            return (
              <Bar key={s.key} dataKey={s.key} yAxisId={id} fill={`var(--color-${s.key})`} radius={[2, 2, 0, 0]} animationDuration={700}>
                {s.signColor && data.map((d, i) => <Cell key={i} fill={Number(d[s.key]) >= 0 ? 'var(--c-up)' : 'var(--c-down)'} />)}
              </Bar>
            )
          }
          if (s.type === 'area') {
            return <Area key={s.key} dataKey={s.key} yAxisId={id} type="monotone" stroke={`var(--color-${s.key})`} strokeWidth={1.5} fill={`var(--color-${s.key})`} fillOpacity={0.12} dot={false} connectNulls={false} animationDuration={900} />
          }
          return <Line key={s.key} dataKey={s.key} yAxisId={id} type="monotone" stroke={`var(--color-${s.key})`} strokeWidth={s.width ?? 1.5} strokeOpacity={s.opacity ?? 1} dot={false} connectNulls={false} animationDuration={900} />
        })}
      </ComposedChart>
    </ChartContainer>
  )
}
