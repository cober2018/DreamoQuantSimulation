# 在家里的 Mac mini 上执行：dk 备份每日拉取（DK4）

> 由**用户本人**在 Mac mini 的「终端」里执行。下面每个代码块整块复制、粘贴、回车即可。
> 不需要在 Mac mini 上克隆仓库：脚本和 launchd 配置都直接写在下面。
> 顺序：块 A → 把公钥发给执行人 → 执行人在边缘机完成 E13.1 和 E13.3 → 块 B → 块 C。

## 块 A：生成专用 Key，并显示公钥

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
[ -f ~/.ssh/dk_backup_ed25519 ] || ssh-keygen -t ed25519 -N '' -C 'mac-mini-dk-backup' -f ~/.ssh/dk_backup_ed25519
cat ~/.ssh/dk_backup_ed25519.pub
```

把最后输出的那一行（以 `ssh-ed25519` 开头）发给执行人。这是**公钥**，可以公开；`~/.ssh/dk_backup_ed25519`（不带 .pub 的那个）是私钥，不要发给任何人。

这把 Key 没有口令，因为定时任务需要无人值守运行。边缘机那边把它限制成只能只读拉取备份目录，所以即使泄露，也只能读到备份。

## 块 B：安装拉取脚本和每日定时任务（执行人告诉你边缘机已经配好以后再做）

```bash
mkdir -p ~/dk-backup && chmod 700 ~/dk-backup
cat > ~/dk-backup/pull-dk-backup.sh <<'SCRIPT_EOF'
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
SCRIPT_EOF
chmod 700 ~/dk-backup/pull-dk-backup.sh
cat > ~/dk-backup/cn.dreamotech.dk-backup-pull.plist <<'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- 放到 Mac mini 的 ~/Library/LaunchAgents/，把 __HOME__ 换成实际家目录。每天 04:30 运行（服务器 03:30 备份）。 -->
<plist version="1.0">
<dict>
  <key>Label</key><string>cn.dreamotech.dk-backup-pull</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>__HOME__/dk-backup/pull-dk-backup.sh</string></array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>4</integer><key>Minute</key><integer>30</integer></dict>
  <key>StandardErrorPath</key><string>__HOME__/dk-backup/launchd.err</string>
  <key>RunAtLoad</key><false/>
</dict>
</plist>
PLIST_EOF
sed "s#__HOME__#$HOME#g" ~/dk-backup/cn.dreamotech.dk-backup-pull.plist > ~/Library/LaunchAgents/cn.dreamotech.dk-backup-pull.plist
plutil -lint ~/Library/LaunchAgents/cn.dreamotech.dk-backup-pull.plist
launchctl bootout gui/$(id -u)/cn.dreamotech.dk-backup-pull 2>/dev/null; launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/cn.dreamotech.dk-backup-pull.plist
launchctl print gui/$(id -u)/cn.dreamotech.dk-backup-pull | grep -E 'state|path' | head -3
```

预期：`plutil` 输出 `OK`；最后一条命令能看到任务已加载。每天 04:30 自动运行。

## 块 C：验证（装好后立即执行一次）

```bash
echo '--- 1) 只读限制：下面两条都应该失败'
ssh -i ~/.ssh/dk_backup_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes dk-backup@101.35.245.53 'ls /' ; echo "exit=$?"
rsync -a -e "ssh -i ~/.ssh/dk_backup_ed25519 -o IdentitiesOnly=yes" /etc/hosts dk-backup@101.35.245.53:x ; echo "exit=$?"
echo '--- 2) 手动拉取一次'
bash ~/dk-backup/pull-dk-backup.sh && tail -1 ~/dk-backup/pull.log
echo '--- 3) 备份可用（完整性检查 + 用户数）'
/usr/bin/sqlite3 "$(ls -1t ~/dk-backup/snapshots/insight-*.sqlite3 | head -1)" "PRAGMA integrity_check; SELECT count(*) FROM users;"
```

预期：
1. 两条 `exit=` 都不是 0；
2. 日志最后一行是 `OK …/insight-<时间>.sqlite3 (N files kept)`；
3. 先输出 `ok`，再输出一个数字（用户数）。

把这三段输出发给执行人，写进回执。不要把备份文件本身发出去：里面有用户信息。

## 以后的日常

- 每天看一眼 `tail -3 ~/dk-backup/pull.log`：应该是 `OK`。出现 `FAIL` 或 `WARN … older than 26h` 就通知执行人。
- 建议打开 FileVault（系统设置 → 隐私与安全性），并在「节能」里打开「唤醒以供网络访问」。睡眠时错过的 04:30，launchd 会在唤醒后补跑。
- 停用：`launchctl bootout gui/$(id -u)/cn.dreamotech.dk-backup-pull`。
