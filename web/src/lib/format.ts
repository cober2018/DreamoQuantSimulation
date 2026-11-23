// 管理后台、账号页共用的格式化：时间戳是秒，空值统一显示「—」
export const dateOf = (t?: number | null) => (t ? new Date(t * 1000).toLocaleDateString('zh-CN') : '—')
export const dateTimeOf = (t?: number | null) => (t ? new Date(t * 1000).toLocaleString('zh-CN') : '—')
export const yuan = (c?: number | null) => ((c || 0) / 100).toFixed(2)
export const cents = (v: unknown) => Math.round(Number(v || 0) * 100)
// 距到期还有几天（向上取整）；没有到期日返回 null
export const daysLeft = (t?: number | null) => (t ? Math.max(0, Math.ceil((t * 1000 - Date.now()) / 86400000)) : null)
