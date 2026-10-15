"""数据接口闸门: 鉴权 → 权限 → 签名 → 限流/异常 → 裁剪辅助。"""
from __future__ import annotations

import hashlib
import time
from datetime import date, timedelta
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request

from . import security
from .guard import AnomalyDetector, Blocklist, NonceStore, SlidingLimiter
from .service import AccessError, AccessService, Principal
from .store import ALL_PERMS

USER_PER_MIN, IP_PER_MIN = 120, 300
BLOCK_SECONDS = 15 * 60
# 小程序只展示部分数据: 不含历史复盘、事件日历全量与下钻明细
MP_PAGES = {"page.overview", "page.participation", "page.industries", "page.themes"}


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


class Gate:
    def __init__(self, access: Optional[AccessService], auth_off: bool):
        self.access = access
        self.auth_off = auth_off
        self.limiter = SlidingLimiter()
        self.blocklist = Blocklist()
        self.nonces = NonceStore()
        self.anomaly = AnomalyDetector()

    # ---- 匿名 (开发) ----
    def _anonymous(self) -> Principal:
        perms = {p: 1 for p in ALL_PERMS if p not in ("data.history_days", "max_sessions")}
        perms["data.history_days"] = 250
        return Principal(user_id=0, username="anonymous-dev", role="dev", perms=perms, client="web",
                         session="", sign_key="")

    def principal(self, request: Request, require_signature: bool = True) -> Principal:
        if self.auth_off:
            return self._anonymous()
        header = request.headers.get("authorization", "")
        if not header.lower().startswith("bearer "):
            raise HTTPException(401, "未登录")
        p = self.access.authenticate(header[7:].strip())
        if p is None:
            raise HTTPException(401, "登录已失效，请重新登录")
        if p.must_change_password:
            raise HTTPException(403, "请先修改初始密码")
        if require_signature:
            self._verify_signature(request, p)
        self._throttle(request, p)
        return p

    def _verify_signature(self, request: Request, p: Principal) -> None:
        ts = request.headers.get("x-ts", "")
        nonce = request.headers.get("x-nonce", "")
        sign = request.headers.get("x-sign", "")
        if not (ts and nonce and sign) or len(nonce) < 12:
            raise HTTPException(401, "缺少请求签名")
        try:
            skew = abs(time.time() - float(ts))
        except ValueError:
            raise HTTPException(401, "请求签名无效")
        if skew > security.SIGN_WINDOW:
            raise HTTPException(401, "请求已过期")
        query = "&".join(f"{k}={v}" for k, v in sorted(request.query_params.multi_items()))
        expected = security.request_signature(p.sign_key, request.method, request.url.path, query, ts, nonce)
        if not security.constant_eq(expected, sign):
            raise HTTPException(401, "请求签名无效")
        if self.nonces.seen_before(p.session or str(p.user_id), nonce):
            raise HTTPException(401, "请求重复")

    def _throttle(self, request: Request, p: Principal) -> None:
        ip = client_ip(request)
        user_key = f"user:{p.user_id}"
        left = self.blocklist.remaining(user_key)
        if left:
            raise HTTPException(429, "请求异常，已被临时限制", headers={"Retry-After": str(left)})
        for key, limit in ((user_key, USER_PER_MIN), (f"ip:{ip}", IP_PER_MIN)):
            ok, wait = self.limiter.hit(key, limit, 60)
            if not ok:
                strikes_ok, _ = self.limiter.hit(f"strike:{user_key}", 5, 600)
                if not strikes_ok:
                    self._block(p, ip, "rate_limit_repeated")
                raise HTTPException(429, "请求过于频繁", headers={"Retry-After": str(wait)})
        reason = self.anomaly.observe(user_key, ip, request.query_params.get("trade_date"))
        if reason:
            self._block(p, ip, reason)
            raise HTTPException(429, "请求异常，已被临时限制", headers={"Retry-After": str(BLOCK_SECONDS)})

    def _block(self, p: Principal, ip: str, reason: str) -> None:
        self.blocklist.block(f"user:{p.user_id}", BLOCK_SECONDS)
        if self.access:
            self.access.store.audit(p.username, "temp_block", reason, ip=ip)

    # ---- 权限 ----
    def require(self, request: Request, perm: str, *, signed: bool = True) -> Principal:
        p = self.principal(request, require_signature=signed)
        if p.client == "mp" and perm in {x for x in ALL_PERMS if x.startswith("page.")} and perm not in MP_PAGES:
            raise HTTPException(403, "小程序暂不提供该内容")
        if perm and not p.can(perm):
            raise HTTPException(403, "当前账号权限不足，该内容需要更高等级")
        return p

    # ---- 裁剪 ----
    @staticmethod
    def history_window_start(p: Principal) -> date:
        days = p.history_days
        return date.today() - timedelta(days=int(days * 7 / 5) + 4)

    def check_trade_date(self, p: Principal, trade_date: Optional[str]) -> None:
        if not trade_date or p.role == "dev":
            return
        try:
            d = date.fromisoformat(trade_date)
        except ValueError:
            return
        if d < self.history_window_start(p):
            raise HTTPException(403, f"超出您的历史查看范围（近 {p.history_days} 个交易日）")

    @staticmethod
    def stamp(result: Dict[str, Any], p: Principal) -> Dict[str, Any]:
        """响应溯源标记: 只进元数据, 不改动任何数值。"""
        if p.user_id:
            result["trace"] = hashlib.sha256(f"{p.user_id}|{p.session}".encode()).hexdigest()[:12]
        result["entitlement"] = {"role": p.role, "history_days": p.history_days, "detail": p.can("data.detail")}
        return result
