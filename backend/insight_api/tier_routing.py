"""等级路由（openspec govern-upstream-via-public-services-v1 D7）。

每次请求 public-* 时按用户当前等级选投研平台等级账号的 Key；认不出的等级一律拒绝，不回退默认账号。
过渡期 review-* 不经路由，使用旧 Key。Key 只来自环境变量，不进数据库、日志与响应。
"""

from __future__ import annotations

import contextvars
import json
import re
import secrets
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

ROUTE_LOG_RETENTION_DAYS = 180
_ACCOUNT_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,39}$")
LEGACY_ACCOUNT = "legacy"


class RouteRejected(RuntimeError):
    """等级认不出、没有生效规则或账号无 Key：拒绝，不发上游请求。"""


class PolicyError(RuntimeError):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


@dataclass
class RequestContext:
    request_id: str
    user_id: int
    end_user_ref: str
    role: str
    client: str


_current: contextvars.ContextVar[Optional[RequestContext]] = contextvars.ContextVar("insight_request_ctx", default=None)


def set_context(ctx: Optional[RequestContext]) -> None:
    _current.set(ctx)


def current_context() -> Optional[RequestContext]:
    return _current.get()


def new_request_id() -> str:
    return uuid.uuid4().hex


def account_keys(primary_key: str, environ: Dict[str, str]) -> Dict[str, str]:
    """账号名 → Key。`insight-svip` 用 INSIGHT_UPSTREAM_API_KEY；将来 `insight-<x>` 用 INSIGHT_UPSTREAM_API_KEY_<X>。"""
    keys = {"insight-svip": primary_key}
    prefix = "INSIGHT_UPSTREAM_API_KEY_"
    for name, value in environ.items():
        if name.startswith(prefix) and value:
            suffix = name[len(prefix):].lower().replace("_", "-")
            if suffix and _ACCOUNT_RE.match(f"insight-{suffix}"):
                keys[f"insight-{suffix}"] = value
    return keys


class TierRouter:
    """持有当前生效的路由规则（进程内缓存，生效时刷新）。无库时（开发态关闭鉴权）只认 dev。"""

    def __init__(self, store, keys: Dict[str, str], legacy_key: str, require_keys: bool,
                 dev_fallback: bool = False):
        self.store = store
        self._keys = keys
        self._legacy_key = legacy_key
        self._require_keys = require_keys
        self._dev_fallback = dev_fallback
        self._active: Optional[Tuple[int, Dict[str, str]]] = None
        self.reload()

    @property
    def known_accounts(self) -> List[str]:
        return sorted(self._keys)

    def reload(self) -> None:
        self.active_roles = None
        if self.store is None:
            self._active = (0, {"dev": "insight-svip"}) if self._dev_fallback else None
            return
        row = self.store.q1("SELECT version, policy FROM role_policy_versions WHERE status='active'")
        policy = json.loads(row["policy"]) if row else {}
        self._active = (row["version"], policy.get("routes", {})) if row else None
        self.active_roles: Optional[Dict[str, Any]] = policy.get("roles")

    def active_version(self) -> Optional[int]:
        return self._active[0] if self._active else None

    def resolve(self, service_key: str, ctx: Optional[RequestContext]) -> Tuple[str, str, Optional[int]]:
        """返回 (key, account, rule_version)。"""
        if not service_key.startswith("public-"):
            return self._legacy_key, LEGACY_ACCOUNT, None
        if ctx is None:
            raise RouteRejected("缺少请求上下文")
        if self._active is None:
            raise RouteRejected("没有生效的路由规则")
        version, routes = self._active
        account = routes.get(ctx.role)
        if not account:
            raise RouteRejected(f"等级 {ctx.role} 未登记路由")
        key = self._keys.get(account, "")
        if self._require_keys and not key:
            raise RouteRejected(f"账号 {account} 未配置 Key")
        return key, account, version


class RouteLog:
    """每次上游服务/视图访问一条（含缓存命中）；保留 180 天，每天清理一次。"""

    def __init__(self, store):
        self.store = store
        self._last_cleanup = 0.0

    def write(self, ctx: Optional[RequestContext], service_key: str, view: Optional[str], account: Optional[str],
              rule_version: Optional[int], cache_hit: bool, result: str, upstream_status: Optional[int],
              latency_ms: Optional[int]) -> None:
        if self.store is None or ctx is None:
            return
        now = time.time()
        self.store.x(
            "INSERT INTO upstream_route_log(at,request_id,user_id,end_user_ref,role_at_request,account,rule_version,"
            "client,service_key,view,cache_hit,result,upstream_status,latency_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (now, ctx.request_id, ctx.user_id, ctx.end_user_ref, ctx.role, account, rule_version, ctx.client,
             service_key, view, 1 if cache_hit else 0, result, upstream_status, latency_ms))
        if now - self._last_cleanup > 86400:
            self._last_cleanup = now
            self.store.x("DELETE FROM upstream_route_log WHERE at < ?", (now - ROUTE_LOG_RETENTION_DAYS * 86400,))


def end_user_ref(store, user_id: int) -> str:
    """不透明匿名编号：首次生成 128 位随机数，之后固定；映射只存在本平台。"""
    if store is None or not user_id:
        return "dev-anonymous"
    row = store.q1("SELECT ref FROM end_user_refs WHERE user_id=?", (user_id,))
    if row:
        return row["ref"]
    ref = secrets.token_hex(16)
    store.x("INSERT OR IGNORE INTO end_user_refs(user_id, ref, created_at) VALUES(?,?,?)", (user_id, ref, time.time()))
    return store.q1("SELECT ref FROM end_user_refs WHERE user_id=?", (user_id,))["ref"]


def audit_headers(ctx: Optional[RequestContext], rule_version: Optional[int]) -> Dict[str, str]:
    if ctx is None:
        return {}
    return {"X-End-User-Ref": ctx.end_user_ref, "X-Client-Entry": ctx.client, "X-Request-Id": ctx.request_id,
            "X-Route-Rule-Version": str(rule_version) if rule_version is not None else LEGACY_ACCOUNT}


class PolicyService:
    """角色策略版本：提交（返回差异）→ 二次确认生效；开关打开时须他人审批，禁止自审。
    策略含 routes（D7 路由）与可选的 roles（D9 看板 × 指标权限）。"""

    def __init__(self, store, router: TierRouter, require_second_approver: bool, scope=None, on_activate=None):
        self.store = store
        self.router = router
        self.require_second = require_second_approver
        self.scope = scope or (lambda account: None)
        self._on_activate = on_activate

    # ---- 查询 ----
    def _row(self, version: int):
        row = self.store.q1("SELECT * FROM role_policy_versions WHERE version=?", (version,))
        if not row:
            raise PolicyError(404, "版本不存在")
        return row

    @staticmethod
    def _out(row) -> Dict[str, Any]:
        d = dict(row)
        d["policy"] = json.loads(d["policy"])
        return d

    def active(self):
        return self.store.q1("SELECT * FROM role_policy_versions WHERE status='active'")

    def list(self) -> List[Dict[str, Any]]:
        return [self._out(r) for r in self.store.q("SELECT * FROM role_policy_versions ORDER BY version DESC")]

    def get(self, version: int) -> Dict[str, Any]:
        return self._out(self._row(version))

    @staticmethod
    def diff(before: Optional[Dict[str, Any]], after: Dict[str, Any]) -> Dict[str, Any]:
        from .access.policy import diff_roles
        b, a = (before or {}).get("routes", {}), after.get("routes", {})
        out = {"routes": {
            "added": {r: a[r] for r in sorted(set(a) - set(b))},
            "removed": {r: b[r] for r in sorted(set(b) - set(a))},
            "changed": {r: {"before": b[r], "after": a[r]} for r in sorted(set(a) & set(b)) if a[r] != b[r]},
        }}
        if "roles" in (before or {}) or "roles" in after:
            out["roles"] = diff_roles((before or {}).get("roles"), after.get("roles"))
        return out

    def diff_versions(self, from_version: int, to_version: int) -> Dict[str, Any]:
        return self.diff(self.get(from_version)["policy"], self.get(to_version)["policy"])

    # ---- 校验 ----
    def _validate(self, policy: Any) -> Dict[str, Any]:
        if (not isinstance(policy, dict) or set(policy) - {"routes", "roles"} or "routes" not in policy
                or not isinstance(policy["routes"], dict)):
            raise PolicyError(422, "策略格式应为 {\"routes\": {角色: 账号}, \"roles\": {角色: 权限}}")
        roles = {r["name"] for r in self.store.q("SELECT name FROM roles")}
        routes = policy["routes"]
        unknown = sorted(set(routes) - roles)
        if unknown:
            raise PolicyError(422, f"未知角色: {', '.join(unknown)}")
        known = set(self.router.known_accounts)
        for role, account in routes.items():
            if not isinstance(account, str) or not _ACCOUNT_RE.match(account) or account not in known:
                raise PolicyError(422, f"角色 {role} 的账号无效: {account}")
        if "admin" not in routes:
            raise PolicyError(422, "不能生成让 admin 失去路由账号的版本")
        out: Dict[str, Any] = {"routes": dict(sorted(routes.items()))}
        if "roles" in policy:
            from .access.policy import PolicyInvalid, validate_roles
            try:
                out["roles"] = validate_roles(policy["roles"], routes, roles, self.scope)
            except PolicyInvalid as e:
                raise PolicyError(e.status, str(e)) from None
        return out

    def active_policy(self) -> Optional[Dict[str, Any]]:
        act = self.active()
        return json.loads(act["policy"]) if act else None

    @staticmethod
    def _reason(reason: Optional[str]) -> str:
        reason = (reason or "").strip()
        if not reason:
            raise PolicyError(422, "原因必填")
        if len(reason) > 500:
            raise PolicyError(422, "原因不能超过 500 字")
        return reason

    def _audit(self, actor: str, action: str, version: int, before, after, reason: str, ip: Optional[str]) -> None:
        self.store.audit(actor, f"role_policy.{action}", str(version),
                         {"version": version, "before": before, "after": after, "reason": reason}, ip=ip)

    def _snapshot(self, row) -> Optional[Dict[str, Any]]:
        return {"version": row["version"], "policy": json.loads(row["policy"])} if row else None

    # ---- 写入 ----
    def submit(self, actor: str, policy: Any, reason: Optional[str], ip: Optional[str] = None) -> Dict[str, Any]:
        reason = self._reason(reason)
        policy = self._validate(policy)
        act = self.active()
        before = json.loads(act["policy"]) if act else None
        with self.store.tx() as c:
            version = (c.execute("SELECT COALESCE(MAX(version),0)+1 FROM role_policy_versions").fetchone()[0])
            c.execute("INSERT INTO role_policy_versions(version,policy,status,reason,created_by,created_at,based_on) "
                      "VALUES(?,?,'draft',?,?,?,?)",
                      (version, json.dumps(policy, ensure_ascii=False), reason, actor, time.time(),
                       act["version"] if act else None))
        self._audit(actor, "submit", version, self._snapshot(act), {"version": version, "policy": policy}, reason, ip)
        return {"version": version, "status": "draft", "based_on": act["version"] if act else None,
                "diff": self.diff(before, policy), "requires_second_approver": self.require_second}

    def confirm(self, actor: str, version: int, ip: Optional[str] = None) -> Dict[str, Any]:
        row = self._row(version)
        if row["status"] != "draft":
            raise PolicyError(409, "只能确认草稿")
        if row["created_by"] != actor:
            raise PolicyError(403, "只能确认自己提交的草稿")
        self._check_fresh(row)
        if self.require_second:
            self.store.x("UPDATE role_policy_versions SET status='pending' WHERE version=?", (version,))
            self._audit(actor, "confirm", version, None, self._snapshot(row), row["reason"], ip)
            return {"version": version, "status": "pending"}
        return self._activate(row, actor, ip)

    def approve(self, actor: str, version: int, ip: Optional[str] = None) -> Dict[str, Any]:
        if not self.require_second:
            raise PolicyError(409, "未开启双人审批，请用确认接口")
        row = self._row(version)
        if row["status"] != "pending":
            raise PolicyError(409, "只能审批待审批版本")
        if row["created_by"] == actor:
            raise PolicyError(403, "不能审批自己提交的版本")
        self._check_fresh(row)
        return self._activate(row, actor, ip)

    def reject(self, actor: str, version: int, reason: Optional[str], ip: Optional[str] = None) -> Dict[str, Any]:
        reason = self._reason(reason)
        row = self._row(version)
        if row["status"] not in ("draft", "pending"):
            raise PolicyError(409, "只能驳回草稿或待审批版本")
        if row["status"] == "draft" and row["created_by"] != actor:
            raise PolicyError(403, "只能放弃自己的草稿")
        self.store.x("UPDATE role_policy_versions SET status='rejected' WHERE version=?", (version,))
        self._audit(actor, "reject", version, self._snapshot(row), None, reason, ip)
        return {"version": version, "status": "rejected"}

    def _check_fresh(self, row) -> None:
        act = self.active()
        if (act["version"] if act else None) != row["based_on"]:
            raise PolicyError(409, "草稿所基于的版本已不是当前生效版本，请基于新版本重做")

    def _activate(self, row, actor: str, ip: Optional[str]) -> Dict[str, Any]:
        self._validate(json.loads(row["policy"]))
        act = self.active()
        now = time.time()
        with self.store.tx() as c:
            c.execute("UPDATE role_policy_versions SET status='retired' WHERE status='active'")
            c.execute("UPDATE role_policy_versions SET status='active', approved_by=?, approved_at=?, activated_at=? "
                      "WHERE version=?", (actor, now, now, row["version"]))
        self.router.reload()
        if self._on_activate:
            self._on_activate()
        self._audit(actor, "activate", row["version"], self._snapshot(act), self._snapshot(row), row["reason"], ip)
        return {"version": row["version"], "status": "active"}
