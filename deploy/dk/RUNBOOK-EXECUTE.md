# dk.dreamotech.cn 上线当天执行清单（DK-002）

> **状态：清单，未执行。** 背景、设计和配置说明见 `deploy/dk/README.md`。本文件只列上线当天按顺序要敲的命令。
> 类型标记：【只读】【写·本地】【写·服务器】【写·数据中台生产】【第三方后台】（需用户本人在第三方后台操作）。
> 每一步都写了：命令、预期输出、失败时怎么办。**任何一步失败都先停下来，不要跳步。**

## 约定

```bash
H=mshengran@101.35.245.53                 # 边缘机
Q=/Users/mshengran/Project/DreamoQuantSimulation
REL=/Users/mshengran/Project/DreamoQuantSimulation-wt/release   # 合并用的干净 worktree
TS=$(date +%Y%m%d%H%M%S)                  # 本次发布的版本号，全程用同一个值
B=/etc/nginx/acceptance-backups/$(date +%F)-dk-002   # 服务器上的配置备份目录（沿用 WEB-CN-006 的约定）
```

**密钥规则**：上游 Key、JWT 密钥、管理员初始密码只出现在服务器 `/etc/dk-insight/insight.env` 和一次性临时文件里。不出现在终端输出、聊天、回执和仓库里。检查时只看变量名、行数和前缀。

---

## E0 开工前提【只读】

| # | 检查 | 通过标准 | 不通过 |
|---|---|---|---|
| 1 | 总控通知「WEB-CN-006 已完成，可以开始」 | 收到通知 | 等待。不能和 www 部署并行 |
| 2 | 用户批准试用期条款（`88cbc6f9a`） | **已满足**：13 号文件 DK4 已确认，随 dk-001 一起上线 | — |
| 3 | 用户**本人**确认由本会话执行生产写操作 | 用户直接在本会话确认 | 等待（见回执 §0：本会话原有规则是「不做生产发布」，需要用户本人放开） |
| 4 | 线上事实（WEB-CN-006，2026-11-17 00:42 完成） | 已知：derper.sh 没有判断 `$RENEWED_LINEAGE`（E2 要加）；18000 由 frps 监听，另一端是 mac-mini 上的 frpc，按运维手册映射到 quantagents-webapi:8000；Python 3.11.6 已在 `/usr/bin/python3.11`；证书续期用 `authenticator = nginx`；没有 `/etc/nginx/snippets`；nginx 运行用户 nginx，pid 文件 `/run/nginx.pid`；配置备份统一放 `/etc/nginx/acceptance-backups/` | — |
| 4a | 18000 确实指向生产 | `ssh $H 'curl -s -o /dev/null -D - http://127.0.0.1:18000/api/health' \| grep -i x-dreamo-env` 输出 `production` | 停：不能接开发环境 |
| 5 | 数据中台 CLI 已登录生产 | `dreamo --env prod api account list` 返回 3 个以上账号 | 请用户自己运行 `! dreamo auth login --username <账号> --password-stdin --env prod`（本会话不接触密码） |
| 6 | SSH 可用 | `ssh -o BatchMode=yes $H true; echo $?` 输出 0 | 停 |
| 7 | 8090 端口空闲 | `ssh $H 'sudo ss -ltnp' \| grep -c ':8090 '` 输出 0 | 换端口，同步改 unit 和 nginx |

---

## E1 合并分支【写·本地】

`feat/upstream-governance-role-policy-mp` 的工作区有 2 个未提交的文档改动，不在那里合并。另开一个干净的 worktree 检出 main。

```bash
cd $Q && git worktree add $REL main && cd $REL
git merge --no-ff feat/zs-002c-zhishu-xingyao-rename -m "merge: feat/zs-002c-zhishu-xingyao-rename — 对外版改名知数星耀量化平台与 logo (ZS-002c)"
git merge --no-ff feat/dk-001-deploy -m "merge: feat/dk-001-deploy — dk.dreamotech.cn 部署配置、免费试用与付费开关、试用期条款 (DK-001)"
git log --oneline -3; M=$(git rev-parse --short HEAD); echo "release commit $M"
```

- 预期：两次合并都没有冲突（dk-001 基于 zs-002c，zs-002c 基于 main）。
- 合并后在 `$REL` 里跑一遍：`cd web && npm ci && npm run build:prod`（出现 `SCAN OK`）；`backend` 下 5 个校验脚本全部通过（命令同 DK-001 回执 §4）。
- 失败：`git merge --abort`，停下来报告。
- 不 push（是否 push 由用户另外决定）。

---

## E2 derper.sh 加证书判断（B3）【写·服务器】

WEB-CN-006 已确认原文没有判断（`#!/bin/sh`，固定拷贝 `live/dreamotech.cn`，之后 `systemctl try-restart derper`）。不加判断不会拷错证书，但每张证书续期都会多拷一次、多重启一次 derper。在签 dk 证书之前加上判断。

```diff
 #!/bin/sh
+[ "$RENEWED_LINEAGE" = /etc/letsencrypt/live/dreamotech.cn ] || exit 0
 # certbot 续期后重新复制证书并重启 derper
 L=/etc/letsencrypt/live/dreamotech.cn
```

```bash
ssh $H "sudo mkdir -p $B && sudo cp -a /etc/letsencrypt/renewal-hooks/deploy/derper.sh $B/derper.sh"
# 在 shebang 之后插入一行：只有 dreamotech.cn 这张证书续期时才往下执行
ssh $H "sudo sed -i '1a [ \"\$RENEWED_LINEAGE\" = \"/etc/letsencrypt/live/dreamotech.cn\" ] || exit 0' /etc/letsencrypt/renewal-hooks/deploy/derper.sh"
ssh $H "sudo head -3 /etc/letsencrypt/renewal-hooks/deploy/derper.sh; sudo sh -n /etc/letsencrypt/renewal-hooks/deploy/derper.sh && echo syntax-ok"
# 只验证「别的证书不会触发」：用 dk 的路径跑一次，应该在第 2 行就退出，不拷贝、不重启 derper
ssh $H "sudo env RENEWED_LINEAGE=/etc/letsencrypt/live/dk.dreamotech.cn sh -x /etc/letsencrypt/renewal-hooks/deploy/derper.sh 2>&1 | head -5; sudo stat -c %y /etc/derper/certs/dreamotech.cn.crt"
```

- 预期：第 2 行是判断语句；输出 `syntax-ok`；dk 路径的运行轨迹只有判断和 `exit 0`；`/etc/derper/certs/dreamotech.cn.crt` 的修改时间还是 2026-11-11（没有被拷贝）。
- **不要**用 dreamotech.cn 的路径手动运行它（那样会真的拷贝证书、重启 derper）。
- 失败：`sudo cp -a $B/derper.sh /etc/letsencrypt/renewal-hooks/deploy/derper.sh`，停。

---

## E3 DNS 新增 dk【第三方后台】

用户在阿里云解析 → `dreamotech.cn` → **新增** `dk`、A、`101.35.245.53`、TTL 600。不改不删任何已有记录。

```bash
dig +short dk.dreamotech.cn @223.5.5.5        # 【只读】预期：101.35.245.53
dig +short dk.dreamotech.cn @119.29.29.29     # 预期同上（腾讯 DNS，证书验证前两边都要生效）
```

- 失败（没有生效）：等 TTL 后重查；10 分钟还查不到就请用户核对记录。

---

## E4 数据中台：按角色建账号、签 Key【写·数据中台生产】

**设计**（回执 §1）：对外版的路由按等级选账号名：
- `insight-svip` 用 `INSIGHT_UPSTREAM_API_KEY`；
- `insight-vip` 用 `INSIGHT_UPSTREAM_API_KEY_VIP`；
- `insight-free` 用 `INSIGHT_UPSTREAM_API_KEY_FREE`。

上线当天按角色建 3 个账号、签 3 把 Key：

| 角色 | 数据中台账号 | 套餐（scope） | Key 名 | 写入的变量 |
|---|---|---|---|---|
| svip、admin | `insight-svip`（已存在） | `insight-svip-v1`（= 合规模板 12 个服务） | `insight-svip-prod` | `INSIGHT_UPSTREAM_API_KEY` |
| vip | `insight-vip`（新建） | `insight-svip-v1`（暂时相同，见回执 §1） | `insight-vip-prod` | `INSIGHT_UPSTREAM_API_KEY_VIP` |
| free | `insight-free`（新建） | `insight-svip-v1`（暂时相同） | `insight-free-prod` | `INSIGHT_UPSTREAM_API_KEY_FREE` |

```bash
cd /Users/mshengran/Project/DreamOAgents
# 4.1 先预演，再建账号
.venv/bin/dreamo --env prod api account create --name insight-vip  --package insight-svip-v1 --dry-run
.venv/bin/dreamo --env prod api account create --name insight-vip  --package insight-svip-v1
.venv/bin/dreamo --env prod api account create --name insight-free --package insight-svip-v1
# 4.2 明文只写进一次性临时文件（700 目录、600 文件）
KD=$(mktemp -d) && chmod 700 $KD && KF=$KD/dk-keys.env
for spec in "insight-svip insight-svip-prod INSIGHT_UPSTREAM_API_KEY" \
            "insight-vip insight-vip-prod INSIGHT_UPSTREAM_API_KEY_VIP" \
            "insight-free insight-free-prod INSIGHT_UPSTREAM_API_KEY_FREE"; do
  set -- $spec
  .venv/bin/dreamo --env prod api key create --account $1 --name $2 \
     --expires-at 2027-11-27T00:00:00+08:00 --rate-limit 120 --env-file $KF --env-var $3
done
chmod 600 $KF; grep -c '^INSIGHT_UPSTREAM_API_KEY' $KF          # 预期 3（只数行数）
.venv/bin/dreamo --env prod api key list --account insight-svip  # 只显示前缀，记进回执
```

- 预期：每次 `key create` 输出 JSON，含 `prefix` 和 `env_var`，**不含明文**。
- 不设 `--ip`：请求经 frp 隧道进入数据中台，看到的来源 IP 不是边缘机的公网 IP，按 IP 限制不可靠。
- 失败：CLI 写文件失败时会自动吊销刚签的 Key（DK-001 之前的 CLI 设计）。账号已建好就保留，重跑 `key create`。

### E4b 行业视图对数（B2）【只读·数据中台生产】

趁临时文件还在，在本机跑新旧链路对数：
- 新链路：用 svip Key 读 public-*；
- 旧链路：用对外版本地原有的开发 Key（`.env.local` 里前缀 `dodk_5f4c678`，可以读 review-*）作为 legacy。

```bash
PF=$KD/parity.env
grep '^INSIGHT_UPSTREAM_API_KEY=' $KF > $PF
grep '^INSIGHT_UPSTREAM_API_KEY=' $Q/.env.local | sed 's/^INSIGHT_UPSTREAM_API_KEY=/INSIGHT_UPSTREAM_LEGACY_API_KEY=/' >> $PF
chmod 600 $PF
cd $REL/backend && $Q/backend/.venv/bin/python ../scripts/sandbox/2026-11-15_verify_public_parity.py \
  --env-file $PF --base-url https://dreamotech.cn --dates <最近 10 个交易日，如 2026-11-13:2026-11-26> --extra <其中一个缺数日或周末> --pages industries
```

- 预期：`industries` 页逐字段一致（脚本会列出已知、可以忽略的差异字段）；缺数日返回空数据和缺数原因，不出现 0。
- **不通过**：行业页先关掉，其余照常上线。做法：E11 管理员登录后，在「角色权限」里把 free/vip/svip 的 `page.industries` 和 `data.detail` 关闭（侧栏显示锁，接口返回 403）。不配置 legacy Key，也不改代码。把差异写进回执，交数据中台会话处理。
- 顺便跑一次其他页：`--pages overview,participation,themes,history,calendar`，结果记录在案（不阻断）。

---

## E5 服务器准备【写·服务器】

```bash
ssh $H 'sudo useradd --system --home /var/lib/dk-insight --shell /sbin/nologin dk-insight; id dk-insight'
ssh $H 'sudo install -d -m 0755 /opt/dk-insight/app/releases /opt/dk-insight/web/releases && sudo install -d -o root -g dk-insight -m 0750 /etc/dk-insight'
# 代码：用 E1 的合并结果打包
cd $REL && git archive --format=tar.gz $M | ssh $H "sudo install -d /opt/dk-insight/app/releases/$TS && sudo tar -xzf - -C /opt/dk-insight/app/releases/$TS"
ssh $H "sudo ln -sfn releases/$TS /opt/dk-insight/app/current.tmp && sudo mv -Tf /opt/dk-insight/app/current.tmp /opt/dk-insight/app/current"
# Python 3.11 + 依赖：机器上已有 /usr/bin/python3.11（B11），直接用标准库 venv，不装 uv
ssh $H 'sudo /usr/bin/python3.11 -m venv /opt/dk-insight/venv && sudo /opt/dk-insight/venv/bin/pip install -q -r /opt/dk-insight/app/current/backend/requirements.lock'
ssh $H '/opt/dk-insight/venv/bin/python -c "import fastapi,uvicorn;print(fastapi.__version__, uvicorn.__version__)"'
```

- 预期最后一行：`0.143.0 0.54.0`。
- 失败：PyPI 访问慢或超时，就加 `-i https://mirrors.cloud.tencent.com/pypi/simple`（腾讯云内网镜像）重试。

---

## E6 写 env 文件【写·服务器】

```bash
# 6.1 不含密钥的部分：直接写
ssh $H "sudo tee /etc/dk-insight/insight.env >/dev/null" <<'EOF'
INSIGHT_ENV=production
INSIGHT_DATA_MODE=live
INSIGHT_DB_PATH=/var/lib/dk-insight/insight.sqlite3
INSIGHT_ALLOWED_ORIGINS=https://dk.dreamotech.cn
INSIGHT_PUBLIC_PAGES=overview,participation,industries,themes,history,calendar
INSIGHT_REGISTRATION=open
INSIGHT_UPSTREAM_BASE_URL=http://127.0.0.1:18000
INSIGHT_UPSTREAM_TIMEOUT=15
INSIGHT_CACHE_TTL=60
INSIGHT_TRIAL_ROLE=svip
INSIGHT_TRIAL_UNTIL=2026-12-18
EOF
# 6.2 JWT 密钥：在服务器上生成，直接追加，不回显
ssh $H 'printf "INSIGHT_JWT_SECRET=%s\n" "$(python3 -c "import secrets;print(secrets.token_urlsafe(48))")" | sudo tee -a /etc/dk-insight/insight.env >/dev/null'
# 6.3 三把上游 Key：临时文件经 scp 放到内存盘，追加后立即删除；本地临时目录同时删除
scp -q $KF $H:/dev/shm/dk-keys.env && ssh $H 'sudo sh -c "cat /dev/shm/dk-keys.env >> /etc/dk-insight/insight.env" && shred -u /dev/shm/dk-keys.env'
rm -P $KF $PF 2>/dev/null; rm -rf $KD
# 6.4 权限与自检（只看变量名）
ssh $H 'sudo chown root:dk-insight /etc/dk-insight/insight.env && sudo chmod 0640 /etc/dk-insight/insight.env && sudo cut -d= -f1 /etc/dk-insight/insight.env'
```

- 预期 6.4 输出 15 个变量名：11 个固定项，加 `INSIGHT_JWT_SECRET` 和 3 个 `INSIGHT_UPSTREAM_API_KEY*`。**没有** `INSIGHT_PAYMENT_ENABLED`、`INSIGHT_AUTH_MODE`、`INSIGHT_MP_MOCK_LOGIN`。
- 管理员引导变量放到 E11 再加，由用户本人填写。
- 失败：重写 6.1，再重新追加；如果 Key 文件已经删了，就到数据中台吊销这 3 把 Key，回到 E4.2 重新签。

---

## E7 安装并启动 systemd 服务【写·服务器】

```bash
ssh $H 'cd /opt/dk-insight/app/current/deploy/dk/systemd && sudo cp dk-insight-api.service dk-insight-backup.service dk-insight-backup.timer /etc/systemd/system/ && sudo systemd-analyze verify /etc/systemd/system/dk-insight-*.service'
ssh $H 'sudo systemctl daemon-reload && sudo systemctl enable --now dk-insight-api && sleep 3 && systemctl is-active dk-insight-api'
ssh $H 'curl -s http://127.0.0.1:8090/api/v1/health'
ssh $H 'sudo systemctl enable --now dk-insight-backup.timer && systemctl list-timers dk-insight-backup.timer --no-pager'
```

- 预期：`active`；health 返回 `{"status":"ok","data_mode":"live",...}`（此时还没有路由规则，`route_rule.ok=false` 是正常的，E11 生效后变成 true）。
- 失败：`ssh $H 'sudo journalctl -u dk-insight-api -n 50 --no-pager'`。配置校验错误会写明是哪个变量；改 env 后 `sudo systemctl restart dk-insight-api`。

---

## E8 nginx phase 1 与证书【写·服务器】

```bash
ssh $H "sudo mkdir -p $B && sudo cp -a /etc/nginx/conf.d $B/conf.d"
ssh $H 'sudo cp /opt/dk-insight/app/current/deploy/dk/nginx/dk.dreamotech.cn.http-only.conf /etc/nginx/conf.d/dk.dreamotech.cn.conf && sudo nginx -t && sudo systemctl reload nginx'
# 和线上现有证书一样用 nginx 插件（authenticator = nginx）：certonly 只签发、不改 nginx 配置
ssh $H 'sudo certbot certonly --nginx -d dk.dreamotech.cn --cert-name dk.dreamotech.cn --dry-run'
ssh $H 'sudo certbot certonly --nginx -d dk.dreamotech.cn --cert-name dk.dreamotech.cn'
ssh $H 'sudo grep -E "^(authenticator|installer)" /etc/letsencrypt/renewal/dk.dreamotech.cn.conf'
ssh $H 'sudo certbot certificates 2>/dev/null | grep -A3 -E "Certificate Name: (dk\.)?dreamotech.cn"'
```

- 预期：dry-run 和正式签发都成功；`certificates` 里 `dreamotech.cn` 那张的到期日和 SAN 没有变化，另外多出一张 `dk.dreamotech.cn`；dk 的续期配置是 `authenticator = nginx`。
- 失败：`nginx -t` 不通过就删除 `conf.d/dk.dreamotech.cn.conf`，不 reload。签发失败多半是 DNS 还没生效，回到 E3 核对；不要改用 DNS-01。插件出错时 certbot 会自己恢复 nginx 配置，事后用 `sudo nginx -t` 确认一次。

---

## E9 nginx 正式配置与前端【写·服务器】

```bash
# 前端用 E1 的合并结果构建
cd $REL/web && npm run build:prod
ssh $H "sudo install -d /opt/dk-insight/web/releases/$TS" && rsync -az --rsync-path='sudo rsync' dist/ $H:/opt/dk-insight/web/releases/$TS/
ssh $H "sudo ln -sfn releases/$TS /opt/dk-insight/web/current.tmp && sudo mv -Tf /opt/dk-insight/web/current.tmp /opt/dk-insight/web/current"
# nginx：运行用户是 nginx（WEB-CN-006）；线上没有 snippets 目录，安全头已经写在 dk 的配置文件里
ssh $H 'D=/opt/dk-insight/app/current/deploy/dk; sudo install -d -o nginx -g root -m 0750 /var/log/nginx/dk-insight && sudo cp $D/logrotate-dk-insight /etc/logrotate.d/dk-insight && sudo logrotate -d /etc/logrotate.d/dk-insight 2>&1 | tail -3'
ssh $H 'sudo cp /opt/dk-insight/app/current/deploy/dk/nginx/dk.dreamotech.cn.conf /etc/nginx/conf.d/dk.dreamotech.cn.conf && sudo nginx -t && sudo systemctl reload nginx'
```

- 预期：`nginx -t` 显示 `syntax is ok` 和 `test is successful`。
- 失败：恢复 phase 1 文件（`dk.dreamotech.cn.http-only.conf`），`nginx -t && reload`；裸域和 www 不受影响。

---

## E10 冒烟【只读】

```bash
for u in http://dk.dreamotech.cn/ https://dk.dreamotech.cn/ https://dk.dreamotech.cn/overview https://dk.dreamotech.cn/api/v1/health \
         https://dreamotech.cn/ https://dreamotech.cn/api/health https://www.dreamotech.cn/; do
  printf '%-44s ' "$u"; curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$u"; done
```

预期：dk 的 http 301 → https，https 页面 200，health 200；裸域和 www 的状态码和上线前一样。

---

## E11 管理员与路由规则【写·服务器，用户本人操作密码】

1. **用户本人**在服务器上把两行引导变量加进 env，并重启服务：`INSIGHT_BOOTSTRAP_ADMIN_USER=<管理员用户名>`、`INSIGHT_BOOTSTRAP_ADMIN_PASSWORD=<初始密码>`（密码策略：至少 10 位，含大小写和数字）。本会话不经手密码。
2. 用户在 `https://dk.dreamotech.cn/login` 用初始密码登录 → 按提示改密。
3. 用户删除这两行引导变量，`sudo systemctl restart dk-insight-api`。完成后本会话【只读】确认：`ssh $H 'sudo grep -c BOOTSTRAP /etc/dk-insight/insight.env'` 输出 0。
4. **路由规则（必须做，否则所有 public-* 请求都会被拒绝）**：管理后台 →「角色策略」→ 新建版本：`{"routes": {"free": "insight-free", "vip": "insight-vip", "svip": "insight-svip", "admin": "insight-svip"}}`，原因填「dk 上线：按角色分账号」→ 确认生效。
5. 管理后台「角色权限」核对 free / vip / svip 能看的页面和历史天数（试用期内大家都按 svip 算）。**不上架任何套餐**。
6. 如果 E4b 行业页对数不通过：在这里关掉 `page.industries`、`data.detail`。

预期：`curl -s https://dk.dreamotech.cn/api/v1/health` 里 `route_rule.ok` 变成 `true`，`active_version` 为 1。

---

## E12 验收【只读，除第 3 项注册一个测试账号外】

| # | 检查 | 预期 |
|---|---|---|
| 1 | 证书：`echo \| openssl s_client -servername dk.dreamotech.cn -connect dk.dreamotech.cn:443 2>/dev/null \| openssl x509 -noout -subject -ext subjectAltName` | SAN 只有 `dk.dreamotech.cn` |
| 2 | 裸域证书 | 和上线前一样：SAN 为 `dreamotech.cn, www.dreamotech.cn`，到期日不变 |
| 3 | 浏览器：注册测试账号 `dk-smoke-<日期>`（开放注册）→ 登录 | 侧栏显示「免费试用中（至 2026/12/18）」；我的账号显示 SVIP |
| 4 | 6 个数据页逐页打开 | 有真实数据（数据日期为最近交易日），没有「开发夹具」提示；行业页按 E4b 的结论 |
| 5 | 页面上找「会员套餐」「¥」；手动访问 `/plans` | 都找不到；`/plans` 跳回总览 |
| 6 | 登录后请求 `/api/v1/plans` | 403「会员购买暂未开放」 |
| 7 | 条款页 `/terms` | 显示试用期条款（`88cbc6f9a` 的版本） |
| 8 | 安全头：`curl -sI https://dk.dreamotech.cn/` | 有 CSP、HSTS、`X-Frame-Options: DENY`，`Server` 不带版本号 |
| 9 | 真实 IP：`ssh $H 'sudo tail -3 /var/log/nginx/dk-insight/access.log'` 与 `journalctl -u dk-insight-api -n 3` | 网关日志里是真实公网 IP，不是 127.0.0.1 |
| 10 | 路由日志：管理后台「上游访问记录」 | 测试账号（试用 svip）的请求走 `insight-svip`，规则版本 1 |
| 11 | 数据中台侧：`dreamo --env prod api account get insight-svip --days 1` | 能看到刚才的调用，`X-End-User-Ref` 是匿名编号 |
| 12 | 证书续期演练：`ssh $H 'sudo certbot renew --dry-run'` | 全部成功；derper 进程仍在，`sudo ls -l <derper 证书路径>` 的修改时间没变 |
| 13 | 手动备份一次：`ssh $H 'sudo systemctl start dk-insight-backup && sudo ls -l /var/lib/dk-insight/backups'` | 出现一份 `insight-*.sqlite3`，日志 `backup ok` |
| 14 | 收尾 | 后台停用 `dk-smoke-*` 测试账号 |

任何一项不通过：按 §回滚 处理受影响的那一层，或者整体回滚。

---

## E13 异地备份：家里的 Mac mini 每天拉取（DK4）

方向是 **Mac mini 主动拉**，边缘机不需要能连回家里。备份含境内用户的账号信息，只存放在境内（边缘机加家里的 Mac mini），不出境。

### E13.1 边缘机：只读专用账号【写·服务器】

```bash
# 专用账号 dk-backup：属于 dk-insight 组（备份文件是 0640、组可读），不加 sudo
ssh $H 'sudo useradd --create-home --shell /bin/sh --gid dk-insight dk-backup && id dk-backup'
ssh $H 'command -v rrsync || ls /usr/share/doc/rsync*/support/rrsync /usr/share/rsync/scripts/rrsync 2>/dev/null'   # 找 rrsync
ssh $H 'sudo ls -ld /var/lib/dk-insight /var/lib/dk-insight/backups; sudo ls -l /var/lib/dk-insight/backups | tail -2'
```

- 预期：`/var/lib/dk-insight` 是 `drwxr-x--- dk-insight dk-insight`（0750）；备份文件是 `-rw-r----- dk-insight dk-insight`（0640）。
- 如果 E12-13 的第一份备份是在本次修改之前生成的（0600），就再手动跑一次备份。
- 找不到 rrsync：从 rsync 源码包的 `support/rrsync` 拷到 `/usr/local/bin/rrsync`，`chmod 755`。它是一个 Python 脚本，需要 python3。

### E13.2 Mac mini：生成专用 Key【需在 Mac mini 上执行】

```bash
ssh-keygen -t ed25519 -N '' -C 'mac-mini-dk-backup' -f ~/.ssh/dk_backup_ed25519   # 无口令：供定时任务使用；只对 dk-backup 有效
cat ~/.ssh/dk_backup_ed25519.pub                                                  # 公钥，交给下一步
```

### E13.3 边缘机：登记公钥并加限制【写·服务器】

```bash
# <公钥> 是上一步输出的那一行。restrict 禁止转发、pty 等；command= 强制只能运行只读 rrsync，根目录锁在备份目录
ssh $H "sudo install -d -o dk-backup -g dk-insight -m 0700 /home/dk-backup/.ssh && echo 'command=\"/usr/local/bin/rrsync -ro /var/lib/dk-insight/backups/\",restrict <公钥>' | sudo tee /home/dk-backup/.ssh/authorized_keys >/dev/null && sudo chown dk-backup:dk-insight /home/dk-backup/.ssh/authorized_keys && sudo chmod 0600 /home/dk-backup/.ssh/authorized_keys"
```

- `rrsync` 的路径按 E13.1 实际找到的位置填写。
- 如果边缘机的 sshd 设置了 `AllowUsers` 或 `AllowGroups`，要把 `dk-backup` 加进去。属于 sshd 配置改动，先 `sshd -t` 再 reload。

### E13.4 Mac mini：安装拉取脚本和定时任务【需在 Mac mini 上执行】

```bash
mkdir -p ~/dk-backup && chmod 700 ~/dk-backup
cp deploy/dk/macmini/pull-dk-backup.sh ~/dk-backup/ && chmod 700 ~/dk-backup/pull-dk-backup.sh
sed "s#__HOME__#$HOME#g" deploy/dk/macmini/cn.dreamotech.dk-backup-pull.plist > ~/Library/LaunchAgents/cn.dreamotech.dk-backup-pull.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/cn.dreamotech.dk-backup-pull.plist
```

- 每天 04:30 运行（服务器 03:30 备份）。
- 本地保留 **30 天**（`KEEP_DAYS=30`）；边缘机本地保留 14 份。
- Mac mini 需要开着；如果睡眠时错过了 04:30，launchd 会在唤醒后补跑一次。建议在「节能」设置里打开「唤醒以供网络访问」。
- 建议打开 FileVault（备份含个人信息）。

### E13.5 验证【需在 Mac mini 上执行·只读】

```bash
# 1) 只读限制生效：交互登录、执行命令、写入都应该被拒绝
ssh -i ~/.ssh/dk_backup_ed25519 -o BatchMode=yes dk-backup@101.35.245.53 'ls /'   # 预期：被 rrsync 拒绝
rsync -a -e "ssh -i ~/.ssh/dk_backup_ed25519" /etc/hosts dk-backup@101.35.245.53:x  # 预期：失败（只读）
# 2) 手动跑一次拉取
bash ~/dk-backup/pull-dk-backup.sh && tail -1 ~/dk-backup/pull.log                  # 预期：OK …/insight-<时间>.sqlite3
# 3) 备份可用：完整性检查，并抽查表结构
/usr/bin/sqlite3 "$(ls -1t ~/dk-backup/snapshots/insight-*.sqlite3 | head -1)" "PRAGMA integrity_check; SELECT count(*) FROM users;"
```

- 预期：完整性检查输出 `ok`，紧接着是用户数（只看数量，不导出内容）。
- 日常监控：`~/dk-backup/pull.log` 每天一行 `OK`。出现 `FAIL`，或者 `WARN …older than 26h`（服务器备份没跑），就查边缘机的 `systemctl status dk-insight-backup.timer`。
- 恢复演练（建议上线一周内做一次）：把 Mac mini 上的一份备份拷回边缘机临时目录，用 E12-13 的方法打开，确认能用。

## E14 收尾【写·本地】

- 回执写上：release commit `$M`、发布版本号 `$TS`、3 把 Key 的**前缀**、证书到期日、验收表的结果。
- `git worktree remove $REL`（合并结果已经在 main 上）。
- 旧 Key 的后续处理，交给数据中台治理流程（runbook 第 9 步）：
  - `dodk_5f4c678`：对外版本地开发 Key，E4b 对数用完后可以吊销；
  - `dodk_451cfb3`：先请 AIContentStudio 会话确认 Connector 是否还在用。

---

## 回滚

| 触发条件 | 回滚动作 | 影响 |
|---|---|---|
| 前端有问题 | `ssh $H "sudo ln -sfn releases/<上一版> /opt/dk-insight/web/current"` | 只影响 dk |
| 网关有问题 | `app/current` 指回上一版，`sudo systemctl restart dk-insight-api`；首发没有上一版时，`sudo systemctl stop dk-insight-api` | 只影响 dk |
| 数据损坏 | `systemctl stop dk-insight-api` → 用 `/var/lib/dk-insight/backups/` 里最近一份覆盖 `insight.sqlite3`（属主 dk-insight，0640） → 启动 | 丢失备份之后的注册和变更 |
| nginx 有问题或要整体下线 | `sudo rm /etc/nginx/conf.d/dk.dreamotech.cn.conf && sudo nginx -t && sudo systemctl reload nginx` | dk 访问失败，裸域和 www 不受影响 |
| 证书 | `sudo certbot delete --cert-name dk.dreamotech.cn`（**只删 dk 这张**） | — |
| derper hook | `sudo cp -a $B/derper.sh /etc/letsencrypt/renewal-hooks/deploy/derper.sh` | 恢复原样 |
| DNS | 用户在阿里云删除 `dk` 这条记录 | — |
| 上游 Key | `dreamo --env prod api key revoke <前缀> --yes`（3 把分别执行）；账号 `insight-vip/free` 用 `account disable` | 对外版取数全部失败 |
| 合并 | 本地 main 还没 push：`git reset` 需要用户确认；已 push 就 `git revert -m 1 <merge commit>` | — |
