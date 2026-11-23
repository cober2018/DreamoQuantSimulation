// 首页历史演示用的样例数据（intro/data/sample.json）：真实数据，从数据中台对外接口导出一次，写进仓库。
// 上涨占比和封板率不存文件，这里按平台同一算法算：上涨占比 = 上涨 ÷（上涨 + 下跌）；封板率见 lib/limitStructure.ts。缺数留空，不补 0。
import raw from './data/sample.json'
import { sealRate } from '@/lib/limitStructure'
import type { TileKey } from './content'

interface Raw { d: string; turnover: number | null; up: number | null; down: number | null; limit_up: number | null; limit_down: number | null; broken: number | null }
export interface Day extends Raw { ratio: number | null; seal: number | null }

export const DAYS: Day[] = (raw.days as Raw[]).map((x) => ({
  ...x,
  ratio: x.up != null && x.down != null && x.up + x.down > 0 ? x.up / (x.up + x.down) : null,
  seal: sealRate(x.limit_up, x.broken),
}))
export const LAST = DAYS[DAYS.length - 1]
export const RANGE = { start: DAYS[0].d, end: LAST.d, n: DAYS.length }

export const int = (v: number) => v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
export const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`
export const weekday = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('zh-CN', { weekday: 'long' })

// 星图四颗亮星的标签（数值取样例最后一天，缺值的那颗不亮）
export const SKY_LABELS: Partial<Record<TileKey, string>> = {
  ...(LAST.turnover != null && { turnover: `两市成交额 ${int(LAST.turnover)} 亿` }),
  ...(LAST.ratio != null && { upRatio: `上涨占比 ${pct1(LAST.ratio)}` }),
  ...(LAST.limit_up != null && { limitUp: `涨停 ${int(LAST.limit_up)} 只` }),
  ...(LAST.seal != null && { seal: `封板率 ${pct1(LAST.seal)}` }),
}
