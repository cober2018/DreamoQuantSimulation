"""账号/角色/邀请码/会话业务逻辑 (不依赖 FastAPI)。"""
from __future__ import annotations

import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from . import security
from .store import ALL_PERMS, BUILTIN_ROLES, NUMERIC_PERMS, Store, sha256

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.@-]{3,32}$")
LOGIN_FAIL_LIMIT, LOGIN_WINDOW = 5, 15 * 60
REDEEM_FAIL_LIMIT, REDEEM_FREEZE = 5, 30 * 60
REDEEM_USER_PER_HOUR, REDEEM_IP_PER_HOUR = 10, 30
GENERIC_LOGIN_ERROR = "用户名或密码错误"


class AccessError(Exception):
    def __init__(self, status: int, detail: str, headers: Optional[Dict[str, str]] = None):
        super().__init__(detail)
        self.status, self.detail, self.headers = status, detail, headers or {}


@dataclass
class Principal:
    user_id: int
    username: str
    role: str
    perms: Dict[str, int]
    client: str
    session: str
    sign_key: str
    must_change_password: bool = False
    member_expires_at: Optional[float] = None
    extra: Dict[str, Any] = field(default_factory=dict)

    def can(self, perm: str) -> bool:
        return perm in self.perms

    @property
    def history_days(self) -> int:
        return int(self.perms.get("data.history_days", 1))


class AccessService:
    def __init__(self, store: Store, jwt_secrets: List[str], *, registration: str = "open"):
        self.store = store
        self._secrets = jwt_secrets
        self.registration = registration  # open | invite_only
        self._perm_cache: Dict[str, tuple] = {}

    # ------------------------------------------------------------------ 角色/权限
    def role_permissions(self, role: str) -> Dict[str, int]:
        ver = self.store.role_version()
        hit = self._perm_cache.get(role)
        if hit and hit[0] == ver:
            return hit[1]
        rows = self.store.q("SELECT perm,value FROM role_permissions WHERE role=?", (role,))
        perms = {r["perm"]: int(r["value"]) for r in rows}
        self._perm_cache[role] = (ver, perms)
        return perms

    def effective_role(self, user) -> str:
        if user["base_role"] == "admin":
            return "admin"
        if user["member_role"] and user["member_expires_at"] and user["member_expires_at"] > time.time():
            return user["member_role"]
        return user["base_role"]

    def principal_for(self, user, client: str, session: str, sign_key: str) -> Principal:
        role = self.effective_role(user)
        return Principal(
            user_id=user["id"], username=user["username"], role=role, perms=self.role_permissions(role),
            client=client, session=session, sign_key=sign_key,
            must_change_password=bool(user["must_change_password"]),
            member_expires_at=user["member_expires_at"] if role == user["member_role"] else None,
        )

    # ------------------------------------------------------------------ 注册/登录
    def _create_user(self, username: str, password: str, base_role: str = "free", must_change: bool = False,
                     terms: bool = True) -> int:
        return self.store.x(
            "INSERT INTO users(username,password_hash,base_role,must_change_password,terms_accepted_at,created_at)"
            " VALUES(?,?,?,?,?,?)",
            (username.lower(), security.hash_password(password), base_role, int(must_change),
             time.time() if terms else None, time.time()))

    def bootstrap_admin(self, username: str, password: str) -> bool:
        if self.store.q1("SELECT 1 FROM users WHERE base_role='admin' LIMIT 1"):
            return False
        err = security.password_policy_error(password, username)
        if err:
            raise ValueError(f"引导管理员密码不合规: {err}")
        self._create_user(username, password, base_role="admin", must_change=True)
        self.store.audit("system", "bootstrap_admin", username)
        return True

    def register(self, username: str, password: str, accept_terms: bool, invite_code: Optional[str], ip: str) -> Dict[str, Any]:
        if not accept_terms:
            raise AccessError(422, "请先阅读并同意用户协议与隐私政策")
        if not USERNAME_RE.match(username or ""):
            raise AccessError(422, "用户名为 3-32 位字母、数字或 _ . @ -")
        err = security.password_policy_error(password, username)
        if err:
            raise AccessError(422, err)
        if self.registration == "invite_only" and not invite_code:
            raise AccessError(422, "当前仅支持邀请码注册")
        if self.store.q1("SELECT 1 FROM users WHERE username=?", (username.lower(),)):
            raise AccessError(409, "用户名已被使用")
        uid = self._create_user(username, password)
        self.store.audit(username, "register", ip=ip)
        out: Dict[str, Any] = {"user_id": uid}
        if invite_code:
            out["redeemed"] = self.redeem(uid, invite_code, ip)
        return out

    def _login_key(self, username: str, ip: str) -> str:
        return f"{username.lower()}|{ip}"

    def _check_lockout(self, key: str) -> None:
        now = time.time()
        rows = self.store.q("SELECT at FROM login_attempts WHERE key=? AND at>? ORDER BY at", (key, now - LOGIN_WINDOW))
        if len(rows) >= LOGIN_FAIL_LIMIT:
            wait = int(rows[-LOGIN_FAIL_LIMIT]["at"] + LOGIN_WINDOW - now) + 1
            raise AccessError(429, "登录失败次数过多，请稍后再试", {"Retry-After": str(max(wait, 1))})

    def login(self, username: str, password: str, ip: str, client: str = "web") -> Dict[str, Any]:
        key = self._login_key(username, ip)
        self._check_lockout(key)
        user = self.store.q1("SELECT * FROM users WHERE username=?", (username.lower(),))
        ok = bool(user) and security.verify_password(user["password_hash"], password)
        if not ok or user["disabled"]:
            self.store.x("INSERT INTO login_attempts(key,at) VALUES(?,?)", (key, time.time()))
            self.store.audit(username, "login_failed", ip=ip)
            raise AccessError(401, GENERIC_LOGIN_ERROR)
        self.store.x("DELETE FROM login_attempts WHERE key=?", (key,))
        self.store.audit(username, "login", ip=ip, detail={"client": client})
        return self._issue_session(user, client, ip)

    def _issue_session(self, user, client: str, ip: str, rotate_from: Optional[int] = None) -> Dict[str, Any]:
        role = self.effective_role(user)
        perms = self.role_permissions(role)
        if client == "mp" and "client.mp" not in perms:
            raise AccessError(403, "当前角色无权使用小程序")
        if client == "web" and "client.web" not in perms:
            raise AccessError(403, "当前角色无权使用网页端")
        refresh = security.opaque_token()
        sk = security.sign_key()
        session = uuid.uuid4().hex[:16]
        now = time.time()
        with self.store.tx() as c:
            c.execute("INSERT INTO refresh_tokens(user_id,token_hash,client,created_at,expires_at,ip) VALUES(?,?,?,?,?,?)",
                      (user["id"], sha256(refresh), client, now, now + security.REFRESH_TTL, ip))
            max_sessions = int(perms.get("max_sessions", 2))
            active = c.execute(
                "SELECT id FROM refresh_tokens WHERE user_id=? AND used=0 AND revoked=0 AND expires_at>? ORDER BY id DESC",
                (user["id"], now)).fetchall()
            for row in active[max_sessions:]:
                c.execute("UPDATE refresh_tokens SET revoked=1 WHERE id=?", (row["id"],))
        access = security.make_access_token(self._secrets[0], user_id=user["id"], token_version=user["token_version"],
                                            client=client, sk=sk, session=session)
        return {"access_token": access, "expires_in": security.ACCESS_TTL, "refresh_token": refresh,
                "sign_key": sk, "session": session, "user": self.me_payload(self.principal_for(user, client, session, sk))}

    def refresh(self, refresh_token: str, ip: str) -> Dict[str, Any]:
        row = self.store.q1("SELECT * FROM refresh_tokens WHERE token_hash=?", (sha256(refresh_token or ""),))
        if not row or row["revoked"] or row["expires_at"] <= time.time():
            raise AccessError(401, "会话已失效，请重新登录")
        if row["used"]:
            # 已轮换的令牌再次出现: 视为被盗, 吊销该用户全部会话
            self.store.x("UPDATE refresh_tokens SET revoked=1 WHERE user_id=?", (row["user_id"],))
            self.store.audit(str(row["user_id"]), "refresh_reuse_detected", ip=ip)
            raise AccessError(401, "会话已失效，请重新登录")
        user = self.store.q1("SELECT * FROM users WHERE id=?", (row["user_id"],))
        if not user or user["disabled"]:
            raise AccessError(401, "会话已失效，请重新登录")
        self.store.x("UPDATE refresh_tokens SET used=1 WHERE id=?", (row["id"],))
        return self._issue_session(user, row["client"], ip)

    def logout(self, refresh_token: Optional[str]) -> None:
        if refresh_token:
            self.store.x("UPDATE refresh_tokens SET revoked=1 WHERE token_hash=?", (sha256(refresh_token),))

    def authenticate(self, access_token: str) -> Optional[Principal]:
        claims = security.decode_access_token(self._secrets, access_token)
        if not claims:
            return None
        user = self.store.q1("SELECT * FROM users WHERE id=?", (int(claims["sub"]),))
        if not user or user["disabled"] or user["token_version"] != claims.get("tv"):
            return None
        return self.principal_for(user, claims.get("cl", "web"), claims.get("ses", ""), claims.get("sk", ""))

    def change_password(self, user_id: int, old: str, new: str, ip: str) -> None:
        user = self.store.q1("SELECT * FROM users WHERE id=?", (user_id,))
        if not user or not security.verify_password(user["password_hash"], old):
            raise AccessError(401, "原密码错误")
        err = security.password_policy_error(new, user["username"])
        if err:
            raise AccessError(422, err)
        self.store.x("UPDATE users SET password_hash=?, token_version=token_version+1, must_change_password=0 WHERE id=?",
                     (security.hash_password(new), user_id))
        self.store.x("UPDATE refresh_tokens SET revoked=1 WHERE user_id=?", (user_id,))
        self.store.audit(user["username"], "change_password", ip=ip)

    def me_payload(self, p: Principal) -> Dict[str, Any]:
        return {
            "username": p.username, "role": p.role, "role_label": self.role_label(p.role),
            "permissions": sorted(p.perms), "history_days": p.history_days,
            "member_expires_at": p.member_expires_at, "must_change_password": p.must_change_password,
            "client": p.client,
        }

    def role_label(self, role: str) -> str:
        row = self.store.q1("SELECT label FROM roles WHERE name=?", (role,))
        return row["label"] if row else role

    # ------------------------------------------------------------------ 邀请码
    def create_invites(self, role: str, duration_days: int, count: int, max_uses: int,
                       expires_at: Optional[float], note: str, actor: str, actor_id: Optional[int]) -> List[str]:
        if not self.store.q1("SELECT 1 FROM roles WHERE name=?", (role,)):
            raise AccessError(422, "目标角色不存在")
        if role == "admin":
            raise AccessError(422, "邀请码不能授予管理员角色")
        if not (1 <= duration_days <= 3650 and 1 <= count <= 200 and 1 <= max_uses <= 10000):
            raise AccessError(422, "天数/数量/次数超出范围")
        codes = []
        for _ in range(count):
            code = security.new_invite_code()
            self.store.x(
                "INSERT INTO invite_codes(code_hash,code_hint,role,duration_days,max_uses,expires_at,note,created_by,created_at)"
                " VALUES(?,?,?,?,?,?,?,?,?)",
                (sha256(security.normalize_code(code)), code[-4:], role, duration_days, max_uses, expires_at, note,
                 actor_id, time.time()))
            codes.append(code)
        self.store.audit(actor, "invite_create", role, {"count": count, "days": duration_days, "max_uses": max_uses})
        return codes

    def _redeem_guard(self, user_id: int, ip: str) -> None:
        now = time.time()
        freeze = self.store.q(
            "SELECT at FROM redeem_attempts WHERE key=? AND ok=0 AND at>? ORDER BY at", (f"u:{user_id}", now - REDEEM_FREEZE))
        if len(freeze) >= REDEEM_FAIL_LIMIT:
            wait = int(freeze[-REDEEM_FAIL_LIMIT]["at"] + REDEEM_FREEZE - now) + 1
            raise AccessError(429, "兑换失败次数过多，已临时冻结", {"Retry-After": str(max(wait, 1))})
        for key, limit in ((f"u:{user_id}", REDEEM_USER_PER_HOUR), (f"ip:{ip}", REDEEM_IP_PER_HOUR)):
            n = self.store.q1("SELECT COUNT(*) c FROM redeem_attempts WHERE key=? AND at>?", (key, now - 3600))["c"]
            if n >= limit:
                raise AccessError(429, "兑换过于频繁，请稍后再试", {"Retry-After": "3600"})

    def redeem(self, user_id: int, code: str, ip: str) -> Dict[str, Any]:
        self._redeem_guard(user_id, ip)
        now = time.time()

        def fail(msg: str):
            for key in (f"u:{user_id}", f"ip:{ip}"):
                self.store.x("INSERT INTO redeem_attempts(key,at,ok) VALUES(?,?,0)", (key, now))
            raise AccessError(422, msg)

        if not security.code_checksum_ok(code):
            fail("邀请码无效")
        with self.store.tx() as c:
            inv = c.execute("SELECT * FROM invite_codes WHERE code_hash=?",
                            (sha256(security.normalize_code(code)),)).fetchone()
            if not inv or inv["status"] != "active":
                invalid = True
            elif inv["expires_at"] and inv["expires_at"] <= now:
                invalid = True
            elif inv["used_count"] >= inv["max_uses"]:
                invalid = True
            else:
                invalid = False
            if invalid:
                pass
            else:
                user = c.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
                start = now
                if user["member_expires_at"] and user["member_expires_at"] > now and user["member_role"] == inv["role"]:
                    start = user["member_expires_at"]  # 同级续期顺延
                expires = start + inv["duration_days"] * 86400
                # 低于当前有效会员等级的邀请码只延长不降级: 比较角色权限页数
                cur_role = self.effective_role(user)
                new_role = inv["role"]
                if self._rank(cur_role) > self._rank(new_role) and cur_role != "free":
                    new_role = cur_role
                    expires = max(expires, user["member_expires_at"] or 0)
                c.execute("UPDATE users SET member_role=?, member_expires_at=? WHERE id=?", (new_role, expires, user_id))
                c.execute("UPDATE invite_codes SET used_count=used_count+1 WHERE id=?", (inv["id"],))
                c.execute("INSERT INTO redemptions(invite_id,user_id,role,expires_at,at,ip) VALUES(?,?,?,?,?,?)",
                          (inv["id"], user_id, new_role, expires, now, ip))
                c.execute("INSERT INTO redeem_attempts(key,at,ok) VALUES(?,?,1)", (f"u:{user_id}", now))
        if invalid:
            fail("邀请码无效、已过期或已用完")
        self.store.audit(str(user_id), "invite_redeem", new_role, {"expires_at": expires}, ip)
        return {"role": new_role, "role_label": self.role_label(new_role), "member_expires_at": expires}

    def _rank(self, role: str) -> int:
        perms = self.role_permissions(role)
        return sum(1 for p in perms if p.startswith("page.")) * 1000 + perms.get("data.history_days", 0)

    # ------------------------------------------------------------------ 管理
    def list_users(self, limit: int = 200) -> List[Dict[str, Any]]:
        rows = self.store.q("SELECT * FROM users ORDER BY id DESC LIMIT ?", (limit,))
        return [{"id": r["id"], "username": r["username"], "base_role": r["base_role"], "member_role": r["member_role"],
                 "member_expires_at": r["member_expires_at"], "effective_role": self.effective_role(r),
                 "disabled": bool(r["disabled"]), "created_at": r["created_at"],
                 "has_wechat": bool(r["wechat_openid"])} for r in rows]

    def update_user(self, user_id: int, actor: str, *, base_role: Optional[str] = None, member_role: Optional[str] = None,
                    member_expires_at: Optional[float] = None, disabled: Optional[bool] = None,
                    clear_member: bool = False) -> None:
        user = self.store.q1("SELECT * FROM users WHERE id=?", (user_id,))
        if not user:
            raise AccessError(404, "用户不存在")
        for role in (base_role, member_role):
            if role and not self.store.q1("SELECT 1 FROM roles WHERE name=?", (role,)):
                raise AccessError(422, f"角色不存在: {role}")
        if user["base_role"] == "admin" and (base_role not in (None, "admin") or disabled):
            if self.store.q1("SELECT COUNT(*) c FROM users WHERE base_role='admin' AND disabled=0")["c"] <= 1:
                raise AccessError(409, "不能移除或禁用最后一个管理员")
        with self.store.tx() as c:
            if base_role:
                c.execute("UPDATE users SET base_role=? WHERE id=?", (base_role, user_id))
            if clear_member:
                c.execute("UPDATE users SET member_role=NULL, member_expires_at=NULL WHERE id=?", (user_id,))
            if member_role:
                c.execute("UPDATE users SET member_role=? WHERE id=?", (member_role, user_id))
            if member_expires_at is not None:
                c.execute("UPDATE users SET member_expires_at=? WHERE id=?", (member_expires_at, user_id))
            if disabled is not None:
                c.execute("UPDATE users SET disabled=?, token_version=token_version+1 WHERE id=?", (int(disabled), user_id))
                if disabled:
                    c.execute("UPDATE refresh_tokens SET revoked=1 WHERE user_id=?", (user_id,))
        self.store.audit(actor, "user_update", user["username"], {
            "base_role": base_role, "member_role": member_role, "member_expires_at": member_expires_at,
            "disabled": disabled, "clear_member": clear_member})

    def reset_password(self, user_id: int, actor: str) -> str:
        user = self.store.q1("SELECT * FROM users WHERE id=?", (user_id,))
        if not user:
            raise AccessError(404, "用户不存在")
        temp = security.opaque_token()[:14] + "Aa1"
        self.store.x("UPDATE users SET password_hash=?, must_change_password=1, token_version=token_version+1 WHERE id=?",
                     (security.hash_password(temp), user_id))
        self.store.x("UPDATE refresh_tokens SET revoked=1 WHERE user_id=?", (user_id,))
        self.store.audit(actor, "password_reset", user["username"])
        return temp

    def list_roles(self) -> List[Dict[str, Any]]:
        out = []
        for r in self.store.q("SELECT * FROM roles ORDER BY builtin DESC, name"):
            out.append({"name": r["name"], "label": r["label"], "builtin": bool(r["builtin"]),
                        "permissions": self.role_permissions(r["name"])})
        return out

    def _validate_perms(self, perms: Dict[str, int]) -> Dict[str, int]:
        clean: Dict[str, int] = {}
        for perm, val in perms.items():
            if perm not in ALL_PERMS:
                raise AccessError(422, f"未知权限点: {perm}")
            if perm in NUMERIC_PERMS:
                lo, hi = NUMERIC_PERMS[perm]
                if not isinstance(val, int) or not (lo <= val <= hi):
                    raise AccessError(422, f"{perm} 取值范围 {lo}–{hi}")
                clean[perm] = val
            elif val:
                clean[perm] = 1
        return clean

    def save_role(self, name: str, label: str, perms: Dict[str, int], actor: str, create: bool) -> None:
        if not re.match(r"^[a-z][a-z0-9_]{1,31}$", name):
            raise AccessError(422, "角色标识为 2-32 位小写字母/数字/下划线，字母开头")
        exists = self.store.q1("SELECT * FROM roles WHERE name=?", (name,))
        if create and exists:
            raise AccessError(409, "角色已存在")
        if not create and not exists:
            raise AccessError(404, "角色不存在")
        clean = self._validate_perms(perms)
        if name == "admin" and "admin.console" not in clean:
            raise AccessError(409, "管理员角色必须保留 admin.console")
        with self.store.tx() as c:
            if create:
                c.execute("INSERT INTO roles(name,label,builtin) VALUES(?,?,0)", (name, label or name))
            else:
                c.execute("UPDATE roles SET label=? WHERE name=?", (label or exists["label"], name))
            c.execute("DELETE FROM role_permissions WHERE role=?", (name,))
            for perm, val in clean.items():
                c.execute("INSERT INTO role_permissions(role,perm,value) VALUES(?,?,?)", (name, perm, val))
        self.store.bump_role_version()
        self.store.audit(actor, "role_create" if create else "role_update", name, {"permissions": clean})

    def delete_role(self, name: str, actor: str) -> None:
        row = self.store.q1("SELECT * FROM roles WHERE name=?", (name,))
        if not row:
            raise AccessError(404, "角色不存在")
        if row["builtin"]:
            raise AccessError(409, "内置角色不可删除")
        if self.store.q1("SELECT 1 FROM users WHERE base_role=? OR member_role=? LIMIT 1", (name, name)):
            raise AccessError(409, "仍有用户使用该角色")
        with self.store.tx() as c:
            c.execute("DELETE FROM role_permissions WHERE role=?", (name,))
            c.execute("DELETE FROM roles WHERE name=?", (name,))
        self.store.bump_role_version()
        self.store.audit(actor, "role_delete", name)

    def list_invites(self, limit: int = 200) -> List[Dict[str, Any]]:
        rows = self.store.q("SELECT * FROM invite_codes ORDER BY id DESC LIMIT ?", (limit,))
        return [{"id": r["id"], "hint": f"****-****-{r['code_hint']}", "role": r["role"],
                 "duration_days": r["duration_days"], "max_uses": r["max_uses"], "used_count": r["used_count"],
                 "expires_at": r["expires_at"], "status": r["status"], "note": r["note"]} for r in rows]

    def revoke_invite(self, invite_id: int, actor: str) -> None:
        if self.store.x("UPDATE invite_codes SET status='revoked' WHERE id=?", (invite_id,)) == 0:
            raise AccessError(404, "邀请码不存在")
        self.store.audit(actor, "invite_revoke", str(invite_id))

    def list_audit(self, limit: int = 200) -> List[Dict[str, Any]]:
        return [dict(r) for r in self.store.q("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,))]

    def list_redemptions(self, limit: int = 200) -> List[Dict[str, Any]]:
        return [dict(r) for r in self.store.q(
            "SELECT r.*, u.username FROM redemptions r JOIN users u ON u.id=r.user_id ORDER BY r.id DESC LIMIT ?", (limit,))]

    def sweep_expired_memberships(self) -> int:
        """到期会员清理 (读取时已按过期判定，这里只落库整洁)。"""
        return self.store.x("UPDATE users SET member_role=NULL, member_expires_at=NULL "
                            "WHERE member_expires_at IS NOT NULL AND member_expires_at<=?", (time.time(),))
