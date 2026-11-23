// RRG 象限：RS-Ratio 与 RS-Momentum 相对基准线（中台 rrg_reference）的位置。颜色只表示象限位置，不带涨跌或主攻 / 规避含义
export type Quadrant = 'leading' | 'improving' | 'weakening' | 'lagging'
export const QUADRANTS: { key: Quadrant; label: string; token: 'viz-1' | 'viz-3' | 'viz-2' | 'viz-4' }[] = [
  { key: 'leading', label: '领先', token: 'viz-1' },
  { key: 'improving', label: '改善', token: 'viz-3' },
  { key: 'weakening', label: '转弱', token: 'viz-2' },
  { key: 'lagging', label: '落后', token: 'viz-4' },
]
export function quadrantOf(x: number, y: number, ref: number): Quadrant {
  const right = x >= ref
  const up = y >= ref
  if (right && up) return 'leading'
  if (!right && up) return 'improving'
  if (right) return 'weakening'
  return 'lagging'
}
export const quadrantToken = (q: Quadrant) => QUADRANTS.find((x) => x.key === q)!.token
// `rgb(r, g, b)` → `rgba(r, g, b, a)`（lib/useTokens 给 ECharts 的颜色是 rgb 字符串）
export const withAlpha = (rgb: string, a: number) => rgb.replace(/^rgba?\(([^)]+)\)$/, (_, inner: string) => `rgba(${inner.split(',').slice(0, 3).join(',')}, ${a})`)
