import { SECTIONS } from './data.js'

export const KIND_ORDER = ['极值', '变化', '连续', '背离', '排名']
export const KIND_CODE = { 极值: 'EXT', 变化: 'CHG', 连续: 'STK', 背离: 'DIV', 排名: 'RNK', 日程: 'CAL' }

const NUM = /([+\-−]?\d[\d,]*(?:\.\d+)?)\s?(亿元|亿|家|个百分点|%|个交易日|个|天)?/g
const minus = (v) => v.replace(/^-/, '−')

// 每条要点的「主读数」：只从固定模板文本里截取，不另算，保证与 statement 逐字一致
export function headline(f) {
  const s = f.statement
  const all = [...s.matchAll(NUM)].map((m) => ({ v: minus(m[1]), u: m[2] || '' }))
  if (!all.length) return null
  const metric = (f.source.split('·')[1] || f.source).trim()
  let r
  if (f.kind === '背离') r = { value: all[all.length - 1].v, unit: '/ 5', label: '流入前 5 与涨停前 5 重名数' }
  else if (f.kind === '排名') { const p = all.find((x) => /^[+−]/.test(x.v)); r = { value: p.v, unit: '亿元', label: '净流入第 1 名', flow: true } }
  else if (f.kind === '连续') r = { value: all.find((x) => x.u === '个交易日')?.v || all[0].v, unit: '个交易日', label: metric }
  else if (/标准分/.test(s)) r = { value: all[all.length - 1].v, unit: 'σ', label: /60 日/.test(s) ? '60 日标准分' : '标准分' }
  else if (/百分位/.test(s)) r = { value: `P${all[all.length - 1].v}`, unit: '', label: '近 60 日分位', sub: `${all[0].v} 亿元` }
  else {
    const m = s.match(/从\s?(\S+?)\s?变为\s?(\S+)/)
    if (m) r = { value: m[2].replace('%', ''), unit: '%', label: metric, sub: `前值 ${m[1]}` }
    else {
      const pp = s.match(/较前一交易日\s?([+\-−]?[\d.]+)\s?个百分点/)
      const prev = s.match(/前一交易日\s?([\d.]+\s?\S)/)
      r = { value: all[0].v, unit: all[0].u, label: metric, sub: pp ? `较前日 ${minus(pp[1])} pp` : prev ? `前一交易日 ${prev[1]}` : '' }
    }
  }
  return r
}

// statement 里的数字用等宽强调；纯展示切分，不改字
export function splitStatement(s) {
  const parts = []
  let last = 0
  for (const m of s.matchAll(/(?<![A-Za-z\u4e00-\u9fff\d.,])([+\-−]?\d[\d,]*(?:\.\d+)?)(\s?(?:亿元|亿|家|个百分点|%|个交易日|天)?)/g)) {
    if (m.index > last) parts.push({ t: s.slice(last, m.index) })
    // 红绿只给资金方向（亿），标准分、百分点等统计量一律中性，避免把统计偏离读成涨跌
    const flow = /亿/.test(m[2])
    parts.push({ t: minus(m[1]), n: true, dir: flow ? (/^\+/.test(m[1]) ? 'up' : /^[-−]/.test(m[1]) ? 'down' : '') : '' })
    if (m[2]) parts.push({ t: m[2] })
    last = m.index + m[0].length
  }
  if (last < s.length) parts.push({ t: s.slice(last) })
  return parts
}

const SOURCE_TO_SECTION = [
  ['行业比较与轮动', 'industries'], ['参与度与资金环境', 'participation'], ['题材与涨跌结构', 'themes'],
  ['历史复盘', 'history'], ['事件日历', 'calendar'], ['市场总览', 'overview'],
]
export function drillTarget(f) {
  const key = (SOURCE_TO_SECTION.find(([p]) => f.source.startsWith(p)) || [, 'overview'])[1]
  const sec = SECTIONS.find((s) => s.key === key)
  return { path: sec.to, query: { from: 'brief', field: f.fields[0], d: f.data_date } }
}
