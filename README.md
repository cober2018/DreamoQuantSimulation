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
web/                     Vite + Vue 3 + ECharts 前端（7 个页面）
scripts/sandbox/         夹具生成与后端验证脚本
docs/source/             输入文档冻结副本
openspec/                规格与变更
```

与旧平台**零代码引用**：唯一依赖是数据中台的 HTTP 接口 `GET /api/v1/data/apis/{service_key}/records`。

## 已完成（2026-10-15 五期）

| 期 | 提案 | 内容 | 状态 |
|---|---|---|---|
| 三 | `integrate-insight-live-api-and-recompose-pages-v1` | 改接数据中台带 Key 的 API；补齐参与观察/题材/股票池结构/Open5 四条内容；主题对照表 `docs/theme-parity-matrix.md`；服务端缓存与日期区间降级 | 本地完成；数据中台已发布，生产实连 6/6 页通过 |
| 四 | `add-insight-access-control-v1` | 免费/VIP/SVIP/管理员，管理员可自定义角色与权限点；邀请码兑换（无支付）；argon2id、短期令牌 + 可轮换刷新令牌；请求签名防重放、限流与异常封禁、水印；生产构建混淆并扫描 | 本地完成并验证 |
| 五 | `add-insight-wechat-miniprogram-v1` | uni-app 小程序（总览/情绪资金/行业/题材/我的）；微信登录接入点；邀请码兑换与账号绑定 | 编译通过；已在微信开发者工具模拟器（测试号）实操通过，证据 `docs/evidence/sim-*.png` |

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
| 账号 | `/api/v1/auth/{register,login,refresh,logout,me,change-password,wechat,wechat/bind}`、`/api/v1/invite/redeem` | — |
| 管理 | `/api/v1/admin/{users,roles,invites,audit,redemptions}` | admin.console |

验证（`scripts/sandbox/`）：`2026-10-14_verify_insight_api.py` 49/49；`2026-10-15_verify_insight_access.py` 64/64。截图证据 `docs/evidence/`。

## 目录补充

```
backend/insight_api/access/   账号权限：store(SQLite) / security / service / gate / guard / routes
web/src/{auth.js,pages/Login|Account|Admin|Terms.vue}   登录、签名请求、账号、管理后台
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
cd web && npm run dev         # http://127.0.0.1:5180 (代理 /api → 8090)
cd web && npm run build:prod  # 构建 + 混淆 + 产物扫描
cd miniprogram && npm run build:mp-weixin   # 导入微信开发者工具 dist/build/mp-weixin
cd miniprogram && VITE_H5_MOCK_CODE=mock:h5demo npm run build:h5 && npx vite preview --outDir dist/build/h5  # 无开发者工具时的预览
```

## TODO

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

前端（Node 18+）：

```bash
cd web && npm install && npm run dev   # http://127.0.0.1:5180，/api 代理到 8090
```

验证：

```bash
backend/.venv/bin/python scripts/sandbox/2026-10-14_verify_insight_api.py
backend/.venv/bin/python scripts/sandbox/2026-10-14_build_synthetic_fixtures.py   # 重建合成夹具
```
