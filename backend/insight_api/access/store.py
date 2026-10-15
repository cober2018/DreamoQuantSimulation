"""SQLite 仓储 (单节点)。所有 SQL 参数化；密码/邀请码/刷新令牌只存哈希。

仓储方法同步执行 (SQLite 本地文件, 事务极短)；FastAPI 里直接调用即可。
换服务端数据库时只需替换本模块。
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

BUILTIN_ROLES = {
    "free": "免费用户",
    "vip": "VIP",
    "svip": "SVIP",
    "admin": "管理员",
}

PAGE_PERMS = ["page.overview", "page.participation", "page.industries", "page.themes", "page.history", "page.calendar"]
# 数值型权限点: 值是数字; 其余为布尔 (存在即授予)
NUMERIC_PERMS = {"data.history_days": (1, 250), "max_sessions": (1, 20)}
ALL_PERMS = PAGE_PERMS + ["data.detail", "client.web", "client.mp", "admin.console"] + list(NUMERIC_PERMS)

DEFAULT_ROLE_PERMS: Dict[str, Dict[str, int]] = {
    "free": {"page.overview": 1, "page.calendar": 1, "client.web": 1, "client.mp": 1,
             "data.history_days": 5, "max_sessions": 2},
    "vip": {"page.overview": 1, "page.calendar": 1, "page.participation": 1, "page.industries": 1,
            "page.themes": 1, "client.web": 1, "client.mp": 1, "data.history_days": 30, "max_sessions": 2},
    "svip": {**{p: 1 for p in PAGE_PERMS}, "data.detail": 1, "client.web": 1, "client.mp": 1,
             "data.history_days": 250, "max_sessions": 3},
    "admin": {**{p: 1 for p in PAGE_PERMS}, "data.detail": 1, "client.web": 1, "client.mp": 1,
              "admin.console": 1, "data.history_days": 250, "max_sessions": 5},
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  base_role TEXT NOT NULL DEFAULT 'free', member_role TEXT, member_expires_at REAL,
  token_version INTEGER NOT NULL DEFAULT 1, must_change_password INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0, terms_accepted_at REAL, wechat_openid TEXT UNIQUE,
  created_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS roles(name TEXT PRIMARY KEY, label TEXT NOT NULL, builtin INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS role_permissions(role TEXT NOT NULL, perm TEXT NOT NULL, value INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(role, perm));
CREATE TABLE IF NOT EXISTS invite_codes(
  id INTEGER PRIMARY KEY AUTOINCREMENT, code_hash TEXT UNIQUE NOT NULL, code_hint TEXT NOT NULL, role TEXT NOT NULL,
  duration_days INTEGER NOT NULL, max_uses INTEGER NOT NULL, used_count INTEGER NOT NULL DEFAULT 0,
  expires_at REAL, status TEXT NOT NULL DEFAULT 'active', note TEXT, created_by INTEGER, created_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS redemptions(
  id INTEGER PRIMARY KEY AUTOINCREMENT, invite_id INTEGER NOT NULL, user_id INTEGER NOT NULL, role TEXT NOT NULL,
  expires_at REAL NOT NULL, at REAL NOT NULL, ip TEXT);
CREATE TABLE IF NOT EXISTS refresh_tokens(
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token_hash TEXT UNIQUE NOT NULL, client TEXT NOT NULL,
  created_at REAL NOT NULL, expires_at REAL NOT NULL, used INTEGER NOT NULL DEFAULT 0, revoked INTEGER NOT NULL DEFAULT 0,
  ip TEXT);
CREATE TABLE IF NOT EXISTS login_attempts(key TEXT NOT NULL, at REAL NOT NULL);
CREATE INDEX IF NOT EXISTS ix_login_attempts ON login_attempts(key, at);
CREATE TABLE IF NOT EXISTS redeem_attempts(key TEXT NOT NULL, at REAL NOT NULL, ok INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ix_redeem_attempts ON redeem_attempts(key, at);
CREATE TABLE IF NOT EXISTS audit_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT, at REAL NOT NULL, actor TEXT, action TEXT NOT NULL, target TEXT,
  detail TEXT, ip TEXT);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class Store:
    def __init__(self, path: str | Path):
        self._path = str(path)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(self._path, check_same_thread=False, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        with self._lock:
            self._conn.executescript(SCHEMA)
        self._seed()

    # ---- 基础 ----
    @contextmanager
    def tx(self):
        with self._lock:
            self._conn.execute("BEGIN IMMEDIATE")
            try:
                yield self._conn
                self._conn.execute("COMMIT")
            except Exception:
                self._conn.execute("ROLLBACK")
                raise

    def q(self, sql: str, args: Iterable[Any] = ()) -> List[sqlite3.Row]:
        with self._lock:
            return self._conn.execute(sql, tuple(args)).fetchall()

    def q1(self, sql: str, args: Iterable[Any] = ()) -> Optional[sqlite3.Row]:
        rows = self.q(sql, args)
        return rows[0] if rows else None

    def x(self, sql: str, args: Iterable[Any] = ()) -> int:
        with self._lock:
            cur = self._conn.execute(sql, tuple(args))
            return cur.lastrowid or cur.rowcount

    def _seed(self) -> None:
        with self.tx() as c:
            for role, label in BUILTIN_ROLES.items():
                c.execute("INSERT OR IGNORE INTO roles(name,label,builtin) VALUES(?,?,1)", (role, label))
                if c.execute("SELECT COUNT(*) FROM role_permissions WHERE role=?", (role,)).fetchone()[0] == 0:
                    for perm, val in DEFAULT_ROLE_PERMS[role].items():
                        c.execute("INSERT INTO role_permissions(role,perm,value) VALUES(?,?,?)", (role, perm, val))
            c.execute("INSERT OR IGNORE INTO meta(key,value) VALUES('role_version','1')")

    # ---- 权限版本 (角色/权限变更即递增, 缓存据此失效) ----
    def role_version(self) -> int:
        return int(self.q1("SELECT value FROM meta WHERE key='role_version'")["value"])

    def bump_role_version(self) -> None:
        self.x("UPDATE meta SET value=CAST(value AS INTEGER)+1 WHERE key='role_version'")

    # ---- 审计 ----
    def audit(self, actor: Optional[str], action: str, target: Optional[str] = None,
              detail: Optional[Dict[str, Any]] = None, ip: Optional[str] = None) -> None:
        self.x("INSERT INTO audit_log(at,actor,action,target,detail,ip) VALUES(?,?,?,?,?,?)",
               (time.time(), actor, action, target, json.dumps(detail or {}, ensure_ascii=False), ip))
