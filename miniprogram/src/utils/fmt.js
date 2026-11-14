export const num = (v, d = 2) => (v == null || v === '' || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: d }))
export const ratio = (v, d = 1) => (v == null ? '—' : `${(v * 100).toFixed(d)}%`)
export const pct = (v, d = 2) => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(d)}%`)
export const signed = (v, d = 1) => (v == null || v === '' || Number.isNaN(Number(v)) ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(d)}`)
export const dir = (v) => (v == null || v === 0 ? '' : v > 0 ? 'rise' : 'fall')
// D9：后端按角色 × 看板 × 指标裁剪，整块无权限的模块不显示（以后端为准）
export const vis = (env, m) => !(env && env.module_access && env.module_access[m] === 'none')
