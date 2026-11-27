# 部署 runbook：知数星耀量化平台 → dk.dreamotech.cn（腾讯云边缘机）

> **上线当天按 `RUNBOOK-EXECUTE.md` 执行**；它已经按 WEB-CN-006 的线上事实修正过（证书用 nginx 插件、没有 snippets 目录、直接用机器上的 python3.11）。本文件是设计说明，命令有出入时以执行清单为准。
>
> **状态：草案，一步都没有执行过。** 每一步都标了类型：
> - 【只读】只看不改；
> - 【写】会改服务器、证书、nginx 或数据中台，必须先拿到用户书面批准；
> - 【第三方后台】需要用户本人在阿里云、微信公众平台等后台操作。
>
> 依据：13_用户裁决记录 DK1（最晚 2026-11-27 上线，不等 ICP 主体变更）、DK2（免费试用、不开支付）、Z5（dk. = 知数星耀）；CORE-003 / CORE-003-addendum；DreamOtechWeb `docs/deploy.md` 的写法。

## 0. 拓扑与约定

```
浏览器 ─https─▶ 101.35.245.53 nginx  conf.d/dk.dreamotech.cn.conf（独立文件）
                  ├─ /            → /opt/dk-insight/web/current（web/dist，SPA）
                  └─ /api/        → 127.0.0.1:8090  dk-insight-api.service（uvicorn，单实例）
                                         │ SQLite /var/lib/dk-insight/insight.sqlite3
                                         └─ X-API-Key ─▶ 127.0.0.1:18000（frp 隧道 → 数据中台生产 webapi）
                                                         /api/v1/data/apis/public-*/records
```

| 项 | 值 |
|---|---|
| 主机 | 腾讯云轻量 101.35.245.53（和 dreamotech.cn、www 同一台） |
| 进程 | systemd `dk-insight-api.service`，系统用户 `dk-insight`，只监听 127.0.0.1:8090 |
| 代码 | `/opt/dk-insight/app/releases/<ts>/`（仓库 `git archive`），`current` 软链 |
| Python | `/opt/dk-insight/venv`（`/usr/bin/python3.11 -m venv`，`pip install -r backend/requirements.lock`） |
| 前端 | `/opt/dk-insight/web/releases/<ts>/`（`web/dist`），`current` 软链 |
| 数据 | `/var/lib/dk-insight/insight.sqlite3`（账号、角色、会员、审计） |
| 备份 | `/var/lib/dk-insight/backups/`，每日 03:30，保留 14 份（0640，组只读）；异地：家里的 Mac mini（中台生产机）每日 04:30 拉取，保留最新 14 份，并整份装进那里 PostgreSQL 的库 `dreamo_user_backup` 的 schema `dk_insight`（查看用副本，只有最新一天） |
| 配置 | `/etc/dk-insight/insight.env`（root:dk-insight 0640），变量见 `insight.env.example` |
| 日志 | nginx：`/var/log/nginx/dk-insight/`，保留 30 天；网关：`journalctl -u dk-insight-api` |
| 证书 | **单独签** `live/dk.dreamotech.cn`，和现有证书一样用 certbot nginx 插件。不碰 `live/dreamotech.cn`（derper 依赖） |

**为什么选 systemd 而不是 docker**：网关只是一个 Python 进程加一个 SQLite 文件；这台边缘机上已经跑着 frps、derper、nginx 和旅游后端，docker 是否安装没有核实。systemd 不增加新组件，崩溃自动重启（launch-checklist #25），`ProtectSystem=strict` 只放行数据目录。如果 S0 发现机器上已经统一用 docker，再改成容器，配置项不变。

**为什么上游走 127.0.0.1:18000**：边缘机上已有 frp 隧道直达数据中台生产 webapi（dreamotech.cn 的 `/api/` 就是这么转的）。走本机隧道不经过公网和边缘 nginx 的 `proxy_cache`，Key 也不出机器。前提是 S0 确认 18000 现在指向生产（2026-08-01 曾被本机开发环境占用过）。

**这台机器上不能碰的东西**（同 DreamOtechWeb runbook）：`dreamotech.cn.conf` 及其中旅游脚本维护的标记块、证书 `live/dreamotech.cn` 与 `renewal-hooks/deploy/derper.sh`、frps、derper、tailscaled、`/opt/dreamotech/`。

## 1. 【只读】S0 线上核对

```bash
mkdir -p ~/dk-tencent-snapshot && cd ~/dk-tencent-snapshot      # 放在仓库外
H=mshengran@101.35.245.53
ssh $H 'sudo nginx -T'                                         > nginx-T.txt
ssh $H 'ls -la /etc/nginx/conf.d /etc/nginx/snippets 2>/dev/null' > conf-files.txt
ssh $H 'sudo certbot certificates; ls -la /etc/letsencrypt/renewal-hooks/*/; sudo cat /etc/letsencrypt/renewal-hooks/deploy/derper.sh' > certs.txt
ssh $H 'sudo ss -ltnp'                                         > ports.txt
ssh $H 'python3 --version; command -v uv docker sqlite3; df -h / /var; free -m' > runtime.txt
ssh $H 'ps -o user= -C nginx | sort | uniq -c; cat /run/nginx.pid' > nginx-user.txt
ssh $H 'curl -s -o /dev/null -D - http://127.0.0.1:18000/api/health | grep -i -E "^HTTP|x-dreamo-env"' > upstream.txt
ssh $H 'ps aux | grep -i -E "insight|uvicorn" | grep -v grep'  > existing-insight.txt
```

必须得到的结论：

| # | 核对项 | 通过标准 | 不通过怎么办 |
|---|---|---|---|
| a | `derper.sh` 是否只处理 `dreamotech.cn` 这张证书 | 脚本里判断了 `$RENEWED_LINEAGE`（或等价条件），其他证书续期时直接退出 | **阻断**。`renewal-hooks/deploy/` 下的脚本对每一张证书续期都会运行；没有判断的话，dk 证书续期会把 dk 证书拷给 derper，导致 Tailscale 中继握手失败。处理方式由用户决定（见 §10 B3），本 runbook 不改 derper.sh |
| b | 127.0.0.1:18000 返回 `X-Dreamo-Env: production` | 是 | 先修隧道，不能接开发环境 |
| c | 8090 没有被占用 | `ports.txt` 里没有 :8090 | 换一个端口，同步改 unit 和 nginx |
| d | Python 3.11 可用 | `python3 --version` ≥ 3.11，或 `uv` 已装 | 用 uv 装 3.11（`uv python install 3.11`，国内下载慢时用镜像）|
| e | 没有已经在跑的 insight 网关 | `existing-insight.txt` 为空 | 先弄清楚是谁、用的哪把 Key（`dodk_451cfb3` 可能就是它） |
| f | `conf.d` 下没有其他文件写了 `server_name dk.dreamotech.cn` | 是 | 先清理冲突 |
| g | nginx 运行用户、pid 路径 | 记录下来 | logrotate 的 `create` 属主按实际改 |

## 2. 【第三方后台】DNS：只新增 dk

阿里云解析 → `dreamotech.cn` → **新增**一条：`dk` A `101.35.245.53`，TTL 600。不修改、不删除任何已有记录。

验证【只读】：`dig +short dk.dreamotech.cn @223.5.5.5` 返回 101.35.245.53。

## 3. 【写·数据中台】签发上游 Key

前置：数据中台 `insight-svip` 账号已建好，套餐 `insight-svip-v1` 含 12 个服务（覆盖本平台用到的 11 个 public-*）。

```bash
# 在有数据中台管理员权限的机器上执行；明文只写进 600 权限的本地文件，不在终端出现
dreamo api key create --env prod --account insight-svip --name insight-svip-prod \
  --env-file ~/dk-secrets/insight.env.upstream --env-var INSIGHT_UPSTREAM_API_KEY
# 传到服务器后立即删除本地文件
scp ~/dk-secrets/insight.env.upstream $H:/tmp/ && rm -P ~/dk-secrets/insight.env.upstream
```

验证【只读】：在边缘机上用这把 Key 逐个读 11 个 public-* 服务 `?limit=1`，全部 200；读 `review-industry` 应返回 403（不在套餐内）。

## 4. 【写】服务器准备

```bash
sudo useradd --system --home /var/lib/dk-insight --shell /sbin/nologin dk-insight
sudo install -d -o root -g root -m 0755 /opt/dk-insight /opt/dk-insight/app/releases /opt/dk-insight/web/releases
sudo install -d -o root -g dk-insight -m 0750 /etc/dk-insight
# 代码：本地 git archive <commit> 上传，解到 /opt/dk-insight/app/releases/<ts>，再切 current 软链
sudo /usr/bin/python3.11 -m venv /opt/dk-insight/venv
sudo /opt/dk-insight/venv/bin/pip install -r /opt/dk-insight/app/current/backend/requirements.lock
# 配置：按 insight.env.example 填写 /etc/dk-insight/insight.env（root:dk-insight 0640），
#       把 §3 的 /tmp/insight.env.upstream 内容合并进去后 shred 掉
```

环境变量取值说明（只写来源，不写值）：

| 变量 | 取值 |
|---|---|
| `INSIGHT_ENV` / `INSIGHT_DATA_MODE` | `production` / `live` |
| `INSIGHT_UPSTREAM_BASE_URL` | `http://127.0.0.1:18000`（S0-b 通过后） |
| `INSIGHT_UPSTREAM_API_KEY` | §3 签发的 `insight-svip-prod` |
| `INSIGHT_PUBLIC_PAGES` | 6 个页面全部走 public-*，因此不需要 `INSIGHT_UPSTREAM_LEGACY_API_KEY` |
| `INSIGHT_JWT_SECRET` | 服务器上 `python3 -c "import secrets;print(secrets.token_urlsafe(48))"` 生成 |
| `INSIGHT_ALLOWED_ORIGINS` | `https://dk.dreamotech.cn` |
| `INSIGHT_REGISTRATION` | `open` 或 `invite_only`（用户拍板，§11） |
| `INSIGHT_PAYMENT_ENABLED` | **不设置**（= 关闭付费，DK2） |
| `INSIGHT_TRIAL_ROLE` / `INSIGHT_TRIAL_UNTIL` | 试用等级与截止日（用户拍板，§11） |
| `INSIGHT_WECHAT_APPID` / `INSIGHT_WECHAT_SECRET` | 小程序上线时再填 |
| `INSIGHT_BOOTSTRAP_ADMIN_USER` / `_PASSWORD` | 只在 §8 首次启动时设置，改密后删除 |

## 5. 【写】启动网关

```bash
sudo cp deploy/dk/systemd/dk-insight-api.service deploy/dk/systemd/dk-insight-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dk-insight-api dk-insight-backup.timer
curl -s http://127.0.0.1:8090/api/v1/health      # 期望 {"status":"ok","data_mode":"live",...}
```

配置不合规时进程会拒绝启动（生产禁止夹具、禁止关闭鉴权、JWT 密钥不足 32 位、试用参数不完整等），看 `journalctl -u dk-insight-api -n 50`。

## 6. 【写】证书：dk 单独签一张

```bash
# phase 1：只开 :80，供 certbot nginx 插件验证
sudo cp deploy/dk/nginx/dk.dreamotech.cn.http-only.conf /etc/nginx/conf.d/dk.dreamotech.cn.conf
sudo nginx -t && sudo systemctl reload nginx
# 先演练，再正式签
sudo certbot certonly --nginx -d dk.dreamotech.cn --cert-name dk.dreamotech.cn --dry-run
sudo certbot certonly --nginx -d dk.dreamotech.cn --cert-name dk.dreamotech.cn
```

- 用 HTTP-01（nginx 插件，和线上现有证书的续期方式一致），不用泛域名 DNS-01（不把阿里云 DNS 密钥放到服务器上）。
- **前提是 S0-a 通过**：确认 derper 的 deploy hook 不会被 dk 证书触发拷贝。

## 7. 【写】nginx 正式配置与前端

```bash
sudo install -d -o nginx -g root -m 0750 /var/log/nginx/dk-insight        # 属主以 S0-g 为准
sudo cp deploy/dk/nginx/dk.dreamotech.cn.conf /etc/nginx/conf.d/dk.dreamotech.cn.conf   # 覆盖 phase 1
sudo cp deploy/dk/logrotate-dk-insight /etc/logrotate.d/dk-insight && sudo logrotate -d /etc/logrotate.d/dk-insight
# 前端：本地 cd web && npm run build:prod（含混淆与产物扫描），rsync 到 /opt/dk-insight/web/releases/<ts>，切 current
sudo nginx -t && sudo systemctl reload nginx
```

nginx 草案要点：`/api/` 覆盖写 `X-Forwarded-For $remote_addr`（配合 uvicorn `--proxy-headers --forwarded-allow-ips=127.0.0.1`，限流和封禁按真实 IP，客户端伪造的头无效）；API 响应 `no-store`、不走 `proxy_cache`；CSP 只允许同源；HSTS 不带 `includeSubDomains`。

**前端换成 React 版后的发布注意（2026-11-23）**：发布命令不变（`cd web && npm ci && npm run build:prod`，看到 `SCAN OK`），本地 Node 要 20.19+ 或 22.12+。
- 先发网关，再发前端：新总览页要用网关新增的补充视图 `limit_history`、`breadth_history`；旧前端不受新网关影响。
- 发布后标题字体会从系统字体变成设计稿的宋体（`/fonts/zx-serif.woff2` 这次随前端发出；旧版取不到，线上一直在用系统字体）。
- 关注页三张二维码随前端发出（`/social/*.png`），旧版取不到，线上是破图。
- 发布后逐页打开看一遍：首页（往下滚出现历史演示）、关注页、6 个数据页、账号、后台，浏览器控制台不应有 CSP 报错。
- 回滚同下表：`web/current` 指回上一个 `releases/<ts>`；只回前端时，新网关对旧前端无影响。

## 8. 【写】管理员与运营配置

1. 在 env 里临时加 `INSIGHT_BOOTSTRAP_ADMIN_USER/PASSWORD`，`systemctl restart dk-insight-api`；登录后立即改密；删除这两行再重启（launch-checklist #17）。
2. 后台「角色权限」核对 free / vip / svip（#18）。
3. **付费关闭期间不要在后台上架套餐**；开关关闭时用户侧套餐接口本来就返回 403，后台带金额或按套餐开通也会被拒（DK2）。

## 9. 【写】备份

- 每日 03:30 `dk-insight-backup.timer` 用 SQLite 在线备份 API 写到 `/var/lib/dk-insight/backups/`，做完整性检查，保留 14 份（`deploy/dk/scripts/backup_sqlite.py`，只依赖 Python 标准库）。
- 异地：家里的 Mac mini（中台生产机）每天 04:30 主动拉取（DK4/ZS-138），只读专用账号 `dk-backup` + rrsync，保留最新 14 份，数据不出境。拉取并校验后，整份装进 Mac mini 上 `postgres-db` 容器的库 `dreamo_user_backup` 的 schema `dk_insight`（`REVOKE CONNECT ... FROM PUBLIC`，普通角色读不到），每天整份替换、只有最新一天，只是方便查看的副本。这个库是公司境内产品的用户数据备份库，每个产品一个 schema，知数星耀是 `dk_insight`。**恢复用拉下来的 SQLite 文件**，不用 PostgreSQL 那份。脚本和安装步骤见 `deploy/dk/macmini/`（`SETUP-ON-MACMINI.md`）。
- 恢复演练【只读】：抽一份备份 `python3 -c "import sqlite3;print(sqlite3.connect('<备份>').execute('PRAGMA integrity_check').fetchone())"`。

## 10. 【只读】验收

```bash
for u in http://dk.dreamotech.cn/ https://dk.dreamotech.cn/ https://dk.dreamotech.cn/overview \
         https://dk.dreamotech.cn/api/v1/health https://dk.dreamotech.cn/api/v1/overview https://dk.dreamotech.cn/api/v1/plans \
         https://dreamotech.cn/ https://dreamotech.cn/api/health https://www.dreamotech.cn/; do
  printf '%-48s ' "$u"; curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$u"
done
curl -s https://dk.dreamotech.cn/api/v1/health
curl -sI https://dk.dreamotech.cn/ | grep -iE 'strict-transport|content-security|x-frame|server'
echo | openssl s_client -servername dk.dreamotech.cn -connect dk.dreamotech.cn:443 2>/dev/null | openssl x509 -noout -subject -enddate -ext subjectAltName
echo | openssl s_client -servername dreamotech.cn -connect dreamotech.cn:443 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName
sudo certbot renew --dry-run
```

| 请求 | 期望 |
|---|---|
| `http://dk…/` | 301 → https |
| `https://dk…/`、`/overview` | 200（SPA） |
| `/api/v1/health` | 200，`"data_mode":"live"` |
| `/api/v1/overview`（未登录） | 401 |
| `/api/v1/plans`（登录后） | 403「会员购买暂未开放」 |
| 裸域、www | 和上线前一样（不受影响） |
| dk 证书 | SAN 只有 `dk.dreamotech.cn` |
| 裸域证书 | 还是原来那张（SAN `dreamotech.cn, www.dreamotech.cn`） |
| `certbot renew --dry-run` | 全部成功；derper 正常（`tailscale netcheck` 或 derper 日志） |

浏览器走查：注册 → 登录 → 侧栏显示「免费试用中（至 …）」→ 6 个数据页都能打开 → 页面上没有任何价格和「会员套餐」入口 → 手动访问 `/plans` 跳回总览。

## 11. 【第三方后台】小程序

1. 微信公众平台 → 开发管理 → 服务器域名：request 合法域名改为 `https://dk.dreamotech.cn`。
2. 本地构建：`cd miniprogram && VITE_API_BASE=https://dk.dreamotech.cn npm run build:mp-weixin`，用开发者工具上传、提审。
3. 网关 env 填 `INSIGHT_WECHAT_APPID/SECRET`，重启。
4. 小程序能否以当前主体通过类目审核另行确认（launch-checklist #3）；**不阻塞网页版上线**。

## 12. 回滚

| 环节 | 回滚 |
|---|---|
| 前端 | `current` 指回上一个 `releases/<ts>`，不用 reload |
| 网关代码 | `app/current` 指回上一版，`systemctl restart dk-insight-api` |
| 数据 | 停服务 → 用 `backups/` 里最近一份覆盖 `insight.sqlite3` → 启服务 |
| nginx | 删除 `conf.d/dk.dreamotech.cn.conf`，`nginx -t && reload`。裸域、www 不受影响 |
| 证书 | `certbot delete --cert-name dk.dreamotech.cn`（只删 dk 这张） |
| DNS | 删除 `dk` 这条 A 记录 |
| 上游 Key | `dreamo api key revoke <前缀> --env prod --yes` |

## 13. 试用期运营

- 延长试用：改 `INSIGHT_TRIAL_UNTIL`，`systemctl restart dk-insight-api`。不写库，所有用户同时生效。
- 结束试用：删除 `INSIGHT_TRIAL_ROLE/UNTIL` 两行并重启，用户回到真实等级（默认 free）；或者等截止日自然结束。
- 打开付费：资质与支付打通后设置 `INSIGHT_PAYMENT_ENABLED=1` 并重启；套餐页、开通入口、兑换入口随之出现，代码无需改动。
