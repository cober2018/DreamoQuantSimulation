// 事实要点数据层：读 ZS-112 R1 真实回放，补上前端展示需要的派生信息（不改原始字段）。
import replay from '@data/brief-replay.json'

export const DEFAULT_DATE = '2026-11-04'
export const days = replay.days

export const MODULES = [
  { key: 'overview', label: '市场总览', short: '总览', to: '/app/p/overview' },
  { key: 'participation', label: '参与度与资金环境', short: '参与度', to: '/app/p/participation' },
  { key: 'industries', label: '行业比较与轮动', short: '行业', to: '/app/industries' },
  { key: 'themes', label: '题材与涨跌结构', short: '题材', to: '/app/p/themes' },
  { key: 'history', label: '历史复盘', short: '复盘', to: '/app/p/history' },
  { key: 'calendar', label: '事件日历', short: '日历', to: '/app/p/calendar' },
]
export const moduleByKey = Object.fromEntries(MODULES.map((m) => [m.key, m]))

// 每个数据页的观察指标（星图的背景星），名称与要点 source 的「 · 」后半段一致，便于把事实落到对应的星上
export const INDICATORS = {
  overview: ['指数涨跌幅', '涨跌家数', '两市成交额'],
  participation: ['成交额历史分位', '主动卖出占比', '股债收益差', '衍生品统计', '风格强弱分', '涨停结构'],
  industries: ['资金净流入', '站上 20 日线比例', '扩散度', '相对强弱'],
  themes: ['涨停数', '炸板数', '连板梯队', '首次封板时间'],
  history: ['开盘五分钟统计', '历史回看'],
  calendar: ['宏观数据', '央行利率决定'],
}

export const KINDS = {
  极值: { glyph: 'extreme', hint: '处在历史分布的边缘' },
  变化: { glyph: 'change', hint: '与前一交易日相比变化较大' },
  连续: { glyph: 'streak', hint: '连续多日处于同一状态' },
  背离: { glyph: 'diverge', hint: '两组相关统计方向不一致' },
  排名: { glyph: 'rank', hint: '按数值排序的前后几名' },
  日程: { glyph: 'event', hint: '未来交易日的事件' },
}

export function modulesOfSource(source) {
  const heads = source.split(' · ')[0].split(' / ')
  return heads.map((h) => MODULES.find((m) => m.label === h.trim())?.key).filter(Boolean)
}
export const metricOfSource = (source) => source.split(' · ')[1] || source

// 数值高亮：只挑带符号、带单位或带小数的数，避开「60 日」「前 5」「HS300」这类口径里的数字
const NUM = /(^|[\s：（(、，])([+\-−]?\d[\d,]*(?:\.\d+)?)(\s?(?:个百分点|个交易日|亿元|亿|%|家|个|天))?/g
export function splitStatement(text) {
  const out = []
  let last = 0
  for (const m of text.matchAll(NUM)) {
    const [, pre, num, unit = ''] = m
    const signed = /^[+\-−]/.test(num)
    const start = m.index + pre.length
    if (!signed && !unit && !num.includes('.')) continue
    if (/(此前|近)\s?$/.test(text.slice(Math.max(0, start - 3), start))) continue
    if (start > last) out.push({ t: text.slice(last, start) })
    out.push({ t: num + unit, num: true, sign: signed ? (num[0] === '+' ? 1 : -1) : 0 })
    last = start + num.length + unit.length
  }
  if (last < text.length) out.push({ t: text.slice(last) })
  return out
}

export function leadValue(fact) {
  // 背离类的数字是「重合个数」，单独拎出来放大没有意义
  if (fact.kind === '背离') return null
  const seg = splitStatement(fact.statement).find((s) => s.num)
  if (!seg) return null
  const m = seg.t.match(/^([+\-−]?[\d,.]+)\s?(.*)$/)
  return { num: m[1], unit: m[2], sign: seg.sign }
}

// 资金净流入按 A 股习惯着色（流入红、流出绿）；其他统计的正负号不代表方向好坏，不着色
export const colorsBySign = (fact) => fact.source.includes('资金净流入')

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
export const weekday = (d) => '周' + WEEK[new Date(d + 'T12:00:00Z').getUTCDay()]

// 所选日期不在回放里（非交易日或尚未发布）时返回 null，由页面显示「所选日期无数据」，不拿别的日期代替
export function findDay(date) {
  return days.some((x) => x.trade_date === date) ? getDay(date) : null
}

export function getDay(date) {
  const d = days.find((x) => x.trade_date === date) || days.find((x) => x.trade_date === DEFAULT_DATE)
  // 原型示意：每天把重要性最高的一条日程标成「AI 整理」，用来展示标识样式；真实数据里 ai_curated 全为 false
  const top = d.schedule.reduce((best, s, i) => (best < 0 || s.stars > d.schedule[best].stars ? i : best), -1)
  const schedule = d.schedule.map((s, i) => ({ ...s, aiDemo: i === top }))
  return { ...d, schedule }
}

export const STATUS_LABEL = { ok: '正常', partial: '部分缺数', empty: '当日无记录', error: '未取到' }

// 「口径」展开区的六项（ZS-109 要点结构：指标、数值、参照、数据日期、来源、性质）。
// 回放数据还没有 metric / value / reference 字段，原型按字段名、句子里的主数值和要点类型推出；接口上线后直接读字段。
export function factSpec(f) {
  const lv = leadValue(f)
  const win = f.statement.match(/(\d+)\s?日/)?.[1]
  const REF = {
    极值: win ? `近 ${win} 个交易日的${f.statement.includes('分位') ? '分位' : '标准分'}` : '历史分布',
    变化: '前一交易日',
    连续: '连续交易日计数',
    背离: f.definition || '同一交易日两项指标的方向',
    排名: '当日全部板块排序',
    日程: '事件日历 · 重要性 ★4 以上',
  }
  return [
    { k: '指标', v: f.metric || f.fields.join(' / '), code: true },
    { k: '数值', v: f.value ?? (lv ? `${lv.num}${lv.unit ? ' ' + lv.unit : ''}` : '见句子') },
    { k: '参照', v: f.reference || REF[f.kind] || '—' },
    { k: '数据日期', v: f.data_date },
    { k: '来源', v: f.source },
    { k: '性质', v: f.nature || '统计' },
  ]
}

export const nearestTradeDay = (date) => [...days].reverse().find((d) => d.trade_date <= date)?.trade_date || days[0].trade_date
