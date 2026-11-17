#!/bin/bash
# 在家里的 Mac mini 上运行：每天从边缘机拉取 dk 的 SQLite 备份（只读账号 + rrsync），校验后保留 30 天。
# 安装见 deploy/dk/RUNBOOK-EXECUTE.md E13。
set -euo pipefail
BASE="$HOME/dk-backup"
DEST="$BASE/snapshots"
KEY="$HOME/.ssh/dk_backup_ed25519"
REMOTE="dk-backup@101.35.245.53"
KEEP_DAYS=30
mkdir -p "$DEST"
chmod 700 "$BASE" "$DEST"
log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >> "$BASE/pull.log"; }

# rrsync 把根目录限制在 /var/lib/dk-insight/backups，所以远端路径写成「:」（即受限根目录）
if ! rsync -a --chmod=F600 -e "ssh -i $KEY -o BatchMode=yes -o IdentitiesOnly=yes" "$REMOTE:" "$DEST/"; then
  log "FAIL rsync"; exit 1
fi
latest=$(ls -1t "$DEST"/insight-*.sqlite3 2>/dev/null | head -1)
if [ -z "$latest" ]; then log "FAIL no backup file"; exit 1; fi
# 拉到的最新一份必须在 26 小时内生成（服务器每天 03:30 备份）
age=$(( $(date +%s) - $(stat -f %m "$latest") ))
ok=$(/usr/bin/sqlite3 "$latest" "PRAGMA integrity_check;")
if [ "$ok" != "ok" ]; then log "FAIL integrity $latest: $ok"; exit 1; fi
if [ "$age" -gt 93600 ]; then log "WARN latest backup is older than 26h: $latest"; fi
find "$DEST" -name 'insight-*.sqlite3' -mtime +$KEEP_DAYS -delete
log "OK $latest ($(ls -1 "$DEST"/insight-*.sqlite3 | wc -l | tr -d ' ') files kept)"
