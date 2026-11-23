import { useQuery } from '@tanstack/react-query'
import { getModule } from '@/lib/api'

// 板块序列按（交易日, 板块, 天数）缓存，沿用现有 industries/{code}/series 接口。
// 同时在途不超过 4 个，避免一屏内的迷你折线和轨迹把接口打满。
const MAX_IN_FLIGHT = 4
let active = 0
const waiting: (() => void)[] = []
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_IN_FLIGHT) await new Promise<void>((r) => waiting.push(r))
  active++
  try { return await fn() } finally { active--; waiting.shift()?.() }
}

export const industrySeriesQuery = (code: string, endDate: string, days?: number) => ({
  queryKey: ['industry-series', endDate, code, days ?? null] as const,
  staleTime: 5 * 60_000,
  queryFn: () => limited(() => getModule(`industries/${encodeURIComponent(code)}/series`, { end_date: endDate, ...(days ? { days: String(days) } : {}) })),
})

export const useIndustrySeries = (code: string, endDate: string, enabled: boolean, days?: number) =>
  useQuery({ ...industrySeriesQuery(code, endDate, days), enabled: enabled && !!code && !!endDate })
