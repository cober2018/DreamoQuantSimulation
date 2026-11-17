// 只读引用共享真实数据；brief-replay 是近 20 个交易日规则回放的原始输出
import replay from '../../../data/brief-replay.json'

export const DAYS = replay.days.map((d) => ({ ...d, date: d.data_date || d.trade_date }))
export const DEFAULT_DAY = '2026-11-04'
export const dayByDate = (iso) => DAYS.find((d) => d.date === iso)
export const GENERATED_AT = replay.generated_at

export const MODULES = [
  { key: 'overview', label: '市场总览' }, { key: 'participation', label: '参与度与资金环境' },
  { key: 'industries', label: '行业比较与轮动' }, { key: 'themes', label: '题材与涨跌结构' },
  { key: 'history', label: '历史复盘' }, { key: 'calendar', label: '事件日历' },
]

export const SECTIONS = [
  { key: 'brief', no: '00', label: '今日要点', to: '/app' },
  { key: 'overview', no: '01', label: '市场总览', to: '/app/s/overview' },
  { key: 'participation', no: '02', label: '参与度与资金环境', to: '/app/s/participation' },
  { key: 'industries', no: '03', label: '行业比较与轮动', to: '/app/industries' },
  { key: 'themes', no: '04', label: '题材与涨跌结构', to: '/app/s/themes' },
  { key: 'history', no: '05', label: '历史复盘', to: '/app/s/history' },
  { key: 'calendar', no: '06', label: '事件日历', to: '/app/s/calendar' },
]
export const sectionByKey = (k) => SECTIONS.find((s) => s.key === k)
