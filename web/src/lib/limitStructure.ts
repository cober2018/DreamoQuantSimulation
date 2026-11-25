// 涨停结构的两个小算法，照旧版 Themes.vue 原样搬来

// 连板高度：「3连板」→3，「首板」→1，「高板」→4（梯队只分首板、2 连板、3 连板、高板四档，高板即 4 板及以上）；无法解析返回 null
export const HIGH_TIER = 4
export const tierHeight = (label: unknown): number | null => {
  const s = String(label ?? '')
  const m = s.match(/\d+/)
  if (m) return Number(m[0])
  return /首/.test(s) ? 1 : /高/.test(s) ? HIGH_TIER : null
}

// 封板率 = 涨停 ÷（涨停 + 炸板），与炸板率互补
export const sealRate = (limitUp: number | null | undefined, broken: number | null | undefined): number | null => {
  if (limitUp == null || broken == null) return null
  const den = limitUp + broken
  return den > 0 ? limitUp / den : null
}
