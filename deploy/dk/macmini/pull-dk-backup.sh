#!/bin/bash
# 在家里的 Mac mini 上运行：每天从 dk 服务器拉取用户库 SQLite 备份（只读账号 + rrsync），
# 校验后保留最新 14 份，再整份装进本机 postgres-db 容器里的库 dk_insight_backup（方便查看的副本）。
# 安装见 deploy/dk/macmini/SETUP-ON-MACMINI.md。
set -euo pipefail
SERVER="101.35.245.53"          # dk 服务器地址。服务器迁移后只改这一处
KEEP=14                          # 保留份数，和隐私政策「每日一份，保留 14 份」一致
PG_DB="${PG_DB:-dk_insight_backup}"
BASE="${DK_BACKUP_BASE:-$HOME/dk-backup}"
RSYNC="${RSYNC:-/usr/bin/rsync}"           # 自测时替换
LOADER="${LOADER:-$BASE/load_dk_backup_pg.py}"
DEST="$BASE/snapshots"
KEY="$HOME/.ssh/dk_backup_ed25519"
mkdir -p "$DEST"
chmod 700 "$BASE" "$DEST"
log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >> "$BASE/pull.log"; }

# macOS 自带 openrsync：不能带 -a/-r（会发 --dirs，服务器端 rrsync 拒绝），按文件名通配逐个拉
if ! "$RSYNC" -t -e "ssh -i $KEY -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=15" \
    "dk-backup@$SERVER:insight-*.sqlite3" "$DEST/"; then
  log "FAIL rsync"; exit 1
fi
chmod 600 "$DEST"/insight-*.sqlite3 2>/dev/null || true
latest=$(ls -1 "$DEST"/insight-*.sqlite3 2>/dev/null | sort | tail -1)
if [ -z "$latest" ]; then log "FAIL no backup file"; exit 1; fi
ok=$(/usr/bin/sqlite3 "$latest" "PRAGMA integrity_check;" 2>&1 || true)
if [ "$ok" != "ok" ]; then log "FAIL integrity $latest"; exit 1; fi
# 拉到的最新一份必须在 26 小时内生成（服务器每天 03:30 备份；rsync -t 保留了服务器上的修改时间）
age=$(( $(date +%s) - $(stat -f %m "$latest") ))
if [ "$age" -gt 93600 ]; then log "WARN latest backup is older than 26h: $latest"; fi
# 按文件名只留最新 KEEP 份（文件名带时间，排序即时间顺序）
ls -1 "$DEST"/insight-*.sqlite3 | sort -r | tail -n +$((KEEP + 1)) | while IFS= read -r f; do rm -f "$f"; done
log "OK pull $latest ($(ls -1 "$DEST"/insight-*.sqlite3 | wc -l | tr -d ' ') files kept)"

# 装进 PostgreSQL。失败时记 FAIL、退出码非 0；已拉到的文件保留
if /usr/bin/python3 "$LOADER" "$latest" --db "$PG_DB" >> "$BASE/pull.log" 2>&1; then
  log "OK load $PG_DB"
else
  log "FAIL load $PG_DB"; exit 1
fi
