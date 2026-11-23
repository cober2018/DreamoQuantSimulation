import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

interface Row { date: string; turnover?: number | null }

const config = {
  prev: { label: '成交额', color: 'var(--c-viz-1)' },
  today: { label: '当日成交额', color: 'var(--c-accent)' },
  ma20: { label: '20 日均值', color: 'var(--c-viz-1)' },
} satisfies ChartConfig

// 20 日均值只是把同一列数据做平滑，方便看当日相对近期的高低；不足 20 日的位置不画
function withMa(rows: Row[]) {
  return rows.map((r, i) => {
    const win = rows.slice(Math.max(0, i - 19), i + 1).map((x) => x.turnover).filter((v): v is number => v != null)
    const last = i === rows.length - 1
    return {
      date: r.date,
      prev: last ? null : r.turnover ?? null,
      today: last ? r.turnover ?? null : null,
      ma20: i >= 19 && win.length === 20 ? win.reduce((a, b) => a + b, 0) / 20 : null,
    }
  })
}

const yi = (v: number) => v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })

export function TurnoverChart({ rows, height = 260 }: { rows: Row[]; height?: number }) {
  const data = withMa(rows)
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="var(--c-line)" strokeDasharray="2 4" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={48} tickFormatter={(d: string) => d.slice(5)} tick={{ fill: 'var(--c-ink-3)', fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={yi} tick={{ fill: 'var(--c-ink-3)', fontSize: 11 }} domain={[0, 'auto']} />
        <ChartTooltip cursor={{ fill: 'var(--c-accent-soft)' }} content={<ChartTooltipContent indicator="dot" />} />
        <Bar dataKey="prev" stackId="t" fill="var(--color-prev)" fillOpacity={0.26} radius={[2, 2, 0, 0]} animationDuration={700} />
        <Bar dataKey="today" stackId="t" fill="var(--color-today)" radius={[2, 2, 0, 0]} animationDuration={700} />
        <Line dataKey="ma20" type="monotone" stroke="var(--color-ma20)" strokeWidth={1.5} dot={false} connectNulls={false} animationDuration={1100} animationBegin={300} />
      </ComposedChart>
    </ChartContainer>
  )
}
