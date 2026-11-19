const MINUS = '−'
const sign = (v) => (v > 0 ? '+' : v < 0 ? MINUS : '')

export const fmt = {
  pct: (v, d = 2) => (v == null ? '—' : `${sign(v)}${Math.abs(v * 100).toFixed(d)}`),
  pctRaw: (v, d = 1) => (v == null ? '—' : `${(v * 100).toFixed(d)}`),
  num: (v, d = 2) => (v == null ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })),
  signed: (v, d = 1) => (v == null ? '—' : `${sign(v)}${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`),
  dir: (v) => (v == null || v === 0 ? 'flat' : v > 0 ? 'up' : 'down'),
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
export const weekday = (iso) => `周${WEEK[new Date(`${iso}T12:00:00Z`).getUTCDay()]}`
export const mmdd = (iso) => (iso ? iso.slice(5) : '—')
