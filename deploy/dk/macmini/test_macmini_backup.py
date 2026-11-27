#!/usr/bin/env python3
"""ZS-138 自测，本机可跑，不连 Mac mini、不连服务器。运行：/usr/bin/python3 test_macmini_backup.py

- 生成 SQL 部分：不需要 docker。
- 装库部分：本机有 docker 就起一个临时 postgres:16-alpine 容器真跑（结束后删掉），没有就跳过。
- 拉取脚本部分：用假的 rsync 和假的装库脚本跑 pull-dk-backup.sh。
"""
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import load_dk_backup_pg as L  # noqa: E402

DOCKER = shutil.which("docker") or L.DOCKER
TEST_CONTAINER = "zs138-selftest-pg"
TRICKY = ['a,b', 'say "hi"', "it's", 'line1\nline2', 'tab\there', 'back\\slash', '\\N', '中文，含标点。', '\r\n', '', ' ']


def make_db(path, drop_extra=False):
    con = sqlite3.connect(path)
    con.execute("PRAGMA journal_mode=WAL")   # 和服务器上的库、在线备份出来的文件一样是 WAL 模式
    con.executescript('''
      CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, created_at REAL, disabled INTEGER NOT NULL DEFAULT 0, email TEXT);
      CREATE TABLE empty_t (a INTEGER, b TEXT);
      CREATE TABLE texts (id INTEGER, v TEXT);
      CREATE TABLE nums (id INTEGER, big INTEGER, x REAL, untyped);
      CREATE TABLE blobs (id INTEGER, data BLOB);
      CREATE TABLE "odd ""name""" ("col one" TEXT);
    ''')
    con.executemany("INSERT INTO users VALUES (?,?,?,?,?)", [
        (1, "alice", 1764000000.123456, 0, "a@example.com"), (2, "张三", None, 1, None)])
    con.executemany("INSERT INTO texts VALUES (?,?)", list(enumerate(TRICKY)) + [(99, None)])
    con.executemany("INSERT INTO nums VALUES (?,?,?,?)", [
        (1, 2 ** 63 - 1, 0.1, "x"), (2, -2 ** 63, 1e-300, 42), (3, 0, 3, 1.5), (4, None, None, None)])
    con.executemany("INSERT INTO blobs VALUES (?,?)", [(1, b"\x00\x01\xff"), (2, None)])
    con.execute('INSERT INTO "odd ""name""" VALUES (?)', ("ok",))
    if not drop_extra:
        con.execute("CREATE TABLE extra (k TEXT)")
        con.execute("INSERT INTO extra VALUES ('only in first backup')")
    con.commit()
    con.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    con.close()
    for side in ("-wal", "-shm"):   # 和拉下来的备份一样，只有主文件，旁边没有 -wal/-shm
        if os.path.exists(path + side):
            os.remove(path + side)


class SqlGen(unittest.TestCase):
    def test_types(self):
        self.assertEqual([L.pg_type(t) for t in ["INTEGER", "REAL", "TEXT", "", None, "BLOB", "NUMERIC", "VARCHAR(5)"]],
                         ["bigint", "double precision", "text", "text", "text", "bytea", "text", "text"])

    def test_copy_escaping(self):
        self.assertEqual(L.copy_value(None, "text", "w"), "\\N")
        self.assertEqual(L.copy_value("a\tb\nc\\d\re", "text", "w"), "a\\tb\\nc\\\\d\\re")
        self.assertEqual(L.copy_value("\\N", "text", "w"), "\\\\N")        # 字面上的 \N 不会被当成空值
        self.assertEqual(L.copy_value(2 ** 63 - 1, "bigint", "w"), "9223372036854775807")
        self.assertEqual(L.copy_value(3, "double precision", "w"), "3.0")
        self.assertEqual(L.copy_value(0.1, "double precision", "w"), "0.1")
        self.assertEqual(L.copy_value(b"\x00\xff", "bytea", "w"), "\\\\x00ff")
        self.assertEqual(L.copy_value(5, "text", "w"), "5")

    def test_type_mismatch_fails_without_content(self):
        with self.assertRaises(L.LoadError) as cm:
            L.copy_value("secret@example.com", "bigint", "表 users 列 id 第 3 行")
        self.assertIn("表 users 列 id 第 3 行", str(cm.exception))
        self.assertNotIn("secret", str(cm.exception))

    def test_sql_shape(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "insight-20261127-033000.sqlite3"); make_db(p)
            sql = L.build_sql(L.read_sqlite(p), "insight-20261127-033000.sqlite3", "ab" * 32)
        self.assertTrue(sql.startswith("\\set ON_ERROR_STOP on\nBEGIN;\n"))
        self.assertTrue(sql.endswith("COMMIT;\n"))
        self.assertIn('CREATE TABLE "odd ""name""" ("col one" text);', sql)
        self.assertIn('CREATE TABLE "users" ("id" bigint, "username" text, "created_at" double precision, "disabled" bigint, "email" text);', sql)
        self.assertIn("DROP TABLE %I CASCADE", sql)
        self.assertIn("row count mismatch", sql)

    def test_wal_file_without_shm(self):
        # 回归：WAL 模式的备份单独拷过来时，普通只读打开会报 unable to open，必须按 immutable 打开
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "insight-x.sqlite3"); make_db(p)
            self.assertEqual(sorted(os.listdir(d)), ["insight-x.sqlite3"])
            with self.assertRaises(sqlite3.OperationalError):
                sqlite3.connect(f"file:{p}?mode=ro", uri=True).execute("SELECT 1").fetchone()
            self.assertEqual(len(L.read_sqlite(p)), 7)
            self.assertEqual(sorted(os.listdir(d)), ["insight-x.sqlite3"])   # 读的时候也没写旁路文件

    def test_bad_db_names(self):
        for bad in ["postgres", "quant", "Bad", "x;drop", ""]:
            with self.assertRaises(L.LoadError):
                L.load("/nonexistent", bad)


def docker_ok():
    try:
        return subprocess.run([DOCKER, "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20).returncode == 0
    except Exception:
        return False


@unittest.skipUnless(docker_ok(), "本机没有可用的 docker，装库部分未真跑")
class RealPostgres(unittest.TestCase):
    DB = "dk_selftest_backup"

    @classmethod
    def setUpClass(cls):
        subprocess.run([DOCKER, "rm", "-f", TEST_CONTAINER], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # 只在本机起的一次性容器；口令是测试用的固定值，容器结束即删
        subprocess.run([DOCKER, "run", "-d", "--name", TEST_CONTAINER, "-e", "POSTGRES_PASSWORD=selftest-only",
                        "-e", "POSTGRES_USER=postgres", "postgres:16-alpine"], check=True, stdout=subprocess.DEVNULL)
        # 镜像先起一个临时实例做初始化、停掉再正式启动；要等初始化完成的那行日志，否则可能连到正在关闭的临时实例
        for _ in range(90):
            logs = subprocess.run([DOCKER, "logs", TEST_CONTAINER], stdout=subprocess.PIPE, stderr=subprocess.STDOUT).stdout
            if b"PostgreSQL init process complete" in logs and subprocess.run(
                    [DOCKER, "exec", TEST_CONTAINER, "pg_isready", "-U", "postgres"],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
                break
            time.sleep(1)
        cls.q("postgres", "CREATE ROLE odpquant LOGIN; CREATE DATABASE quant;")   # 模拟 Mac mini 上已有的普通角色和库
        cls.tmp = tempfile.mkdtemp()

    @classmethod
    def tearDownClass(cls):
        subprocess.run([DOCKER, "rm", "-f", TEST_CONTAINER], stdout=subprocess.DEVNULL)
        shutil.rmtree(cls.tmp, ignore_errors=True)

    @classmethod
    def q(cls, db, sql):
        return L.psql(db, sql, TEST_CONTAINER, DOCKER, capture=True).strip()

    def load(self, name, drop_extra=False):
        p = os.path.join(self.tmp, name)
        if not os.path.exists(p):
            make_db(p, drop_extra)
        return L.load(p, self.DB, TEST_CONTAINER, DOCKER)

    def test_1_first_load_and_values(self):
        tables, sha = self.load("insight-20261126-033000.sqlite3")
        self.assertEqual(self.q(self.DB, "SELECT count(*) FROM users;"), "2")
        self.assertEqual(self.q(self.DB, "SELECT count(*) FROM empty_t;"), "0")
        for i, v in enumerate(TRICKY):   # 每个特殊文本都原样存进去
            self.assertEqual(self.q(self.DB, f"SELECT count(*) FROM texts WHERE id = {i} AND v = {L.ql(v)};"), "1", repr(v))
        self.assertEqual(self.q(self.DB, "SELECT count(*) FROM texts WHERE id = 99 AND v IS NULL;"), "1")
        self.assertEqual(self.q(self.DB, "SELECT big FROM nums WHERE id = 1;"), str(2 ** 63 - 1))
        self.assertEqual(self.q(self.DB, "SELECT big FROM nums WHERE id = 2;"), str(-2 ** 63))
        self.assertEqual(self.q(self.DB, "SELECT count(*) FROM nums WHERE x = 0.1::float8 AND id = 1;"), "1")
        self.assertEqual(self.q(self.DB, "SELECT count(*) FROM nums WHERE x = 1e-300::float8 AND id = 2;"), "1")
        self.assertEqual(self.q(self.DB, "SELECT untyped FROM nums WHERE id = 3;"), "1.5")
        self.assertEqual(self.q(self.DB, "SELECT count(*) FROM nums WHERE id = 4 AND big IS NULL AND x IS NULL;"), "1")
        self.assertEqual(self.q(self.DB, "SELECT encode(data, 'hex') FROM blobs WHERE id = 1;"), "0001ff")
        self.assertEqual(self.q(self.DB, "SELECT username FROM users WHERE id = 2;"), "张三")
        self.assertEqual(self.q(self.DB, "SELECT created_at FROM users WHERE id = 1;"), "1764000000.123456")  # 时间保持原数值
        self.assertEqual(self.q(self.DB, 'SELECT "col one" FROM "odd ""name""";'), "ok")
        self.assertEqual(self.q(self.DB, "SELECT format_type(atttypid, -1) FROM pg_attribute WHERE attrelid = 'users'::regclass AND attname = 'created_at';"), "double precision")
        meta = self.q(self.DB, "SELECT DISTINCT source_file || ' ' || sha256 FROM _backup_meta;")
        self.assertEqual(meta, f"insight-20261126-033000.sqlite3 {sha}")
        self.assertEqual(self.q(self.DB, "SELECT row_count FROM _backup_meta WHERE table_name = 'texts';"), str(len(TRICKY) + 1))

    def test_2_public_cannot_connect(self):
        self.load("insight-20261126-033000.sqlite3")
        self.assertEqual(self.q("postgres", f"SELECT has_database_privilege('odpquant', '{self.DB}', 'CONNECT');"), "f")
        self.assertEqual(self.q("postgres", "SELECT has_database_privilege('odpquant', 'quant', 'CONNECT');"), "t")  # 别的库不受影响

    def test_3_repeat_and_dropped_table(self):
        self.load("insight-20261126-033000.sqlite3")
        self.load("insight-20261126-033000.sqlite3")                          # 重复执行不报错
        self.assertEqual(self.q(self.DB, "SELECT count(*) FROM users;"), "2")
        self.assertEqual(self.q(self.DB, "SELECT count(*) FROM pg_tables WHERE tablename = 'extra';"), "1")
        self.load("insight-20261127-033000.sqlite3", drop_extra=True)         # 新备份里没有 extra 表
        self.assertEqual(self.q(self.DB, "SELECT count(*) FROM pg_tables WHERE tablename = 'extra';"), "0")
        self.assertEqual(self.q(self.DB, "SELECT DISTINCT source_file FROM _backup_meta;"), "insight-20261127-033000.sqlite3")

    def test_4_failure_rolls_back(self):
        self.load("insight-20261126-033000.sqlite3")
        p = os.path.join(self.tmp, "insight-20261128-033000.sqlite3")
        make_db(p, drop_extra=True)
        sql = L.build_sql(L.read_sqlite(p), os.path.basename(p), "cd" * 32)
        # 把元数据里 users 的行数改错，模拟装完后核对不一致
        bad = sql.replace("'users', 2);", "'users', 3);")
        self.assertNotEqual(bad, sql)
        with self.assertRaises(L.LoadError) as cm:
            L.psql(self.DB, bad, TEST_CONTAINER, DOCKER)
        self.assertIn("row count mismatch", str(cm.exception))
        # 库里仍是上一次的内容：extra 表还在，来源文件没变
        self.assertEqual(self.q(self.DB, "SELECT count(*) FROM pg_tables WHERE tablename = 'extra';"), "1")
        self.assertEqual(self.q(self.DB, "SELECT DISTINCT source_file FROM _backup_meta;"), "insight-20261126-033000.sqlite3")

    def test_5_type_mismatch_does_not_touch_db(self):
        self.load("insight-20261126-033000.sqlite3")
        p = os.path.join(self.tmp, "insight-bad.sqlite3")
        make_db(p)
        con = sqlite3.connect(p); con.execute("INSERT INTO users VALUES (3, 'x', 'not-a-number-secret', 0, NULL)"); con.commit(); con.close()
        rc = L.main([p, "--db", self.DB, "--container", TEST_CONTAINER, "--docker", DOCKER])
        self.assertEqual(rc, 1)
        self.assertEqual(self.q(self.DB, "SELECT DISTINCT source_file FROM _backup_meta;"), "insight-20261126-033000.sqlite3")


class PullScript(unittest.TestCase):
    def setUp(self):
        self.d = Path(tempfile.mkdtemp())
        self.src, self.base, self.bin = self.d / "server", self.d / "home" / "dk-backup", self.d / "bin"
        for x in (self.src, self.base, self.bin):
            x.mkdir(parents=True)
        for i in range(1, 17):   # 服务器上有 16 份
            make_db(str(self.src / f"insight-202611{i:02d}-033000.sqlite3"), drop_extra=True)
        (self.bin / "rsync").write_text('#!/bin/bash\n[ -n "$FAKE_RSYNC_FAIL" ] && exit 23\n'
                                        'echo "$@" > "$FAKE_ARGS"\ncp -p "$FAKE_SRC"/insight-*.sqlite3 "${@: -1}"\n')
        (self.bin / "rsync").chmod(0o755)
        (self.bin / "loader.py").write_text('import os, sys\nopen(os.environ["FAKE_LOADED"], "w").write(" ".join(sys.argv[1:]))\n'
                                            'sys.exit(int(os.environ.get("FAKE_LOAD_RC", "0")))\n')

    def tearDown(self):
        shutil.rmtree(self.d, ignore_errors=True)

    def run_pull(self, **extra):
        env = dict(os.environ, DK_BACKUP_BASE=str(self.base), RSYNC=str(self.bin / "rsync"), LOADER=str(self.bin / "loader.py"),
                   FAKE_SRC=str(self.src), FAKE_ARGS=str(self.d / "args"), FAKE_LOADED=str(self.d / "loaded"), **extra)
        r = subprocess.run(["/bin/bash", str(HERE / "pull-dk-backup.sh")], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return r.returncode, (self.base / "pull.log").read_text() if (self.base / "pull.log").exists() else ""

    def snaps(self):
        return sorted(p.name for p in (self.base / "snapshots").glob("insight-*.sqlite3"))

    def test_ok_keeps_14_and_loads_latest(self):
        rc, log = self.run_pull()
        self.assertEqual(rc, 0, log)
        s = self.snaps()
        self.assertEqual(len(s), 14)
        self.assertEqual(s[0], "insight-20261103-033000.sqlite3")      # 最旧的两份被删
        self.assertEqual(s[-1], "insight-20261116-033000.sqlite3")
        args = (self.d / "args").read_text()
        self.assertIn("-t -e ssh -i", args)
        self.assertNotIn(" -a ", " " + args)
        self.assertIn("dk-backup@101.35.245.53:insight-*.sqlite3", args)
        self.assertEqual((self.d / "loaded").read_text(),
                         f"{self.base}/snapshots/insight-20261116-033000.sqlite3 --db dk_insight_backup")
        self.assertIn("OK pull", log); self.assertIn("OK load dk_insight_backup", log)
        self.assertNotIn("WARN", log)
        self.assertEqual(oct((self.base / "snapshots" / s[-1]).stat().st_mode & 0o777), "0o600")

    def test_stale_backup_warns(self):
        old = time.time() - 3 * 86400   # 服务器上最新一份是 3 天前的
        for f in self.src.iterdir():
            os.utime(f, (old, old))
        rc, log = self.run_pull()
        self.assertEqual(rc, 0, log)
        self.assertIn("WARN latest backup is older than 26h", log)

    def test_load_failure_keeps_files(self):
        rc, log = self.run_pull(FAKE_LOAD_RC="1", PG_DB="dk_tmp_check")
        self.assertNotEqual(rc, 0)
        self.assertIn("FAIL load dk_tmp_check", log)
        self.assertEqual(len(self.snaps()), 14)

    def test_rsync_failure(self):
        rc, log = self.run_pull(FAKE_RSYNC_FAIL="1")
        self.assertNotEqual(rc, 0); self.assertIn("FAIL rsync", log)
        self.assertFalse((self.d / "loaded").exists())

    def test_corrupt_latest(self):
        (self.src / "insight-20261199-033000.sqlite3").write_bytes(b"not a sqlite file" * 100)
        rc, log = self.run_pull()
        self.assertNotEqual(rc, 0); self.assertIn("FAIL integrity", log)
        self.assertFalse((self.d / "loaded").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
