"""个人 MCP 令牌（不依赖 FastAPI）。

库里只存 sha256（令牌是 256 位随机数，不需要慢哈希）；界面只显示前缀；明文只在创建时返回一次。
令牌绑定创建时的 token_version：改密/管理员重置密码后自动失效，与网页会话一致。
"""
from __future__ import annotations

import hashlib
import json
import secrets
import time
from typing import Any, Dict, List, Optional, Tuple

from ..tier_routing import ROUTE_LOG_RETENTION_DAYS
from .service import AccessError
from .store import Store, sha256

TOKEN_PREFIX = "zsmcp_"
SHOWN_LEN = len(TOKEN_PREFIX) + 6      # 界面与审计里显示的前缀长度
MAX_ACTIVE = 3                         # 每人最多有效令牌数
MAX_EXPIRES_DAYS = 365


def params_hash(args: Dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(args, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]


class McpTokens:
    def __init__(self, store: Store):
        self.store = store
        self._last_cleanup = 0.0

    @staticmethod
    def _status(row, user, now: float) -> str:
        if row["revoked_at"]:
            return "revoked"
        if row["expires_at"] and row["expires_at"] <= now:
            return "expired"
        if row["token_version"] != user["token_version"]:
            return "invalidated"   # 改密后失效
        return "active"

    def list(self, user) -> List[Dict[str, Any]]:
        now = time.time()
        rows = self.store.q("SELECT * FROM mcp_tokens WHERE user_id=? ORDER BY id DESC LIMIT 50", (user["id"],))
        return [{"id": r["id"], "prefix": r["prefix"], "name": r["name"], "created_at": r["created_at"],
                 "expires_at": r["expires_at"], "last_used_at": r["last_used_at"], "revoked_at": r["revoked_at"],
                 "status": self._status(r, user, now)} for r in rows]

    def create(self, user, name: str, expires_days: Optional[int], ip: str) -> Dict[str, Any]:
        name = (name or "").strip()[:32]
        if expires_days is not None and not 1 <= expires_days <= MAX_EXPIRES_DAYS:
            raise AccessError(422, f"有效期为 1–{MAX_EXPIRES_DAYS} 天，或不设")
        token = TOKEN_PREFIX + secrets.token_urlsafe(32)
        now = time.time()
        with self.store.tx() as c:
            rows = c.execute("SELECT * FROM mcp_tokens WHERE user_id=? AND revoked_at IS NULL", (user["id"],)).fetchall()
            if sum(1 for r in rows if self._status(r, user, now) == "active") >= MAX_ACTIVE:
                raise AccessError(409, f"每个账号最多 {MAX_ACTIVE} 把有效令牌，请先吊销不用的")
            cur = c.execute(
                "INSERT INTO mcp_tokens(user_id,token_hash,prefix,name,token_version,created_at,expires_at)"
                " VALUES(?,?,?,?,?,?,?)",
                (user["id"], sha256(token), token[:SHOWN_LEN], name, user["token_version"], now,
                 now + expires_days * 86400 if expires_days else None))
            token_id = cur.lastrowid
        self.store.audit(user["username"], "mcp_token.create", token[:SHOWN_LEN],
                         {"expires_days": expires_days}, ip=ip)
        return {"id": token_id, "token": token, "prefix": token[:SHOWN_LEN], "name": name,
                "expires_at": now + expires_days * 86400 if expires_days else None}

    def revoke(self, user, token_id: int, ip: str) -> None:
        row = self.store.q1("SELECT * FROM mcp_tokens WHERE id=? AND user_id=?", (token_id, user["id"]))
        if not row:
            raise AccessError(404, "令牌不存在")
        if not row["revoked_at"]:
            self.store.x("UPDATE mcp_tokens SET revoked_at=? WHERE id=?", (time.time(), token_id))
            self.store.audit(user["username"], "mcp_token.revoke", row["prefix"], ip=ip)

    def authenticate(self, token: str) -> Tuple[Optional[Any], Optional[Any]]:
        """返回 (令牌行, 用户行)；任何一步不成立都返回 (None, None)，不区分原因，避免探测。"""
        if not token.startswith(TOKEN_PREFIX) or len(token) > 100:
            return None, None
        row = self.store.q1("SELECT * FROM mcp_tokens WHERE token_hash=?", (sha256(token),))
        if not row:
            return None, None
        user = self.store.q1("SELECT * FROM users WHERE id=?", (row["user_id"],))
        now = time.time()
        if not user or self._status(row, user, now) != "active":
            return None, None
        self.store.x("UPDATE mcp_tokens SET last_used_at=? WHERE id=?", (now, row["id"]))
        return row, user

    def log_call(self, request_id: str, user_id: int, prefix: str, role: str, tool: str, args: Dict[str, Any],
                 result: str, latency_ms: int) -> None:
        now = time.time()
        self.store.x("INSERT INTO mcp_call_log(at,request_id,user_id,token_prefix,role_at_request,tool,params_hash,"
                     "result,latency_ms) VALUES(?,?,?,?,?,?,?,?,?)",
                     (now, request_id, user_id, prefix, role, tool, params_hash(args), result, latency_ms))
        # 与 upstream_route_log 同一保留期
        if now - self._last_cleanup > 86400:
            self._last_cleanup = now
            self.store.x("DELETE FROM mcp_call_log WHERE at < ?", (now - ROUTE_LOG_RETENTION_DAYS * 86400,))
