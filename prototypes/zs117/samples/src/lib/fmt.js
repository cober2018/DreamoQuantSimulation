import { ref } from 'vue'

// 窄屏判断：图表在 640 以下换一套更紧凑的配置
const mq = matchMedia('(max-width: 640px)')
export const narrow = ref(mq.matches)
mq.addEventListener('change', (e) => { narrow.value = e.matches })

export const NA = '—'
const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '')
export const num = (v, d = 2) => (v == null ? NA : (v < 0 ? '−' : '') + Math.abs(v).toFixed(d))
export const signed = (v, d = 2) => (v == null ? NA : sign(v) + Math.abs(v).toFixed(d))
// 比例（0.015）→ 百分数文字
export const pct = (v, d = 2) => (v == null ? NA : signed(v * 100, d) + '%')
export const ratioPct = (v, d = 1) => (v == null ? NA : (v * 100).toFixed(d) + '%')
export const md = (s) => (s ? s.slice(5) : NA)

// 「rgb(r, g, b)」加透明度；设计系统给的是 rgb 字符串
export function alpha(rgb, a) {
  const m = String(rgb).match(/\d+(\.\d+)?/g)
  return m ? `rgba(${m[0]}, ${m[1]}, ${m[2]}, ${a})` : rgb
}
// 两色线性混合，t∈[0,1]
export function mix(c1, c2, t) {
  const a = String(c1).match(/\d+/g).map(Number), b = String(c2).match(/\d+/g).map(Number)
  const r = (i) => Math.round(a[i] + (b[i] - a[i]) * t)
  return `rgb(${r(0)}, ${r(1)}, ${r(2)})`
}
