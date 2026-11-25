# DreamoQuantSimulation · 量化数据洞察（对外版）

## PRD / 背景

原 DreamO 研究平台的看板混有仓位指导、行业主攻/规避、个股动作、明日指引等建议性内容。2026-10-13 用户决定：不再原地改造旧看板，而是抽取其中**可对外提供的事实与历史统计**，重组为独立产品。

- 输入文档（冻结副本 + SHA-256）：`docs/source/COMPLIANCE_ACTIVE.md`、`docs/source/EXTERNAL_ANALYTICS_CONTENT_SCOPE.md`
- OpenSpec 变更：`openspec/changes/add-external-market-insight-platform-v1/`（proposal / design / 3 份 spec / tasks，`--strict` 校验通过）
- 产品边界：只做证券信息汇总与历史数据统计；不提供品种选择、买卖时机、仓位或其他投资建议。

## 结构

```
backend/                 FastAPI 网关（insight_api）
  insight_api/
    config.py            环境变量与启动校验（production 禁止夹具；live 必须有 Key）
    content_scope.py     CNT-001～037 注册表、禁止键守卫、免责声明
    upstream.py          数据中台 records 客户端 / 夹具源，分页去重，TTL 缓存
    projection.py        白名单投影、统一信封
    modules.py           各页面取数与统计口径
    main.py              路由、令牌中间件、错误处理
  fixtures/              开发夹具（情绪/前瞻风险为真实 ADS 导出行，行业与日历事件为合成）
web/                     React 19 + Vite + Tailwind 4 前端（首页、5 个数据页、账号与后台；2026-11 由 Vue 3 迁移）
scripts/sandbox/         夹具生成与后端验证脚本
docs/source/             输入文档冻结副本
openspec/                规格与变更
```

与旧平台**零代码引用**：唯一依赖是数据中台的 HTTP 接口 `GET /api/v1/data/apis/{service_key}/records`。

## 2026-11-25 看板修复（ZS-132，分支 fix/zs-132-dashboard）

- **行业页**：相对旋转图按中台的实际口径画（相对强度、相对动量是以 0 为参考的小数，图上换成百分点，参考线 0；以前按 100 画，所有点挤在原点）。行业板块按东财一级、二级、三级分开显示，默认一级；层级取自中台 `public-industry-review` 的 `overview` 视图（`facts` 视图的 `level` 目前全为空），取不到时显示全部并注明。扩散度排行、领涨行业只取成分股不少于 10 只的行业。
- **参与度页**：风格强弱图恢复（中台的序列每个点多了日期，网关原先没转换）；卖压图叠加 5 日均值；衍生品缺失原因、底部条件的比较结果改成中文；开盘五分钟从历史复盘页搬到这里。
- **题材页**：涨停个股的行业分布覆盖当日全部涨停股（行业榜视图只列不少于 3 只的行业，其余由封板时间视图按行业加总补齐）。个股名单、跌停梯队等中台提供字段后再接。
- **事件日历**：可按国家或地区、重要程度筛选，默认只显示中国和美国的重要事件；限售股解禁放到页面最上面。
- **历史复盘页已拆掉**：`/history` 跳转到 `/participation`。网关的 `/api/v1/history` 接口和 `page.history` 权限点保留（网页的开盘五分钟、小程序、MCP 仍在用），权限点显示名改为「开盘五分钟与板块统计」。
- **市场总览**：首屏指数卡列上证综指、沪深 300、创业板指、中证 1000。
- 验证：`scripts/sandbox/2026-11-25_verify_zs132.py`（15 项，内存里的假上游，不连中台）。
- 发布顺序：**先发网关，再发前端**（新前端按网关返回的参考线 0 画旋转图）。

## 2026-11-23 前端迁移到 React（feat/web-react）

- `web/` 由 Vue 3 改为 React 19（Vite 8、Tailwind 4、shadcn/ui、TanStack Query、zustand）。地址、权限点、页面数据项与旧版一致；旧 Vue 代码只留在 git 历史里。
- 图表：时间序列用 Recharts，行业页的旋转图和树图用 ECharts（只打进行业页的分包）。
- 生产构建 `npm run build:prod` = 构建 + 混淆 + 产物扫描。混淆工具固定为 javascript-obfuscator 5.9.1：4.x 会把 Redux Toolkit 里引用自身类名的写法改坏，图表页一打开就报错；`disableConsoleOutput` 关闭，因为它注入的 `Function()` 会被线上 CSP（`script-src 'self'`）拦下。
- 新增公开页：首页（星图 + 历史曲线演示）、关注页（二维码在 `web/public/social/`）、价格/小程序/文档/博客占位页、「没有这个页面」兜底页。
- 网关：`backend/insight_api/supplement.py` 新增补充视图 `limit_history`、`breadth_history`，总览页的涨跌停、上涨占比历史曲线用它们，**网关要和前端一起发布，先发网关**。

### 首页样例数据怎么更新

首页第二屏的历史演示读静态文件 `web/src/intro/data/sample.json`（60 个交易日），不走接口，所以会随时间变旧，需要手动重新导出：

1. 从数据中台对外接口取 3 个视图，日期范围取最近 60 个交易日：
   - `public-market-participation` / `history`：`date`、`turnover`（两市成交额，亿元）
   - `public-market-participation` / `breadth-history`：`trade_date`、`up_count`、`down_count`（每个指数各一行，按日期去重）
   - `public-limit-pool-structure` / `history`：`tier_counts[].count`、`broken_board_count`、`limit_down_count`
2. 每天一行，字段 `d`、`turnover`、`up`、`down`、`limit_up`、`limit_down`、`broken`。涨停数 = `tier_counts` 前四档（首板、2 连板、3 连板、高板）的 `count` 之和；上涨占比、封板率由页面按 `上涨 ÷（上涨 + 下跌）`、`lib/limitStructure.ts` 的 `sealRate` 计算，不写进文件。
3. 缺数的日子填 `null`，不要补 0。2026-11-18 的跌停数、炸板数在中台是空值，修好之前终点不要选这一天。
4. 改 `note` 里的导出日期；挑 3 天和中台 `current` 视图核对；`npm run build:prod` 后看首页演示。

## 2026-11-18 MCP 只读服务（ZS-108，内部封闭测试，本地完成、未部署）

- 入口 `POST /mcp`（MCP streamable HTTP，无状态，直接回 JSON；GET/DELETE 405）。方法：initialize / notifications/initialized / ping / tools/list / tools/call。手写实现（`insight_api/mcp.py`），不引入 mcp SDK。
- 开关：`INSIGHT_MCP_ENABLED=1` + `INSIGHT_MCP_USERS=<逗号分隔用户名>`（管理员总是可用）；关闭时 `/mcp` 与令牌接口 404，账号页不显示。门禁 A 无结论前不对外。
- 鉴权：账号页生成个人令牌 `zsmcp_…`，库里只存 sha256，界面只显示前 12 位；可设有效期、可吊销，每人最多 3 把有效；改密/重置/停用后自动失效。接口 `/api/v1/account/mcp-tokens`（签名网页会话）。
- 等级与口径：令牌 → 用户 → `principal_for`（含试用、会员到期）→ 页面权限点 → `main.py` 里与网页路由共用的页面装载函数（同一裁剪、历史范围、TierRouter；上下文 client=mcp，上游带 `X-Client-Entry: mcp`）。
- 工具 9 个：list_datasets、describe_dataset、get_market_overview、get_participation、get_industries、get_industry_series、get_themes、get_history、get_calendar。只读，无分析/建议类工具；返回带数据日、来源说明、免责声明。
- 限流（每把令牌，只计 tools/call；`mcp.RATE_LIMITS`）：free 10/分钟、200/24 小时；vip 30/1000；svip、admin 60/3000。进程内计数，重启清零。
- 审计：每次 tools/call 写 `mcp_call_log`（用户、令牌前缀、等级、工具、参数哈希、结果、耗时），`request_id` 与 `upstream_route_log` 关联；保留 180 天。
- nginx 已加 `location = /mcp`（`deploy/dk/nginx/dk.dreamotech.cn.conf`）。

## 2026-11-17 dk.dreamotech.cn 上线准备（DK-001，本地完成、未部署）

- 部署配置与 runbook：`deploy/dk/`（systemd 单实例网关、nginx 独立 server 块、SQLite 每日备份、30 天日志轮转、环境变量清单）；`backend/requirements.lock` 固定依赖版本。
- DK2 免费试用、不开支付：`INSIGHT_PAYMENT_ENABLED` 默认关闭（套餐接口 403、后台不能记录收款、网页与小程序隐藏价格/套餐/兑换入口）；`INSIGHT_TRIAL_ROLE` + `INSIGHT_TRIAL_UNTIL` 全站试用，不写库，到期回到真实等级，页面显示「免费试用中（至 …）」。
- 验证：`scripts/sandbox/2026-11-17_verify_payment_trial.py`。

## 已完成（2026-10-22 六期）

| 期 | 提案 | 内容 | 状态 |
|---|---|---|---|
| 三 | `integrate-insight-live-api-and-recompose-pages-v1` | 改接数据中台带 Key 的 API；补齐参与观察/题材/股票池结构/Open5 四条内容；主题对照表 `docs/theme-parity-matrix.md`；服务端缓存与日期区间降级 | 本地完成；数据中台已发布，生产实连 6/6 页通过 |
| 四 | `add-insight-access-control-v1` | 免费/VIP/SVIP/管理员，管理员可自定义角色与权限点；邀请码兑换（无支付）；argon2id、短期令牌 + 可轮换刷新令牌；请求签名防重放、限流与异常封禁、水印；生产构建混淆并扫描 | 本地完成并验证 |
| 五 | `add-insight-wechat-miniprogram-v1` | uni-app 小程序（总览/情绪资金/行业/题材/我的）；微信登录接入点；邀请码兑换与账号绑定 | 编译通过；已在微信开发者工具模拟器（测试号）实操通过，证据 `docs/evidence/sim-*.png` |
| 六 | `launch-membership-ops-and-page-polish-v1` | 会员运营（线下收款）：套餐、后台按套餐开通/续期、开通记录与实收合计、冲正、到期提醒；会员页面锁定预告；缺数据日如实标注并可跳到最近有数据日；Web 与小程序逐页优化；上线清单 `docs/launch-checklist.md` | 本地完成并验证；真实上游 10-21 缺数据实测待做 |
| 七 | `add-miniprogram-history-calendar-v1` | 小程序与网页同权限：删除入口层页面拦截；补历史复盘、事件日历两页（总览"更多数据"、我的"全部页面"进入）；题材封板时间分布、行业板块序列下钻 | 本地完成；模拟器走查证据 `docs/evidence/mp-sim-*.png` |

追加（2026-10-15 二轮，10 条待定内容收敛，见 `docs/theme-parity-matrix.md`）：

- **事实部分迁入 4 条**：CNT-009 聪明钱五因子截面统计、CNT-011 风格相对强度序列（固定阵营顺序，无 leader/signal）、CNT-013 底部条件观察值（无预测/总分）→ 参与度页；CNT-027 股票池当日计数（无名单）→ 题材页。因子键名重命名绕开禁止模式（`low_impact_stealth` → `stealth`）。
- **不迁入 6 条**：CNT-018/019/023/033/036/037（事实已由其他内容覆盖或纯结论）。
- **日历接口收紧**：上游 ADS 新混入 lockup（解禁）/policy（政策）事件族，不在 CNT-034/035 审定范围——已过滤为仅 `macro:` 宏观族，新增 `days` 前瞻窗口参数（默认 14 天，1–60），并启用 gzip（日历响应 290KB → 传输 27KB）。
- **移除客户端去重降级**：数据中台第二期稳定排序键已发布并经生产重叠分页实测确认，`upstream.fetch` 去重逻辑移除，分页上限保护保留。
- 夹具刷新为 2026-10-14 真实行并裁剪至模块所需列；小程序情绪页同步新增五因子与风格强度摘要。

页面与接口（均需登录与对应权限点；`/auth/*`、`/health` 除外）：

| 页面 | 接口 | 权限点 |
|---|---|---|
| 市场总览 | `/api/v1/overview` | page.overview |
| 参与度与资金环境 | `/api/v1/participation` | page.participation |
| 行业比较与轮动 | `/api/v1/industries`、`/industries/{code}/series`（需 data.detail） | page.industries |
| 题材与涨跌结构 | `/api/v1/themes`（封板时间分布需 data.detail） | page.themes |
| 历史复盘 | `/api/v1/history` | page.history |
| 事件日历 | `/api/v1/calendar` | page.calendar |
| 会员套餐 | `/api/v1/plans`（已上架套餐与开通方式说明） | 登录即可 |
| 账号 | `/api/v1/auth/{register,login,refresh,logout,me,change-password,wechat,wechat/bind}`、`/api/v1/invite/redeem` | — |
| 管理 | `/api/v1/admin/{users,roles,invites,audit,redemptions,plans,plan-contact,grants}`、`/admin/users/{id}/grant`、`/admin/grants/{id}/correction` | admin.console |

会员开通规则：后台开通、邀请码兑换（以及将来的支付回调）统一走 `grant_membership`，都写 `membership_grants`（只追加，记错用冲正）。同等级续期从原到期日顺延；升级从今天算；后台降级会被拒绝（409）。新建套餐默认不上架。
缺数据：所选日期上游没有数据时返回 `status=empty` 和 `latest_available_date`，页面显示"数据暂缺"和跳转按钮，不拿其他日期冒充。

验证（`scripts/sandbox/`）：`2026-10-14_verify_insight_api.py` 52/52；`2026-10-15_verify_insight_access.py` 84/84。截图证据 `docs/evidence/`。

## 目录补充

```
backend/insight_api/access/   账号权限：store(SQLite) / security / service / gate / guard / routes
web/src/{lib/auth.ts,pages/Login|Account|Admin|Terms.tsx}   登录、签名请求、账号、管理后台
web/src/{lib/pageCatalog.ts,pages/Plans|Locked.tsx,components/shell/DateTag.tsx}   套餐页、锁定预告、分区数据日标注
web/src/{pages/Landing|Follow|Stub.tsx,components/site/,intro/}   公开页：首页星图与历史演示、关注页、占位页与「没有这个页面」
docs/launch-checklist.md      上线检查清单
web/scripts/{obfuscate,scan-dist}.mjs                   生产构建混淆与产物扫描
miniprogram/                  uni-app 小程序 (npm run build:mp-weixin | build:h5)
docs/goals/2026-10-15_five-phase-goal.md  五期目标与提案索引
```

## 启动

```
# 后端 (live 模式连数据中台; 本地开发)
cd backend && .venv/bin/python -m uvicorn insight_api.main:app --port 8090
# 必需环境变量: INSIGHT_UPSTREAM_BASE_URL / INSIGHT_UPSTREAM_API_KEY (数据中台 Key, 只在服务端)
#   INSIGHT_JWT_SECRET (production 必须 >=32 位) / INSIGHT_BOOTSTRAP_ADMIN_USER+PASSWORD (首次启动创建管理员, 首登强制改密)
# 可选: INSIGHT_AUTH_MODE=off(仅开发) INSIGHT_REGISTRATION=invite_only INSIGHT_MP_MOCK_LOGIN=1(仅开发)
#       INSIGHT_WECHAT_APPID / INSIGHT_WECHAT_SECRET (有资质后)
cd web && npm run dev         # http://127.0.0.1:5181 (代理 /api → 8090，INSIGHT_API_TARGET 可改)
cd web && npm run build:prod  # 构建 + 混淆 + 产物扫描
cd miniprogram && npm run build:mp-weixin   # 导入微信开发者工具 dist/build/mp-weixin
cd miniprogram && VITE_H5_MOCK_CODE=mock:h5demo npm run build:h5 && npx vite preview --outDir dist/build/h5  # 无开发者工具时的预览
```

## TODO

- **上线前**：按 `docs/launch-checklist.md` 逐项完成，特别是主体资质、协议退款条款、HTTPS 备案域名；之后在后台填写套餐价格和客服联系方式，再上架。
- 数据中台改造完成后，用真实上游实测 2026-10-21 的缺数据显示（本地已用夹具验证）。

- **生产收尾**：存量 Key 标记、签发收窄范围的新平台 Key 并吊销开发 Key、删除生产备份表（远程写操作需用户放行或自行执行）；次日核对 22:10 三个任务自然运行。
- 微信开发者工具模拟器验证已完成（测试号；证据 `docs/evidence/sim-*.png`）；真机预览/上传仍需资质（企业主体、金融类目）、HTTPS 备案域名、合法域名配置、用户协议正式文本。
- 上游日历 ADS 新出现的解禁/政策事件族如需展示，须另立内容条目（CNT）再审后接入。
- 多节点部署需把限流/签名随机数去重换成共享存储；SQLite 换服务端数据库（仓储接口已隔离）。
- 邮件/短信找回密码未做（由管理员重置）。

## 关键设计决策

1. **服务端投影**：浏览器不接触数据中台和 API Key；原始行含大量不迁入字段，前端过滤等于已分发。
2. **白名单 + 失败关闭守卫**：只复制登记字段；响应键名命中禁止模式即返回 500，不降级输出。
3. **状态如实**：上游错误 → 502 无数据；缺数据 → `empty`/`partial` + `gaps`；无供数服务 → `not_connected`。不插值、不回退假值。
4. **不截断、不预设选择**：列表全量展示，排序由用户触发；颜色只表达涨跌方向；RRG 不画象限含义。
5. **服务端是权限边界**：前端隐藏入口只是体验；签名/混淆只抬高成本，权限裁剪、限流与封禁在服务端。
6. **夹具显式标识**：`data_mode=fixture` + 页面横幅；`INSIGHT_ENV=production` 时拒绝启用。

## 依赖与启动

后端（Python 3.11）：

```bash
cd backend
uv venv -p 3.11 .venv && uv pip install --python .venv/bin/python fastapi uvicorn httpx
# 离线演示
INSIGHT_DATA_MODE=fixture .venv/bin/uvicorn insight_api.main:app --host 127.0.0.1 --port 8090
# 实连数据中台（配置见 backend/.env.example）
INSIGHT_UPSTREAM_BASE_URL=http://<数据中台> INSIGHT_UPSTREAM_API_KEY=<key> .venv/bin/uvicorn insight_api.main:app --host 127.0.0.1 --port 8090
```

前端（Node 20.19+ 或 22.12+，Vite 8 的要求）：

```bash
cd web && npm ci && npm run dev   # http://127.0.0.1:5181，/api 代理到 8090
cd web && npm run typecheck       # 类型检查
```

验证：

```bash
backend/.venv/bin/python scripts/sandbox/2026-10-14_verify_insight_api.py
backend/.venv/bin/python scripts/sandbox/2026-10-14_build_synthetic_fixtures.py   # 重建合成夹具
```
