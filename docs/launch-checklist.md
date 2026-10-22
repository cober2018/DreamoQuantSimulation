# 上线检查清单

逐项执行，每项结果只记"通过"或"不通过"。任何一项不通过就不对外开放。

## 一、主体与资质（上架套餐前必须完成）

| # | 事项 | 怎么检查 |
|---|---|---|
| 1 | 确认运营主体，以及对外有偿提供证券信息汇总服务所需的资质或备案 | 由主体法务出具书面意见 |
| 2 | 用户协议与隐私政策由法务审定，"退款【待主体确认】"一段替换为正式条款 | `web/src/pages/Terms.vue` 中不再出现"待主体确认" |
| 3 | 小程序：企业主体、相应服务类目审核通过 | 微信公众平台 → 设置 → 服务类目 |

## 二、域名与 HTTPS

| # | 事项 | 怎么检查 |
|---|---|---|
| 4 | 域名已完成 ICP 备案 | 工信部备案查询能查到 |
| 5 | HTTPS 证书有效，HTTP 自动跳转 HTTPS | `curl -I http://<域名>` 返回 301 到 https；`curl -vI https://<域名>` 证书链有效 |
| 6 | 反向代理把 `/api` 转发到网关，前端静态文件来自 `web/dist` | `curl https://<域名>/api/v1/health` 返回 `{"status":"ok","data_mode":"live"}` |
| 7 | 小程序后台把 request 合法域名配置为该 HTTPS 域名，构建时设置 `VITE_API_BASE=https://<域名>` | 微信开发者工具真机预览能正常取数 |

## 三、生产环境变量（只放服务端，不进仓库）

| # | 变量 | 要求 |
|---|---|---|
| 8 | `INSIGHT_ENV` | `production`（夹具数据、关闭鉴权、模拟登录都会被拒绝启动） |
| 9 | `INSIGHT_DATA_MODE` | `live` |
| 10 | `INSIGHT_UPSTREAM_BASE_URL` / `INSIGHT_UPSTREAM_API_KEY` | 数据中台地址，以及只读、范围收窄的新 Key；开发用的 Key 已吊销 |
| 11 | `INSIGHT_JWT_SECRET` | 至少 32 位随机串，例如 `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| 12 | `INSIGHT_ALLOWED_ORIGINS` | 填正式域名 |
| 13 | `INSIGHT_REGISTRATION` | 按运营策略选 `open` 或 `invite_only` |
| 14 | `INSIGHT_DB_PATH` | 指向持久化磁盘，不放在临时目录 |
| 15 | `INSIGHT_MP_MOCK_LOGIN`、`INSIGHT_AUTH_MODE` | 未设置 |
| 16 | `INSIGHT_WECHAT_APPID` / `INSIGHT_WECHAT_SECRET` | 小程序上线时填写 |

## 四、管理员与运营配置

| # | 事项 | 怎么检查 |
|---|---|---|
| 17 | 首次启动用 `INSIGHT_BOOTSTRAP_ADMIN_USER/PASSWORD` 创建管理员，登录后立即修改密码，然后从环境变量里删除这两项 | 用初始密码登录，数据页提示"请先修改初始密码"；改密后用新密码能正常访问 |
| 18 | 后台"角色权限"页核对 free / vip / svip 各自能看的页面和历史天数 | 分别用三个测试账号访问各页，结果与配置一致 |
| 19 | 后台"套餐"页填写价格和天数，"开通方式说明"填客服联系方式，确认第 1、2 项通过后再勾选上架 | 免费账号的"会员套餐"页能看到上架的套餐 |
| 20 | 试走一遍：线下收款 → 后台开通 → 用户刷新后生效 → 开通记录里有金额 | 后台"开通记录"合计等于实收 |

## 五、数据与构建

| # | 事项 | 怎么检查 |
|---|---|---|
| 21 | 后端验证脚本全部通过 | `backend/.venv/bin/python scripts/sandbox/2026-10-14_verify_insight_api.py`、`2026-10-15_verify_insight_access.py` 都显示全部通过 |
| 22 | 前端生产构建，混淆和产物扫描通过 | `cd web && npm run build:prod` 退出码为 0 |
| 23 | 上游缺数据日的显示正确（例如数据中台改造期间的 2026-10-21） | 选择该日期，页面显示"数据暂缺"和"查看最近有数据的交易日"按钮，没有任何假数值 |

## 六、备份与监控

| # | 事项 | 怎么检查 |
|---|---|---|
| 24 | SQLite 每日备份（账号、会员、开通记录都在里面），备份异地保存 | `sqlite3 $INSIGHT_DB_PATH ".backup '/backup/insight-$(date +%F).sqlite3'"` 加入 crontab；抽一份备份能正常打开 |
| 25 | 网关进程由 systemd 或 supervisor 守护，崩溃后自动重启 | `kill` 掉进程后会自动拉起 |
| 26 | 单实例部署（限流和签名防重放依赖本机内存；多实例部署前要先换成共享存储） | 部署拓扑里只有一个网关进程 |
