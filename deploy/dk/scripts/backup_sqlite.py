"""SQLite 在线备份：用标准库 backup API（不依赖 sqlite3 命令行），保留最近 N 份。

用法: backup_sqlite.py <db> <备份目录> <保留份数>
"""
import sqlite3
import sys
from datetime import datetime
from pathlib import Path


def main(db: str, out_dir: str, keep: int) -> None:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    target = out / f"insight-{datetime.now():%Y%m%d-%H%M%S}.sqlite3"
    src = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    dst = sqlite3.connect(target)
    with dst:
        src.backup(dst)
    src.close()
    ok = dst.execute("PRAGMA integrity_check").fetchone()[0]
    dst.close()
    if ok != "ok":
        target.unlink()
        raise SystemExit(f"备份完整性检查失败: {ok}")
    target.chmod(0o600)
    for old in sorted(out.glob("insight-*.sqlite3"))[:-keep]:
        old.unlink()
    print(f"backup ok: {target}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]))
