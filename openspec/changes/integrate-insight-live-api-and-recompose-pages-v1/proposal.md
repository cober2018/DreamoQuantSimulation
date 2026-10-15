## Why

新平台首版（`add-external-market-insight-platform-v1`）只接通了 37 条内容中的 14 条，4 条因数据中台当时没有 API 而标为"未接入"，且只用夹具数据验证过。数据中台已按看板登记了 ADS 与明细服务，并将为新平台签发带范围限制的专用 Key（见数据中台变更 `harden-api-key-authorization-v1`）。现在需要把新平台改接真实接口，补齐 4 条未接入内容，并把页面按分析逻辑重新编排，使其成为现有复盘平台的合规精简版：主题不变，只重排。

## What Changes

- 后端改接数据中台 API：服务端持有专用 Key，浏览器不接触 Key；按看板服务清单取数。
- 补齐 4 条"未接入"内容：

| 内容 | 来源服务 |
|---|---|
| CNT-006 市场参与与压力观察 | `review-market-sentiment` 的 `participation_observation_json` |
| CNT-022 题材涨停/炸板数、最高板、平均涨幅、封板时间 | `review-theme` + `review-limit-list-detail` |
| CNT-025 炸板率、涨跌比、连板/断板结构 | `review-pools` + `review-limit-list-detail` |
| CNT-031 Open5 覆盖/正向/延续/过度反应占比 | `review-daily` 的 `opening_price_discovery_json` |

- 页面按"市场状态 → 情绪与资金 → 结构（行业/题材）→ 回看 → 前瞻"的分析链重排；输出"主题对照表"，逐项说明现有平台每个看板在新平台的对应页面/模块、保留或隐藏及原因。
- 生产路径不再使用夹具；上游不可用时显示"数据暂不可用"并标注数据日期，不回退假数据。
- 内容注册表更新：4 条改为已交付。
- **待定项逐条过审**：10 条 `pending`（如行业阶段、机会风险分布、风格轮动、前瞻风险曲线）若一律不迁入，"行业生命周期""前瞻风险"等主题在新平台会只剩空壳，与"主题不变"冲突。本期逐条拆分"事实统计"与"结论/建议"，事实部分按合规文档迁入，结论部分保持排除；每条结论提交用户确认。
- **服务端缓存**：按（服务、参数）缓存上游结果，历史交易日长缓存、当日短缓存，使多用户访问不按人数放大上游请求，保持在第二期 Key 限流之内。
- 新增接口契约与页面验证的实连冒烟（对生产数据中台，使用专用 Key）。

## Capabilities

### New Capabilities
- `insight-live-data-integration`: 经鉴权 API 取数、服务端持 Key、不可用时的显示语义、4 条未接入内容的接入。
- `insight-page-recomposition`: 主题对照表与按分析逻辑的页面编排。

### Modified Capabilities
（沿用 `insight-content-scope`、`insight-data-supply`、`insight-pages`，其要求在本变更中不放宽）

## Impact

- 代码：`backend/insight_api/{modules,upstream,content_scope,config}.py`、`web/src/pages/*`、`web/src/App.vue`、验证脚本。
- 依赖：数据中台 API（第二期）与专用 Key。
- 不改：合规边界、禁止键守卫、字段允许清单机制。
