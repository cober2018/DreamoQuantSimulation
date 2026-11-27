# 在 Mac mini 上安装：dk 用户库每日拉取 + 装进 PostgreSQL（DK4 / ZS-138）

Mac mini 就是中台生产机（开发机上的 ssh 别名 `quantagents-prod`）。它每天 04:30 做三件事：

1. 从 dk 服务器拉取用户库的 SQLite 备份（服务器每天 03:30 生成）。
2. 校验后保留最新 14 份。
3. 把最新一份整份装进本机 `postgres-db` 容器里的库 `dk_insight_backup`。

- **恢复用拉下来的 SQLite 文件**：整个文件拷回服务器就行，见文末「恢复」。
- PostgreSQL 里那份只是方便查看的副本，每天整份替换，只有最新一天。

## 文件

| 文件 | 放到 Mac mini 的位置 | 作用 |
|---|---|---|
| `pull-dk-backup.sh` | `~/dk-backup/pull-dk-backup.sh` | 拉取、完整性检查、保留 14 份、调用装库脚本。服务器地址在顶部的 `SERVER=`，迁移后只改这一处 |
| `load_dk_backup_pg.py` | `~/dk-backup/load_dk_backup_pg.py` | 装库。只用标准库，系统自带的 `/usr/bin/python3`（3.9）就能跑 |
| `cn.dreamotech.dk-backup-pull.plist` | `~/Library/LaunchAgents/`（把 `__HOME__` 换成家目录） | 每天 04:30 运行 |

## 前提（已具备）

- 专用 Key `~/.ssh/dk_backup_ed25519` 已在 Mac mini 上生成（2026-11-18）。服务器端的 `dk-backup` 账号和 rrsync 只读限制已配好。
- `postgres-db` 容器（postgres:16-alpine）在运行。装库脚本通过 `docker exec -i postgres-db sh -c 'psql -U "$POSTGRES_USER" ...'` 进库，用容器自己的环境变量，不经手任何密码。**不要用 `docker inspect`、`env` 把容器的密码打印出来。**
- 不新建角色，也不动现有的 `postgres`、`quant` 库和 `odpquant` 角色。新库会执行 `REVOKE CONNECT ON DATABASE dk_insight_backup FROM PUBLIC`，`odpquant` 这类普通角色连不进去。

## 第 1 步：拷文件（在开发机的仓库根目录执行）

```bash
ssh quantagents-prod 'mkdir -p ~/dk-backup && chmod 700 ~/dk-backup'
scp deploy/dk/macmini/pull-dk-backup.sh deploy/dk/macmini/load_dk_backup_pg.py deploy/dk/macmini/cn.dreamotech.dk-backup-pull.plist quantagents-prod:dk-backup/
ssh quantagents-prod 'chmod 700 ~/dk-backup/pull-dk-backup.sh ~/dk-backup/load_dk_backup_pg.py'
```

## 第 2 步：先用临时库名试一遍（在 Mac mini 上执行）

```bash
PG_DB=dk_tmp_check bash ~/dk-backup/pull-dk-backup.sh; echo "exit=$?"
tail -25 ~/dk-backup/pull.log
ls -1 ~/dk-backup/snapshots/ | tail -3; ls -1 ~/dk-backup/snapshots/ | wc -l
# 逐表行数：PostgreSQL 里的 _backup_meta 应当和 SQLite 一致（装库时已经在事务里核对过一遍，这里再人工看一眼）
docker exec -i postgres-db sh -c 'psql -X -U "$POSTGRES_USER" -d dk_tmp_check -c "SELECT table_name, row_count FROM _backup_meta ORDER BY 1"'
latest=$(ls -1 ~/dk-backup/snapshots/insight-*.sqlite3 | sort | tail -1)
for t in $(/usr/bin/sqlite3 "$latest" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY 1"); do
  printf '%s %s\n' "$t" "$(/usr/bin/sqlite3 "$latest" "SELECT count(*) FROM \"$t\"")"; done
# 普通角色连不进去，应输出 f
docker exec -i postgres-db sh -c 'psql -X -tA -U "$POSTGRES_USER" -d postgres' <<'SQL'
SELECT has_database_privilege('odpquant', 'dk_tmp_check', 'CONNECT');
SQL
# 试完删掉临时库
docker exec -i postgres-db sh -c 'psql -X -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE dk_tmp_check"'
```

预期结果：

- `exit=0`。
- 日志依次是 `OK pull …`、`OK load dk_tmp_check: 19 张表，N 行 …`、各表行数，最后一行 `OK load dk_tmp_check`。
- 快照目录最多 14 份。
- 两边的逐表行数一致。
- 权限查询输出 `f`。

## 第 3 步：正式安装定时任务并跑第一次（在 Mac mini 上执行）

```bash
sed "s#__HOME__#$HOME#g" ~/dk-backup/cn.dreamotech.dk-backup-pull.plist > ~/Library/LaunchAgents/cn.dreamotech.dk-backup-pull.plist
plutil -lint ~/Library/LaunchAgents/cn.dreamotech.dk-backup-pull.plist
launchctl bootout gui/$(id -u)/cn.dreamotech.dk-backup-pull 2>/dev/null; launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/cn.dreamotech.dk-backup-pull.plist
launchctl kickstart -k gui/$(id -u)/cn.dreamotech.dk-backup-pull     # 立即按 launchd 的环境跑一次
sleep 20; tail -25 ~/dk-backup/pull.log; cat ~/dk-backup/launchd.err 2>/dev/null | tail -5
docker exec -i postgres-db sh -c 'psql -X -U "$POSTGRES_USER" -d dk_insight_backup -c "SELECT DISTINCT source_file, loaded_at FROM _backup_meta"'
```

预期结果：

- `plutil` 输出 `OK`。
- 日志最后一行是 `OK load dk_insight_backup`。
- `_backup_meta` 里是最新那份的文件名和刚才的时间。

用 `kickstart` 跑一次，可以确认 launchd 的短 PATH 下 docker 能找到：脚本里写的是绝对路径 `/usr/local/bin/docker`，plist 里也补了 PATH。

## 日常

- 看一眼 `tail -5 ~/dk-backup/pull.log`，最后应当是 `OK load dk_insight_backup`。
- 出现以下几种记录时要处理：
  - `FAIL rsync`：连不上服务器，或者 Key 有问题。
  - `FAIL integrity`：拉到的文件损坏。
  - `FAIL load`：装库失败。已经拉到的 SQLite 文件保留，PostgreSQL 里仍是上一次的内容。
  - `WARN … older than 26h`：服务器那边当天没生成备份。
- 服务器迁移后：只改 `~/dk-backup/pull-dk-backup.sh` 顶部的 `SERVER=`，然后在新服务器上配好 `dk-backup` 账号和 rrsync（Key 不变），再跑一次第 3 步的 `kickstart` 验证。
- 停用：`launchctl bootout gui/$(id -u)/cn.dreamotech.dk-backup-pull`。数据库用 `DROP DATABASE dk_insight_backup` 删除。

## 恢复（用 SQLite 文件，不用 PostgreSQL 那份）

拉下来的每一份都是完整的 SQLite 库文件，整个拷回去就行：

```bash
# 1) 在 Mac mini 上挑一份（一般是最新的），先确认完整
f=$(ls -1 ~/dk-backup/snapshots/insight-*.sqlite3 | sort | tail -1); /usr/bin/sqlite3 "$f" "PRAGMA integrity_check;"   # 应输出 ok
# 2) 拷到服务器的临时目录（用有 sudo 的运维账号，不是 dk-backup）
scp "$f" <运维账号>@<服务器>:/tmp/insight-restore.sqlite3
# 3) 在服务器上：停服务 → 旧库留底 → 换上备份 → 删掉旧库的 -wal/-shm → 恢复属主和权限 → 启服务
sudo systemctl stop dk-insight-api
sudo mv /var/lib/dk-insight/insight.sqlite3 /var/lib/dk-insight/insight.sqlite3.before-restore
sudo rm -f /var/lib/dk-insight/insight.sqlite3-wal /var/lib/dk-insight/insight.sqlite3-shm
sudo install -o dk-insight -g dk-insight -m 0600 /tmp/insight-restore.sqlite3 /var/lib/dk-insight/insight.sqlite3
sudo systemctl start dk-insight-api && curl -s https://dk.dreamotech.cn/api/v1/health
```

恢复后，备份生成时间之后的新注册、改密码、开通记录都会丢失，需要另行补录。确认无误后再删 `.before-restore`。旧库文件的属主和权限以服务器上实际为准；上面的 `-m 0600` 是按服务账号 `dk-insight` 独占来写的。
