"""FastAPI 组合根：`uvicorn insight_api.main:app --host 127.0.0.1 --port 8090`。"""

from __future__ import annotations

import hmac
import logging
from contextlib import asynccontextmanager
from typing import Literal, Optional

import os
import secrets as _secrets

from fastapi import FastAPI, HTTPException, Path, Query, Request
from fastapi.responses import JSONResponse

from .access.gate import Gate
from .access.routes import build_router
from .access.service import AccessService
from .access.store import Store

from . import modules
from .config import load_settings
from .content_scope import CONTENT_SCOPE, DISCLAIMER, ContentGuardViolation, validate_registry
from .upstream import Upstream, UpstreamError

logger = logging.getLogger("insight_api")

DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"
IdxType = Literal["行业板块", "概念板块", "地域板块"]


def create_app() -> FastAPI:
    settings = load_settings()
    validate_registry()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.upstream = Upstream(settings)
        yield
        await app.state.upstream.close()

    docs = settings.env != "production"
    app = FastAPI(title="DreamoQuantSimulation Insight API", version="0.2.0", lifespan=lifespan,
                  docs_url="/api/docs" if docs else None, openapi_url="/api/openapi.json" if docs else None,
                  redoc_url=None)

    # ---- 账号/权限 ----
    access = None
    if settings.auth_mode == "required":
        secrets_list = list(settings.jwt_secrets) or [_secrets.token_urlsafe(48)]
        if not settings.jwt_secrets:
            logger.warning("未配置 INSIGHT_JWT_SECRET，使用进程内随机密钥，重启后全部登录失效 (仅限开发)")
        os.makedirs(os.path.dirname(settings.db_path) or ".", exist_ok=True)
        access = AccessService(Store(settings.db_path), secrets_list, registration=settings.registration)
        if settings.bootstrap_admin_user and settings.bootstrap_admin_password:
            access.bootstrap_admin(settings.bootstrap_admin_user, settings.bootstrap_admin_password)
    gate = Gate(access, auth_off=settings.auth_mode == "off")
    if access:
        app.include_router(build_router(access, gate, settings))
    else:
        @app.get("/api/v1/auth/me")
        async def _dev_me():
            return {"role": "dev", "permissions": ["*"], "history_days": 250, "username": "anonymous-dev"}

    @app.middleware("http")
    async def access_token(request: Request, call_next):
        path = request.url.path
        if settings.access_token and path.startswith("/api/v1/") and path != "/api/v1/health":
            supplied = request.headers.get("authorization", "")
            if not hmac.compare_digest(supplied, f"Bearer {settings.access_token}"):
                return JSONResponse(status_code=401, content={"detail": "未授权"})
        return await call_next(request)

    @app.exception_handler(UpstreamError)
    async def upstream_error(_: Request, exc: UpstreamError):
        logger.warning("upstream_error %s", exc)
        return JSONResponse(status_code=502, content={
            "status": "upstream_error", "data": {}, "detail": "数据服务暂不可用",
            "data_mode": settings.data_mode, "disclaimer": DISCLAIMER,
        })

    @app.exception_handler(ContentGuardViolation)
    async def guard_violation(_: Request, exc: ContentGuardViolation):
        # 守卫命中说明投影有缺陷：失败关闭，只记录日志，不回显任何数据
        logger.error("content_guard_violation %s", exc)
        return JSONResponse(status_code=500, content={"status": "content_guard_violation", "data": {},
                                                      "disclaimer": DISCLAIMER})

    def up(request: Request) -> Upstream:
        return request.app.state.upstream

    TradeDate = Query(None, pattern=DATE_PATTERN, description="交易日 YYYY-MM-DD，缺省为最新")

    @app.get("/api/v1/health")
    async def health():
        return {"status": "ok", "data_mode": settings.data_mode}

    @app.get("/api/v1/meta/content-scope")
    async def content_scope():
        return {"items": CONTENT_SCOPE, "disclaimer": DISCLAIMER}

    def entitled(request: Request, perm: str, trade_date: Optional[str] = None):
        p = gate.require(request, perm)
        gate.check_trade_date(p, trade_date)
        return p

    @app.get("/api/v1/overview")
    async def overview(request: Request, trade_date: Optional[str] = TradeDate):
        p = entitled(request, "page.overview", trade_date)
        return gate.stamp(await modules.overview(up(request), trade_date), p)

    @app.get("/api/v1/participation")
    async def participation(request: Request, trade_date: Optional[str] = TradeDate):
        p = entitled(request, "page.participation", trade_date)
        return gate.stamp(await modules.participation(up(request), trade_date), p)

    @app.get("/api/v1/industries")
    async def industries(request: Request, trade_date: Optional[str] = TradeDate, idx_type: IdxType = "行业板块"):
        p = entitled(request, "page.industries", trade_date)
        return gate.stamp(await modules.industries(up(request), trade_date, idx_type), p)

    @app.get("/api/v1/industries/{sector_code}/series")
    async def industry_series(
        request: Request,
        sector_code: str = Path(..., pattern=r"^[A-Za-z0-9._-]{1,32}$"),
        end_date: Optional[str] = Query(None, pattern=DATE_PATTERN),
        days: int = Query(5, ge=2, le=20),
    ):
        p = entitled(request, "page.industries", end_date)
        if not p.can("data.detail") or p.client == "mp":
            raise HTTPException(403, "板块序列属于下钻明细，需要更高等级")
        return gate.stamp(await modules.industry_series(up(request), sector_code, end_date, min(days, p.history_days)), p)

    @app.get("/api/v1/themes")
    async def themes(request: Request, trade_date: Optional[str] = TradeDate):
        p = entitled(request, "page.themes", trade_date)
        out = await modules.themes(up(request), trade_date)
        data = out.get("data") or {}
        if not p.can("data.detail") or p.client == "mp":
            for t in data.get("themes", []):
                t.pop("seal_time_buckets", None)
            data.pop("seal_time_buckets", None)
            data["detail_locked"] = True
        if data.get("history"):
            data["history"] = data["history"][-p.history_days:]
        return gate.stamp(out, p)

    @app.get("/api/v1/history")
    async def history(
        request: Request,
        trade_date: Optional[str] = TradeDate,
        idx_type: IdxType = "行业板块",
        period: Literal["1d", "5d", "20d"] = "1d",
    ):
        p = entitled(request, "page.history", trade_date)
        return gate.stamp(await modules.history(up(request), trade_date, idx_type, period), p)

    @app.get("/api/v1/calendar")
    async def calendar(request: Request, trade_date: Optional[str] = TradeDate):
        p = entitled(request, "page.calendar", trade_date)
        return gate.stamp(await modules.calendar(up(request), trade_date), p)

    return app


app = create_app()
