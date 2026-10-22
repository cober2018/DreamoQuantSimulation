// 所有请求走同源 /api；上游错误也返回信封，交给页面框架渲染错误态
import { authedFetch } from './auth'

export async function getModule(path, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  const url = `/api/v1/${path}${qs.toString() ? `?${qs}` : ''}`
  let resp
  try {
    resp = await authedFetch(url)
  } catch {
    return { status: 'upstream_error', data: {}, gaps: [], sources: [], content_ids: [] }
  }
  let body = {}
  try { body = await resp.json() } catch { /* 非 JSON 视为服务错误 */ }
  if (!resp.ok) {
    const status = resp.status === 401 ? 'unauthorized' : resp.status === 403 ? 'forbidden' : resp.status === 429 ? 'rate_limited'
      : resp.status === 502 ? 'upstream_error' : 'server_error'
    if (resp.status === 403 || resp.status === 429) body.detail = body.detail || (resp.status === 403 ? '当前账号权限不足' : '请求过于频繁')
    return { ...body, status, data: {}, gaps: [], sources: [], content_ids: [] }
  }
  return body
}

// 页面只展示中文数据名, 不暴露内部服务标识
export const SERVICE_NAMES = {
  'review-industry': '板块日表', 'review-market-sentiment': '市场情绪日表', 'review-theme': '题材日表',
  'review-forward-risk': '事件日历', 'review-limit-list-detail': '涨跌停明细', 'review-pools': '股票池统计',
  'review-daily': '市场日表',
}

export const fmt = {
  pct(v, digits = 2) {
    if (v === null || v === undefined) return '—'
    const n = v * 100
    return `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`
  },
  ratio(v, digits = 1) {
    return v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits)}%`
  },
  num(v, digits = 2) {
    if (v === null || v === undefined || v === '') return '—'
    const n = Number(v)
    return Number.isFinite(n) ? n.toLocaleString('zh-CN', { maximumFractionDigits: digits }) : String(v)
  },
  signed(v, digits = 2) {
    if (v === null || v === undefined) return '—'
    return `${v > 0 ? '+' : ''}${Number(v).toFixed(digits)}`
  },
  signedPct(v, digits = 2) {
    return v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(digits)}%`
  },
  dir(v) {
    if (v === null || v === undefined || v === 0) return ''
    return v > 0 ? 'rise' : 'fall'
  },
}
