"""角色策略：看板 × 指标权限（openspec govern-upstream-via-public-services-v1 D9）。

策略版本 JSON：
  {"routes": {角色: 等级账号},
   "roles":  {角色: {"pages": {看板: [指标编号...]}, "history_days": n, "max_sessions": n,
                    "entries": ["web", "mp"], "admin_console": bool}}}
没有 "roles" 时（迁移第 1 步）权限仍读 role_permissions；有 "roles" 时它是唯一的权限来源。
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Set, Tuple

import httpx

from ..indicator_catalog import INDICATORS, PAGES, by_page

ENTRIES = ("web", "mp")
NUMERIC = {"history_days": (1, 250), "max_sessions": (1, 20)}
SCOPE_TTL = 600
_SEL = re.compile(r"^(?P<name>[^\[\]]+)(?:\[(?P<sel>[^\]]*)\])?$")


class PolicyInvalid(ValueError):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


# ---------------------------------------------------------------- 裁剪
def _remove(node: Any, parts: List[str]) -> None:
    if not parts or node is None:
        return
    m = _SEL.match(parts[0])
    if not m:
        return
    name, sel = m.group("name"), m.group("sel")
    if not isinstance(node, dict) or name not in node:
        return
    last = len(parts) == 1
    if sel is None:
        if last:
            node.pop(name, None)
        else:
            _remove(node[name], parts[1:])
        return
    lst = node[name]
    if not isinstance(lst, list):
        return
    if sel == "":
        if last:
            node.pop(name, None)
            return
        for item in lst:
            _remove(item, parts[1:])
        return
    k, _, v = sel.partition("=")
    keep = [x for x in lst if not (isinstance(x, dict) and str(x.get(k)) == v)]
    if last:
        node[name] = keep
    else:
        for x in lst:
            if isinstance(x, dict) and str(x.get(k)) == v:
                _remove(x, parts[1:])


def trim(page: str, envelope: Dict[str, Any], allowed: Optional[Set[str]],
         only_module: Optional[str] = None) -> Dict[str, Any]:
    """按角色允许的指标删除响应里未授权的路径；响应元数据加 restricted 与模块状态。allowed=None 表示未启用指标级策略。"""
    if allowed is None:
        return envelope
    items = [i for i in by_page(page) if only_module is None or i.module == only_module]
    if only_module is None:
        items = [i for i in items if not (page == "industries" and i.module == "series")]
    restricted = [i for i in items if i.id not in allowed]
    for ind in restricted:
        for path in ind.paths:
            _remove(envelope, path.split("."))
    modules: Dict[str, str] = {}
    for i in items:
        state = modules.get(i.module)
        ok = i.id in allowed
        modules[i.module] = ("full" if ok else "none") if state is None else (
            state if (state == "full") == ok else "partial")
    envelope["restricted"] = [i.id for i in restricted]
    envelope["module_access"] = modules
    labels = {i.module: i.module_label for i in items}
    total = {m: sum(1 for i in items if i.module == m) for m in modules}
    opened = {m: sum(1 for i in items if i.module == m and i.id in allowed) for m in modules}
    # 本等级开放的指标数 / 该模块指标总数（与上游数据源"可用 x/y"无关）
    envelope["module_counts"] = {m: [opened[m], total[m]] for m in modules}
    envelope["restricted_modules"] = [{"module": m, "label": labels[m], "state": st, "open": opened[m], "total": total[m]}
                                      for m, st in modules.items() if st != "full"]
    return envelope


# ---------------------------------------------------------------- 权限推导
def perms_for(cfg: Dict[str, Any]) -> Dict[str, int]:
    """把角色策略转成现有权限点形状：前端 can()、perm_min_role、Principal 都不用改。"""
    perms: Dict[str, int] = {}
    for page in cfg.get("pages", {}):
        perms[f"page.{page}"] = 1
    selected = {i for ids in cfg.get("pages", {}).values() for i in ids}
    if any(INDICATORS[i].detail for i in selected if i in INDICATORS):
        perms["data.detail"] = 1
    for e in cfg.get("entries", []):
        perms[f"client.{e}"] = 1
    if cfg.get("admin_console"):
        perms["admin.console"] = 1
    perms["data.history_days"] = int(cfg.get("history_days", 1))
    perms["max_sessions"] = int(cfg.get("max_sessions", 1))
    return perms


def allowed_indicators(cfg: Dict[str, Any]) -> Set[str]:
    return {i for ids in cfg.get("pages", {}).values() for i in ids}


# ---------------------------------------------------------------- 从旧权限生成
def from_legacy(role_perms: Dict[str, Dict[str, int]]) -> Dict[str, Dict[str, Any]]:
    """迁移第 2 步：开放的看板默认勾选全部指标；无 data.detail 的角色不勾下钻指标；其余设置照搬。"""
    out = {}
    for role, perms in role_perms.items():
        pages = {}
        for page in PAGES:
            if perms.get(f"page.{page}"):
                pages[page] = [i.id for i in by_page(page) if perms.get("data.detail") or not i.detail]
        out[role] = {
            "pages": pages,
            "history_days": int(perms.get("data.history_days", 1)),
            "max_sessions": int(perms.get("max_sessions", 1)),
            "entries": [e for e in ENTRIES if perms.get(f"client.{e}")],
            "admin_console": bool(perms.get("admin.console")),
        }
    return out


# ---------------------------------------------------------------- 校验
def validate_roles(roles: Any, routes: Dict[str, str], known_roles: Set[str],
                   scope: Callable[[str], Optional[Set[Tuple[str, str, str]]]]) -> Dict[str, Any]:
    if not isinstance(roles, dict):
        raise PolicyInvalid(422, "roles 应为 {角色: 配置}")
    if set(roles) != set(routes):
        raise PolicyInvalid(422, "每个角色都必须同时配置路由账号与权限")
    unknown = sorted(set(roles) - known_roles)
    if unknown:
        raise PolicyInvalid(422, f"未知角色: {', '.join(unknown)}")
    clean: Dict[str, Any] = {}
    for role, cfg in sorted(roles.items()):
        if not isinstance(cfg, dict):
            raise PolicyInvalid(422, f"{role} 配置格式错误")
        pages = cfg.get("pages") or {}
        if not isinstance(pages, dict) or set(pages) - set(PAGES):
            raise PolicyInvalid(422, f"{role} 含未知看板")
        norm_pages = {}
        for page, ids in pages.items():
            if not isinstance(ids, list) or any(i not in INDICATORS or INDICATORS[i].page != page for i in ids):
                raise PolicyInvalid(422, f"{role} / {page} 含未知指标")
            order = [i.id for i in by_page(page)]
            norm_pages[page] = [i for i in order if i in set(ids)]
        out = {"pages": dict(sorted(norm_pages.items()))}
        for k, (lo, hi) in NUMERIC.items():
            v = cfg.get(k)
            if not isinstance(v, int) or isinstance(v, bool) or not lo <= v <= hi:
                raise PolicyInvalid(422, f"{role} 的 {k} 取值范围 {lo}–{hi}")
            out[k] = v
        entries = cfg.get("entries") or []
        if not isinstance(entries, list) or set(entries) - set(ENTRIES):
            raise PolicyInvalid(422, f"{role} 的可用入口只能是 {', '.join(ENTRIES)}")
        out["entries"] = [e for e in ENTRIES if e in entries]
        out["admin_console"] = bool(cfg.get("admin_console"))
        if out["admin_console"] and role != "admin":
            raise PolicyInvalid(422, "管理后台权限只能授予 admin")
        clean[role] = out
    admin = clean.get("admin")
    if not admin or not admin["admin_console"] or "web" not in admin["entries"]:
        raise PolicyInvalid(422, "不能生成让 admin 失去管理后台权限（或网页入口）的版本")
    out_of_scope = beyond_scope(clean, routes, scope)
    if out_of_scope:
        raise PolicyInvalid(422, "以下指标超出所路由账号的上游上限: " + "; ".join(out_of_scope[:10]))
    return clean


def beyond_scope(roles: Dict[str, Any], routes: Dict[str, str],
                 scope: Callable[[str], Optional[Set[Tuple[str, str, str]]]]) -> List[str]:
    out = []
    for role, cfg in roles.items():
        account = routes[role]
        sc = scope(account)
        if sc is None:
            raise PolicyInvalid(503, f"暂时无法查询账号 {account} 的上游上限，不能提交")
        for ids in cfg["pages"].values():
            for i in ids:
                missing = [u for u in INDICATORS[i].upstream if u not in sc]
                if missing:
                    out.append(f"{role}/{i}（{account} 未授权 {'/'.join(missing[0])}）")
    return out


def diff_roles(before: Optional[Dict[str, Any]], after: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    before, after = before or {}, after or {}
    out: Dict[str, Any] = {}
    for role in sorted(set(before) | set(after)):
        b, a = before.get(role), after.get(role)
        if b == a:
            continue
        if b is None or a is None:
            out[role] = {"added" if b is None else "removed": True}
            continue
        bi, ai = allowed_indicators(b), allowed_indicators(a)
        d: Dict[str, Any] = {}
        pages_added = sorted(set(a["pages"]) - set(b["pages"]))
        pages_removed = sorted(set(b["pages"]) - set(a["pages"]))
        if pages_added:
            d["pages_added"] = pages_added
        if pages_removed:
            d["pages_removed"] = pages_removed
        if ai - bi:
            d["indicators_added"] = sorted(ai - bi)
        if bi - ai:
            d["indicators_removed"] = sorted(bi - ai)
        settings = {k: {"before": b.get(k), "after": a.get(k)}
                    for k in ("history_days", "max_sessions", "entries", "admin_console") if b.get(k) != a.get(k)}
        if settings:
            d["settings"] = settings
        out[role] = d
    return out


# ---------------------------------------------------------------- 上游上限
class UpstreamScope:
    """按账号查询投研平台授权范围（服务 → 视图 → 字段），缓存 10 分钟；失败返回 None（配置页只读）。
    live 模式：catalog 列服务与视图，schema 给各视图字段。fixture 模式：读 fixtures/upstream-scope.json。"""

    def __init__(self, settings, keys: Dict[str, str]):
        self._settings = settings
        self._keys = keys
        self._cache: Dict[str, Tuple[float, Optional[Set[Tuple[str, str, str]]]]] = {}

    def __call__(self, account: str) -> Optional[Set[Tuple[str, str, str]]]:
        hit = self._cache.get(account)
        if hit and time.monotonic() - hit[0] < SCOPE_TTL:
            return hit[1]
        try:
            raw = self._fixture(account) if self._settings.data_mode == "fixture" else self._live(account)
            scope = {(s, v, f) for s, views in raw.items() for v, fields in views.items() for f in fields}
        except Exception:
            scope = None
        if scope is not None:
            self._cache[account] = (time.monotonic(), scope)
        return scope

    def raw(self, account: str) -> Optional[Dict[str, Dict[str, List[str]]]]:
        sc = self(account)
        if sc is None:
            return None
        out: Dict[str, Dict[str, List[str]]] = {}
        for s, v, f in sorted(sc):
            out.setdefault(s, {}).setdefault(v, []).append(f)
        return out

    def _fixture(self, account: str) -> Dict[str, Dict[str, List[str]]]:
        data = json.loads((Path(self._settings.fixture_dir) / "upstream-scope.json").read_text(encoding="utf-8"))
        return data[account]

    def _live(self, account: str) -> Dict[str, Dict[str, List[str]]]:
        key = self._keys.get(account)
        if not key:
            raise RuntimeError("账号未配置 Key")
        with httpx.Client(base_url=self._settings.upstream_base_url, timeout=self._settings.upstream_timeout,
                          headers={"X-API-Key": key}) as c:
            r = c.get("/api/v1/data/apis/catalog", params={"profile": "dashboard-read"})
            r.raise_for_status()
            out: Dict[str, Dict[str, List[str]]] = {}
            for item in r.json()["data"]["items"]:
                svc = item["service_key"]
                if not svc.startswith("public-"):
                    continue
                s = c.get(f"/api/v1/data/apis/{svc}/schema")
                s.raise_for_status()
                body = s.json()
                views = (body.get("data") or body).get("views") or {}
                out[svc] = {v: list((views.get(v) or {}).get("fields", {}).keys()) for v in item.get("views", [])}
            return out
