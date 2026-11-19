import { reactive } from 'vue'
import { getModule } from '../../api'

// 板块序列按（交易日, 板块）缓存，沿用现有 industries/{code}/series 接口。
// 同时在途请求不超过 4 个，避免一屏内的迷你折线和轨迹把接口打满。
const SPARK_DAYS = 20
const MAX_IN_FLIGHT = 4
const MAX_ENTRIES = 800
const cache = new Map()
const waiting = []
let inFlight = 0

function pump() {
  while (inFlight < MAX_IN_FLIGHT && waiting.length) {
    const job = waiting.shift()
    inFlight++
    getModule(`industries/${encodeURIComponent(job.code)}/series`, { end_date: job.endDate, days: SPARK_DAYS })
      .then((out) => {
        job.entry.points = out?.data?.points || []
        job.entry.status = out?.status || 'error'
      })
      .catch(() => { job.entry.status = 'error' })
      .finally(() => { inFlight--; pump() })
  }
}

export function ensureIndustrySeries(code, endDate) {
  const key = `${endDate}|${code}`
  let entry = cache.get(key)
  if (!entry) {
    entry = reactive({ status: 'loading', points: [] })
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value)
    cache.set(key, entry)
    waiting.push({ code, endDate, entry })
    pump()
  }
  return entry
}
