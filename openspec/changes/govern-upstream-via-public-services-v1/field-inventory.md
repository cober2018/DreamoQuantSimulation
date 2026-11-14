# 上游取数清单（现状，2026-11-14）

依据：`backend/insight_api/modules.py`、`projection.py`、`main.py` 当前代码逐行整理。本清单只记录本平台**实际读取**的字段；上游 `SELECT *` 多返回的列一律不需要。

## 一、总表：按页面

| 页面（接口） | CNT | review-* 服务 | 参数 | 每次请求行数 |
|---|---|---|---|---|
| 总览 `/overview` | 002、004 | `review-industry` | `trade_date`、`idx_type=行业板块`、`limit=1` | 1 |
| | 002 | `review-market-sentiment` | `trade_date`、`limit=1`（只读新鲜度） | 1 |
| | 002 | `review-forward-risk` | `trade_date`、`limit=1`（只读新鲜度） | 1 |
| 参与度与资金环境 `/participation` | 006、007、008、009、010、011、013 | `review-market-sentiment` | `trade_date`、`limit=1` | 1 |
| 行业比较与轮动 `/industries` | 014、015、016、020 | `review-industry` | `trade_date`、`idx_type`（三类之一），翻页 500/页 | 行业约 90、概念可能超过 500 |
| 板块序列 `/industries/{code}/series` | 032、015 | `review-industry` | `industry_code`、`start_date`/`end_date`（2–20 个交易日）；422 时逐日 `trade_date` | 每日 1 |
| 题材与涨跌结构 `/themes` | 022、025、027 | `review-theme` | `trade_date`、`limit=1` | 1 |
| | 022 | `review-limit-list-detail` | `trade_date`、`board_type=U`，翻页 | 每股 1，约 50–150 |
| | 025、027 | `review-pools` | `trade_date`、`limit=1`；另取近 10 日 `start_date`/`end_date` | 1 / 10 |
| 历史复盘 `/history` | 029、030 | `review-industry` | `trade_date`、`idx_type`，翻页 | 同行业页 |
| | 031 | `review-daily` | `trade_date`、`limit=1` | 1 |
| 事件日历 `/calendar` | 034、035 | `review-forward-risk` | `trade_date`、`limit=1` | 1 |
| 各页"所选日无数据" | 002 | 各页主服务 | 不带日期、`limit=1`，只读 `trade_date` | 1 |

实际用到 7 个服务：`review-industry`、`review-market-sentiment`、`review-forward-risk`、`review-theme`、`review-pools`、`review-daily`、`review-limit-list-detail`。现用 Key 可读的另外 6 个 review-* 服务（含 `review-industry-stock-ranking-detail` 个股排名）**一个都没用**，等级账号不应授权。

## 二、逐服务字段

### 1. `review-industry`（每板块每日一行）

| 字段 | 用途 | 页面 |
|---|---|---|
| `trade_date` | 数据日 | 全部 |
| `sector_code`、`sector_name`、`idx_type` | 板块标识、分类切换 | 行业、序列、历史 |
| `sector_return`、`sector_return_5d`、`sector_return_20d`、`sector_return_60d` | 涨跌幅（小数） | 行业；`sector_return` 另用于序列、历史 |
| `amount` | 成交额（亿元） | 行业、序列、历史（前十集中度） |
| `turnover_rate` | 换手率 | 行业 |
| `up_num`、`down_num`、`member_count` | 板块内涨跌家数、成分数 | 行业 |
| `up_stock_ratio`、`above_ma20_ratio`、`new_high_20d_ratio` | 扩散指标 | 行业；`above_ma20_ratio` 另用于历史（中位数） |
| `di` | 方向指标 | 行业、序列、历史（均值） |
| `market_amount_share`、`amount_ratio_ma20` | 成交占比、相对 20 日均量 | 行业 |
| `rs_ratio`、`rs_momentum` | RRG 原始坐标（基准 100） | 行业、序列 |
| `net_flow_1d`、`net_flow_5d`、`net_flow_20d` | 资金净流入（亿元） | 行业；历史按 1d/5d/20d 排行；序列只用 1d |
| `coverage_ratio`、`is_fallback` | 覆盖率、回退行数 | 行业、序列、历史、总览 |
| `source_max_updated_at`、`missing_sources` | 新鲜度、缺失来源 | 总览、行业、序列、历史 |
| `market_ctx_index_code`、`market_ctx_index_change_pct` | 大盘指数与涨跌幅（%） | 总览 |
| `market_ctx_up_count`、`market_ctx_down_count` | 全市场涨跌家数 | 总览 |
| `market_ctx_turnover_billion` | 全市场成交额（实际单位千亿元，×1000 转亿元） | 总览 |

### 2. `review-market-sentiment`（每日一行）

| 列 → 子字段 | 用途 | CNT |
|---|---|---|
| `trade_date`、`snapshot_time`、`coverage_ratio`、`missing_sources_json` | 数据日、新鲜度 | 002 |
| `erp_filter_json` → `earnings_yield`、`erp_value_pct`、`yield_10y`、`erp_change_5d_pct`、`erp_change_20d_pct`、`erp_percentile_252d`、`erp_percentile_3y`、`erp_percentile_5y`、`yield_source_flag`、`available_count`、`total_count` | ERP 数值与分位 | 007 |
| `valuation_filter_json` → `current_pe_median`、`hist_90d_pe_median`、`break_ratio_pct`、`discount_pct`、`available_count`、`total_count` | 估值统计 | 007 |
| `micro_atomic_json` → `seal_rate`、`consecutive_board_count`、`max_consecutive_days`、`first_board_premium`、`broken_repair_rate` | 涨停结构 | 008 |
| `participation_observation_json` → `trade_date`、`source_trade_date`、`total_amount`（元）、`count_stocks`、`amount_ratio_20d`、`participation_pctile_60d`、`participation_pctile_250d`、`low_participation_streak`、`active_sell_ratio`、`sell_pressure_change_1d`、`sell_pressure_change_3d`、`order_imbalance`、`order_imbalance_delta_1d`、`data_status`、`status_reason`、`calc_version` | 参与与压力原始统计 | 006 |
| `derivatives_matrix_json[]` → `instrument`、`basis_value`、`basis_zscore_60d`、`position_ratio`、`pcr_value`、`pcr_zscore_60d`、`oi_volume_crowding_zscore_60d`、`basis_source_date`、`pcr_source_date`、`position_source_date`、`missing_reason` | 衍生品原始统计 | 010 |
| `indicators_json` → `smart_money.metrics.available`、`.missing_reason`；`.raw` 下 `factor_display`、`factor_net_breadth`、`factor_pos_share`、`factor_neg_share`（各含 5 个 `informed_flow_*` 因子键）、`rows`、`candidate_expected_pool_rows`、`factor_breadth_threshold`、`model_version`、`trade_date` | 聪明钱五因子截面统计 | 009 |
| `style_rotation_json` → `camps[]` 的 `key`、`label`、`index_name`、`index_code`、`strength_score`、`z_score`、`strength_series`、`source_date`、`available`、`missing_reason` | 风格相对强度序列 | 011 |
| `next_state_json` → `trade_date`、`history_obs`、`data_status`、`calc_version`、`conditions[]` 的 `key`、`label`、`value`、`threshold`、`condition` | 底部条件观察值 | 013 |

本服务里本平台**不读**但 Key 能拿到的建议性内容：仓位/预算类列、`next_state_json` 的预测状态与准备度、`style_rotation_json` 的 `leader`/`signal`/`acceleration`、聪明钱共振评分与风险分等。

### 3. `review-forward-risk`（每日一行）

| 列 → 子字段 | 用途 | CNT |
|---|---|---|
| `trade_date`、`snapshot_time`、`missing_sources_json` | 数据日、新鲜度 | 002 |
| `calendar_window_json` → `start_date`、`end_date`、`complete` | 日历窗口 | 034 |
| `calendar_events_json[]` → `event_id`（只用于筛 `macro:` 前缀）、`event_date`、`event_time`、`country`、`event_type_label`、`title`、`indicator_code`、`period`、`unit`、`publication_status`、`macro_previous_value`、`macro_actual_value`、`macro_forecast_value`、`source`（筛掉 `fallback_contract`，并作为预期来源输出）、`source_importance` | 宏观事件事实 | 034、035 |

筛选规则：只留 `macro:` 事件族、去掉 `source=fallback_contract` 占位、`event_date` 落在数据日起 N 天内（N=1–60，默认 14）。解禁、政策事件与风险曲线、计价程度、传导路径一律不用。

### 4. `review-theme`（每日一行）

| 列 → 子字段 | 用途 | CNT |
|---|---|---|
| `trade_date`、`snapshot_time`、`missing_sources_json` | 数据日、新鲜度 | 002 |
| `theme_rankings_json[]` → `industry`、`up_count`、`broken_count`、`highest_tier`、`avg_pct`（%） | 题材统计 | 022 |
| `board_tiers_json[]` → `tier`、`count` | 连板梯队 | 022 |

不读：`strength_score`、`stage`、`stage_reason`、`net_inflow`、代表股。

### 5. `review-limit-list-detail`（每股每日一行）

| 字段 | 用途 | CNT |
|---|---|---|
| `industry` | 归入题材（行业分组） | 022 |
| `first_board_time` | 封板时间分 5 档计数（HHMMSS，不补零） | 022 |

只用 `board_type=U`。`ts_code` 不读、不输出；本平台只要"按 `industry` × 时间档的计数 + 当日涨停总数"。

### 6. `review-pools`（每日一行）

| 列 → 子字段 | 用途 | CNT |
|---|---|---|
| `trade_date`、`snapshot_time`、`missing_sources_json` | 数据日、新鲜度 | 002 |
| `pool_summary_json` → `board_tier_counts`、`broken_board_count`、`limit_down_count` | 涨停/炸板/跌停计数、近 10 日序列 | 025 |
| `pool_summary_json.high_recognition` → `count`、`status`、`latest_date`、`lag_days` | 高标池计数 | 027 |
| `pool_summary_json.momentum_extreme.{窗口}` → `window_days`、`status`、`reason`、`latest_avail_date`、`count` | 动量极端池计数 | 027 |

不读：池内名单、`risk_summary`。

### 7. `review-daily`（每日一行）

| 列 → 子字段 | 用途 | CNT |
|---|---|---|
| `trade_date`、`snapshot_time`、`missing_sources_json` | 数据日、新鲜度 | 002 |
| `opening_price_discovery_json` → `expected_stock_count`、`open5_ready_count`、`close_ready_count`、`open5_observed_count`、`open5_incomplete_count`、`open5_unavailable_count`、`coverage_ratio`、`positive_open5_ratio`、`continuation_ratio`、`overreaction_ratio`、`data_status`、`metric_version` | Open5 汇总 | 031 |

不读：`market_state_json`、`guidance_json`。

## 三、和现有 public-* 的对照（依据 DreamOAgents 本地代码 `dashboard_data_public/contracts.py`、`fields.py`，未核对生产）

| 本平台内容 | 最接近的 public-* 服务/视图 | 能否直接用 | 差距 |
|---|---|---|---|
| 总览大盘涨跌家数、成交额 | `public-industry-review` overview 的上下文 `market` | 待确认 | 需确认 `market` 含指数涨跌幅、涨跌家数、成交额及单位 |
| 参与观察 CNT-006 | `public-market-participation` current | 否 | 缺 `count_stocks`、`sell_pressure_change_1d/3d`、`order_imbalance`；含热度分、冷热/承接状态、市场概况文案（本平台不交付） |
| ERP CNT-007 | `public-market-compensation` current | 否 | 口径不同（`erp_pct`/`rf_10y_pct`/5 年分位 vs 本平台 `erp_filter_json`）；含"估值安全垫"状态；缺 3 年/252 日分位 |
| 估值统计 CNT-007 | 无 | 否 | 需新增 |
| 涨停结构 CNT-008 | `public-market-short-feedback`（字段表为空） | 否 | 需新增 |
| 聪明钱五因子 CNT-009 | `public-market-capital-behavior`（字段表为空） | 否 | 需新增；因子键含 `impact`，建议出口即用中性键 |
| 衍生品 CNT-010 | `public-market-derivatives` current | 否 | 结构是显示值 + 状态带，缺原始基差/PCR/持仓比及来源日 |
| 风格强度 CNT-011 | `public-market-style-rotation` current/history | 部分 | 强度分可用；`momentum_state`/`momentum_direction` 与上下文 `style_leader`/`style_signal` 必须不授权；缺 `z_score` |
| 底部条件 CNT-013 | 无（`public-market-budget` 属不迁入内容） | 否 | 需新增 |
| 行业列表 CNT-014/016/020 | `public-industry-review` overview | 否 | 缺 5/20/60 日涨幅、涨跌家数、MA20/新高占比、`di`、成交占比、`net_flow_1d`、覆盖率；含复盘分组、拥挤、机会标签、风险等级（本平台不交付） |
| RRG CNT-015 | 同上 `relative_strength`/`relative_momentum` | 否 | 口径是 z 分位置刻度，和本平台基准 100 的 `rs_ratio`/`rs_momentum` 不同，数字会变；`rotation_zone` 不授权 |
| 板块序列 CNT-032 | 无区间视图 | 否 | 需新增按 `industry_code` + 日期区间的视图 |
| 历史复盘资金排行/结构 CNT-029/030 | 同行业列表 | 否 | 同上，另缺 `net_flow_1d` |
| Open5 CNT-031 | 无 | 否 | 需新增 |
| 题材 CNT-022 | 无 | 否 | 需新增（含封板时间按行业×时间档聚合，替代个股明细） |
| 股票池计数 CNT-025/027 | 无 | 否 | 需新增（含近 10 日区间） |
| 事件日历 CNT-034/035 | `public-forward-risk-events` calendar | 部分 | 事实字段齐全；需不授权 `impact`、`targets`、`risk_level`、`sensitivity`、`priced_pct`、`surprise`、`ashare_transmission`、`base/bull/bear`、`research`、`reference`；需支持按事件族（宏观）与日期窗口过滤，并剔除占位事件；需带 `source`（预期来源） |

## 四、按数据中台初稿逐字段核对（对照 DreamOAgents `govern-external-data-compliance-v1/design.md` §2、§3，2026-11-14）

### 4.1 去处映射

| 页面 / 模块 | 本平台字段 | 初稿去处 | 核对结论 |
|---|---|---|---|
| 总览 CNT-004 | `market_ctx_index_code`、`market_ctx_index_change_pct`、`market_ctx_up_count`、`market_ctx_down_count`、`market_ctx_turnover_billion` | `public-market-participation/breadth` | 有去处。初稿写"现在从 review-market-sentiment 读"不对，实际来自 `review-industry` 的 `market_ctx_*`；`breadth` 要同时带指数代码、指数涨跌幅（%）、全市场成交额（请直接给亿元） |
| 总览 CNT-002 | 情绪、前瞻风险的 `trade_date`、`snapshot_time`、`coverage_ratio`、`missing_sources` | 各新视图的来源元数据 | 待补：初稿没写统一来源元数据，见 4.2 第 1 条 |
| 参与度 CNT-006 | `total_amount`、`amount_ratio_20d`、`participation_pctile_60d/250d`、`low_participation_streak`、`active_sell_ratio`、`order_imbalance_delta_1d`、`data_status` | `market-participation/current`：`turnover`、`relative_turnover`、`recent_position_pct`、`long_position_pct`、`low_participation_days`、`selling_share_reference_pct`、`buy_sell_change_pp`、`status` | 有去处（改名、单位换算后核对数值） |
| | `count_stocks`、`order_imbalance`、`sell_pressure_change_1d`、`sell_pressure_change_3d`、`source_trade_date`、`status_reason` | 无 | **没有去处**。初稿的 `pressure_change_pp`、`pressure_trend_pp` 取自 interpretation 的变化量与斜率，和这里的 `sell_pressure_change_1d/3d` 是否同一口径要确认 |
| 参与度 CNT-007 ERP | `earnings_yield`、`erp_value_pct`、`yield_10y`、`erp_change_20d_pct`、`erp_percentile_5y` | `market-compensation/current`：`earnings_yield_pct`、`compensation_pct`、`bond_yield_pct`、`change_20d_bp`、`historical_position_pct` | 有去处，但上游来源不同（`erp_filter_json` vs 补偿表），要核对数值；20 日变化单位从 % 变 bp |
| | `erp_change_5d_pct`、`erp_percentile_252d`、`erp_percentile_3y`、`yield_source_flag`、`available_count`、`total_count` | 无 | **没有去处** |
| 参与度 CNT-007 估值 | `valuation_filter_json` 全部：`current_pe_median`、`hist_90d_pe_median`、`break_ratio_pct`、`discount_pct`、`available_count`、`total_count` | 无 | **整块没有去处**（`market-index-position` 是分指数 PE，口径不同，且初稿默认不放） |
| 参与度 CNT-008 | `seal_rate`、`consecutive_board_count`、`max_consecutive_days`、`first_board_premium`、`broken_repair_rate` | `public-market-short-feedback`（全放） | 有去处；本地代码里该服务字段表为空，请把 5 个字段名发过来对一下 |
| 参与度 CNT-009 | 五因子 `factor_display`、`factor_net_breadth`、`factor_pos_share`、`factor_neg_share`；`rows` | `market-capital-behavior/factor-breadth` | 有去处 |
| | `candidate_expected_pool_rows`、`factor_breadth_threshold`、`raw.trade_date`、`metrics.missing_reason` | 未写明 | 待补：页面显示样本池数、净广度阈值、因子数据日和缺失原因；`model_version` 可以不给 |
| 参与度 CNT-010 | `instrument`、`basis_value`、`basis_zscore_60d`、`position_ratio`、`pcr_value`、`pcr_zscore_60d`、各 `*_source_date`、`missing_reason` | `public-market-derivatives`（⚠ 待核对嵌套） | 待核对：现有视图是显示值 + 状态带，原始值和来源日要确认有 |
| | `oi_volume_crowding_zscore_60d` | 无 | **冲突**：初稿 §2.3 把 `crowding*` 一律不放，但这是 CNT-010 已交付的原始 z 分（成交持仓比的 z 分，不是拥挤度标签）。需用户定：放（改中性名，如 `oi_volume_ratio_zscore_60d`）还是从本平台下线 |
| 参与度 CNT-011 | `key`、`label`、`index_name`、`index_code`、`strength_score`、`source_date`、`available`、`missing_reason`、`strength_series` | `market-style-rotation/current`、`history`（`observations`） | 有去处 |
| | `z_score` | 无 | **没有去处** |
| 参与度 CNT-013 | `conditions[].key/label/value/threshold/condition`、`history_obs`、`data_status`、`trade_date` | `market-participation/bottom-observation` | 有去处；`condition`（met/near/unmet）是数值和阈值的比较结果，请确认放（本平台按阈值比较事实交付） |
| 行业 CNT-014/016/020 | `up_num`、`down_num`、`member_count`、`up_stock_ratio`、`above_ma20_ratio`、`new_high_20d_ratio`、`di`、`market_amount_share`、`amount_ratio_ma20`、`net_flow_1d`、`coverage_ratio`、`is_fallback`、`source_max_updated_at`、`missing_sources` | `industry-review/facts` | 有去处 |
| | `sector_code`、`sector_name`、`idx_type`、`sector_return`、`amount`、`turnover_rate`、`net_flow_5d`、`net_flow_20d` | `industry-review/overview`：`industry_code`、`industry_name`、`change_pct`（%）、`turnover`、`turnover_rate`、`net_inflow_5d/20d` | 有去处；建议 `facts` 自带这些列，一页一次请求，免得两个视图日期或行数对不上。`turnover_rate` 初稿源列是 `turnover_rate|turnover_ratio_20d` 二选一，要确认取的是当日换手 |
| | `sector_return_5d`、`sector_return_20d`、`sector_return_60d` | 无 | **没有去处** |
| 行业 CNT-015 RRG | `rs_ratio`、`rs_momentum`（基准 100） | `industry-review/facts` | 有去处。overview 的 `relative_strength/momentum` 是 z 分位置刻度，本平台不用 |
| 板块序列 CNT-032 | 按 `industry_code` + 日期区间取 2–20 个交易日：`trade_date`、`sector_return`、`net_flow_1d`、`amount`、`rs_ratio`、`rs_momentum`、`di` | `industry-review/trend-5d` | 有去处，但两处要改：初稿写"现在从 review-daily 读"不对，实际是 `review-industry` 区间取数；天数不是固定 5 天，按会员等级 2–20 天，视图要支持 `sessions` 2–20 |
| 历史复盘 CNT-029 | `net_flow_1d/5d/20d`、`sector_return`、`sector_code/name`，按 `idx_type` 全量 | `industry-review/facts` | 有去处（初稿写 review-daily 不对，实际 `review-industry`）；本平台自己排序，不需要上游排序 |
| 历史复盘 CNT-030 | 本平台由行业行现算：上涨板块占比、`di` 均值、`above_ma20_ratio` 中位数、前十成交集中度、资金与涨跌背离占比 | `public-daily-review-summary/structure` | 口径要定：初稿写来自 review-daily 不对，现在是本平台用 `review-industry` 行算的。`facts` 给齐字段后本平台可以照旧现算，这个视图可以不建；要建就得和现算结果逐项一致 |
| 历史复盘 CNT-031 | `opening_price_discovery_json` 12 个字段 | `daily-review-summary/open5` | 有去处 |
| 题材 CNT-022 | `theme_rankings_json` 的 `industry`、`up_count`、`broken_count`、`highest_tier`、`avg_pct` | `theme-limit-stats/themes` | 有去处 |
| | `board_tiers_json` 的 `tier`、`count` | `theme-limit-stats/ladder` | 有去处（初稿写来自涨跌停明细，现在本平台取的是 `review-theme.board_tiers_json`，两者要一致） |
| | 封板时间 5 档计数，**按行业分**；当日涨停总数 | `theme-limit-stats/seal-time` | 有去处；请按"行业 × 5 档"给，不是全市场一组；档位边界见 `modules.py` `SEAL_BUCKETS`（左闭右开，14:00–15:00 含 15:00:00） |
| 题材 CNT-025 | `board_tier_counts`（剔除 `unknown`）、`broken_board_count`、`limit_down_count`，当日 + 近 10 日 | `limit-pool-structure/current`、`history` | 有去处；`history` 要支持截至某日的近 10 个交易日 |
| 题材 CNT-027 | `high_recognition` 的 `count/status/latest_date/lag_days`；`momentum_extreme.{窗口}` 的 `window_days/status/reason/latest_avail_date/count` | `limit-pool-structure/pool-counts` | 有去处 |
| 日历 CNT-034/035 | 15 个事件事实字段、`calendar_window_json` 的 `start_date/end_date/complete` | `forward-risk-events/calendar-facts` | 有去处；需支持只给宏观事件族、剔除 `fallback_contract`、按数据日起 1–60 天窗口过滤；`source`（预期来源）要给；重要性现有是 `source_importance_stars`，要和 `source_importance` 数值对上 |

### 4.2 所有新视图都要的公共项（初稿未写）

| # | 项 | 原因 |
|---|---|---|
| 1 | 来源元数据：实际数据日、`snapshot_time`、覆盖率、缺失来源 | 每页显示数据日期与新鲜度（CNT-002），总览要列出各来源的更新时间 |
| 2 | `trade_date=latest` 和"所选日无数据时给最近有数据日" | 各页"查看最近有数据的交易日"按钮 |
| 3 | 当日数据没生成时返回空结果并标明，不返回 0 | 2026-10-21 这类缺数据日的显示 |
| 4 | `idx_type` 三类和分页（概念板块超过 500 行） | 行业页、历史复盘 |

### 4.3 没有去处的字段汇总

| # | 字段 | CNT | 处理建议 |
|---|---|---|---|
| 1 | `valuation_filter_json` 全部 6 个 | 007 | 请数据中台新增（如 `market-compensation/valuation-breadth`），或用户决定下线估值块 |
| 2 | `erp_change_5d_pct`、`erp_percentile_252d`、`erp_percentile_3y`、`yield_source_flag`、`available_count`、`total_count` | 007 | 请加到 `market-compensation`，或用户接受只显示 20 日变化和 5 年分位 |
| 3 | `count_stocks`、`order_imbalance`、`sell_pressure_change_1d/3d`、`source_trade_date`、`status_reason` | 006 | 请加到 `market-participation/current`；`sell_pressure_change_*` 先确认和 `pressure_*_pp` 是否同口径 |
| 4 | `oi_volume_crowding_zscore_60d` | 010 | 改中性名放出，或下线（需用户定） |
| 5 | `z_score`（风格阵营） | 011 | 请加到 `market-style-rotation` |
| 6 | `candidate_expected_pool_rows`、`factor_breadth_threshold`、因子数据日、缺失原因 | 009 | 请加到 `factor-breadth` |
| 7 | `sector_return_5d`、`sector_return_20d`、`sector_return_60d` | 014/016 | 请加到 `industry-review/facts` |

## 五、数据中台定稿回复（2026-11-14，dreamoagents-87）

4.3 列出的 7 组缺字段已全部补上，4.1 中初稿写错的 4 处来源也已改正。等级账号只授权事实视图（数据中台 D9），口径和数值都与现在一致。

### 5.1 待确认项结论

| 项 | 结论 |
|---|---|
| `market-short-feedback` 字段 | `seal_rate_pct`、`consecutive_count`、`maximum_boards`、`first_board_return_pct`、`repair_rate_pct`，每个都是 `{value, available}`，依次对应 `seal_rate`、`consecutive_board_count`、`max_consecutive_days`、`first_board_premium`、`broken_repair_rate` |
| 衍生品 | 新建 `market-derivatives/raw-stats`，包含 matrix 里的 11 个原始字段 |
| 底部条件 `condition` | 放（数据中台 D11） |
| 日历 | `calendar-facts`：参数 `event_family=macro`、`window_days` 1–60（默认 14），服务端剔除 `fallback_contract`；输出 `consensus_source`、`consensus_value`，`source_importance` 给数值 |
| `oi_volume_crowding_zscore_60d` | 改名为 `oi_volume_ratio_zscore_60d` 后放（数据中台 D10，用户已同意） |
| CNT-030 | 数据中台不建视图，本平台用 `facts` 自己算（用户已同意） |
| 公共项 C1–C5 | 都有来源元数据；支持 `trade_date=latest`，并给出 `latest_available_date`；所选日无数据时返回空 rows 和 `empty_reason`，不补 0；支持 `idx_type` 和 offset 分页；金额统一用亿元 |

### 5.2 上游改名对照（实施时改输入映射）

| 现在读的上游字段 | public-* 事实视图字段 |
|---|---|
| `sector_code` | `industry_code` |
| `turnover_rate`（当日换手） | `turnover_rate_1d`（`industry-review/facts`；不用 overview 的 `turnover_rate`，它缺值时会回退成 20 日换手） |
| `theme_rankings_json[].industry` | `theme` |
| `informed_flow_low_impact_stealth` | `stealth` |
| `informed_flow_uncrowded_liquidity` | `uncongested_liquidity` |
| `overreaction_ratio` | `over_response_ratio` |
| `macro_forecast_value` | `consensus_value` |
| `macro_previous_value` / `macro_actual_value` | `previous_value` / `actual_value` |
| `market_ctx_turnover_billion`（千亿元） | `breadth` 成交额（已换算成亿元，本平台不再 ×1000） |
| `participation_observation_json.total_amount`（元） | `observation` 成交额（已换算成亿元，本平台不再 ÷1e8） |

### 5.3 参与度两套口径的核对（CNT-006）

投研平台确认：参与度 `current` 和 `observation` 里的成交额、相对成交、参与位置是同一个上游字段，只是名字不同；真正有两套口径的是卖压变化和卖出占比。本平台现在用的是：

| 指标 | 本平台现用（`participation_observation_json` 原始字段） | 不用的另一套（`current` 视图） |
|---|---|---|
| 卖压变化 | `sell_pressure_change_1d`、`sell_pressure_change_3d`（原始变化值） | `pressure_change_pp`（单日变化量，取自 interpretation）、`pressure_trend_pp`（三次观测斜率） |
| 卖出占比 | `active_sell_ratio`（主动卖出占比，0–1） | `selling_pressure_pct`（卖压相对强度，取自 `sell_pressure_level`） |

切到 `market-participation/observation` 后必须仍是左列这一套，核对时逐日比数值。`sell_pressure_change_3d` 是原始的 3 日变化值，不是三次观测斜率，两者不能互换。

投研平台已核实（2026-11-15，其 design §2.4）：

| 字段 | 结论 |
|---|---|
| `sell_pressure_change_1d` / `sell_pressure_change_3d` | `observation` 直接投影原始字段，不换算；来源 DWS 表 `dws_market_sentiment_observation_daily_df`（上游列名 `sell_release_1d/3d`）。3d 是 3 日变化值。**方向：正值表示卖压缓和** |
| `active_sell_ratio` | 卖出 ÷（买入 + 卖出），0–1，直接投影 |
| 更正 | `current.selling_share_reference_pct` = `active_sell_ratio` × 100，同源；`current.selling_pressure_pct` 是另一个指标"卖压相对强度"。本平台走 `observation`，不受影响 |

**发现一个现有页面的标注问题（不在本变更范围，另行处理）**：`web/src/pages/Participation.vue:14-15` 把这两个字段标为"卖出占比 1 日变化""卖出占比 3 日趋势"。按上游定义，它们是"卖压缓和"方向的变化值（正值 = 卖压缓和），且 3d 是变化值不是趋势。现在的标注容易让用户把正值读成"卖出增加"。需要改标注和说明，例如"卖压缓和程度（1 日变化，正值为缓和）"，由用户确认措辞后另立小变更修改。小程序没有展示这两个字段。

本平台的**对外响应字段名不变**（前端和小程序不改）：改名只影响 `modules.py` 从上游取值的那一侧。例如本平台继续输出 `sector_code` 和 `uncrowded_liquidity`。本平台的 `FORBIDDEN_KEY_RE` 不含 `crowd`，所以这两个输出名不受影响。单位换算改由上游做以后，D5 核对要特别检查成交额有没有被重复换算。
