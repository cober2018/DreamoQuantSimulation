## 1. 清单与对接（本次）

- [x] 1.1 整理上游取数清单 `field-inventory.md`（页面、CNT、服务、参数、字段、用途）
- [x] 1.2 写对接方案 `design.md` 与 spec
- [x] 1.3 只看本地文档和配置，核对生产 Key 前缀（结论见 design D6）
- [x] 1.4 清单交数据中台（dreamoagents-87），已收到合规模板和补齐方案（D9–D11）
- [x] 1.5 用户确认待决问题（见 design「已定决定」）
- [ ] 1.6 用户登录后台查看生产实际 Key，补记前缀到 design D6

## 2. 数据中台侧（DreamOAgents 负责，本仓库只跟踪）

- [ ] 2.1 为本平台设计 public-* 合规模板（服务 → 视图 → 字段），只含清单字段
- [ ] 2.2 新增或调整服务：参与观察、ERP/估值、涨停结构、聪明钱、衍生品原始值、底部条件、合规行业视图与区间序列、Open5、题材统计、封板时间聚合、股票池计数
- [ ] 2.3 `public-forward-risk-events`：支持事件族与日期窗口过滤、剔除占位事件、返回预期来源
- [ ] 2.4 开 `insight-svip` 账号并配置权限，签发 `insight-svip-prod`、`insight-svip-dev` 两把 Key，交付前缀与登记名
- [ ] 2.5 投研平台按统一名称接收并记录审计请求头：`X-End-User-Ref`（匿名编号）、`X-Client-Entry`、`X-Request-Id`、`X-Route-Rule-Version`

## 3. 本平台实施（数据中台定稿、统筹会话通知后）

- [x] 3.1 `upstream.py`：请求带 `view`/`fields`，适配 `trade_date=latest` 与区间参数；缓存与分页逻辑不变
- [x] 3.1b 等级路由模块：按 `Principal` 当前等级查 active 规则选账号 Key，认不出一律 403；上游缓存键加账号名；发上游请求时带审计请求头
- [x] 3.1c `role_policy_versions` 表与提交（返回差异）/ 确认 / 审批 / 驳回 / 查看历史与差异接口，只有 admin 能调；默认二次确认生效，`INSIGHT_POLICY_REQUIRE_SECOND_APPROVER` 打开时须他人审批、禁止自审；原因必填；变更写 `audit_log`；防自锁校验；初始版本 1
- [x] 3.1d `end_user_refs` 表（首次上游请求时生成随机匿名编号）与 `upstream_route_log` 表：每次上游服务 / 视图访问一条（含缓存命中），保留 180 天，每天自动清理
- [x] 3.1a 过渡期：`config.py` 读可选的 `INSIGHT_UPSTREAM_LEGACY_API_KEY`，`upstream.py` 按 `review-`/`public-` 前缀选 Key；日志不出现任一 Key
- [x] 3.1e 验证脚本 `scripts/sandbox/2026-11-15_verify_tier_routing.py`（44 项）；原有两组验证仍全部通过
- [ ] 3.1f 上线前：管理员按 D7.3 流程提交并确认路由规则版本 1（未确认前 public-* 一律拒绝，review-* 不受影响）
- [x] 3.2 夹具改为 public-* 形状；新增"上游多给字段"和"禁止键"两个夹具用例
- [x] 3.3 核对脚本 `scripts/sandbox/<日期>_verify_public_parity.py`：新旧链路对比，输出每页差异
- [ ] 3.4 按 design D4 的顺序逐页切换，每页核对结果写入 `findings.md`
- [ ] 3.5 全部切完后，验证脚本确认无 review-* 请求；用 `insight-svip` 的 Key 请求 review-* 返回 403
- [ ] 3.6 删除过渡期旧 Key 变量与按前缀选 Key 的代码

## 4. 角色权限配置页（D9，用户已确认，2026-11-15 本地完成）

- [x] 4.1 `indicator_catalog.py`：6 个看板的模块与指标目录（编号、路径、上游依赖、detail 标记），与各页响应逐字段对上
- [x] 4.2 上限查询：按账号读投研平台授权目录快照，缓存 10 分钟；失败时配置页只读
- [x] 4.3 `access/policy.py` 集中裁剪：按角色 × 看板 × 指标删未授权路径，响应加 `restricted`；收拢 `main.py` 各路由里现有裁剪
- [x] 4.4 迁移脚本：从 `role_permissions` 生成完整策略草稿；逐角色逐页比对新旧裁剪结果一致后确认生效；`Principal.perms` 与最低可见等级改由生效策略生成
- [x] 4.5 后台配置页：角色列表、基本设置、看板 × 指标树（超上限置灰并注明原因）、差异与二次确认、历史版本与任意两版差异
- [x] 4.6 前端按 `restricted` 隐藏指标与锁定模块；旧"角色权限"页与 `PUT /admin/roles/{name}` 改权限功能下线（410）
- [ ] 4.7 稳定一个版本周期后删除 `role_permissions` 表与旧代码（迁移第 5 步）

## 5. 收尾（远程写操作，由用户执行或放行）

- [ ] 5.1 生产配 `insight-svip-prod`（过渡期同时配旧 Key 临时变量），更新 `docs/launch-checklist.md` 第 10 项记录账号名与前缀
- [ ] 5.2 全部切完后从生产删除临时变量，再吊销旧 Key，确认旧 Key 返回 401
- [ ] 5.3 更新 `docs/upstream-data-services.md` 为 public-* 版本
