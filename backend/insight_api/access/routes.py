"""认证 / 兑换 / 管理接口。"""
from __future__ import annotations

import hashlib
import time
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from . import security
from .gate import Gate, client_ip
from .service import AccessError, AccessService
from ..tier_routing import PolicyError

REFRESH_COOKIE = "insight_rt"
COOKIE_PATH = "/api/v1/auth"


class RegisterIn(BaseModel):
    username: str
    password: str
    accept_terms: bool = False
    invite_code: Optional[str] = None
    email: Optional[str] = None
    email_code: Optional[str] = None


class RegisterCodeIn(BaseModel):
    email: str


class LoginIn(BaseModel):
    username: str
    password: str


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str


class RedeemIn(BaseModel):
    code: str


class RefreshIn(BaseModel):
    refresh_token: Optional[str] = None


class WechatIn(BaseModel):
    code: str
    accept_terms: bool = False


class WechatBindIn(BaseModel):
    username: str
    password: str


class UserPatchIn(BaseModel):
    base_role: Optional[str] = None
    member_role: Optional[str] = None
    member_expires_at: Optional[float] = None
    disabled: Optional[bool] = None
    clear_member: bool = False


class RoleIn(BaseModel):
    name: Optional[str] = None
    label: str = ""
    permissions: Dict[str, int] = Field(default_factory=dict)


class InviteIn(BaseModel):
    role: str
    duration_days: int = 30
    count: int = 1
    max_uses: int = 1
    expires_at: Optional[float] = None
    note: str = ""


class PlanIn(BaseModel):
    name: str
    role: str
    duration_days: int
    price_cents: int
    listed: bool = False
    sort: int = 0
    note: str = ""


class GrantIn(BaseModel):
    plan_id: Optional[int] = None
    role: Optional[str] = None
    days: Optional[int] = None
    amount_cents: int = 0
    channel: str = ""
    note: str = ""


class CorrectionIn(BaseModel):
    amount_cents: int
    note: str


class ContactIn(BaseModel):
    text: str = ""


class PolicyDraftIn(BaseModel):
    policy: Dict[str, Any]
    reason: str = Field(default="", max_length=500)


class PolicyReasonIn(BaseModel):
    reason: str = Field(default="", max_length=500)


def _day_start(date_str: Optional[str], plus_days: int = 0) -> Optional[float]:
    if not date_str:
        return None
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=ZoneInfo("Asia/Shanghai"))
    except ValueError:
        raise HTTPException(422, "日期格式应为 YYYY-MM-DD")
    return (d + timedelta(days=plus_days)).timestamp()


def _err(e: AccessError) -> HTTPException:
    return HTTPException(e.status, e.detail, headers=e.headers or None)


def build_router(access: AccessService, gate: Gate, settings, policies=None, scope=None) -> APIRouter:
    r = APIRouter(prefix="/api/v1")

    def check_origin(request: Request) -> None:
        origin = request.headers.get("origin")
        if not origin:
            return
        host = request.headers.get("host", "")
        if origin.split("://", 1)[-1] == host or origin in settings.allowed_origins:
            return
        raise HTTPException(403, "来源不被允许")

    def set_cookie(response: Response, request: Request, token: str) -> None:
        secure = settings.env == "production" or request.url.scheme == "https"
        response.set_cookie(REFRESH_COOKIE, token, max_age=security.REFRESH_TTL, httponly=True, secure=secure,
                            samesite="strict", path=COOKIE_PATH)

    def finish_session(response: Response, request: Request, out: Dict[str, Any], client: str) -> Dict[str, Any]:
        if client == "web":
            set_cookie(response, request, out.pop("refresh_token"))
        return out

    # ---------------- 认证 ----------------
    @r.post("/auth/register")
    def register(body: RegisterIn, request: Request):
        check_origin(request)
        ip = client_ip(request)
        ok, wait = gate.limiter.hit(f"reg:{ip}", 10, 3600)
        if not ok:
            raise HTTPException(429, "注册过于频繁", headers={"Retry-After": str(wait)})
        try:
            return access.register(body.username, body.password, body.accept_terms, body.invite_code, ip,
                                   email=body.email, email_code=body.email_code)
        except AccessError as e:
            raise _err(e)

    @r.post("/auth/register/code")
    def register_code(body: RegisterCodeIn, request: Request):
        check_origin(request)
        ip = client_ip(request)
        ok, wait = gate.limiter.hit(f"regcode:{ip}", 10, 3600)
        if not ok:
            raise HTTPException(429, "验证码请求过于频繁", headers={"Retry-After": str(wait)})
        try:
            return access.send_register_code(body.email, ip)
        except AccessError as e:
            raise _err(e)

    @r.post("/auth/login")
    def login(body: LoginIn, request: Request, response: Response):
        check_origin(request)
        try:
            out = access.login(body.username, body.password, client_ip(request), "web")
        except AccessError as e:
            raise _err(e)
        return finish_session(response, request, out, "web")

    @r.post("/auth/refresh")
    def refresh(request: Request, response: Response, body: Optional[RefreshIn] = None):
        check_origin(request)
        token = (body.refresh_token if body else None) or request.cookies.get(REFRESH_COOKIE)
        if not token:
            raise HTTPException(401, "会话已失效，请重新登录")
        try:
            out = access.refresh(token, client_ip(request))
        except AccessError as e:
            raise _err(e)
        client = out["user"]["client"]
        return finish_session(response, request, out, client)

    @r.post("/auth/logout")
    def logout(request: Request, response: Response, body: Optional[RefreshIn] = None):
        token = (body.refresh_token if body else None) or request.cookies.get(REFRESH_COOKIE)
        access.logout(token)
        response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)
        return {"ok": True}

    @r.get("/auth/me")
    def me(request: Request):
        p = gate.principal(request, require_signature=False)
        return access.me_payload(p) if access else {"role": "dev"}

    @r.post("/auth/change-password")
    def change_password(body: ChangePasswordIn, request: Request, response: Response):
        header = request.headers.get("authorization", "")
        p = access.authenticate(header[7:].strip()) if header.lower().startswith("bearer ") else None
        if p is None:
            raise HTTPException(401, "未登录")
        try:
            access.change_password(p.user_id, body.old_password, body.new_password, client_ip(request))
        except AccessError as e:
            raise _err(e)
        response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)
        return {"ok": True, "detail": "密码已修改，请重新登录"}

    @r.post("/invite/redeem")
    def redeem(body: RedeemIn, request: Request):
        p = gate.principal(request, require_signature=True)
        try:
            return access.redeem(p.user_id, body.code, client_ip(request))
        except AccessError as e:
            raise _err(e)

    # ---------------- 微信登录 (小程序) ----------------
    @r.post("/auth/wechat")
    async def wechat_login(body: WechatIn, request: Request):
        ip = client_ip(request)
        openid: Optional[str] = None
        mock = False
        if settings.wechat_appid and settings.wechat_secret:
            try:
                async with httpx.AsyncClient(timeout=8) as c:
                    resp = await c.get("https://api.weixin.qq.com/sns/jscode2session", params={
                        "appid": settings.wechat_appid, "secret": settings.wechat_secret,
                        "js_code": body.code, "grant_type": "authorization_code"})
                data = resp.json()
            except (httpx.HTTPError, ValueError):
                raise HTTPException(502, "微信登录服务暂不可用")
            openid = data.get("openid")
            if not openid:
                raise HTTPException(401, "微信登录失败")
        elif settings.env != "production" and settings.mp_mock_login and body.code.startswith("mock:"):
            openid, mock = f"mock-{body.code[5:]}", True
        else:
            raise HTTPException(503, "微信登录尚未开通")
        user = access.store.q1("SELECT * FROM users WHERE wechat_openid=?", (openid,))
        if user is None:
            if not body.accept_terms:
                raise HTTPException(422, "请先阅读并同意用户协议与隐私政策")
            uname = "wx_" + hashlib.sha256(openid.encode()).hexdigest()[:12]
            uid = access.store.x(
                "INSERT INTO users(username,password_hash,base_role,terms_accepted_at,wechat_openid,created_at)"
                " VALUES(?,?,?,?,?,?)",
                (uname, security.hash_password(security.opaque_token()), "free", time.time(), openid, time.time()))
            user = access.store.q1("SELECT * FROM users WHERE id=?", (uid,))
            access.store.audit(uname, "wechat_register", ip=ip)
        if user["disabled"]:
            raise HTTPException(401, "账号已被禁用")
        try:
            out = access._issue_session(user, "mp", ip)
        except AccessError as e:
            raise _err(e)
        out["mock"] = mock
        return out

    @r.post("/auth/wechat/bind")
    def wechat_bind(body: WechatBindIn, request: Request):
        p = gate.principal(request, require_signature=True)
        if p.client != "mp":
            raise HTTPException(403, "仅小程序会话可绑定")
        ip = client_ip(request)
        try:
            out = access.login(body.username, body.password, ip, "web")  # 复用校验与锁定; 丢弃网页会话
        except AccessError as e:
            raise _err(e)
        web_user = access.store.q1("SELECT * FROM users WHERE username=?", (body.username.lower(),))
        if web_user["wechat_openid"]:
            raise HTTPException(409, "该网页账号已绑定微信")
        mp_user = access.store.q1("SELECT * FROM users WHERE id=?", (p.user_id,))
        with access.store.tx() as c:
            c.execute("UPDATE users SET wechat_openid=NULL WHERE id=?", (mp_user["id"],))
            c.execute("UPDATE users SET wechat_openid=? WHERE id=?", (mp_user["wechat_openid"], web_user["id"]))
            c.execute("UPDATE users SET disabled=1, token_version=token_version+1 WHERE id=? AND base_role='free'",
                      (mp_user["id"],))
            c.execute("UPDATE refresh_tokens SET revoked=1 WHERE user_id=? AND client='web'", (web_user["id"],))
        access.store.audit(body.username, "wechat_bind", ip=ip)
        fresh = access.store.q1("SELECT * FROM users WHERE id=?", (web_user["id"],))
        return access._issue_session(fresh, "mp", ip)

    # ---------------- 管理 ----------------
    def admin(request: Request):
        p = gate.principal(request, require_signature=True)
        if p.client != "web" or not p.can("admin.console"):
            raise HTTPException(403, "无权访问")
        return p

    @r.get("/plans")
    def plans(request: Request):
        gate.principal(request, require_signature=False)
        if not settings.payment_enabled:
            raise HTTPException(403, "会员购买暂未开放")
        return {"items": access.list_plans(listed_only=True), "contact_text": access.plan_contact_text()}

    @r.get("/admin/users")
    def admin_users(request: Request, expiring_within_days: Optional[int] = None):
        admin(request)
        return {"items": access.list_users(expiring_within_days=expiring_within_days)}

    @r.post("/admin/users/{user_id}/grant")
    def admin_grant(user_id: int, body: GrantIn, request: Request):
        p = admin(request)
        # 付费关闭时只允许按角色+天数免费开通（运营补偿/试用延长），不允许记录收款或按套餐开通
        if not settings.payment_enabled and (body.plan_id is not None or body.amount_cents):
            raise HTTPException(403, "付费功能未开放：只能按角色与天数免费开通")
        try:
            return access.grant_membership(user_id, p.username, **body.model_dump())
        except AccessError as e:
            raise _err(e)

    @r.get("/admin/plans")
    def admin_plans(request: Request):
        admin(request)
        return {"items": access.list_plans(), "contact_text": access.plan_contact_text()}

    @r.post("/admin/plans")
    def admin_plan_create(body: PlanIn, request: Request):
        p = admin(request)
        try:
            return {"id": access.save_plan(None, body.model_dump(), p.username), "detail": "新套餐默认未上架"}
        except AccessError as e:
            raise _err(e)

    @r.put("/admin/plans/{plan_id}")
    def admin_plan_update(plan_id: int, body: PlanIn, request: Request):
        p = admin(request)
        try:
            access.save_plan(plan_id, body.model_dump(), p.username)
        except AccessError as e:
            raise _err(e)
        return {"ok": True}

    @r.delete("/admin/plans/{plan_id}")
    def admin_plan_delete(plan_id: int, request: Request):
        p = admin(request)
        try:
            access.delete_plan(plan_id, p.username)
        except AccessError as e:
            raise _err(e)
        return {"ok": True}

    @r.put("/admin/plan-contact")
    def admin_plan_contact(body: ContactIn, request: Request):
        p = admin(request)
        access.set_plan_contact_text(body.text, p.username)
        return {"ok": True}

    @r.get("/admin/grants")
    def admin_grants(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None,
                     source: Optional[str] = None, username: Optional[str] = None):
        admin(request)
        return access.list_grants(_day_start(start_date), _day_start(end_date, 1), source or None, username or None)

    @r.post("/admin/grants/{grant_id}/correction")
    def admin_grant_correction(grant_id: int, body: CorrectionIn, request: Request):
        p = admin(request)
        try:
            access.correct_grant(grant_id, body.amount_cents, body.note, p.username)
        except AccessError as e:
            raise _err(e)
        return {"ok": True}

    @r.patch("/admin/users/{user_id}")
    def admin_user_patch(user_id: int, body: UserPatchIn, request: Request):
        p = admin(request)
        try:
            access.update_user(user_id, p.username, **body.model_dump())
        except AccessError as e:
            raise _err(e)
        return {"ok": True}

    @r.post("/admin/users/{user_id}/reset-password")
    def admin_reset(user_id: int, request: Request):
        p = admin(request)
        try:
            return {"temporary_password": access.reset_password(user_id, p.username),
                    "detail": "临时密码仅此一次显示，用户下次登录必须改密"}
        except AccessError as e:
            raise _err(e)

    @r.get("/admin/roles")
    def admin_roles(request: Request):
        admin(request)
        from .store import ALL_PERMS, NUMERIC_PERMS
        return {"items": access.list_roles(), "all_permissions": ALL_PERMS, "numeric": NUMERIC_PERMS,
                "policy_active": access.policy_roles() is not None}

    @r.post("/admin/roles")
    def admin_role_create(body: RoleIn, request: Request):
        p = admin(request)
        try:
            access.save_role(body.name or "", body.label, body.permissions, p.username, create=True)
        except AccessError as e:
            raise _err(e)
        return {"ok": True}

    @r.put("/admin/roles/{name}")
    def admin_role_update(name: str, body: RoleIn, request: Request):
        p = admin(request)
        try:
            access.save_role(name, body.label, body.permissions, p.username, create=False)
        except AccessError as e:
            raise _err(e)
        return {"ok": True}

    @r.delete("/admin/roles/{name}")
    def admin_role_delete(name: str, request: Request):
        p = admin(request)
        try:
            access.delete_role(name, p.username)
        except AccessError as e:
            raise _err(e)
        return {"ok": True}

    @r.get("/admin/invites")
    def admin_invites(request: Request):
        admin(request)
        return {"items": access.list_invites()}

    @r.post("/admin/invites")
    def admin_invite_create(body: InviteIn, request: Request):
        p = admin(request)
        try:
            codes = access.create_invites(body.role, body.duration_days, body.count, body.max_uses, body.expires_at,
                                          body.note, p.username, p.user_id)
        except AccessError as e:
            raise _err(e)
        return {"codes": codes, "detail": "邀请码明文仅此一次显示，库内只存哈希"}

    @r.post("/admin/invites/{invite_id}/revoke")
    def admin_invite_revoke(invite_id: int, request: Request):
        p = admin(request)
        try:
            access.revoke_invite(invite_id, p.username)
        except AccessError as e:
            raise _err(e)
        return {"ok": True}

    @r.get("/admin/audit")
    def admin_audit(request: Request):
        admin(request)
        return {"items": access.list_audit()}

    @r.get("/admin/redemptions")
    def admin_redemptions(request: Request):
        admin(request)
        return {"items": access.list_redemptions()}

    # ---------------- 角色策略版本 (D7.3) ----------------
    def policy_writer(request: Request):
        """写入只有 admin 能调：既要管理后台权限，又必须是 admin 角色。"""
        p = admin(request)
        if p.role != "admin":
            raise HTTPException(403, "只有管理员可以修改角色策略")
        return p

    def policy_call(fn, *args):
        try:
            return fn(*args)
        except PolicyError as e:
            raise HTTPException(e.status, str(e))

    @r.get("/admin/policy/versions")
    def policy_versions(request: Request):
        admin(request)
        act = policies.active()
        return {"items": policies.list(), "active_version": act["version"] if act else None,
                "requires_second_approver": policies.require_second}

    @r.get("/admin/policy/versions/{version}")
    def policy_version(version: int, request: Request):
        admin(request)
        return policy_call(policies.get, version)

    @r.get("/admin/policy/diff")
    def policy_diff(request: Request, from_version: int, to_version: int):
        admin(request)
        return policy_call(policies.diff_versions, from_version, to_version)

    @r.post("/admin/policy/drafts")
    def policy_submit(body: PolicyDraftIn, request: Request):
        p = policy_writer(request)
        return policy_call(policies.submit, p.username, body.policy, body.reason, client_ip(request))

    @r.get("/admin/policy/catalog")
    def policy_catalog(request: Request):
        """配置页数据：看板 → 模块 → 指标；每个账号的上游上限与不可选指标（置灰原因）；当前生效策略与角色列表。"""
        admin(request)
        from ..indicator_catalog import INDICATORS, catalog_payload
        accounts = {}
        for account in policies.router.known_accounts:
            sc = scope(account) if scope else None
            accounts[account] = {
                "available": sc is not None,
                "blocked": None if sc is None else {
                    i.id: f"{account} 未授权 {'/'.join(next(u for u in i.upstream if u not in sc))}"
                    for i in INDICATORS.values() if any(u not in sc for u in i.upstream)},
            }
        act = policies.active()
        return {"pages": catalog_payload(), "accounts": accounts,
                "roles": [{"name": x["name"], "label": x["label"], "builtin": x["builtin"]} for x in access.list_roles()],
                "active": policies.get(act["version"]) if act else None,
                "requires_second_approver": policies.require_second,
                "limits": {"history_days": [1, 250], "max_sessions": [1, 20], "entries": ["web", "mp"]}}

    @r.post("/admin/policy/drafts/from-legacy")
    def policy_from_legacy(body: PolicyReasonIn, request: Request):
        """迁移第 2 步：由当前 role_permissions 生成完整角色策略草稿（开放看板勾选全部指标）。"""
        p = policy_writer(request)
        from .policy import from_legacy
        current = policies.active_policy()
        if not current:
            raise HTTPException(409, "请先确认路由规则版本")
        routes = current["routes"]
        legacy = {role: access.legacy_role_permissions(role) for role in routes}
        return policy_call(policies.submit, p.username, {"routes": routes, "roles": from_legacy(legacy)},
                           body.reason, client_ip(request))

    @r.post("/admin/policy/versions/{version}/confirm")
    def policy_confirm(version: int, request: Request):
        p = policy_writer(request)
        return policy_call(policies.confirm, p.username, version, client_ip(request))

    @r.post("/admin/policy/versions/{version}/approve")
    def policy_approve(version: int, request: Request):
        p = policy_writer(request)
        return policy_call(policies.approve, p.username, version, client_ip(request))

    @r.post("/admin/policy/versions/{version}/reject")
    def policy_reject(version: int, body: PolicyReasonIn, request: Request):
        p = policy_writer(request)
        return policy_call(policies.reject, p.username, version, body.reason, client_ip(request))

    return r
