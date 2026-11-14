## ADDED Requirements

### Requirement: Upstream only through governed public services
本平台后端 SHALL 只通过投研平台的 public-* 事实视图取数，并 MUST 在每次请求里带 `view` 和只含 `field-inventory.md` 清单内字段的 `fields`；全部页面切换完成后 MUST NOT 再请求任何 review-* 服务。

#### Scenario: No review-* call after cutover
- **WHEN** 全部页面切换完成后，对 6 个页面各请求一次并记录上游请求
- **THEN** 上游请求的 service_key 全部以 `public-` 开头，且每个请求都带 `view` 和 `fields`

#### Scenario: Field request matches inventory
- **WHEN** 检查某页面发往上游的 `fields` 参数
- **THEN** 其中每个字段都能在 `field-inventory.md` 对应页面的映射里找到

### Requirement: Tier account keys
投研平台 SHALL 按本平台用户等级开账号，一个等级一个账号，权限挂在账号上；本期只有 `insight-svip`，Key 为 `insight-svip-prod`、`insight-svip-dev`，通过环境变量 `INSIGHT_UPSTREAM_API_KEY` 注入。等级账号 MUST 只授权投研平台合规模板内的 public-* 服务、视图和字段，不授权任何 review-* 服务；本期 `insight-svip` 的范围等于整个合规模板，可以大于页面实际用量，页面用不到的部分 MUST NOT 被请求，将来要上页面须先由产品确认口径。等级 Key MUST 只存在于服务端环境变量，不进数据库、日志、响应和前端；文档里只出现账号名、Key 登记名和前缀。投研平台 MUST NOT 给终端用户发 Key。

#### Scenario: Unused service is refused
- **WHEN** 用 `insight-svip` 的任一 Key 请求任一 review-* 服务，或合规模板之外的 public-* 服务（如 `public-industry-stock-scores`）
- **THEN** 投研平台返回 403

#### Scenario: Unlisted field is refused
- **WHEN** 用 `insight-svip` 的 Key 请求某视图下没有授权的字段
- **THEN** 投研平台返回 422，不返回该字段

#### Scenario: Dev and prod keys share scope
- **WHEN** 分别用 `insight-svip-dev` 和 `insight-svip-prod` 请求同一视图、同一字段
- **THEN** 两者的授权结果相同

### Requirement: Tier routing
每次请求 public-* 时，本平台 SHALL 从当前请求的 `Principal` 实时读取用户等级，按当前生效的路由规则版本选出等级账号及其 Key。等级不在规则表里、没有生效的规则版本、或账号对应的 Key 变量为空时，MUST 拒绝该请求，MUST NOT 回退到任何默认账号。本期规则版本 1 把 free、vip、svip、admin 都路由到 `insight-svip`；等级之间的差别 MUST 继续由本平台权限点在取数之后裁剪。上游缓存键 MUST 包含等级账号名。

#### Scenario: Known tier is routed
- **WHEN** 一个 vip 用户请求参与度页
- **THEN** 上游请求使用 `insight-svip` 的 Key，路由记录里的 `account=insight-svip`、`rule_version=1`

#### Scenario: Unknown tier is refused
- **WHEN** 管理员新建了一个未登记在路由规则里的等级，该等级用户请求任一数据页
- **THEN** 本平台返回 403，不发上游请求，写一条 `result=rejected` 的路由记录

#### Scenario: Tier change takes effect immediately
- **WHEN** 用户会员到期，等级从 svip 变为 free，随后再请求数据页
- **THEN** 该请求按 free 的规则路由，并按 free 的权限点裁剪，不沿用到期前的等级

#### Scenario: No active rule
- **WHEN** 启动时没有 active 的路由规则版本
- **THEN** 所有 public-* 请求被拒绝，健康检查报告路由规则缺失

### Requirement: Role policy change control
路由规则与角色权限 SHALL 共用一套带递增版本号的角色策略版本。只有拥有管理后台权限的 admin 能提交、确认、审批或驳回。默认流程下，管理员提交后 MUST 先看到改前改后的差异并填写原因（必填），再二次确认才生效；未确认的草稿不生效。环境变量 `INSIGHT_POLICY_REQUIRE_SECOND_APPROVER` 打开时，确认后 MUST 由提交人以外的另一名管理员审批才生效，提交人不能审批自己的版本。同一时刻只能有一个生效版本。每次提交、确认、审批、驳回、生效、退役 MUST 记录操作人、时间、改前与改后的版本和内容、原因。

#### Scenario: Single admin confirms with diff
- **WHEN** 开关关闭，管理员提交一份修改并收到差异，随后带该草稿版本号确认
- **THEN** 新版本立即生效且无需重启；审计记录里有操作人、时间、改前与改后的版本和内容、原因

#### Scenario: Unconfirmed draft has no effect
- **WHEN** 管理员提交草稿后没有确认
- **THEN** 生效版本不变，请求仍按原版本路由和裁剪

#### Scenario: Reason is required
- **WHEN** 管理员提交草稿时未填原因
- **THEN** 接口拒绝，不生成草稿

#### Scenario: Second approver switch on
- **WHEN** 开关打开，管理员确认自己的草稿后又尝试审批它
- **THEN** 草稿停在待审批，自审被拒绝；另一名管理员审批后才生效

#### Scenario: Non-admin cannot write
- **WHEN** 没有管理后台权限的用户调用提交、确认或审批接口
- **THEN** 返回 403，不生成任何版本

#### Scenario: Self lock-out is refused
- **WHEN** 草稿会让 admin 失去管理后台权限或失去路由账号
- **THEN** 提交被拒绝并说明原因

#### Scenario: Stale draft is refused
- **WHEN** 草稿基于的版本已不是当前生效版本时被确认
- **THEN** 确认被拒绝，要求基于新版本重做草稿

### Requirement: Per-request route log and upstream audit fields
本平台 SHALL 为每次用户请求中的每一次上游服务 / 视图访问写一条路由记录，字段包括时间、`request_id`、用户编号、请求时等级、等级账号、规则版本、入口（web / mp / api / mcp）、服务、视图、是否命中缓存、结果；命中本平台缓存的访问也要记录。实际发往投研平台的每个请求 MUST 带请求头 `X-End-User-Ref`、`X-Client-Entry`、`X-Request-Id`、`X-Route-Rule-Version`，使两边记录可以按 `X-Request-Id` 对上。`X-End-User-Ref` MUST 是本平台生成并保存的不透明匿名编号，MUST NOT 是内部 `user_id` 或可由它直接推出的值；匿名编号与用户的映射 MUST 只保存在本平台。记录和审计字段 MUST NOT 包含 Key、用户名以外的个人信息或响应内容。

#### Scenario: Records match across platforms
- **WHEN** 一个小程序用户请求题材页，且该请求未命中缓存
- **THEN** 本平台路由记录与投研平台调用记录中存在相同的 `X-Request-Id`，匿名编号和入口 `mp` 一致

#### Scenario: Upstream cannot identify the user
- **WHEN** 检查发往投研平台的审计请求头
- **THEN** `X-End-User-Ref` 是 32 位十六进制随机编号，不等于也不包含该用户的 `user_id`、用户名或手机号；同一用户多次请求的编号相同

#### Scenario: Cache hit is logged locally
- **WHEN** 第二个用户在缓存有效期内请求同一页面
- **THEN** 本平台写一条 `cache_hit=1` 的路由记录，投研平台没有对应记录

### Requirement: Legacy key only during cutover
切换期间，没切的页面 SHALL 在生产上继续用旧 Key 读 review-*。旧 Key MUST 只放在临时变量 `INSIGHT_UPSTREAM_LEGACY_API_KEY` 中，且只用于 review-* 请求；public-* 请求 MUST 经等级路由使用等级账号 Key。全部页面切完并核对通过后，MUST 先删除该临时变量，再吊销旧 Key。

#### Scenario: Key chosen by service prefix
- **WHEN** 过渡期内同时请求一个已切页面和一个未切页面
- **THEN** public-* 请求带等级账号 Key，review-* 请求带旧 Key，日志里两把 Key 都不出现

#### Scenario: Legacy key revoked after cutover
- **WHEN** 全部页面切完、临时变量已删除、旧 Key 已吊销后，用旧 Key 请求任一服务
- **THEN** 投研平台返回 401，本平台各页面仍正常取数

### Requirement: Platform-side guard retained as second line
本平台的字段白名单投影、`FORBIDDEN_KEY_RE` 出口拦截和内容注册表 SHALL 保留，且 MUST NOT 因上游已收窄或用户等级不同而放宽。上游返回了本平台未请求或清单外的字段时，本平台 MUST 丢弃该字段，并在验证脚本中报告。将来的对外 API / MCP 入口 MUST 复用同一套过滤和拦截。

#### Scenario: Upstream sends an extra field
- **WHEN** 夹具模拟上游在授权视图里多返回一个清单外字段（如 `rotation_zone`）
- **THEN** 本平台响应不含该字段，验证脚本输出"上游模板偏宽"告警

#### Scenario: Forbidden key still blocked
- **WHEN** 夹具模拟上游返回键名含 `impact` 或 `scenario` 的字段
- **THEN** 本平台响应整体失败并返回内容守卫错误，不外发该字段

### Requirement: Per-page cutover with parity check
页面 SHALL 整页切换，同一页面的全部模块 MUST 同时来自 public-*。切换前 MUST 对同一组交易日比较新旧链路的对外响应；数值相对差异超过 1e-6，或 `status`、`gaps`、数据日不一致，该页就不得切换。核对可以对生产投研平台发请求，但 MUST 只发只读的 records 请求。

#### Scenario: Parity passes
- **WHEN** 对事件日历页的样本日逐日比较新旧响应
- **THEN** 事件数量、每条事件的事实字段、窗口、`status` 一致，核对结果写入 `findings.md`

#### Scenario: Unit conversion not doubled
- **WHEN** 比较总览成交额和参与度成交额的新旧响应
- **THEN** 两者都以亿元为单位且数值一致，没有被本平台再换算一次

#### Scenario: Same-name fields keep their definition
- **WHEN** 比较行业页当日换手和参与度页卖压变化、卖出占比的新旧响应
- **THEN** 换手取自 `turnover_rate_1d` 且逐板块一致；卖压变化取自 `sell_pressure_change_1d/3d`、卖出占比取自 `active_sell_ratio`，数值一致

#### Scenario: Missing-data day stays honest
- **WHEN** 对 2026-10-21（上游缺数据日）比较新旧响应
- **THEN** 新链路同样返回 `empty` 或 `partial` 并带最近有数据的交易日，不出现补值

#### Scenario: Parity check is read-only
- **WHEN** 对生产投研平台运行核对脚本
- **THEN** 脚本只发 GET records 请求，不调用任何写入、签发或吊销接口

### Requirement: Pages wait for missing public services
用到的 public-* 事实视图还没上线、或还没授权给等级账号的页面，SHALL 继续留在旧链路，MUST NOT 用其他服务的近似字段拼凑。

#### Scenario: Theme page waits
- **WHEN** `public-theme-limit-stats` 或 `public-limit-pool-structure` 中任一视图未上线
- **THEN** 题材页继续读 review-*，也不用 public-* 里其他服务的字段替代

### Requirement: Unused SVIP scope stays off pages
`insight-svip` 可读但页面未使用的部分（指数位置，以及参与度、ERP 补偿、行业复盘现有视图里与事实视图口径不同的事实字段）SHALL NOT 被本平台请求或展示，除非产品已确认采用哪套口径，并已在内容注册表和 `field-inventory.md` 登记。同一类数据在页面上 MUST NOT 混用两套口径。

#### Scenario: Extra scope not requested
- **WHEN** 检查全部页面发往上游的请求
- **THEN** 不包含 `public-market-index-position`，也不包含 `market-participation`、`market-compensation`、`industry-review` 的非事实视图

### Requirement: Role dashboard-indicator policy
本平台 SHALL 用角色策略按"角色 × 看板 × 指标"配置数据权限，作为唯一的一套权限配置；现有权限点（看板开关、下钻明细、历史天数、会话数、可用入口、管理后台权限）MUST 并入角色策略，不与之并存。指标编号以代码内的指标目录为准。

#### Scenario: Indicator trimmed by backend
- **WHEN** 生效策略中 vip 角色未勾选 `participation.erp.erp_percentile_5y`，vip 用户请求参与度页
- **THEN** 响应不含该指标的值，`restricted` 列出该指标编号，其他指标照常返回

#### Scenario: Dashboard closed
- **WHEN** 某角色策略中某看板未开放，该角色用户请求该看板
- **THEN** 返回 403，并给出由生效策略计算的最低可见等级

#### Scenario: Frontend follows backend
- **WHEN** 前端收到带 `restricted` 的响应
- **THEN** 隐藏被裁掉的指标；某模块全部被裁时显示锁定卡片；前端不自行做权限判断

#### Scenario: Migration keeps behavior
- **WHEN** 由现有 `role_permissions` 生成的首个完整策略版本生效后，free、vip、svip 测试账号访问全部页面
- **THEN** 每个页面返回的字段与切换前逐字段一致

#### Scenario: Old permission editing removed
- **WHEN** 完整策略上线后调用旧的直接改角色权限接口
- **THEN** 返回 410，权限只能通过角色策略版本修改

### Requirement: Policy bounded by upstream account
配置页可勾选的指标 SHALL 以该角色所路由等级账号的上游可读范围为上限：指标依赖的上游服务、视图、字段不全在可读范围内时，MUST 置灰并注明原因，且不能提交。确认和审批时 MUST 再次核对上限，超出时拒绝生效。运行时裁剪按"策略 ∩ 上限"执行。

#### Scenario: Out-of-scope indicator greyed
- **WHEN** 某指标依赖的字段不在 `insight-svip` 的授权目录中
- **THEN** 配置页该指标置灰并显示"insight-svip 未授权"及具体服务、视图、字段，提交包含它的草稿被拒绝

#### Scenario: Upper bound unavailable
- **WHEN** 查询投研平台授权目录失败
- **THEN** 配置页只读，不能提交草稿；当前生效版本不受影响
