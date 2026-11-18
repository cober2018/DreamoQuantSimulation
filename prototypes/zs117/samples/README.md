# ZS-117 · 参与度与行业两页精简版样张（知数星耀）

方案稿 `12_执行回执/ZS-117.md` §三.2 / §三.3 的样张。只用于设计评审，不接线上、不部署。全部 token 取自仓库根 `design-system/`，外壳、EChart、状态组件从 `prototypes/zs115/c-system` 复制后精简。

## 运行

```bash
npm install
npm run build && npm run preview   # http://localhost:4393（prebuild 先跑 design-system/build.mjs）
npm run dev                        # http://localhost:5393
```

## 路由与开关

| 路由 | 内容 |
|---|---|
| `/participation` | 参与热度与成交、卖压相对强度、股债收益差、衍生品标准分矩阵、风格强弱 |
| `/industries` | 相对旋转图（5 日轨迹）、成交与涨跌地图、资金净流入（1/5/20 日）、扩散度点图、全行业表 |

`?theme=light|dark`；`?state=loading|empty|error|forbidden|nodate`（整页所有模块）；行业页 `?level=1|2|3|all`。

## 数据

`data/*.json` 是 2026-11-18 从对外数据服务只读取得的快照（数据日期 2026-11-17），只保留画图字段和日期 / 状态；每个文件头写了服务、视图、取数时间和发现的异常。

| 文件 | 来源（视图） |
|---|---|
| participation-history.json | 市场参与与压力 · history（60 交易日） |
| compensation-history.json | 股权风险补偿 · history-position（155 交易日） |
| derivatives-raw-stats.json | 衍生品观察 · raw-stats（当日截面） |
| style-history.json | 风格轮动监控 · history（60 个观测序号） |
| industry-facts-l1.json | 行业复盘 · facts（按名称识别的 31 个一级行业） |
| industry-series-top8.json | 行业复盘 · series（成交额前 8，10 交易日） |

## 关键决定

- 标准分（衍生品矩阵）用蓝—橙发散色，不用红绿：设计系统原则 4，标准分正负不代表好坏。涨跌幅、资金净流入才用红涨绿跌。
- 行业层级字段为空，二级 / 三级 / 全部显示空态并说明原因，不拿一级冒充，也不把 496 行混排。
- 成交额单位存疑（合计约为全市场 10 倍），地图和表格只用占比。
- 图表进入视口附近才初始化（IntersectionObserver），echarts 按需引入并懒加载。

## TODO

- 层级字段上线后改为 `level` 筛选，开放二级 / 三级。
- 卖压分档规则、补偿历史位置的回看窗口、成交额单位、RRG 刻度，待数据方确认后替换页面说明。
- 「近 10 日」迷你折线目前只取了成交额前 8 个行业。
