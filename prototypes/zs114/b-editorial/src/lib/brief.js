import replay from '@data/brief-replay.json'

// 回放里最后一条没有 data_date（整天取数失败），用 trade_date 兜底，仍保留为「所选日期无数据」样例
export const DAYS = replay.days
  .map((d) => ({ ...d, date: d.data_date || d.trade_date || '2026-11-17' }))
export const DEFAULT_DATE = '2026-11-04'
export const dayOf = (date) => DAYS.find((d) => d.date === date)

export const KINDS = {
  极值: { glyph: '◆', label: '极值' },
  变化: { glyph: 'Δ', label: '变化' },
  连续: { glyph: '≡', label: '连续' },
  背离: { glyph: '⇄', label: '背离' },
  排名: { glyph: '№', label: '排名' },
  日程: { glyph: '◷', label: '日程' },
}

export const SECTIONS = [
  { key: 'brief', path: '/', title: '今日要点', short: '要点' },
  { key: 'overview', path: '/p/overview', title: '市场总览', short: '总览' },
  { key: 'participation', path: '/p/participation', title: '参与度与资金环境', short: '参与度' },
  { key: 'industries', path: '/industries', title: '行业比较与轮动', short: '行业' },
  { key: 'themes', path: '/p/themes', title: '题材与涨跌结构', short: '题材' },
  { key: 'history', path: '/p/history', title: '历史复盘', short: '复盘' },
  { key: 'calendar', path: '/p/calendar', title: '事件日历', short: '日历' },
]

const MODULE_LABEL = {
  overview: '市场总览', participation: '参与度与资金环境', industries: '行业比较与轮动',
  themes: '题材与涨跌结构', history: '历史复盘', calendar: '事件日历',
}
const STATUS_LABEL = { ok: '完整', partial: '部分缺失', error: '取数失败' }
export const moduleRows = (day) => Object.entries(day?.module_status || {}).map(([k, v]) => ({
  key: k, label: MODULE_LABEL[k] || k, status: v, statusLabel: STATUS_LABEL[v] || v,
  date: day.module_dates?.[k] || '—',
}))

// 「参与度与资金环境 · 衍生品统计」→ 跳到对应明细页
export function drillPath(source) {
  const head = source.split(/[·/]/)[0].trim()
  return SECTIONS.find((s) => s.title === head)?.path || '/'
}
export const sourceTail = (source) => (source.includes('·') ? source.split('·').pop().trim() : source.split('/')[0].trim())

// 把陈述里的数值标出来，第一处作为主值放进页边。只认带符号或带单位的数，避免把「中证1000」「近 60 日」当成数值
const NUM_RE = /[+\-−]\d[\d,]*(?:\.\d+)?(?:\s?(?:个百分点|亿元|亿|%))?|\d[\d,]*(?:\.\d+)?\s?(?:亿元|个百分点|%|家|天)|(?<=(?:为|分|相同|连续|第) )\d[\d,]*(?:\.\d+)?/g
export function segments(statement) {
  const out = []
  const lead = leadValue(statement)
  let last = 0
  for (const m of statement.matchAll(NUM_RE)) {
    if (m.index > last) out.push({ t: statement.slice(last, m.index) })
    out.push({ t: m[0], num: true, lead: m[0] === lead })
    last = m.index + m[0].length
  }
  if (last < statement.length) out.push({ t: statement.slice(last) })
  return out
}
// 页边主值：背离类给「重合 n / 5」，其余取陈述中的主值
export function figureOf(f) {
  const m = f.statement.match(/名称相同 (\d+) 个/)
  if (m) return { v: `${m[1]} / 5`, c: '前 5 名称重合' }
  return { v: leadValue(f.statement) || '—', c: sourceTail(f.source) }
}
export function leadValue(statement) {
  const all = statement.match(NUM_RE) || ['']
  // 「从 A 变为 B」主值取变化后的 B
  return statement.includes('变为') ? all[all.length - 1] : all[0]
}

// 页脚注：同一口径只编一个号，正文用上标指向它
export function footnotesOf(facts) {
  const notes = []
  const index = facts.map((f) => {
    const key = f.source + '|' + (f.definition || '') + '|' + f.fields.join(',')
    let i = notes.findIndex((n) => n.key === key)
    if (i < 0) { notes.push({ key, source: f.source, definition: f.definition, fields: f.fields, date: f.data_date }); i = notes.length - 1 }
    return i + 1
  })
  return { notes, index }
}

const WEEK = '日一二三四五六'
export function longDate(date) {
  const d = new Date(date + 'T00:00:00+08:00')
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${WEEK[d.getDay()]}`
}

export const DISCLAIMER = '以上为按固定规则计算的市场统计事实，不构成投资建议。'
export const LEGAL = '本平台提供市场数据与历史统计，仅供研究和学习参考，不构成任何投资建议、证券推荐或交易指令。数据可能存在延迟、缺失或误差，请以交易所及上市公司的官方披露为准。'

// 示意：回放数据里还没有 AI 整理的日程，用这一条演示标识样式；界面上同时标「示意」
export const AI_DEMO_TITLE = '美国10月非农就业报告'
