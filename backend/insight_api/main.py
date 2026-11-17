"""FastAPI 组合根：`uvicorn insight_api.main:app --host 127.0.0.1 --port 8090`。"""

from __future__ import annotations

import hmac
import logging
from contextlib import asynccontextmanager
from typing import Literal, Optional

import os
import secrets as _secrets

from fastapi import FastAPI, HTTPException, Path, Query, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from .access.gate import Gate
from .access.routes import build_router
from .access.service import AccessService
from .access.store import Store

from . import modules, public_modules
from .config import ConfigError, load_settings
from .content_scope import CONTENT_SCOPE, DISCLAIMER, ContentGuardViolation, validate_registry
from .upstream import Upstream, UpstreamError
from .access.policy import UpstreamScope, trim
from .tier_routing import (PolicyService, RequestContext, RouteLog, RouteRejected, TierRouter, end_user_ref,
                           new_request_id, set_context)

logger = logging.getLogger("insight_api")

DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"
IdxType = Literal["行业板块", "概念板块", "地域板块"]


def create_app() -> FastAPI:
    settings = load_settings()
    validate_registry()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.upstream = Upstream(settings, router, RouteLog(store))
        yield
        await app.state.upstream.close()

    docs = settings.env != "production"
    app = FastAPI(title="知数星耀量化平台 数据 API", version="0.2.0", lifespan=lifespan,
                  docs_url="/api/docs" if docs else None, openapi_url="/api/openapi.json" if docs else None,
                  redoc_url=None)

    # 日历等列表接口响应可达数百 KB，启用 gzip 传输压缩
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    # ---- 账号/权限 ----
    access = None
    if settings.auth_mode == "required":
        secrets_list = list(settings.jwt_secrets) or [_secrets.token_urlsafe(48)]
        if not settings.jwt_secrets:
            logger.warning("未配置 INSIGHT_JWT_SECRET，使用进程内随机密钥，重启后全部登录失效 (仅限开发)")
        os.makedirs(os.path.dirname(settings.db_path) or ".", exist_ok=True)
        access = AccessService(Store(settings.db_path), secrets_list, registration=settings.registration,
                               payment_enabled=settings.payment_enabled, trial_role=settings.trial_role,
                               trial_until=settings.trial_until)
        if settings.trial_role and not access.store.q1("SELECT 1 FROM roles WHERE name=?", (settings.trial_role,)):
            raise ConfigError(f"INSIGHT_TRIAL_ROLE 不存在: {settings.trial_role}")
        if settings.bootstrap_admin_user and settings.bootstrap_admin_password:
            access.bootstrap_admin(settings.bootstrap_admin_user, settings.bootstrap_admin_password)
    gate = Gate(access, auth_off=settings.auth_mode == "off")

    # ---- 等级路由 (D7) ----
    store = access.store if access else None
    if not settings.legacy_api_key and settings.data_mode == "live":
        logger.warning("未配置 INSIGHT_UPSTREAM_LEGACY_API_KEY，review-* 暂用 INSIGHT_UPSTREAM_API_KEY（切换前兼容）")
    router = TierRouter(store, dict(settings.account_keys), settings.legacy_api_key or settings.upstream_api_key,
                        require_keys=settings.data_mode == "live",
                        dev_fallback=store is None and settings.env != "production")
    scope = UpstreamScope(settings, dict(settings.account_keys))

    def _policy_activated():
        # 角色策略生效：权限缓存按 role_version 失效
        store.bump_role_version()

    policies = PolicyService(store, router, settings.policy_require_second_approver, scope=scope,
                             on_activate=_policy_activated) if store else None
    if access:
        access.policy_roles = lambda: router.active_roles
    if access:
        app.include_router(build_router(access, gate, settings, policies, scope))
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

    @app.exception_handler(RouteRejected)
    async def route_rejected(_: Request, exc: RouteRejected):
        logger.warning("route_rejected %s", exc)
        return JSONResponse(status_code=403, content={"detail": "当前账号等级暂无数据权限", "disclaimer": DISCLAIMER})

    @app.exception_handler(ContentGuardViolation)
    async def guard_violation(_: Request, exc: ContentGuardViolation):
        # 守卫命中说明投影有缺陷：失败关闭，只记录日志，不回显任何数据
        logger.error("content_guard_violation %s", exc)
        return JSONResponse(status_code=500, content={"status": "content_guard_violation", "data": {},
                                                      "disclaimer": DISCLAIMER})

    def src(page: str):
        """按页切换 (D4)：同一页全部模块走同一条链路。"""
        return public_modules if page in settings.public_pages else modules

    def up(request: Request) -> Upstream:
        return request.app.state.upstream

    TradeDate = Query(None, pattern=DATE_PATTERN, description="交易日 YYYY-MM-DD，缺省为最新")

    @app.get("/api/v1/health")
    async def health():
        version = router.active_version()
        return {"status": "ok", "data_mode": settings.data_mode,
                "route_rule": {"active_version": version, "ok": version is not None}}

    @app.get("/api/v1/meta/trial")
    async def trial():
        # 介绍页未登录可读；只给截止时间，不含其他配置
        return {"until": access.trial_until if access and access.trial_active() else None}

    @app.get("/api/v1/meta/content-scope")
    async def content_scope():
        return {"items": CONTENT_SCOPE, "disclaimer": DISCLAIMER}

    def entitled(request: Request, perm: str, trade_date: Optional[str] = None):
        p = gate.require(request, perm)
        gate.check_trade_date(p, trade_date)
        set_context(RequestContext(request_id=new_request_id(), user_id=p.user_id,
                                   end_user_ref=end_user_ref(store, p.user_id), role=p.role, client=p.client))
        return p

    def out_for(page: str, out, p):
        """D9：按角色 × 看板 × 指标统一裁剪（唯一入口），再打溯源标记。"""
        return gate.stamp(trim(page, out, p.extra.get("indicators")), p)

    @app.get("/api/v1/overview")
    async def overview(request: Request, trade_date: Optional[str] = TradeDate):
        p = entitled(request, "page.overview", trade_date)
        return out_for("overview", await src("overview").overview(up(request), trade_date), p)

    @app.get("/api/v1/participation")
    async def participation(request: Request, trade_date: Optional[str] = TradeDate):
        p = entitled(request, "page.participation", trade_date)
        return out_for("participation", await src("participation").participation(up(request), trade_date), p)

    @app.get("/api/v1/industries")
    async def industries(request: Request, trade_date: Optional[str] = TradeDate, idx_type: IdxType = "行业板块"):
        p = entitled(request, "page.industries", trade_date)
        return out_for("industries", await src("industries").industries(up(request), trade_date, idx_type), p)

    @app.get("/api/v1/industries/{sector_code}/series")
    async def industry_series(
        request: Request,
        sector_code: str = Path(..., pattern=r"^[A-Za-z0-9._-]{1,32}$"),
        end_date: Optional[str] = Query(None, pattern=DATE_PATTERN),
        days: int = Query(5, ge=2, le=20),
    ):
        p = entitled(request, "page.industries", end_date)
        ind = p.extra.get("indicators")
        series_ok = p.can("data.detail") if ind is None else any(i.startswith("industries.series.") for i in ind)
        if not series_ok:
            raise HTTPException(403, "板块序列属于下钻明细，需要更高等级")
        out = await src("industries").industry_series(up(request), sector_code, end_date, min(days, p.history_days))
        return gate.stamp(trim("industries", out, ind, only_module="series"), p)

    @app.get("/api/v1/themes")
    async def themes(request: Request, trade_date: Optional[str] = TradeDate):
        p = entitled(request, "page.themes", trade_date)
        out = await src("themes").themes(up(request), trade_date)
        data = out.get("data") or {}
        ind = p.extra.get("indicators")
        if (not p.can("data.detail")) if ind is None else ("themes.seal_time.seal_time_buckets" not in ind):
            for t in data.get("themes", []):
                t.pop("seal_time_buckets", None)
            data.pop("seal_time_buckets", None)
            data["detail_locked"] = True
        if data.get("history"):
            data["history"] = data["history"][-p.history_days:]
        return out_for("themes", out, p)

    @app.get("/api/v1/history")
    async def history(
        request: Request,
        trade_date: Optional[str] = TradeDate,
        idx_type: IdxType = "行业板块",
        period: Literal["1d", "5d", "20d"] = "1d",
    ):
        p = entitled(request, "page.history", trade_date)
        return out_for("history", await src("history").history(up(request), trade_date, idx_type, period), p)

    @app.get("/api/v1/calendar")
    async def calendar(
        request: Request,
        trade_date: Optional[str] = TradeDate,
        days: int = Query(14, ge=1, le=60, description="自数据日起的前瞻事件天数窗口"),
    ):
        p = entitled(request, "page.calendar", trade_date)
        return out_for("calendar", await src("calendar").calendar(up(request), trade_date, days), p)

    return app


app = create_app()
