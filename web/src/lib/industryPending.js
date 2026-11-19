// 行业页的「数据待更新」判定（纯函数，便于测试）。
// 行业绝对成交额在 2026-09-18 之前不对外；5 日、20 日、RS 指标的窗口跨到下限之前也不显示。
export const INDUSTRY_FLOOR = '2026-09-18'
export const AMOUNT_KEYS = ['amount']

export function rollingMask(day) {
  return {
    sector_return_5d: day < '2026-09-25',
    sector_return_20d: day < '2026-10-16',
    rs: day < '2026-10-16',
  }
}

// 返回 true 表示该单元格显示「数据待更新」，不显示数值（也不能显示成 0）
export function isPending(key, row, day) {
  if (!day) return false
  if (AMOUNT_KEYS.includes(key) && (day < INDUSTRY_FLOOR || row?.[key] == null)) return true
  if (key === 'sector_return_5d' || key === 'sector_return_20d') return rollingMask(day)[key]
  return false
}
