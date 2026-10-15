> **状态更新（2026-10-14）**：本稿已被"以数据中台为准"的方案取代。用户确定：先在数据中台把复盘看板与 ADS 规整为一对一，再按看板登记 API（看板 ADS 接口 + 个股明细接口），新平台随后按功能适配。对应变更在 DreamOAgents 仓库 `openspec/changes/align-dashboard-ads-one-to-one-v1/`（分支 `feat/align-dashboard-ads-one-to-one-v1`），已在本地完成（2026-10-15 已按最新 main 重新整理）。新平台接入的服务清单：
>
> | 看板 | ADS 服务 | 明细服务 |
> |---|---|---|
> | 复盘总览 | review-dashboard | — |
> | 每日复盘 | review-daily | — |
> | 题材（含双周期板块排名） | review-theme | review-limit-list-detail、review-industry-stock-ranking-detail（双周期板块内个股） |
> | 股票池 | review-pools | review-limit-list-detail、review-limit-factor-detail |
> | 市场情绪（含参与观察、ERP） | review-market-sentiment | — |
> | 行业复盘 / 生命周期 | review-industry | review-industry-members-detail、review-industry-stock-ranking-detail |
> | 前瞻风险 | review-forward-risk | — |
>
> 新平台的页面组合与权限方案待下一步讨论；下文保留为历史讨论记录。

# 数据供应方案（讨论稿 V0.1，2026-10-14）

新平台的数据全部来自数据中台的 records 接口 `GET /api/v1/data/apis/{service_key}/records`。本稿按看板列出：数据在哪张表、是否已注册、注册方案、待决问题。**未执行任何注册。**

## 0. records 接口现状与限制（决定方案的约束）

| 限制 | 影响 |
|---|---|
| 一个服务 = 一张表，`SELECT *` 返回全部列 | 持 Key 方能拿到建议性列（如 `next_state_json`、`signal_priority_*`）；新平台虽能剔除，但接口本身已对外暴露 |
| 参数只支持等值过滤，`trade_date` 只能取单日 | 近 5 日序列要按天逐次请求 |
| 每页最多 500 行，排序只按 `trade_date DESC` | 概念板块等超过 500 行时翻页可能重复或漏行 |
| 不支持聚合 | 题材、Open5 这类"明细→统计"的内容，要么新平台拿明细自己算，要么数据中台先建聚合表 |

本地环境现状：8000 端口跑的是另一个项目，DreamO API 本地没有启动（之前的 404 就是这个原因）；本地缺 `ads_industry_lifecycle_daily_df`、`ads_review_industry_rrg_trail_df`、`dws_market_sentiment_observation_daily_df`、`dws_astock_opening_price_discovery_daily_df` 4 张表，只能在生产或测试环境验证。

## 1. 按看板的供数方案

| 看板 / 内容 | 源表（粒度） | 已注册服务 | 方案 | 待决问题 |
|---|---|---|---|---|
| 市场情绪：ERP、估值、涨停结构、衍生品（CNT-007/008/010） | `ads_review_market_sentiment_dashboard_df`（1 行/日） | `review-market-sentiment` | 复用 | 表里含仓位预算、下一状态等列，见决策 1 |
| 市场情绪：参与与压力观察（CNT-006） | `dws_market_sentiment_observation_daily_df`（1 行/日） | 无 | **新注册** `market-participation-observation`，参数 `trade_date` | 表里有"低参与/承接改善"等解读标签，要先逐列审哪些是统计、哪些是解读 |
| 行业复盘 / 生命周期 / RRG（CNT-014/015/016/020） | `ads_industry_lifecycle_daily_df`（1 行/板块/日） | `review-industry`、`review-industry-lifecycle`（同一张表注册了两次） | 复用 `review-industry` | 概念板块可能超过 500 行，翻页不稳，见决策 2 |
| RRG 历史轨迹（CNT-015） | `ads_review_industry_rrg_trail_df` | `review-industry-rrg-trails` | 复用，替代现在逐日请求 | 本地没有这张表，需在生产核对列和数据 |
| 题材：涨停/炸板数、最高板、平均涨幅、封板时间（CNT-022） | `ods_astock_board_limit_list_d_df`（1 行/股/日，约 80～200 行） | 无 | 见决策 3（A：直接注册 ODS 明细；B：先建聚合 ADS） | 旧看板的"题材"实际是按涨停明细的 `industry` 列分组，并非概念题材，口径要确认 |
| 股票池：炸板率、涨跌比、连板/断板结构（CNT-025） | 同上明细表 + `dws_astock_date_daily_measures_df`（1 行/日） | 无 | **新注册** `market-limit-list`（参数 `trade_date`、`board_type`）与 `market-limit-measures`（参数 `trade_date`） | 是否展示个股名单（仅事实列，按连板数排序，不截断） |
| 每日复盘：行业资金排行、结构统计（CNT-029/030） | 当前用 `ads_industry_lifecycle_daily_df` 的 `net_flow_*` | `review-industry` | 复用 | 旧每日复盘的资金排行另有 `moneyflow_ind_dc` 口径，两者不能混用，选哪个见决策 4 |
| 每日复盘：近 5 日趋势（CNT-032） | 同上 | `review-industry` | 复用，逐日请求 | 见决策 2（加日期区间参数可一次取完） |
| 每日复盘：Open5 统计（CNT-031） | `dws_astock_opening_price_discovery_daily_df`（1 行/股/阶段/日，约 5000×阶段数） | 无 | records 分页上限 5000 行，取不全；需数据中台先建**按日聚合的 ADS**（覆盖、正向、收盘延续、过度反应占比）再注册 | 是否本期做 |
| 前瞻风险：事件日历（CNT-034/035） | `ads_review_forward_risk_dashboard_df`（1 行/日，日历在 JSON 列） | `review-forward-risk` | 复用 | 表里风险曲线、Price In 等列，见决策 1 |
| 总览：涨跌家数、成交额（CNT-002/004） | `ads_industry_lifecycle_daily_df` 的 `market_ctx_*` 冗余列 | `review-industry` | 复用 | 无 |

## 2. 需要决定的问题

1. **接口是否加列白名单**：给服务注册表增加 `columns` 字段，records 只 `SELECT` 登记的列。这样建议性列在数据中台层就不出去，而不只靠新平台剔除。需要改数据中台代码（`api_service_models.py`、`api_service_registry.py`，向后兼容：没配 `columns` 时行为不变）。建议做。
2. **接口是否补排序键和日期区间**：给 records 增加稳定的二级排序（按表主键），以及可选的 `start_date`/`end_date`。前者解决翻页漏行，后者让 5 日序列一次取完。同样是改数据中台代码。建议做排序键，日期区间可后做。
3. **题材/股票池走明细还是先建聚合表**：
   - A：直接注册 ODS 涨停明细表，新平台自己聚合。改动小，本期可完成；代价是 ODS 明细直接对外暴露，聚合口径在新平台维护。
   - B：数据中台新建 `ads_market_limit_theme_daily_df` 一类的聚合表（预设脚本 + 调度），再注册。口径归数据中台，但要多做一条数仓链路。
   - 建议本期用 A，配合决策 1 的列白名单。
4. **行业资金口径**：统一用生命周期 ADS 的 `net_flow_*`（单位亿元，现已接入），还是旧每日复盘的 `moneyflow_ind_dc`。建议统一用前者，只保留一个口径。
5. **注册在哪个环境**：本地先注册验证，需要先在本地把 DreamO API 跑起来（另选端口）。生产注册会写生产 Mongo 并签发 Key，需要你单独批准后再执行。
6. **Open5 本期是否做**：需要新建 ADS 聚合表，建议列为下一期。

## 3. 定案后的执行顺序（草案）

1. 数据中台：列白名单 + 排序键（如批准）→ 本地验证。
2. 数据中台：注册新增服务的种子脚本（沿用 `scripts/review_data_ops/review_ads_api_service_onboard/` 的写法）→ 本地注册 → 签发本地 Key。
3. 新平台：按定案更新 OpenSpec（内容注册表、字段白名单、题材/股票池/参与观察页面）→ 实现 → 本地实连冒烟。
4. 生产：经你批准后注册服务、签发 Key、实连核对。
