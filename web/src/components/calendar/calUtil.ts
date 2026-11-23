// 日历用到的日期与事件小工具。日期统一用 YYYY-MM-DD 字符串，按 UTC 推算，避免本机时区影响
export type Ev = Record<string, any>

// 未登记的状态（含 unknown）显示「—」，不把上游原值的英文露给用户
export const PUB: Record<string, string> = { published: '已公布', scheduled: '待公布', upcoming: '待公布', revised: '已修正', delayed: '延期', not_applicable: '不适用' }
export const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export const WEEK_MON_FIRST = ['一', '二', '三', '四', '五', '六', '日']

const ISO = /^\d{4}-\d{2}-\d{2}$/
export const isIso = (d: unknown): d is string => typeof d === 'string' && ISO.test(d)
const toUtc = (d: string) => { const [y, m, day] = d.split('-').map(Number); return Date.UTC(y, m - 1, day) }
export const fromUtc = (t: number) => new Date(t).toISOString().slice(0, 10)
export const addDays = (d: string, n: number) => fromUtc(toUtc(d) + n * 86400000)
export const weekdayOf = (d: string) => (isIso(d) ? WEEK[new Date(toUtc(d)).getUTCDay()] : '')
export const mondayIndex = (d: string) => (new Date(toUtc(d)).getUTCDay() + 6) % 7
export const isWeekend = (d: string) => { const w = new Date(toUtc(d)).getUTCDay(); return w === 0 || w === 6 }
export const datesBetween = (a: string, b: string) => { const out: string[] = []; for (let t = toUtc(a); t <= toUtc(b) && out.length < 400; t += 86400000) out.push(fromUtc(t)); return out }
export const monthOf = (d: string) => d.slice(0, 7)
export const shiftMonth = (m: string, delta: number) => { const [y, mo] = m.split('-').map(Number); const t = new Date(Date.UTC(y, mo - 1 + delta, 1)); return fromUtc(t.getTime()).slice(0, 7) }
export const monthLabel = (m: string) => `${m.slice(0, 4)} 年 ${Number(m.slice(5))} 月`

export const importance = (e: Ev): number | null => {
  const n = Number(e.source_importance)
  return e.source_importance != null && e.source_importance !== '' && Number.isInteger(n) && n >= 0 && n <= 5 ? n : null
}
export const isImportant = (e: Ev) => (importance(e) ?? -1) >= 3
// 同一天内：来源重要性从高到低，再按时间
export const byImportance = (a: Ev, b: Ev) => (importance(b) ?? -1) - (importance(a) ?? -1) || String(a.event_time || '99:99').localeCompare(String(b.event_time || '99:99'))
