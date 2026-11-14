# 切换核对记录

## 第 1 轮：本地联调（2026-11-15）

环境：投研平台本地实例 `http://127.0.0.1:8796`（投研平台 68/68 回归通过）；新链路 Key `insight-svip-dev`（前缀 `dodk_cbde22b`），旧链路本地对数 Key `insight-legacy-compare-local`（前缀 `dodk_33747f5`，只读 7 个 review-*，对完数由投研平台吊销）。Key 明文只在 `.env.integration.local`（600，已 gitignore）。只发 GET records。

命令：`backend/.venv/bin/python scripts/sandbox/2026-11-15_verify_public_parity.py --dates 2026-09-07:2026-09-09 --extra 2026-09-06`

忽略字段：`service_key`（服务名不同）、`event_id`（改为不透明事件引用）、`model_version`（事实视图不提供）、`snapshot_time`（格式不同，单独核对）；`gaps` 只比内容编号。

| 页面 | 结果 | 说明 |
|---|---|---|
| 题材与涨跌结构 | **一致**（09-07、09-08、09-09、缺数据日 09-06） | 题材统计、梯队、封板时间（题材 × 5 档）、股票池结构与近 10 日、池计数逐字段一致 |
| 参与度与资金环境 | 差异全部是上游四舍五入 | 事实视图把 ERP、估值、衍生品 z 分截到 4 位小数，首板溢价截到 2 位；旧链路为 6 位。百分数换算（封板率、回封率 ×0.01）无差异。缺数据日一致 |
| 事件日历 | 不一致 | 09-07～09-09：旧链路有当日行（窗口完整、宏观事件 0 条，`status=empty` 带窗口与来源），新链路返回 `not_generated`、无日期与窗口。09-06：旧链路最近有数据日 09-18，新链路为 null |
| 总览、行业比较、历史复盘 | 本地无法比较 | 本地缺 `ads_industry_lifecycle_daily_df`，新旧两边都取不到；待投研平台发布到有该表的环境后只读核对 |

待投研平台处理：

1. 事实视图数值不要截位（与"直接投影、数值不变"一致），或至少保留 6 位小数。
2. `calendar-facts`：当日快照存在但窗口内宏观事件为 0 时，返回 `trade_date` 与窗口（`window_start/end/complete`），不要标 `not_generated`；"最近有数据日"以快照存在为准，不以有事件为准。
3. `style-rotation` 缺阵营代码 `key`（旧链路输出 `chinext` / `dividend` / `sse50`），本平台对外响应有这个字段。本地风格数据为 `source_row_missing`，尚未比到。

本平台侧发现并已处理：`short-feedback` 以百分数给出封板率、回封率，本平台 ×0.01 还原为比例口径，已核对一致。

## 第 2 轮：本地联调（2026-11-15，投研平台修复后）

投研平台已处理第 1 轮的 3 处：事实视图不再截位（short-feedback 由统筹会话确认改为 6 位）；`calendar-facts` 快照存在即返回日期与窗口（无事件时 `empty_reason=no_events_in_window`）；风格补上阵营代码 `key`。本平台同步：请求字段带上 `key`；对数脚本对 Key 限流（429）退避重试，参与度逐日间隔执行。

日期：2026-08-27～2026-09-09 的 10 个交易日，外加缺数据日 2026-09-06（周日）。

| 页面 | 结果 |
|---|---|
| 事件日历 | 11/11 一致（含缺数据日，最近有数据日均为 09-18） |
| 题材与涨跌结构 | 11/11 一致 |
| 参与度与资金环境 | 10/10 一致；09-06 在第 1 轮已一致 |
| 上游模板偏宽 | 无（各视图只返回本平台请求的字段） |
| 总览、行业比较、历史复盘 | 本地缺表，待投研平台在有 `ads_industry_lifecycle_daily_df` 的环境发布后只读核对 |

已知且接受的差异（不计入对数）：

| 字段 | 说明 |
|---|---|
| `sources[].service_key` | 服务名由 review-* 变为 public-* |
| `events[].event_id` | 改为不透明事件引用 `event_ref` |
| `smart_money_factors.model_version` | 事实视图不提供，输出 null |
| `sources[].missing_sources` | 新链路把内部表名统一折叠为 `undisclosed_source` 并去重；旧链路会把内部表名直接透出给页面，新行为更合规 |
| `sources[].snapshot_time` | 时间格式不同（ISO 带时区），含义相同 |

结论：日历、题材、参与度三页满足 D5 切换条件，可以按 D4 设置 `INSIGHT_PUBLIC_PAGES=calendar,themes,participation` 切换（生产切换需投研平台发布新视图并签发 `insight-svip-prod`）。

## Key 处置（2026-11-15）

| Key | 状态 |
|---|---|
| `insight-legacy-compare-local`（前缀 `dodk_33747f5`，本地对数用） | 投研平台已吊销（只存在于本地 Mongo）；`.env.integration.local` 中对应的 `INSIGHT_UPSTREAM_LEGACY_API_KEY` 已失效，再跑本地对数需重新签发 |
| `insight-svip-dev`（前缀 `dodk_cbde22b`） | 保留，供本地开发 |
| 行业三项（facts、series、breadth）回归 | 待用户按投研平台 ops-runbook 发布到有 `ads_industry_lifecycle_daily_df` 的环境并签发该环境的 `insight-svip` Key 后，用该 Key 与 `dodk_5f4c678` 只读核对；由统筹会话或投研平台通知 |
