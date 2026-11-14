## Why

本平台现在用的 Key（前缀 `dodk_5f4c678`，登记名 insight-platform-local-dev）能读数据中台 13 个 review-* 原始服务的全部列，包括个股排名表和仓位、预测、机会标签等建议性列。合规完全依赖本平台自己的字段白名单（`modules.py`）和出口禁止键拦截（`content_scope.py`）。也就是说，不合规数据已经交到了本平台手里，只是没往外发。

用户的设计是：数据中台按服务账号决定对外给哪些服务、视图和字段，Key 只是账号下的凭证、继承账号权限。所以要改成数据中台在出口就只给本平台合规字段，本平台的过滤降为第二道防线。

## What Changes

- 整理本平台完整的上游取数清单（`field-inventory.md`），交数据中台据此设计本平台专用的合规模板，并补齐 public-* 缺的数据。
- 后端从 `review-*` records 改接数据中台 `public-*` 服务：按页面逐个切换，响应结构改为 public-* 的视图与字段名。
- 投研平台按本平台用户等级开账号（一个等级一个账号）。本期只建 `insight-svip`，Key 为 `insight-svip-prod` / `insight-svip-dev`；账号只授权本平台用到的 public-* 服务、视图和字段，不授权任何 review-*；环境变量名仍是 `INSIGHT_UPSTREAM_API_KEY`。
- 新增等级路由模块：每次请求按用户当前等级选上游账号 Key，认不出的等级一律拒绝；本期所有等级都路由到 `insight-svip`，等级差别继续由本平台权限点裁剪。路由规则与角色权限共用一套策略版本：看差异、二次确认后生效（保留双人审批开关，默认关闭）、留变更记录；新增角色权限配置页，按角色 × 看板 × 指标配置，取代现有权限点配置；每次请求留路由记录，并把匿名用户编号和入口作为审计字段传给投研平台。
- 过渡期没切的页面在生产上继续用旧 Key 读 review-*，旧 Key 放进临时变量 `INSIGHT_UPSTREAM_LEGACY_API_KEY`，全部切完后删除。
- 本平台的字段白名单、`FORBIDDEN_KEY_RE` 出口拦截、内容注册表全部保留，作为第二道防线。
- 切换期间对每个页面做新旧数字核对，核对通过才切换该页。
- 全部页面切完后，删除临时变量，吊销旧 Key（`dodk_5f4c678`，或用户核对出的生产旧 Key）。

本变更只定方案。用户已于 2026-11-14 拍板（见 design「已定决定」）；代码等数据中台定稿后，由统筹会话统一通知开工。

## Capabilities

### New Capabilities
- `upstream-data-governance`：上游只走 public-*、等级账号 Key 与等级路由、路由记录、两道防线、切换核对、按页切换门槛

### Modified Capabilities
- 无（`insight-live-data-integration` 里"只走已登记且鉴权的服务、Key 只在服务端"的要求不变，本变更在其上收紧）

## Impact

- 代码（后续实施时）：`backend/insight_api/upstream.py`（请求参数增加 `view`/`fields`，区间参数改名）、`modules.py`（各页取数与字段映射）、新增等级路由模块、`role_policy_versions`、`upstream_route_log`、`end_user_refs` 三张表；之后新增指标目录、策略执行函数和角色权限配置页（D9）、`backend/fixtures/`（夹具换成 public-* 形状）、`scripts/sandbox/` 验证脚本。前端和接口响应结构不变。
- 依赖：数据中台（DreamOAgents）新增或调整 public-* 服务，开 `insight-svip` 账号并配置字段模板，签发 prod / dev Key；接收本平台的审计请求头。
- 运维：生产环境配置新 Key 和过渡期旧 Key，切完后吊销旧 Key。这些是远程写操作，由用户执行或授权。
