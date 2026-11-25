// 数据页静态对照表：导航、锁定预告共用。预告只列指标名称，不含任何数值
export interface PageDef { key: string; path: string; title: string; perm: string; question: string; metrics: string[] }
export const PAGES: PageDef[] = [
  { key: 'overview', path: '/overview', title: '市场总览', perm: 'page.overview', question: '今天市场发生了什么？',
    metrics: ['基准指数涨跌幅', '上涨/下跌家数', '上涨占比', '两市成交额'] },
  { key: 'participation', path: '/participation', title: '参与度与资金环境', perm: 'page.participation',
    question: '参与和资金结构相对历史怎样变化？',
    metrics: ['成交额及历史分位', '主动卖出占比与变化', '股债收益差及分位', '估值端统计',
      '风格相对强度序列', '开盘五分钟统计', '底部条件观察值', '股指衍生品基差、持仓比、认沽认购比'] },
  { key: 'industries', path: '/industries', title: '行业比较与轮动', perm: 'page.industries',
    question: '不同板块已发生的表现有什么差异？',
    metrics: ['一级、二级、三级行业和概念、地域板块数据表', '1/5/20 日涨跌幅', '成交额、换手率、资金净流入', '扩散度与站上 20 日线占比',
      '相对旋转图（相对强度与相对动量）', '领涨行业 5 日走势', '单板块近期序列（下钻）'] },
  { key: 'themes', path: '/themes', title: '题材与涨跌结构', perm: 'page.themes', question: '当日涨停、炸板、跌停如何分布？',
    metrics: ['涨停/炸板/跌停家数与封板率', '连板梯队', '涨跌停近期变化', '涨停个股的行业分布'] },
  { key: 'calendar', path: '/calendar', title: '事件日历', perm: 'page.calendar', question: '哪些事件已公布、将公布，事实是什么？',
    metrics: ['限售股解禁日程与参考市值', '宏观经济数据发布日程（可按国家和重要程度筛选）', '前值/市场预期/公布值'] },
]

export const pageByKey = (k: string) => PAGES.find((p) => p.key === k)
