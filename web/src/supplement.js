// 补充视图的取数封装：只请求网关的 /api/v1/supplement/<name>，不在前端推导任何判断。
import { getModule } from './api'

export async function loadSupplement(name, tradeDate) {
  const r = await getModule(`supplement/${name}`, tradeDate ? { trade_date: tradeDate } : {})
  return { rows: Array.isArray(r?.rows) ? r.rows : null, status: r?.status || 'upstream_error', reason: r?.reason || null }
}
