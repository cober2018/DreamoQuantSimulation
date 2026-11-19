// 行业页图形配色，取自 C 设计 token（light，见 styles/tokens.css）。ECharts 只认字面量，故此处写死同值。
// 涨跌用红涨绿跌；象限色只表示 RRG 位置，不带涨跌或主攻 / 规避含义。
export const UP = 'hsl(1, 60%, 42%)'
export const DOWN = 'hsl(155, 55%, 27%)'
export const NEUTRAL = 'hsl(220, 14%, 52%)'
export const GRID_LINE = 'hsl(216, 24%, 86%)'
export const INK_MUTED = 'hsl(220, 14%, 40%)'

export const QUADRANTS = [
  { key: 'leading', label: '领先', color: 'hsl(222, 52%, 20%)' },
  { key: 'improving', label: '改善', color: 'hsl(213, 53%, 38%)' },
  { key: 'weakening', label: '转弱', color: 'hsl(36, 78%, 32%)' },
  { key: 'lagging', label: '落后', color: 'hsl(250, 29%, 45%)' },
]

// RRG 象限：RS-Ratio 与 RS-Momentum 相对基准线（中台 rrg_reference）的位置
export function quadrantOf(x, y, ref) {
  const right = x >= ref
  const up = y >= ref
  if (right && up) return QUADRANTS[0]
  if (!right && up) return QUADRANTS[1]
  if (right) return QUADRANTS[2]
  return QUADRANTS[3]
}

export const retColor = (v) => (v == null ? NEUTRAL : v >= 0 ? UP : DOWN)
