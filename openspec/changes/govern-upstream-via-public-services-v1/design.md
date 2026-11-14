## 背景

- 现状取数清单见 `field-inventory.md`：6 个页面、7 个 review-* 服务、约 130 个字段（含 JSON 子字段）。
- 数据中台已有 16 个 public-* 服务，支持配置 `public_permissions`（服务 → 视图 → 顶层字段）。投研平台按本平台用户等级开账号，权限挂在账号上，Key 只是账号下的凭证（见 D2）。但这些服务是按内部看板设计的，大多带状态标签、评分、机会/风险标签，和本平台的口径也不一致。能部分沿用的只有 `public-forward-risk-events` 和 `public-market-style-rotation`，其余都要数据中台新增视图或服务（对照见清单第三节）。
- 生产 Key 现状（只看本地文档）：见第六节。

## D1 两道防线

| 防线 | 位置 | 管什么 | 失败表现 |
|---|---|---|---|
| 第一道 | 投研平台出口（等级账号的权限：服务、视图、字段；本期只有 `insight-svip`） | 只返回授权的服务、视图、字段；未授权服务 403，未授权字段 422 | 本平台拿不到不合规数据 |
| 第二道 | 本平台 `modules.py` 白名单 + `scan_forbidden_keys` | 只投影清单内字段；响应里出现禁止键就整体失败 | 页面报错，不外发 |

第二道防线保留现状，不因第一道上线而放宽。本期 `insight-svip` 能读的比页面用的多（D2），所以第一道只保证"不出合规模板"，"只出页面需要的字段"靠本平台请求时带 `fields=` 和第二道白名单。如果上游返回了本平台没请求的字段，本平台照样丢弃，并在验证脚本里记一条告警。

## D2 等级账号与 Key

产品架构（用户 2026-11-15 定）：本平台是合规产品线，网页、小程序和将来的对外 API / MCP 服务共用一套用户体系和等级权限。投研平台（DreamOAgents）只通过数据 API 给本平台供数，**按本平台的用户等级开账号，一个等级一个账号**；权限（服务、视图、字段）挂在账号上，Key 是账号下的凭证。

| 项 | 要求 |
|---|---|
| 本期账号 | 只建 `insight-svip` 一个账号（最全的一套）：套餐等于投研平台整个合规模板（12 个服务），不授权任何 review-* 服务。见下方「SVIP 可读范围大于页面用量」 |
| Key | `insight-svip-prod`、`insight-svip-dev`（替换原定的 `insight-display-prod` / `-dev`）。两把权限相同，dev 过期时间更短，不在环境之间混用 |
| 环境变量 | 仍是 `INSIGHT_UPSTREAM_API_KEY`，本期填 `insight-svip` 的 Key。不加账号标识，records 接口由 Key 反查账号 |
| 将来多账号 | 拆出新等级账号时，每个账号一个变量 `INSIGHT_UPSTREAM_API_KEY_<账号后缀>`（如 `_VIP`）；路由表只写账号名，不写 Key，由等级路由模块按账号名取变量（D7） |
| 过渡期旧 Key | 没切的页面在生产上继续用旧 Key 读 review-*：旧 Key 放临时变量 `INSIGHT_UPSTREAM_LEGACY_API_KEY`，只用于 review-* 请求，不经等级路由。全部切完后先删变量和对应代码，再吊销旧 Key。实现上的兼容：`insight-svip` 的 Key 下发前，生产只有旧 Key 配在 `INSIGHT_UPSTREAM_API_KEY` 里，此时若未设临时变量，review-* 暂用 `INSIGHT_UPSTREAM_API_KEY` 并在启动日志告警；配上 `insight-svip` 的 Key 时必须同时把旧 Key 移到临时变量 |
| 有效期与限流 | 由投研平台在账号或 Key 上设置；建议 365 天、600 次/分钟，来源 IP 绑定生产网关 |
| 文档记录 | 只记账号名、Key 登记名和前缀，不写明文 |
| 旧 Key | 全部页面切完、核对通过后吊销（`dodk_5f4c678`，或用户核对出的生产旧 Key） |
| 终端用户 Key | 投研平台不给终端用户发 Key；将来对外 API 的个人 Key 由本平台签发（D8） |

**SVIP 可读范围大于页面用量**（用户 2026-11-15 定）：`insight-svip` 的套餐等于投研平台整个合规模板，共 12 个服务，比页面实际用到的 11 个服务（D4）多出：

| 多出的部分 | 与页面现用数据的关系 |
|---|---|
| `public-market-index-position` overview / history（指数位置） | 页面目前没有这块内容 |
| `public-market-participation`、`public-market-compensation`、`public-industry-review` 现有视图里的事实字段 | 和页面现用的事实视图（`observation`、`erp-filter`、`facts` 等）是同一类数据，**但口径不同** |

- 页面照现在的设计继续只用事实视图，口径不变；本平台请求时只带 `field-inventory.md` 里的 `fields`，不读多出的部分。
- 多出的部分将来要上页面，必须先由产品确认用哪套口径，同一类数据在页面上不能混用两套口径；确认后在内容注册表和 `field-inventory.md` 登记，再接入。
- 将来拆出低等级账号时，各等级账号的范围按产品定的数据权限收窄，不一定等于合规模板。

对本平台的影响：

| 方面 | 影响 |
|---|---|
| 配置 | 本期仍是一个 `INSIGHT_UPSTREAM_API_KEY`；过渡期多一个临时变量 |
| 代码 | 新增等级路由模块（D7）；过渡期 `upstream.py` 按 `review-`/`public-` 前缀区分旧 Key 与路由 Key；`config.py` 的"live 模式必须有 Key"校验照旧 |
| 上游缓存 | 缓存键必须加上等级账号名。拆出多个账号后，不同账号能读的字段不同，不能共用缓存；本期只有一个账号，行为不变 |
| 本地开发 | `.env.local` 换成 `insight-svip-dev` |
| 越权表现 | 账号没授权的服务返回 403、字段返回 422，本平台错误处理不变 |

## D3 请求方式变化

| 项 | review-*（现状） | public-*（目标） |
|---|---|---|
| 地址 | `/api/v1/data/apis/{key}/records` | 相同 |
| 视图 | 无 | `view=` 必填（或用默认视图） |
| 字段 | 整行 | `fields=` 只请求清单内字段 |
| 最新日 | 不传日期 + `limit=1` | `trade_date=latest`，续页用返回的实际日期 |
| 日期区间 | `start_date`/`end_date` | 需数据中台在新视图里提供（现有 public-* 只有 `sessions` 或 `date_from`/`date_to`，各服务不同） |
| JSON 列 | `*_json` 字符串要再解析一次 | 嵌套对象直接返回 |
| 缺失 | 空值或 `data_status` | `null` 表示未知，零值保留 |

`upstream.py` 的缓存、分页上限、空结果不缓存、422 降级逐日取等逻辑保留，只改参数组装和响应解析。

## D4 按页切换

一个页面只要用到的某个服务没准备好，整页就不切。不允许同一页一半走 review-*、一半走 public-*，避免同页数据日期和口径不一致。

按数据中台 `govern-external-data-compliance-v1` 定稿（D9：等级账号只授权"事实视图"，直接投影本平台现在读的同一批上游字段，口径不变）：

| 页面 | 依赖的 public-* 事实视图 | 切换条件 |
|---|---|---|
| 事件日历 | `forward-risk-events/calendar-facts`（`event_family=macro`、`window_days` 1–60） | 视图上线并授权 |
| 总览 | `market-participation/breadth`；情绪、前瞻风险的新鲜度取自各事实视图的来源元数据 | 同上 |
| 参与度与资金环境 | `market-participation/observation`、`bottom-observation`；`market-compensation/erp-filter`、`valuation-breadth`；`market-short-feedback`；`market-capital-behavior/factor-breadth`；`market-derivatives/raw-stats`；`market-style-rotation`（加 `z_score`、`strength_series`、`missing_reason`） | 7 块全部上线并授权 |
| 行业比较与轮动（含板块序列） | `industry-review/facts`、`industry-review/series`（`industry_code` + `sessions` 2–20） | 同上 |
| 历史复盘 | `industry-review/facts`（CNT-030 本平台现算）、`daily-review-summary/open5` | 同上 |
| 题材与涨跌结构 | `theme-limit-stats/themes`、`ladder`、`seal-time`（题材 × 5 档 + `limit_up_total`）；`limit-pool-structure/current`、`history`、`pool-counts` | 同上 |

页面实际只用其中 11 个服务（`insight-svip` 可读 12 个，见 D2）：`public-market-participation`、`-compensation`、`-short-feedback`、`-capital-behavior`、`-derivatives`、`-style-rotation`、`public-forward-risk-events`、`public-industry-review`、`public-theme-limit-stats`、`public-limit-pool-structure`、`public-daily-review-summary`。

建议切换顺序：事件日历 → 总览 → 历史复盘 → 行业 → 参与度 → 题材。

## D5 切换核对

每个页面切换前，用同一组交易日并行请求新旧两条链路，对比本平台**对外响应**（不是上游原始行）：

| 项 | 做法 |
|---|---|
| 样本日 | 最近 10 个交易日 + 2026-10-20、2026-10-21（上游缺数据日）+ 每类板块各 1 天概念板块超过 500 行的日子 |
| 对比内容 | 每个模块的数值、计数、排序、`status`、`gaps`、`sources[].source_date` |
| 允许差异 | 数值相对误差 ≤ 1e-6（只允许浮点舍入）；字段改名在对比前按映射表归一 |
| 口径变化 | 数据中台 D9 承诺口径不变，预期零差异；若仍出现口径差异，该页不切，回到数据中台查原因 |
| 专项核对 | ① 成交额（亿元）没有被重复换算；② 行业当日换手取自 `facts.turnover_rate_1d`，逐板块与现用 `turnover_rate` 一致，不能出现 20 日换手回退值；③ 参与度卖压变化用 `sell_pressure_change_1d/3d`、卖出占比用 `active_sell_ratio`，不能换成 `pressure_*_pp`、`selling_pressure_pct`（`field-inventory.md` 5.3） |
| 合规检查 | 新链路上游原始响应里不得出现清单外字段，也不得命中 `FORBIDDEN_KEY_RE` |
| 记录 | 每页一份核对结果，写进本变更的 `findings.md`，附命令和差异明细 |
| 环境 | 用户已允许对生产数据中台做**只读**请求（已定决定 6）；只发 GET records，不调用任何写接口、签发或吊销接口 |
| 两把 Key | 核对脚本同时用旧 Key 读 review-*、新 Key 读 public-*，变量同 D2 过渡期 |

核对脚本放 `scripts/sandbox/`，只读，不写任何上游数据。

## D6 生产 Key 现状（只看本地文档和配置，未连生产）

| 来源 | 内容 |
|---|---|
| `docs/launch-checklist.md` 第 10 项 | 只写了要求："只读、范围收窄的新 Key；开发用的 Key 已吊销"，没有记录生产实际配的是哪把 Key |
| `openspec/changes/integrate-insight-live-api-and-recompose-pages-v1/tasks.md:36` | 对生产数据中台（`https://dreamotech.cn`）实连冒烟用的是"开发专用 Key" |
| `docs/goals/2026-10-15_five-phase-goal.md:18` | 签发收窄 Key、吊销开发 Key `dodk_5f4c678` 还没做（远程写操作被拦截，待用户执行） |
| 本地 `.env.local` | `INSIGHT_UPSTREAM_API_KEY` 前缀 `dodk_5f4c678` |
| `backend/.env.example` | Key 为空 |

结论：本地文档里没有任何新 Key 的签发记录。唯一有记录、连过生产的 Key 是开发 Key `dodk_5f4c678`，和本地 `.env.local` 是同一把。上线清单第 10 项按现有记录应判"不通过"。生产服务器上实际配的是哪把，由用户登录后台查看，结果出来后补记前缀到这里（已定决定 5）。

## D7 等级路由

### 7.1 职责

新增等级路由模块（建议 `backend/insight_api/tier_routing.py`），每次需要请求 public-* 时：

1. 从本次请求的 `Principal` 实时读取用户当前等级（`AccessService.authenticate` 每次请求都查库，会员到期即时生效，不用令牌里缓存的等级）。
2. 按当前生效的路由规则版本，查出该等级对应的投研平台账号，再按账号名取对应 Key（D2）。
3. 认不出的等级（不在规则表里、规则表没加载成功、账号对应的 Key 变量为空）一律拒绝：返回 403"当前账号等级暂无数据权限"，写一条 `rejected` 路由记录，**不回退到任何默认账号**。
4. 等级 Key 只放服务端环境变量，不进数据库、日志、响应和前端。

路由只决定"用哪把上游 Key"。各等级之间的页面、历史天数、下钻明细差别，继续由本平台权限点在取数之后裁剪（D8）。

### 7.2 本期路由表（规则版本 1）

| 本平台等级 | 投研平台账号 | 本期 Key 变量 |
|---|---|---|
| free | insight-svip | `INSIGHT_UPSTREAM_API_KEY` |
| vip | insight-svip | `INSIGHT_UPSTREAM_API_KEY` |
| svip | insight-svip | `INSIGHT_UPSTREAM_API_KEY` |
| admin | insight-svip | `INSIGHT_UPSTREAM_API_KEY` |
| 其他（含后台新建、未登记的等级） | 无 | 拒绝 |

开发态匿名用户（`INSIGHT_AUTH_MODE` 关闭鉴权时的 `dev`）只在非生产环境存在，路由到 `insight-svip`；生产环境禁止关闭鉴权，这一条不会生效。将来各等级的数据权限定了，再拆新账号，只改路由表和补 Key 变量，不改页面代码。

### 7.3 路由规则变更记录（a）

路由规则由产品经理负责，带版本号。目前只有一名管理员（用户本人），由他自己提交并确认生效；保留双人审批开关，将来管理员多于一人时打开。

| 项 | 要求 |
|---|---|
| 存储 | SQLite 新表 `role_policy_versions`（角色策略版本，D9 的权限配置也存在这里，一套版本、一套审批）：`version`（递增）、`policy`（JSON，本期只含 `routes`：角色 → 账号名；D9 上线后加入看板 × 指标权限）、`status`（draft / pending / active / retired / rejected）、`reason`、`created_by`、`created_at`、`approved_by`、`approved_at`、`activated_at`、`based_on`（草稿基于哪个版本） |
| 变更记录 | 每次提交、确认、审批、驳回、生效、退役都写一条：谁、何时、改前版本与内容、改后版本与内容、原因（必填）。沿用 `audit_log`，`action` 用 `role_policy.*` |
| 生效流程（默认） | 管理员编辑后先看改前改后的差异，填写原因（必填），再**二次确认**才生效：第一步提交生成 draft 并返回差异，第二步带上 draft 版本号确认，才变为 active。不经确认的 draft 不生效 |
| 双人审批开关 | 环境变量 `INSIGHT_POLICY_REQUIRE_SECOND_APPROVER`，默认关闭。打开后，确认只会让 draft 变为 pending，须由提交人以外的另一名管理员审批才生效，提交人不能审批自己的版本。开关放在环境变量而不是后台，避免在后台随手关掉；表结构不用变（`approved_by` 在关闭时记为提交人本人） |
| 写入权限 | 提交、确认、审批、驳回接口只有 admin 能调：要求管理后台权限（`admin.console`）。策略校验禁止把管理后台权限授给 admin 以外的角色，也禁止生成让 admin 失去管理后台权限或失去路由的版本，防止把自己锁在外面 |
| 生效 | 同一时刻只有一个 active 版本；生效时进程内重新加载，不用重启 |
| 失败处理 | 启动时没有 active 版本，或规则里引用的账号没有对应 Key 变量，所有 public-* 请求按"认不出的等级"拒绝，并在健康检查里报错 |
| 初始版本 | 版本 1 即 7.2 的表；上线时由管理员按上面流程提交并确认 |
| 后台界面 | 先做接口（提交、确认、审批、驳回、查看历史与差异）；界面由 D9 的角色权限配置页提供 |
| 并发 | 草稿记 `based_on`；确认或审批时若 active 版本已不是 `based_on`，拒绝，要求基于新版本重做草稿，避免覆盖刚生效的改动 |

### 7.4 每次请求的路由记录（b）

| 项 | 要求 |
|---|---|
| 粒度 | 一次用户请求里每一次上游服务 / 视图访问写一条；命中本平台缓存的也写，标 `cache_hit=1` |
| 字段 | `at`、`request_id`、`user_id`、`role_at_request`、`account`、`rule_version`、`client`（web / mp / api / mcp，本期只有 web / mp）、`service_key`、`view`、`cache_hit`、`result`（ok / empty / upstream_4xx / upstream_5xx / rejected）、`upstream_status`、`latency_ms` |
| 存储 | SQLite 新表 `upstream_route_log`，按 `at`、`user_id` 建索引；保留 180 天（用户已定），进程每天自动清理一次过期记录 |
| 不记什么 | 不记 Key、不记用户名以外的个人信息、不记响应内容 |
| 传给投研平台的审计字段 | 实际发出的每个上游请求加 4 个通用请求头（与投研平台统一）：`X-End-User-Ref`（匿名用户编号，见下一行）、`X-Client-Entry`（入口：web / mp / api / mcp）、`X-Request-Id`（与本地记录的 `request_id` 一致）、`X-Route-Rule-Version`（规则版本） |
| 两边对账 | 照旧以 `X-Request-Id` 对账。命中缓存的请求不会到达投研平台，所以投研平台只有 `cache_hit=0` 的记录；对账时只比这部分。同一份缓存会服务多个用户，投研平台记录里的用户只代表"触发这次取数的用户" |
| 匿名用户编号 | `X-End-User-Ref` 不传内部 `user_id`，传不透明的匿名编号：新表 `end_user_refs`（`user_id` 主键、`ref` 唯一、`created_at`），用户第一次产生上游请求时生成 128 位随机数（32 位十六进制），之后固定不变。映射关系只存在本平台，投研平台看不出对应哪个真实账号；也不传用户名、手机号。选随机编号而不是对 `user_id` 加盐哈希，是因为将来迁到用户中心时 `user_id` 会变，存下来的编号可以随映射表一起迁移，不受影响 |
| 本地记录 | `upstream_route_log` 同时记 `user_id` 和 `end_user_ref`，便于本平台内部查人和对账 |

### 7.5 与其他部分的关系

| 部分 | 关系 |
|---|---|
| 两道防线（D1） | 路由选出的账号是第一道防线的范围；本平台白名单和出口拦截不随等级放宽 |
| 上游缓存 | 缓存键含账号名（D2） |
| 切换核对（D5） | 核对脚本经路由取 `insight-svip`，同时用旧 Key 读 review-* |
| 将来的对外 API / MCP | 同样经过等级路由，`client` 记 `api` / `mcp`（D8） |

## D9 角色权限配置页（看板 × 指标）

用户原话："路由规则需要有一个配置页面，就是一个角色，他对这些看板细到某一个指标。"

### 9.1 目标

管理端新增"角色权限"配置页：按角色（free / vip / svip / admin 及自定义角色）配置能看哪些看板、每个看板里能看哪些指标（细到单个指标），以及该角色路由到哪个等级账号。保存即生成新的策略版本，走 D7.3 的流程：看差异、填原因、二次确认后生效（双人审批开关打开时，还需另一名管理员审批）。**这是本平台唯一的一套数据权限配置**，取代现有的权限点配置（9.6）。

### 9.2 指标目录（代码内维护）

新增 `backend/insight_api/indicator_catalog.py`，和内容注册表一样随代码发版，配置页和后端裁剪都只认这里的编号：

| 字段 | 说明 |
|---|---|
| `id` | 指标编号，`看板.模块.指标`，如 `participation.erp.erp_percentile_5y` |
| `page`、`module` | 所属看板、模块（对应页面上的一个面板） |
| `label`、`unit` | 配置页显示名称与单位 |
| `cnt` | 对应内容注册表 CNT 编号 |
| `paths` | 该指标在本平台对外响应里的位置（如 `data.erp.erp_percentile_5y`），后端按它裁剪 |
| `upstream` | 依赖的上游（服务、视图、字段）列表，用于上限判断（9.3） |
| `detail` | 是否属于下钻明细（如题材封板时间、板块序列），便于从旧的 `data.detail` 迁移 |

看板 = 现有 6 个页面。每个看板的模块和指标按 `field-inventory.md` 第二节与各页对外响应整理，实际为 6 个看板、28 个模块、106 个指标（其中 7 个属下钻明细）；单位说明、`definition`、来源元数据、`gaps`、当日涨停样本数等总量不算指标，始终返回。106 个指标依赖的上游字段已核对全部在 `insight-svip` 授权范围内（本地 8796，2026-11-15）。

页面级的非数据设置也放进同一份角色策略：历史可查天数（原 `data.history_days`）、同时在线会话数（原 `max_sessions`）、可用入口（web / mp，将来 api / mcp，原 `client.*`）、管理后台权限（原 `admin.console`）。

### 9.3 可选范围以上游上限为准

| 项 | 规则 |
|---|---|
| 上限来源 | 每个等级账号的可读范围：调用投研平台按 Key 查询自身授权目录的接口（`/apis/catalog` 自助快照，服务 → 视图 → 字段），按账号缓存 10 分钟 |
| 判断 | 指标的 `upstream` 全部在该角色所路由账号的可读范围内，才可勾选 |
| 不可选 | 置灰并注明原因，如"insight-svip 未授权 public-x / view / field" |
| 上限查询失败 | 配置页只读展示，不能提交草稿；已生效版本不受影响 |
| 确认与生效时复核 | 确认（及审批）时再查一次上限；有指标已超出上限就拒绝生效，并列出超出的指标 |
| 上限收窄后 | 运行时裁剪按"策略 ∩ 上限"执行：上游不再返回的字段本来就拿不到，页面显示"暂无数据权限"，不报错；配置页把这些指标标红提醒 |

### 9.4 页面结构

| 区域 | 内容 |
|---|---|
| 顶部 | 当前生效版本号、生效时间、确认人；有未确认草稿（或开关打开时的待审批版本）时显示提示 |
| 左栏 | 角色列表（内置 + 自定义），每个角色显示路由账号与已开放看板数 |
| 右栏·基本设置 | 路由账号（本期下拉只有 `insight-svip`）、历史天数、会话数、可用入口、管理后台权限 |
| 右栏·看板 × 指标 | 按看板分组的树：看板开关 → 模块勾选（全选 / 部分）→ 指标勾选；超出上限的置灰并显示原因；显示每个看板已选 / 可选数量 |
| 底部 | 修改原因（必填）、"查看差异" |
| 确认视图 | 显示草稿与当前生效版本的差异：按角色列出路由变化、新增 / 移除的看板与指标、基本设置变化；按钮"确认生效"（二次确认弹窗，再次显示变更摘要与原因）或"放弃草稿"。双人审批开关打开时，提交人这里只有"提交审批"，另一名管理员看到"通过 / 驳回（填原因）"，接口也拒绝自审 |
| 历史 | 版本列表（版本号、状态、提交人、确认 / 审批人、时间、原因）；任选两个版本看差异 |

### 9.5 后端裁剪与前端隐藏

| 项 | 规则 |
|---|---|
| 唯一入口 | 新增集中的策略执行函数（建议 `access/policy.py`），所有数据路由在返回前调用一次：按"角色 × 看板 × 指标"删掉未授权指标的 `paths`；看板未开放直接 403。这同时收拢了 D8 8.3 第 1 条散落在 `main.py` 各路由里的裁剪 |
| 取数 | `modules.py` 照旧按页面取全量合规数据，缓存照旧按账号共享；裁剪在取数之后做，不影响缓存 |
| 响应标记 | 响应元数据新增 `restricted`：本次被裁掉的指标编号列表，以及每个模块的状态（全部可见 / 部分可见 / 无权限） |
| 前端 | 按 `restricted` 隐藏指标；整个模块无权限时显示锁定卡片和所需等级（等级由后端按生效策略计算，替代 `perm_min_role`）。以后端裁剪为准：前端不做权限判断的唯一依据 |
| 第二道防线 | 白名单投影与出口禁止键扫描在裁剪之后照旧执行 |
| 未知角色 | 策略里没有该角色 → 403（与 D7 的路由拒绝一致） |

### 9.6 与现有权限点合并（一套，不并存）

现有权限点 `ALL_PERMS`（`page.*`、`data.detail`、`data.history_days`、`max_sessions`、`client.*`、`admin.console`）、`role_permissions` 表、后台"角色权限"页和 `perm_min_role`，全部并入角色策略版本：

| 现有 | 并入后 |
|---|---|
| `page.<看板>` | 策略里该看板的开关 |
| `data.detail` | 指标目录中 `detail=true` 的指标是否勾选 |
| `data.history_days`、`max_sessions` | 角色基本设置 |
| `client.web`、`client.mp` | 角色可用入口 |
| `admin.console` | 角色基本设置里的管理后台权限 |
| `role_permissions` 表 | 停用：迁移后只读保留一个版本周期用于回滚，之后删除 |
| 后台"角色权限"页（`PUT /admin/roles/{name}` 直接改权限、立即生效） | 由新配置页取代；角色的增删改名保留，但权限只能通过策略版本和审批修改 |
| `perm_min_role` | 改为由生效策略计算"最低可见等级" |
| `Principal.perms` / 前端 `can()` | 保留接口形状，内容改由生效策略生成（看板开关 → `page.*`，基本设置 → 其余项），前端路由守卫不用重写 |
| 小程序页面限制 `MP_PAGES` | 删除（用户 2026-11-15 定：小程序与网页同样能访问全部合规数据）。入口只表示请求从哪里来，用于审计和角色的"可用入口"设置，不限制能看哪些页面。由变更 `add-miniprogram-history-calendar-v1` 实施 |

迁移步骤：

| 步 | 内容 | 检查 |
|---|---|---|
| 1 | 本期先上线路由（D7），策略版本只含 `routes`；权限仍读 `role_permissions` | 现有验证脚本全部通过 |
| 2 | 指标目录与策略执行函数上线；用迁移脚本从当前 `role_permissions` 生成一份完整策略草稿：开放的看板默认勾选全部指标，`data.detail` 映射到 `detail` 指标，其余项照搬 | 对每个角色、每个页面，新旧裁剪结果逐字段一致 |
| 3 | 管理员看差异、二次确认让这份草稿生效；后端改从生效策略读权限，`role_permissions` 转只读 | 三个测试账号（free / vip / svip）访问各页，结果与切换前一致 |
| 4 | 新配置页上线，旧"角色权限"页下线 | 旧接口返回 410 |
| 5 | 稳定一个版本周期后删除 `role_permissions` 表和旧代码 | — |

### 9.7 范围

本期只写 spec。配置页、指标目录、策略执行函数在用户确认 9.2–9.6 后再开发；不依赖它们的部分（D7 路由、`role_policy_versions` 与审批接口、`upstream_route_log`、`end_user_refs`、审计头、过渡期两把 Key）可以先开发。

### 9.8 实施记录（2026-11-15）

| 项 | 实现 |
|---|---|
| 指标目录 | `backend/insight_api/indicator_catalog.py` |
| 策略执行 | `backend/insight_api/access/policy.py`：`trim()` 是唯一裁剪入口，`main.py` 各数据路由经 `out_for()` 调用；响应加 `restricted`、`module_access`、`restricted_modules` |
| 权限来源 | `AccessService.role_permissions()`：生效策略含 `roles` 时由 `perms_for()` 生成权限点（`Principal.perms`、前端 `can()`、最低可见等级沿用原形状），否则读 `role_permissions`；策略生效时递增 `role_version` 使缓存失效 |
| 上游上限 | `UpstreamScope`：live 模式按账号 Key 读 catalog（服务、视图）与各服务 schema（字段，投研平台已按 Key 实际权限裁剪），缓存 10 分钟；fixture 模式读 `fixtures/upstream-scope.json`（由本地 8796 真实目录生成） |
| 接口 | `GET /admin/policy/catalog`（目录、各账号上限与置灰原因、生效策略）、`POST /admin/policy/drafts/from-legacy`（迁移第 2 步），其余沿用 D7.3 |
| 旧接口 | 完整策略生效后，`PUT/POST /admin/roles` 带权限返回 410；只改名称仍可用；策略中的角色不能删除 |
| 前端 | 网页：管理后台"角色权限配置"页签（`RolePolicy.vue`），旧"角色权限"页签改为"角色"（只管名称）；`v-module` 隐藏整块无权限模块，`v-ind` 隐藏被裁掉的数值卡片，`PageFrame` 显示受限提示。小程序：`StateView` 显示受限提示，整块无权限的卡片隐藏 |
| 迁移比对 | `scripts/sandbox/2026-11-15_verify_role_policy.py`：4 个角色 × 7 个接口共 28 组，新旧完全一致 |
| 浏览器走查 | 创建路由版本 1 → 由现有权限生成完整策略 → 编辑 VIP 指标 → 查看差异 → 二次确认 → 防自锁被拒 → 历史两版对比 → VIP 用户页面隐藏被裁指标；截图 `docs/evidence/web-policy-0*.png` |

## D8 扩展性边界（只定边界，本次不改会员体系，不做 API / MCP 服务）

产品架构（用户 2026-11-15 定）：本平台是合规产品线，网页、小程序和将来的对外 API / MCP 服务共用一套用户体系和等级权限。统一的用户中心将来从老平台独立出来，**属于本平台这一侧**，负责对外用户的开通、会员等级、API 服务申请与审批。投研平台只通过数据 API 给本平台供数，不面对终端用户。本节只写清分层、迁移边界和要避免的耦合，不扩大本次范围。

### 8.1 现在的权限分层

| 层 | 谁管 | 管什么 | 落在哪里 |
|---|---|---|---|
| 上限 | 投研平台 | 每个等级账号能读哪些服务、视图、字段（D2、D4）；本期只有 `insight-svip` | 投研平台账号配置；本平台只持 Key |
| 路由 | 本平台（规则由产品经理负责） | 用户当前等级用哪个等级账号（D7） | 等级路由模块与 `role_policy_versions` |
| 分配 | 本平台 | 每个会员等级（free / vip / svip / admin）在上限内能看哪些页面、看多少天历史、能否看下钻明细、能用哪个客户端 | `access/store.py` 的权限点目录 `ALL_PERMS` 与 `role_permissions`；执行在 `access/gate.py` 和 `main.py` 各路由 |

规则：
- 分配只能在该等级所路由账号的上限内裁剪，不能超出。新内容必须先由投研平台把字段授权给对应等级账号，本平台才能给该等级开放。
- 上游取数和缓存不区分用户，只按等级账号区分。`modules.py` 按页面取全量合规数据，按等级裁剪放在取数之后，所以等级变化不会让上游请求按人数放大。
- 投研平台的等级 Key 只属于本平台服务端，不分给终端用户。

### 8.2 将来迁到用户中心：搬什么、留什么

| 类别 | 内容（现有代码 / 数据表） | 去向 |
|---|---|---|
| 账号身份 | `users`（用户名、密码哈希、`must_change_password`）、登录与改密接口（`access/routes.py`、`security.py` 中的密码部分）、`login_attempts` | **搬** |
| 会员等级与到期 | `users.base_role`、`member_role`、`member_expires_at`，到期计算（`access/service.py`） | **搬**：用户中心是等级的唯一来源 |
| 开通与收入 | `plans`、`membership_grants`、`invite_codes`、`redemptions`、`redeem_attempts`，以及后台套餐、开通、邀请码、开通记录页 | **搬** |
| 登录令牌 | `refresh_tokens`、JWT 签发 | **搬**（改成用户中心签发、本平台验证） |
| 等级到权限点的映射 | `roles`、`role_permissions` | **待定**：用户中心管"用户是什么等级"，本平台管"这个等级在本平台能做什么"。建议映射留在本平台，因为权限点只在本平台有意义；也可以由用户中心统一下发。迁移时由用户决定 |
| 权限点目录 | `ALL_PERMS`、`PAGE_PERMS`、`NUMERIC_PERMS` | **留**：这是本平台的能力清单，用户中心只引用 |
| 请求防护 | 请求签名与防重放、按用户和 IP 限流、异常封禁（`gate.py`、`guard.py`） | **留**：属于本平台出口安全 |
| 合规与取数 | `content_scope.py`、`modules.py`、`projection.py`、`upstream.py`、投研平台等级 Key | **留** |
| 等级路由 | 等级路由模块、`role_policy_versions`、`upstream_route_log` | **留**：路由读的是用户中心给出的等级，规则和记录在本平台 |
| 溯源与审计 | 响应 `trace`、水印、数据访问审计 | **留**；用户标识改为用户中心的用户 ID |
| 账号类审计 | `audit_log` 中开通、改密、邀请码等记录 | 随对应功能**搬**，历史记录导出后迁移 |
| 对外 API / MCP 服务 | 尚未实现 | 做在本平台：申请与审批在本平台一侧的用户中心，个人 Key 由本平台签发；请求同样经过等级路由、权限点裁剪、字段白名单和出口拦截，`client` 记 `api` / `mcp`。投研平台不给终端用户发 Key |

迁移后的接缝只有一个：`Principal`。现在由 `AccessService.authenticate` 从本地库构造；将来改成验证用户中心令牌后构造，字段（用户 ID、等级、权限点、客户端、到期时间）保持不变。`gate.py`、各路由和前端都只依赖 `Principal` 和权限点，不依赖本地用户表。

### 8.3 现在要避免的耦合

现状核对（2026-11-14）：`modules.py` 里没有任何等级判断，上游缓存不分用户（D7 之后按等级账号分），前端按权限点判断（`can('data.detail')` 等），不按等级名。这几处要保持。已发现的耦合点和约束如下：

| # | 现状 | 风险 | 约束（本次只记录，不改代码） |
|---|---|---|---|
| 1 | 按等级裁剪散落在 `main.py` 各路由：题材页去掉封板时间、历史序列截到 `history_days`、板块序列无 `data.detail` 时返回 403 并限制天数 | 加页面或迁移时容易漏改，各页规则不一致 | 新增的等级裁剪一律写在 `gate.py`（或将来集中的权限策略模块），不写进 `modules.py`；后续单独立变更，把现有路由里的裁剪收拢到一处 |
| 2 | 客户端策略写死在代码里：`gate.MP_PAGES`，路由里的 `p.client == "mp"` | 客户端维度和等级维度混在一起 | 已定删除（`add-miniprogram-history-calendar-v1`）：不按入口限制页面或明细，`client` 只用于审计、路由记录和"可用入口"登录判断；以后也不新增按入口的数据判断 |
| 3 | `check_trade_date` 里直接判断等级名 `p.role == "dev"` | 等级名一改就失效 | 只按权限点或数值权限判断，不按等级名判断；`dev` 只用于开发态匿名用户 |
| 4 | 会员到期计算在 `access/service.py`，`Principal` 由本地库构造 | 迁移时要改多处 | 到期、等级的计算只在 `AccessService` 内部完成，其他代码只读 `Principal` 的结果 |
| 5 | `trace`、水印和路由记录（D7）用本地自增 `user_id` | 迁移后 ID 体系变化 | 用户编号只出现在 `trace`、水印、`upstream_route_log` 和 `end_user_refs` 里，传给投研平台的只有匿名编号；不在其他业务表里另外持久化；迁移时一次性做 ID 映射，两边历史记录按映射表对账 |
| 7 | 将来 API / MCP 入口可能各自写一套等级判断 | 不同入口权限不一致 | 新入口只新增 `client` 取值，复用同一套 `Principal`、等级路由和权限点裁剪 |
| 6 | 前端锁定提示用后端下发的 `perm_min_role` | 无 | 保持由后端下发，前端不写死等级与页面的对应关系 |

本次不改会员体系，不做 API / MCP 服务和 API 申请功能；上表的约束从本变更起对新代码生效，现有代码的收拢另立变更。

## 风险

| 风险 | 应对 |
|---|---|
| 上游单位换算改由数据中台做，本平台重复换算 | D5 核对专门检查成交额（亿元）；`field-inventory.md` 5.2 已列出要去掉的换算 |
| 同名不同口径的字段取错（换手、卖压、卖出占比） | 输入映射按 `field-inventory.md` 5.2、5.3；D5 专项核对逐项比数值 |
| public-* 嵌套对象只能整块授权，子字段收不窄 | 要求数据中台把本平台要的子字段提为顶层字段，或给本平台单独的视图 |
| 切换期间两把 Key 并存 | 旧 Key 只放在临时变量里，只用于 review-*；全部切完先删变量再吊销，D5 和 tasks 里各有一项检查 |

## 已定决定（用户 2026-11-14、11-15 拍板）

| # | 问题 | 决定 |
|---|---|---|
| 1 | 切换期间，还没切的页面在生产上怎么办 | 继续用旧 Key 读 review-*；全部切完再吊销旧 Key（实现方式见 D2 过渡期） |
| 2 | 口径变化是否接受 | 不需要决定了：数据中台 D9 改成事实视图，口径不变 |
| 3 | 封板时间改由数据中台按"题材 × 5 档"汇总下发 | 同意；等级账号不碰个股数据 |
| 4 | `oi_volume_crowding_zscore_60d` 改名 `oi_volume_ratio_zscore_60d` 后放出 | 同意 |
| 5 | 生产实际配的是哪把 Key | 用户登录后台查看，结果转来后补记到 D6 |
| 6 | 切换核对能否对生产数据中台发请求 | 允许，只限只读 |
| 7 | CNT-030 行业结构统计 | 本平台用 `industry-review/facts` 自己算 |
| 8 | 将来对外 API 的申请与审批在哪里办 | 本平台一侧（用户中心属于本平台）；个人 Key 由本平台签发，数据从本平台出去 |
| 9 | 投研平台怎么开账号 | 按本平台用户等级一个等级一个账号；本期只建 `insight-svip`，所有等级都路由到它 |
| 10 | 路由规则与记录 | 规则由产品经理负责、带版本、看差异二次确认后生效（保留双人审批开关）、留变更记录；每次请求留路由记录，并把匿名用户编号和入口作为审计字段传给投研平台 |

## 待确认（不阻塞 spec）

| # | 问题 | 建议 |
|---|---|---|
| 1 | ~~路由记录保留多久~~ | 已定：180 天，到期自动清理 |
| 2 | ~~传给投研平台的审计请求头名称~~ | 已定：通用名称 `X-End-User-Ref`、`X-Client-Entry`、`X-Request-Id`、`X-Route-Rule-Version`，投研平台照同一套改；用户编号匿名化（D7 7.4） |
| 3 | ~~路由规则审批人~~ | 已定：目前唯一管理员（用户本人）自己看差异、二次确认生效；保留双人审批开关 `INSIGHT_POLICY_REQUIRE_SECOND_APPROVER`，默认关闭 |
