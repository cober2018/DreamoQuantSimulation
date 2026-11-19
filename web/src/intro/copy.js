import replay from './data/brief-replay.json'
// 介绍页文案的两个版本，由构建开关 BRIEF_LIVE 选择（见 src/config.js）。
// 「每日要点」在 ZS-112 R2 上线前不能写成现有功能：live=false 时写「即将推出」，要点卡片只作为标明的样张出现。
// 本文件不依赖浏览器，vite.config.js 也用它生成 index.html 的标题和描述。
export function landingCopy(live) {
  const DEMO = replay.days[replay.days.length - 1].trade_date
  return live
    ? {
        title: '知数星耀 · A 股盘后数据与每日事实要点',
        description: '知数星耀：A 股盘后数据平台。指数与涨跌家数、成交与参与度、行业板块、涨停题材、事件日程，按固定规则整理成可核对的每日统计事实。只给数据，不构成投资建议。',
        heroLead: '盘后数据，整理成<br class="br-m" />可以核对的每日事实。',
        heroDesc: '指数与涨跌家数、成交与参与度、行业板块、涨停题材、未来事件日程，按固定规则提炼成当天的统计要点。每一条都标出数据日期、口径和来源，只描述市场状态，不预测涨跌。',
        caption: `星图中每颗星是一项盘后统计，连线表示同属一个数据页；亮星与数值取自 ${DEMO} 的要点。`,
        traceEyebrow: '今日要点',
        traceTitle: '每一条要点，<br />都连着它的口径。',
        traceDesc: '要点按固定模板生成，不经大模型改写。点开任意一条，能看到用到的指标、数据日期和计算规则，再落到对应的明细页核对原始数据。',
        cardBadge: '',
        pagesTitle: '首页看要点，六个数据页看明细',
        briefTag: '',
      }
    : {
        title: '知数星耀 · A 股盘后数据，每个数字都标明口径',
        description: '知数星耀：A 股盘后数据平台。指数与涨跌家数、成交与参与度、行业板块、涨停题材、事件日程，按交易日更新，每个数字标明数据日期与口径。只给数据，不构成投资建议。',
        heroLead: '盘后数据，每个数字<br class="br-m" />都能追到口径。',
        heroDesc: '指数与涨跌家数、成交与参与度、行业板块、涨停题材、未来事件日程，六个数据页按交易日更新。每个数字都标出数据日期、口径和来源，只描述市场状态，不预测涨跌。',
        caption: `星图中每颗星是一项盘后统计，连线表示同属一个数据页；亮星与数值取自 ${DEMO} 的盘后数据。`,
        traceEyebrow: '每日要点 · 即将推出',
        traceTitle: '每一条要点，<br />都会连着它的口径。',
        traceDesc: `我们正在把六个数据页的统计整理成每天几条事实要点：按固定模板生成，不经大模型改写，点开能看到指标、数据日期和计算规则。下面是用 ${DEMO} 回放数据做的样张，不是线上界面。`,
        cardBadge: '样张',
        pagesTitle: '六个数据页，按交易日更新',
        briefTag: '即将推出',
      }
}

export const PAGES = [
  { key: 'brief', title: '今日要点', text: '每天几条统计事实，按偏离常态的程度排序，附明日的重要日程。' },
  { key: 'overview', title: '市场总览', text: '主要指数涨跌、涨跌家数、成交额，以及数据来源与覆盖情况。' },
  { key: 'participation', title: '参与度与资金环境', text: '成交参与度分位、主动卖出占比、股债收益差观察、衍生品持仓统计、风格强弱。' },
  { key: 'industries', title: '行业比较与轮动', text: '行业、概念、地域板块的涨跌、成交、换手、资金净流入，以及近期序列。' },
  { key: 'themes', title: '题材与涨跌结构', text: '涨停和炸板数、连板梯队、首次封板时间分布、股票池计数。' },
  { key: 'history', title: '历史复盘', text: '按日期回看以上数据，以及开盘五分钟统计。' },
  { key: 'calendar', title: '事件日历', text: '未来两周的宏观数据和事件日程。' },
]
