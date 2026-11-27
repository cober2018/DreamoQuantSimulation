#!/usr/bin/env python3
"""把 dk 用户库的 SQLite 备份整份装进 Mac mini 上 postgres-db 容器里的一个库（ZS-138）。

只用标准库，Python 3.9 可跑。由 pull-dk-backup.sh 在拉取、校验通过后调用：
  /usr/bin/python3 load_dk_backup_pg.py <备份文件.sqlite3> [--db dk_insight_backup]

- 库不存在就建，每次都执行 REVOKE CONNECT ... FROM PUBLIC（重复执行不报错）。不建角色，不动别的库。
- 整份替换放在一个事务里：先删掉库里 public 下所有表，再按 SQLite 重建并 COPY 写入，
  写 _backup_meta，逐表核对行数，全部通过才提交；任何一步失败都整体回滚，库里保持上一次内容。
- 只打印表名和行数，不打印数据内容。
PostgreSQL 里这份只是方便查看的副本；恢复用拉下来的 SQLite 文件。
"""
import argparse
import hashlib
import os
import re
import sqlite3
import subprocess
import sys

DOCKER = "/usr/local/bin/docker"   # launchd 的 PATH 很短，写绝对路径
CONTAINER = "postgres-db"
DB_RE = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")
META = "_backup_meta"


class LoadError(Exception):
    pass


def pg_type(decl):
    """SQLite 声明类型 → PostgreSQL 类型（按 SQLite 的类型亲和规则取关键字）。"""
    d = (decl or "").upper()
    if "INT" in d:
        return "bigint"
    if "BLOB" in d:
        return "bytea"
    if "REAL" in d or "FLOA" in d or "DOUB" in d:
        return "double precision"
    return "text"   # TEXT、其他、未声明


def qi(name):
    return '"' + name.replace('"', '""') + '"'


def ql(s):
    return "'" + s.replace("'", "''") + "'"


def _esc(s):
    return s.replace("\\", "\\\\").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t")


def copy_value(v, typ, where):
    """一个值 → COPY 文本格式的一格。类型对不上直接失败（错误里只给表、列、行号，不给内容）。"""
    if v is None:
        return "\\N"
    if typ == "bigint":
        if isinstance(v, int) and not isinstance(v, bool):
            return str(v)
    elif typ == "double precision":
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            f = float(v)
            if f != f:
                return "NaN"
            if f in (float("inf"), float("-inf")):
                return "Infinity" if f > 0 else "-Infinity"
            return repr(f)
    elif typ == "bytea":
        if isinstance(v, bytes):
            return "\\\\x" + v.hex()
    else:  # text
        if isinstance(v, str):
            return _esc(v)
        if isinstance(v, (int, float)):
            return _esc(str(v))
    raise LoadError(f"{where}：值的类型是 {type(v).__name__}，放不进 {typ} 列")


def read_sqlite(path):
    """返回 [(表名, [(列名, pg类型)], 行列表)]。只读打开。
    备份文件是 WAL 模式（服务器库开了 WAL，在线备份会带上这个标记），只读打开 WAL 库需要写 -shm 文件，
    会报 unable to open；备份文件不会再变，按 immutable 打开即可，不写任何旁路文件。"""
    con = sqlite3.connect(f"file:{path}?mode=ro&immutable=1", uri=True)
    try:
        names = [r[0] for r in con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        if META in names:
            raise LoadError(f"SQLite 里已有名为 {META} 的表，和元数据表重名")
        out = []
        for t in names:
            cols = [(r[1], pg_type(r[2])) for r in con.execute(f"PRAGMA table_info({qi(t)})")]
            rows = con.execute(f"SELECT {', '.join(qi(c) for c, _ in cols)} FROM {qi(t)}").fetchall()
            out.append((t, cols, rows))
        return out
    finally:
        con.close()


def build_sql(tables, source_name, sha256):
    """生成整份替换的 SQL（含 COPY 数据），在一个事务里执行。"""
    p = ["\\set ON_ERROR_STOP on", "BEGIN;",
         # 删掉库里 public 下现有的所有表：SQLite 里已经没有的表也一起去掉
         "DO $$ DECLARE r record; BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' "
         "LOOP EXECUTE format('DROP TABLE %I CASCADE', r.tablename); END LOOP; END $$;"]
    for t, cols, rows in tables:
        p.append(f"CREATE TABLE {qi(t)} ({', '.join(f'{qi(c)} {typ}' for c, typ in cols)});")
        p.append(f"COPY {qi(t)} ({', '.join(qi(c) for c, _ in cols)}) FROM STDIN;")
        for i, row in enumerate(rows, 1):
            p.append("\t".join(copy_value(v, typ, f"表 {t} 列 {c} 第 {i} 行") for v, (c, typ) in zip(row, cols)))
        p.append("\\.")
    p.append(f"CREATE TABLE {META} (source_file text NOT NULL, sha256 text NOT NULL, "
             "loaded_at timestamptz NOT NULL DEFAULT now(), table_name text NOT NULL, row_count bigint NOT NULL);")
    for t, _, rows in tables:
        p.append(f"INSERT INTO {META} (source_file, sha256, table_name, row_count) "
                 f"VALUES ({ql(source_name)}, {ql(sha256)}, {ql(t)}, {len(rows)});")
    # 逐表核对行数，以及库里的表正好是 SQLite 的表加元数据表；不一致就报错，整个事务回滚
    p.append(
        "DO $$ DECLARE r record; c bigint; BEGIN "
        f"FOR r IN SELECT table_name, row_count FROM {META} LOOP "
        "EXECUTE format('SELECT count(*) FROM %I', r.table_name) INTO c; "
        "IF c <> r.row_count THEN RAISE EXCEPTION 'row count mismatch: % (expected %, got %)', r.table_name, r.row_count, c; END IF; "
        "END LOOP; "
        f"IF (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') <> (SELECT count(*) + 1 FROM {META}) "
        "THEN RAISE EXCEPTION 'table set mismatch'; END IF; END $$;")
    p.append("COMMIT;")
    return "\n".join(p) + "\n"


def psql(db, sql, container=CONTAINER, docker=DOCKER, capture=False):
    """在容器里用容器自己的 POSTGRES_USER 执行 psql，SQL 从标准输入传入。不经手任何密码。"""
    cmd = [docker, "exec", "-i", container, "sh", "-c",
           'exec psql -X -q -t -A -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"', "sh", db]
    r = subprocess.run(cmd, input=sql.encode("utf-8"), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0:
        # 只保留 psql 报错的第一行；COPY 出错时后面几行会带出问题行的内容，不往日志里写
        first = (r.stderr.decode("utf-8", "replace").strip().splitlines() or ["(无输出)"])[0]
        first = re.sub(r'"[^"]*"', '"…"', first)   # 报错里引号中的可能是数据值，去掉
        raise LoadError(f"psql 失败（库 {db}）：{first[:300]}")
    return r.stdout.decode("utf-8", "replace") if capture else ""


def ensure_db(db, container=CONTAINER, docker=DOCKER):
    exists = psql("postgres", f"SELECT 1 FROM pg_database WHERE datname = {ql(db)};", container, docker, capture=True)
    if exists.strip() != "1":
        psql("postgres", f"CREATE DATABASE {qi(db)};", container, docker)
        print(f"已新建库 {db}")
    psql("postgres", f"REVOKE CONNECT ON DATABASE {qi(db)} FROM PUBLIC;", container, docker)


def load(path, db, container=CONTAINER, docker=DOCKER):
    if not DB_RE.match(db):
        raise LoadError(f"库名不合法：{db!r}（只允许小写字母、数字、下划线）")
    if db in ("postgres", "quant", "template0", "template1"):
        raise LoadError(f"不能装进现有的库 {db}")
    with open(path, "rb") as f:
        sha = hashlib.sha256(f.read()).hexdigest()
    tables = read_sqlite(path)
    sql = build_sql(tables, os.path.basename(path), sha)   # 先在本地生成完，类型不符在这里就失败，不碰库
    ensure_db(db, container, docker)
    psql(db, sql, container, docker)
    return tables, sha


def main(argv=None):
    ap = argparse.ArgumentParser(description="把 dk 用户库 SQLite 备份整份装进 PostgreSQL")
    ap.add_argument("sqlite_file")
    ap.add_argument("--db", default="dk_insight_backup", help="目标库名，默认 dk_insight_backup")
    ap.add_argument("--container", default=CONTAINER)
    ap.add_argument("--docker", default=DOCKER)
    a = ap.parse_args(argv)
    try:
        tables, sha = load(a.sqlite_file, a.db, a.container, a.docker)
    except (LoadError, sqlite3.Error, OSError) as e:
        print(f"FAIL load {os.path.basename(a.sqlite_file)} -> {a.db}: {e}", file=sys.stderr)
        return 1
    total = sum(len(r) for _, _, r in tables)
    print(f"OK load {os.path.basename(a.sqlite_file)} -> {a.db}: {len(tables)} 张表，{total} 行，sha256 {sha[:12]}")
    for t, _, rows in tables:
        print(f"  {t}: {len(rows)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
