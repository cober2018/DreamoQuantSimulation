## Context

输入文档（冻结副本，见 `docs/source/`）：

| 文档 | SHA-256 | 用途 |
|---|---|---|
| `COMPLIANCE_ACTIVE.md` V0.3 | `a69319177475bb9f76d39dc7c9fcec09bb6806115c97cefb55ebaa78232ae575` | 合规边界、SEC-001～016 风险索引、批准边界 |
| `EXTERNAL_ANALYTICS_CONTENT_SCOPE.md` V0.3 | `7dbca159a1d96e4c54666bc8f7089396b3d4eaab87812a1dab2a37ef4837f94d` | 37 条 CNT 去留、6 个页面组合、内容选择规则 |

监管区分依据（内容草案 §8）：仅「证券信息汇总 / 历史数据统计」与「具体证券投资分析、品种选择、买卖时机或其他投资分析预测建议」分开。本平台只做前者。

供数现状（2026-10-14 只读核对 DreamO 数据中台）：

| service_key | 目标表 | 粒度 | 可承接 CNT |
|---|---|---|---|
| `review-market-sentiment` | `ads_review_market_sentiment_dashboard_df` | 1 行/日 | 002, 007, 008, 010 |
| `review-industry` | `ads_industry_lifecycle_daily_df` | 1 行/板块/日，参数 `trade_date`/`industry_code`/`idx_type` | 002, 004(涨跌家数), 014, 015, 016, 029, 030, 032 |
| `review-forward-risk` | `ads_review_forward_risk_dashboard_df` | 1 行/日 | 034, 035 |

records 接口特性（决定实现方式）：`SELECT * ... FINAL ORDER BY trade_date DESC LIMIT ≤500 OFFSET n`；无同日内二级排序；`trade_date` 缺省为 `latest` 且回显字符串 `latest`；响应 `{success, data:{rows, row_count, columns, trade_date, limit, offset}, cache}`。

约束：新仓库与旧平台**零代码引用**；旧平台零改动；不新增数据中台服务注册；不部署生产。

## Goals / Non-Goals

**Goals**
- 独立可启动的后端网关 + 前端站点；只读消费数据中台。
- 每个对外字段都能追溯到 CNT 条目与上游列；未登记的字段不可能出现在响应中。
- 缺数、上游失败、无供数服务的内容如实呈现为状态，而不是空白或假值。

**Non-Goals**
- 不实现仓位、择时、行业优先、个股动作、预测分数、条件传导解释。
- 不实现用户注册/会员/收费；不做公网部署；不改旧平台 SEC 状态。
- 不解决「待定」条目的语义审查（另行逐条收敛后再加入白名单）。

## Decisions

### D1 架构：服务端投影网关 + 静态前端

```
浏览器 ──▶ web (Vite/Vue) ──/api/v1──▶ insight_api (FastAPI)
                                         ├─ content_scope  (CNT 注册表 + 禁止键守卫)
                                         ├─ projection     (逐模块字段白名单)
                                         └─ upstream       (records 客户端 / 夹具)
                                                 │ X-API-Key（仅服务端）
                                                 ▼
                                  DreamO 数据中台 /api/v1/data/apis/{key}/records
```

- 不让浏览器直连数据中台：API Key 不出服务端（呼应 SEC-014），且原始行含大量不迁入字段（`opportunity_tags`、`signal_priority_*`、`next_state_json`、`short_term_risk_budget_json` 等）。
- 备选「前端直接调 records + 前端过滤」被否决：原始字段会进入浏览器网络面板，等同对外分发。

### D2 允许清单投影（主防线）+ 禁止键守卫（第二防线）

- 每个模块定义「输出字段 ← 上游列/JSON 路径」映射，只复制映射中的字段；JSON 列先解析再按路径取值。
- 响应发出前递归扫描所有键名，命中禁止模式（`action|suggest|guidance|budget|next_state|signal_priority|opportunity|review_group|lifecycle_phase|decision|recommend|target_price|risk_badge|pricing_degree|price_in|risk_score|transmission|scenario|impact|focus|avoid`）即**失败关闭**返回 500，不降级输出。
- 自由文本仅允许：板块名称、事件标题、事件国家/地区、指标代码、周期、单位、来源标签；不输出上游叙述字段（`description`、`phase_reason`、`notes`、`summary`）。

### D3 首版字段白名单

**市场总览（CNT-002、CNT-004 原始涨跌统计）**

| 输出 | 来源 |
|---|---|
| `trade_date` | review-industry 行 `trade_date` |
| `index_code` / `index_change_pct` | `market_ctx_index_code` / `market_ctx_index_change_pct` |
| `up_count` / `down_count` / `up_ratio` | `market_ctx_up_count` / `market_ctx_down_count` / 计算 `up/(up+down)` |
| `turnover_billion`（亿元） | `market_ctx_turnover_billion` |
| `sources[]` | 三个服务各自的数据日、`snapshot_time`、`coverage_ratio`、`missing_sources` |

不输出：`emotion_total_score/state/label`（CNT-004 复合分待定）、所有维度复合分。

**参与度与资金环境（CNT-007、CNT-008、CNT-010）** — 来源 review-market-sentiment

| 块 | 输出字段 | JSON 路径 |
|---|---|---|
| ERP 统计 | `earnings_yield, erp_value_pct, yield_10y, erp_change_5d_pct, erp_change_20d_pct, erp_percentile_252d, erp_percentile_3y, erp_percentile_5y, yield_source_flag, available_count, total_count` | `erp_filter_json` |
| 估值端统计 | `current_pe_median, hist_90d_pe_median, break_ratio_pct, discount_pct, available_count, total_count` | `valuation_filter_json` |
| 涨停结构 | `seal_rate, consecutive_board_count, max_consecutive_days, first_board_premium, broken_repair_rate` | `micro_atomic_json` |
| 衍生品原始指标 | 每品种 `instrument, basis_value, basis_zscore_60d, position_ratio, pcr_value, pcr_zscore_60d, oi_volume_crowding_zscore_60d, basis_source_date, pcr_source_date, position_source_date, missing_reason` | `derivatives_matrix_json[]` |

不输出：`valuation_state`、`compensation_trend`、`valuation_anchor_score`、`instrument_score`、`long_dominant_score`、`fut_score/opt_score/spread`、`indicators_json`（聪明钱，CNT-009 待定）、`style_sentinels_json`（CNT-011 待定）、`next_state_json`（CNT-013 待定）、`short_term_risk_budget_json`（CNT-012 不迁入）。首板溢价固定附注「历史观察值，不代表未来收益」。

**行业比较与轮动（CNT-014、CNT-015、CNT-016）** — 来源 review-industry

`sector_code, sector_name, idx_type, sector_return, sector_return_5d, sector_return_20d, sector_return_60d, amount(亿元), turnover_rate, up_num, down_num, member_count, up_stock_ratio, above_ma20_ratio, new_high_20d_ratio, di, market_amount_share, amount_ratio_ma20, rs_ratio, rs_momentum, net_flow_1d, net_flow_5d, net_flow_20d(亿元), coverage_ratio, is_fallback`

`sector_return*` 上游为小数（0.015 = +1.5%），网关原样输出、前端负责百分比显示。
不输出：`lifecycle_phase, review_group, phase_*, risk_tags, opportunity_tags, signal_*, turning_signals, primary_turning_signal*, rrg_v3_quadrant, rrg_v3_turning_signal, rrg_quadrant, crowding_level/state/score, *_state, trend_mode/score, orderflow_signal_*, leader_stock_codes, capital_path_v3_*, market_env_*, notes, trend_reasons, trend_risk_flags`。
RRG 只画原始坐标 `rs_ratio`/`rs_momentum` 与 100 参考线，不着象限色、不标象限名。

**历史复盘（CNT-029、CNT-030、CNT-032）** — 来源 review-industry，在网关内计算

| 统计 | 定义 | 分母 |
|---|---|---|
| 资金排行 | 所选期间 `net_flow_{1d,5d,20d}` 全量降序，**不截断** | 该 idx_type 当日全部板块 |
| 上涨板块占比 | `count(sector_return>0) / count(sector_return 非空)` | 非空板块 |
| 扩散度均值 | `mean(di)` | `di` 非空板块 |
| 站上 MA20 比例中位数 | `median(above_ma20_ratio)` | 非空板块 |
| 成交额前十集中度 | `sum(top10 amount) / sum(amount)` | `amount` 非空板块 |
| 资金与价格方向背离比例 | `count(sign(net_flow_1d)≠sign(sector_return)) / count(两者均非空且非零)` | 两者均非零板块 |

每项随值返回 `numerator`、`denominator`。「领先改善比例」依赖 RRG 象限判定，首版不提供。
近 5 日序列：对单板块按自然日向前逐日查询（最多 14 次），收集同 `idx_type` 的前 N 个有数交易日；凑不满 N 返回 `status=partial` 并列出实际日期，不插值。

**事件日历（CNT-034、CNT-035）** — 来源 review-forward-risk `calendar_events_json` 与 `calendar_window_json`

`event_id, event_date, event_time, country, event_type_label, title, indicator_code, period, unit, publication_status, previous_value, actual_value, consensus_value, consensus_source, source_importance`

`consensus_value` 来自 `macro_forecast_value`，前端固定标注「第三方发布的市场预期，非本平台预测」。窗口：`start_date, end_date, complete`。
不使用 `events_json`（含 `fallback_contract` 占位事件与风险评分）、`curve_json`、`horizons_json`、`summary_json`、`structured_output_json`、`market_pricing_features_json`、`focus_event_json` 及事件内 `impact_*`、`risk_*`、`transmission_*`、`scenario`。来源为 `fallback_contract` 的事件一律剔除。

**题材与涨跌结构（CNT-022、CNT-025）**：数据中台无对应服务 → 返回 `status=not_connected`，附所需业务字段合同，页面展示待接入说明。参与观察（CNT-006）、Open5（CNT-031）同此处理。

### D4 统一响应信封

```json
{
  "module": "overview",
  "content_ids": ["CNT-002", "CNT-004"],
  "trade_date": "2026-09-09",
  "status": "ok | partial | empty | not_connected | upstream_error",
  "data_mode": "live | fixture",
  "sources": [{"service_key": "...", "source_date": "...", "snapshot_time": "...", "coverage_ratio": 0.83, "missing_sources": []}],
  "gaps": [{"content_id": "CNT-006", "reason": "数据中台无对应服务"}],
  "data": {},
  "disclaimer": "本平台仅提供证券信息汇总与历史数据统计，不构成任何证券投资建议。"
}
```

- 上游超时/5xx/401 → HTTP 502，`status=upstream_error`，`data` 为空；不回退缓存外的任何值。
- 上游 0 行 → HTTP 200，`status=empty`。
- 部分块缺数或分页异常 → `status=partial`，在 `gaps` 中逐条说明。

### D5 上游客户端

- `httpx.AsyncClient`，超时 15s，重试 0 次（避免掩盖上游问题）。
- 分页：`limit=500`，循环 `offset` 直至返回行数 < 500，上限 10 页；按 `sector_code` 去重。因上游同日无二级排序，分页可能重复/遗漏：若检测到重复键，或触达页数上限，标记 `partial`。按 `idx_type` 分开请求以尽量单页取全。
- 进程内 TTL 缓存 60s，键 = service_key + 排序后参数。
- 实际交易日以返回行的 `trade_date` 为准（上游回显可能为 `latest`）。

### D6 运行模式与访问

- `INSIGHT_DATA_MODE=live|fixture`。fixture 读 `backend/fixtures/*.json`：情绪与前瞻风险夹具取自 2026-09 本地 ADS 真实行（原样保存上游整行，用于验证投影确实剔除禁用字段）；行业夹具与日历事件夹具为**合成**数据。信封 `data_mode=fixture`，页面顶部固定横幅「开发夹具数据，非实时行情」。
- `INSIGHT_ACCESS_TOKEN` 设置时，`/api/v1/*`（除 `/health`）要求 `Authorization: Bearer <token>`；开发 Vite 代理在服务端注入，不进浏览器包。
- 默认监听 `127.0.0.1`。

### D7 前端

- Vite + Vue 3 + vue-router + ECharts，无 UI 组件库，自写轻量样式；与旧前端无共享代码。
- 7 个路由：`/overview`、`/participation`、`/industries`、`/themes`、`/history`、`/calendar`、`/about`。
- 每页顶部：数据日期、数据状态徽标、来源与覆盖；底部固定免责声明。
- 排序只由用户点击列头触发；默认排序见 spec；任何列表不做 Top N 截断展示。
- 颜色只编码涨跌方向（红涨绿跌），不编码「关注/规避」类含义。

## Risks / Trade-offs

- [上游分页无稳定排序] → 按 idx_type 拆分请求 + 去重 + partial 标记；长期需数据中台加二级排序（列为待办，不在本仓库改）。
- [字段语义仍有未核项，如 `di`、`market_amount_share` 的精确公式] → 页面「数据与内容说明」逐项列出来源列与「公式待数据中台确认」状态；不自行解释为择时信号。
- [行业夹具为合成数据] → 信封与横幅双重标识；生产模式禁止启用 fixture（启动时 `INSIGHT_ENV=production` 且 fixture 则拒绝启动）。
- [合规结论] → 技术白名单不等于法律意见；对外开放前须完成 B-LAW/B07。

## Migration Plan

新仓库，无迁移。回滚 = 停止服务。上线前置条件：数据中台签发专用 Key；法律复核；访问控制方案确定。

## Open Questions

- 题材/股票池/Open5/市场参与观察是否在数据中台新建 ADS 服务（需数据中台侧变更，另立 change）。
- 「待定」条目（CNT-004 复合分、009、011、013、018、019、021、023、027、033、036、037）逐条语义审查后再决定是否进入白名单。
