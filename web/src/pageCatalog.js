// 数据页静态对照表：导航、锁定预告共用。预告只列指标名称，不含任何数值
export const PAGES = [
  { key: 'overview', path: '/overview', title: '市场总览', perm: 'page.overview', question: '今天市场发生了什么？',
    metrics: ['基准指数涨跌幅', '上涨/下跌家数', '上涨占比', '两市成交额'] },
  { key: 'participation', path: '/participation', title: '参与度与资金环境', perm: 'page.participation',
    question: '参与和资金结构相对历史怎样变化？',
    metrics: ['成交额及历史分位', '主动卖出占比与变化', '股权风险溢价（ERP）及分位', '估值端统计', '涨停结构',
      '聪明钱五因子截面统计', '风格相对强度序列', '底部条件观察值', '股指衍生品基差/持仓/PCR'] },
  { key: 'industries', path: '/industries', title: '行业比较与轮动', perm: 'page.industries',
    question: '不同板块已发生的表现有什么差异？',
    metrics: ['行业/概念/地域板块全量数据表', '1/5/20 日涨跌幅', '成交额、换手率、资金净流入', '扩散度与站上 MA20 占比',
      'RRG 相对强度—动量坐标', '单板块近期序列（下钻）'] },
  { key: 'themes', path: '/themes', title: '题材与涨跌结构', perm: 'page.themes', question: '当日涨停、炸板、跌停如何分布？',
    metrics: ['涨停/炸板/跌停家数与炸板率', '连板梯队', '股票池当日计数', '涨跌停近期变化', '题材榜', '封板时间分布（下钻）'] },
  { key: 'history', path: '/history', title: '历史复盘', perm: 'page.history', question: '某一天的数据和历史对比是什么？',
    metrics: ['板块结构统计（上涨占比、扩散度、集中度、背离比例）', '开盘 5 分钟统计', '板块资金净流入全量排行'] },
  { key: 'calendar', path: '/calendar', title: '事件日历', perm: 'page.calendar', question: '哪些事件已公布、将公布，事实是什么？',
    metrics: ['宏观经济数据发布日程', '前值/市场预期/公布值'] },
]

export const pageByKey = (k) => PAGES.find((p) => p.key === k)
