// 公开页（首页、关注页、占位页）的文案和静态定义。文字来源：旧版 web/src/intro/copy.js、content/social.json 和路由里的占位说明。
import { PAGES } from '@/lib/pageCatalog'

export const HERO = {
  eyebrow: 'A 股盘后数据 · 按交易日更新',
  title: '知数星耀',
  lead: ['盘后数据，每个数字', '都带着它的历史。'],
  desc: '指数与涨跌家数、成交与参与度、行业板块、涨停题材、未来事件日程，六个数据页按交易日更新。每项指标给出当日值和历史曲线，可以对比，可以按交易日回看。每个数字标出数据日期和口径，只描述市场状态，不预测涨跌。',
}

export const DEMO_HEAD = {
  eyebrow: '回看 · 样例数据',
  title: ['拖动日期，', '回到那一个交易日。'],
}

// 六个数据页的介绍（去掉「今日要点」）
export const PAGE_TEXT: Record<string, string> = {
  overview: '主要指数涨跌、涨跌家数、成交额，以及数据来源与覆盖情况。',
  participation: '成交参与度分位、主动卖出占比、股债收益差观察、衍生品持仓统计、风格强弱。',
  industries: '行业、概念、地域板块的涨跌、成交、换手、资金净流入，以及近期序列。',
  themes: '涨停和炸板数、连板梯队、首次封板时间分布、股票池计数。',
  history: '按日期回看以上数据，以及开盘五分钟统计。',
  calendar: '未来两周的宏观数据和事件日程。',
}
export const SITE_PAGES = PAGES.map((p) => ({ ...p, text: PAGE_TEXT[p.key] }))

// 星图：星座 = 数据页，星 = 观察指标。位置、指标名照旧版 Landing.vue 原样搬来
export const AT: Record<string, [number, number]> = { overview: [0.2, 0.2], participation: [0.6, 0.1], industries: [0.92, 0.42], themes: [0.74, 0.86], history: [0.34, 0.88], calendar: [0.08, 0.6] }
export const INDICATORS: Record<string, string[]> = {
  overview: ['指数涨跌幅', '涨跌家数', '两市成交额'],
  participation: ['成交额历史分位', '主动卖出占比', '股债收益差', '衍生品统计', '风格强弱分', '涨停结构'],
  industries: ['资金净流入', '站上 20 日线比例', '扩散度', '相对强弱'],
  themes: ['涨停数', '炸板数', '连板梯队', '首次封板时间'],
  history: ['开盘五分钟统计', '历史回看'],
  calendar: ['宏观数据', '央行利率决定'],
}
export const EXTRA: Record<string, string[]> = { overview: ['上涨占比'], industries: ['换手率', '成交额占比', '新高比例'], themes: ['封板率', '股票池计数'], history: ['开盘五分钟上涨占比'], calendar: ['事件重要性', '前值与预期'] }
// 亮星只有这四颗，对应第二屏的四个格子
export type TileKey = 'turnover' | 'upRatio' | 'limitUp' | 'seal'
export const BRIGHT: Record<string, TileKey> = { 两市成交额: 'turnover', 上涨占比: 'upRatio', 涨停数: 'limitUp', 封板率: 'seal' }

export const FOLLOW_STRIP = { title: '关注知数Talk 主理人', text: '市场数据的口径和读法，也会发在这些平台。' }

// 自媒体卡片：只放 ready 的。qr 为空时显示「二维码待补充」
export interface Social { platform: string; platformName: string; name: string; qr: string; qrAlt: string; url: string; ready: boolean }
export const SOCIAL: Social[] = ([
  { platform: 'wechat-oa', platformName: '公众号', name: '知数Talk', qr: '/social/wechat-qr.png', qrAlt: '知数Talk 公众号二维码', url: '', ready: true },
  { platform: 'douyin', platformName: '抖音', name: '知数Talk', qr: '/social/douyin-code.png', qrAlt: '知数Talk 抖音码', url: '', ready: true },
  { platform: 'xiaohongshu', platformName: '小红书', name: '知数Talk', qr: '/social/xiaohongshu-qr.png', qrAlt: '知数Talk 小红书二维码', url: '', ready: true },
] as Social[]).filter((s) => s.ready)

export const FOLLOW = {
  eyebrow: '公众号 · 抖音 · 小红书',
  title: '关注知数Talk 主理人',
  sub: '在公众号、抖音、小红书上分享市场数据的口径和读法。用对应 App 扫码即可关注；内容仅作数据与方法交流，不构成投资建议。',
}

// 占位页：地址 → 标题和说明（文字照旧）
export const STUBS: Record<string, { title: string; desc: string }> = {
  '/pricing': { title: '价格与权益', desc: '价格待公布。免费试用期内所有内容开放，正式档位和价格将另行公布。' },
  '/mp': { title: '小程序', desc: '小程序版本单独排期，暂未开放。' },
  '/docs': { title: '文档', desc: '文档即将推出。开始使用和 MCP 说明会陆续发布。' },
  '/blog': { title: '博客', desc: '博客即将推出。首批文章会围绕指标口径和统计方法。' },
}
// box 是框内标题，和页面大标题错开，不重复「没有这个页面」
export const NOT_FOUND = { title: '没有这个页面', box: '地址可能输错了', desc: '或者页面已经移走。' }

export const FOOTER_DISCLAIMER = '本平台提供市场数据与历史统计，仅供研究和学习参考，不构成任何投资建议、证券推荐或交易指令。数据可能存在延迟、缺失或误差，请以交易所及上市公司的官方披露为准。'
