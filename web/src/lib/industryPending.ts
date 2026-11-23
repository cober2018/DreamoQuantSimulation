// 行业页的「数据待更新」判定（纯函数，便于测试）。
// 行业绝对成交额在 2026-09-18 之前不对外；5 日、20 日、RS 指标的窗口跨到下限之前也不显示。
// 中台字段状态码 amount_pre_correction（成交额未校正）、insufficient_lookback（回看不足）一律按待更新处理。
export const INDUSTRY_FLOOR = '2026-09-18'
export const AMOUNT_KEYS = ['amount']
export const PENDING_STATUS = ['amount_pre_correction', 'insufficient_lookback']

export function rollingMask(day: string): Record<string, boolean> {
  return {
    sector_return_5d: day < '2026-09-25',
    sector_return_20d: day < '2026-10-16',
    rs: day < '2026-10-16',
  }
}

// 返回 true 表示该单元格显示「数据待更新」，不显示数值（也不能显示成 0）
export function isPending(key: string, row: any, day?: string): boolean {
  if (row?.field_status && PENDING_STATUS.includes(row.field_status[key])) return true
  if (!day) return false
  if (AMOUNT_KEYS.includes(key) && (day < INDUSTRY_FLOOR || row?.[key] == null)) return true
  if (key === 'sector_return_5d' || key === 'sector_return_20d') return rollingMask(day)[key]
  return false
}

// 表格单元格口径：待更新或值为 null 都显示「数据待更新」，不显示 0 或 -0
export function cellPending(key: string, row: any, day?: string): boolean {
  return isPending(key, row, day) || row?.[key] == null
}
