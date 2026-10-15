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

REFRESH_COOKIE = "insight_rt"
COOKIE_PATH = "/api/v1/auth"


class RegisterIn(BaseModel):
    username: str
    password: str
    accept_terms: bool = False
    invite_code: Optional[str] = None


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


def _err(e: AccessError) -> HTTPException:
    return HTTPException(e.status, e.detail, headers=e.headers or None)


def build_router(access: AccessService, gate: Gate, settings) -> APIRouter:
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
            return access.register(body.username, body.password, body.accept_terms, body.invite_code, ip)
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

    @r.get("/admin/users")
    def admin_users(request: Request):
        admin(request)
        return {"items": access.list_users()}

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
        return {"items": access.list_roles(), "all_permissions": ALL_PERMS, "numeric": NUMERIC_PERMS}

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

    return r
