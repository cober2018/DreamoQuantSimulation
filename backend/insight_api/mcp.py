"""MCP 只读服务（内部封闭测试）：POST /mcp，streamable HTTP 无状态模式，每个请求直接回 JSON。

不引入 mcp SDK：只需 5 个 JSON-RPC 方法，手写约 300 行即可，且鉴权/限流/裁剪必须走网关现有链路，
SDK 的会话与 SSE 机制在这里用不上，还要再加一个未锁定的依赖。

等级与口径与网页同一套：令牌 → 用户 → principal_for（含试用、会员到期）→ 页面权限点 →
main.py 的同一组页面装载函数（同一套裁剪、历史范围、TierRouter 路由；上下文 client=mcp）。
"""
from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field

from .access.gate import IP_PER_MIN, Gate, client_ip
from .access.mcp_tokens import MAX_ACTIVE, McpTokens, params_hash
from .access.service import AccessError, AccessService
from .content_scope import CONTENT_SCOPE, DELIVERED, DISCLAIMER, ContentGuardViolation
from .indicator_catalog import PAGES, by_page
from .tier_routing import RouteRejected, current_context, new_request_id, set_context
from .upstream import UpstreamError

logger = logging.getLogger("insight_api.mcp")

# 每把令牌的调用上限：(每分钟, 滚动 24 小时)。只计 tools/call；未登记的自定义角色按 free
RATE_LIMITS = {"free": (10, 200), "vip": (30, 1000), "svip": (60, 3000), "admin": (60, 3000)}

PROTOCOL_VERSIONS = ("2025-06-18", "2025-03-26", "2024-11-05")
SERVER_INFO = {"name": "zhishu-xingyao-data", "title": "知数星耀数据（只读）", "version": "0.1.0"}
INSTRUCTIONS = ("知数星耀只读数据服务（内部封闭测试）。先调用 list_datasets 查看当前账号等级可读的数据集，"
                "再用 describe_dataset 查看字段含义与单位。只提供市场数据与历史统计，不提供任何分析结论或投资建议。")
SOURCE_NOTE = ("数据来自知数星耀数据服务，与网页同页同口径、同等级裁剪。sources 为各部分的来源数据日与覆盖率，"
               "gaps 为缺失说明；status=empty 表示该日暂无数据（见 latest_available_date），不会用其他日期代替；"
               "restricted 为当前等级不可见的指标编号。")

# JSON-RPC 错误码
PARSE_ERROR, INVALID_REQUEST, METHOD_NOT_FOUND, INVALID_PARAMS = -32700, -32600, -32601, -32602
AUTH_ERROR, FORBIDDEN, RATE_LIMITED = -32001, -32003, -32029

DATE = {"type": "string", "pattern": r"^\d{4}-\d{2}-\d{2}$", "description": "交易日，格式 YYYY-MM-DD；不填为最新数据日"}
IDX = {"type": "string", "enum": ["行业板块", "概念板块", "地域板块"], "default": "行业板块", "description": "板块分类"}


@dataclass
class McpPages:
    """main.py 注入的页面装载函数（与网页路由共用）。"""
    bind: Callable[..., Any]
    series_ok: Callable[[Any], bool]
    overview: Callable[..., Awaitable[Dict[str, Any]]]
    participation: Callable[..., Awaitable[Dict[str, Any]]]
    industries: Callable[..., Awaitable[Dict[str, Any]]]
    industry_series: Callable[..., Awaitable[Dict[str, Any]]]
    themes: Callable[..., Awaitable[Dict[str, Any]]]
    history: Callable[..., Awaitable[Dict[str, Any]]]
    calendar: Callable[..., Awaitable[Dict[str, Any]]]


@dataclass
class Tool:
    name: str
    title: str
    description: str
    properties: Dict[str, Any]
    page: Optional[str] = None                  # 需要的页面权限 page.<page>；None 为目录类工具
    date_arg: str = "trade_date"
    load: Optional[Callable[[McpPages, Any, Any, Dict[str, Any]], Awaitable[Dict[str, Any]]]] = None
    required: tuple = ()

    def spec(self) -> Dict[str, Any]:
        return {"name": self.name, "title": self.title, "description": self.description,
                "inputSchema": {"type": "object", "properties": self.properties, "required": list(self.required),
                                "additionalProperties": False},
                "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True,
                                "openWorldHint": False}}


TOOLS: List[Tool] = [
    Tool("list_datasets", "数据集清单",
         "列出当前账号等级可读取的数据集（与网页各页一一对应）、对应的读取工具、包含的模块，以及可查看的历史交易日数。",
         {}),
    Tool("describe_dataset", "数据集字段说明",
         "查看一个数据集的字段说明：每个指标的名称、单位、在返回 JSON 中的位置，以及当前等级是否可见。",
         {"name": {"type": "string", "enum": list(PAGES), "description": "数据集名称，取自 list_datasets 的 name"}},
         required=("name",)),
    Tool("get_market_overview", "市场总览",
         "读取指定交易日的市场总览统计：上涨/下跌家数及占比、全市场成交额等。",
         {"trade_date": DATE}, page="overview",
         load=lambda pg, u, p, a: pg.overview(u, p, a.get("trade_date"))),
    Tool("get_participation", "参与度与资金环境",
         "读取指定交易日的市场参与度原始统计：成交与卖压、股权风险溢价与估值统计、涨停结构、五因子截面、"
         "衍生品原始统计、风格相对强度序列、底部条件观察值。",
         {"trade_date": DATE}, page="participation",
         load=lambda pg, u, p, a: pg.participation(u, p, a.get("trade_date"))),
    Tool("get_industries", "行业比较与轮动",
         "读取指定交易日各板块的横截面统计：成交、资金净流入、扩散度、站上均线占比、RRG 相对强度坐标等。",
         {"trade_date": DATE, "idx_type": IDX}, page="industries",
         load=lambda pg, u, p, a: pg.industries(u, p, a.get("trade_date"), a["idx_type"])),
    Tool("get_industry_series", "板块近 N 日序列",
         "读取单个板块截至某日的近 N 个交易日序列统计（下钻明细，需要相应等级）。sector_code 取自 get_industries 返回的板块代码。",
         {"sector_code": {"type": "string", "pattern": r"^[A-Za-z0-9._-]{1,32}$", "description": "板块代码"},
          "end_date": {**DATE, "description": "序列截止交易日 YYYY-MM-DD；不填为最新数据日"},
          "days": {"type": "integer", "minimum": 2, "maximum": 20, "default": 5,
                   "description": "交易日个数（2–20，且不超过当前等级的历史范围）"}},
         page="industries", date_arg="end_date", required=("sector_code",),
         load=lambda pg, u, p, a: pg.industry_series(u, p, a["sector_code"], a.get("end_date"), a["days"])),
    Tool("get_themes", "题材与涨跌结构",
         "读取指定交易日的题材统计与涨跌停结构：各题材涨停/炸板数、连板梯队、涨停/炸板/跌停计数及近期序列、股票池计数。",
         {"trade_date": DATE}, page="themes",
         load=lambda pg, u, p, a: pg.themes(u, p, a.get("trade_date"))),
    Tool("get_history", "历史复盘",
         "读取指定交易日的板块结构统计、板块资金净流入排行（按 1/5/20 日口径）和开盘 5 分钟统计。",
         {"trade_date": DATE, "idx_type": IDX,
          "period": {"type": "string", "enum": ["1d", "5d", "20d"], "default": "1d", "description": "资金统计口径"}},
         page="history", load=lambda pg, u, p, a: pg.history(u, p, a.get("trade_date"), a["idx_type"], a["period"])),
    Tool("get_calendar", "事件日历",
         "读取自数据日起若干天内的宏观事件：事件名称、时间、前值、公布值、公布状态与来源。",
         {"trade_date": DATE, "days": {"type": "integer", "minimum": 1, "maximum": 60, "default": 14,
                                       "description": "自数据日起的天数窗口（1–60）"}},
         page="calendar", load=lambda pg, u, p, a: pg.calendar(u, p, a.get("trade_date"), a["days"])),
]
TOOLS_BY_NAME = {t.name: t for t in TOOLS}


class McpTokenIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field("", max_length=32)
    expires_days: Optional[int] = Field(90, ge=1, le=365)


def validate_args(tool: Tool, args: Dict[str, Any]) -> Dict[str, Any]:
    """按 inputSchema 校验并补默认值；错误信息给模型看，便于它自行改正。"""
    extra = sorted(set(args) - set(tool.properties))
    if extra:
        raise ValueError(f"不支持的参数: {', '.join(extra)}")
    out: Dict[str, Any] = {}
    for key, spec in tool.properties.items():
        v = args.get(key)
        if v is None:
            if key in tool.required:
                raise ValueError(f"缺少参数 {key}")
            if "default" in spec:
                out[key] = spec["default"]
            continue
        if spec["type"] == "integer":
            if isinstance(v, str) and v.isdigit():
                v = int(v)
            if isinstance(v, bool) or not isinstance(v, int) or not spec["minimum"] <= v <= spec["maximum"]:
                raise ValueError(f"{key} 应为 {spec['minimum']}–{spec['maximum']} 的整数")
        elif not isinstance(v, str) or ("enum" in spec and v not in spec["enum"]) or (
                "pattern" in spec and not re.fullmatch(spec["pattern"], v)):
            hint = f"可选值 {'/'.join(spec['enum'])}" if "enum" in spec else spec.get("description", "")
            raise ValueError(f"{key} 取值无效（{hint}）")
        out[key] = v
    return out


def rpc_result(msg_id, result) -> Dict[str, Any]:
    return {"jsonrpc": "2.0", "id": msg_id, "result": result}


def rpc_error(msg_id, code: int, message: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    err = {"code": code, "message": message}
    if data:
        err["data"] = data
    return {"jsonrpc": "2.0", "id": msg_id, "error": err}


# 中台服务名属于内部信息：MCP 返回里一律去掉（审计日志 upstream_route_log 仍记录），追溯靠数据日期与口径说明
INTERNAL_KEYS = frozenset({"service_key"})


def strip_internal(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: strip_internal(v) for k, v in value.items() if k not in INTERNAL_KEYS}
    if isinstance(value, list):
        return [strip_internal(v) for v in value]
    return value


def text_result(payload: Dict[str, Any], is_error: bool = False) -> Dict[str, Any]:
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str)
    return {"content": [{"type": "text", "text": text}], "isError": is_error}


def build_mcp_router(access: AccessService, gate: Gate, settings, pages: McpPages) -> APIRouter:
    r = APIRouter()
    tokens = McpTokens(access.store)

    def allowed(user) -> bool:
        return user["base_role"] == "admin" or user["username"] in settings.mcp_users

    # ---------------- 账号页：令牌管理（签名网页会话） ----------------
    def web_user(request: Request):
        p = gate.principal(request, require_signature=True)
        if p.client != "web":
            raise HTTPException(403, "请在网页端管理 MCP 令牌")
        user = access.store.q1("SELECT * FROM users WHERE id=?", (p.user_id,))
        if not allowed(user):
            raise HTTPException(403, "MCP 内测暂未对该账号开放")
        return p, user

    @r.get("/api/v1/account/mcp-tokens")
    def list_tokens(request: Request):
        p, user = web_user(request)
        per_min, per_day = RATE_LIMITS.get(p.role, RATE_LIMITS["free"])
        return {"items": tokens.list(user), "endpoint_path": "/mcp", "max_active": MAX_ACTIVE,
                "limits": {"per_minute": per_min, "per_day": per_day}}

    @r.post("/api/v1/account/mcp-tokens")
    def create_token(body: McpTokenIn, request: Request):
        _, user = web_user(request)
        try:
            return tokens.create(user, body.name, body.expires_days, client_ip(request))
        except AccessError as e:
            raise HTTPException(e.status, e.detail)

    @r.post("/api/v1/account/mcp-tokens/{token_id}/revoke")
    def revoke_token(token_id: int, request: Request):
        _, user = web_user(request)
        try:
            tokens.revoke(user, token_id, client_ip(request))
        except AccessError as e:
            raise HTTPException(e.status, e.detail)
        return {"ok": True}

    # ---------------- MCP 端点 ----------------
    def deny(status: int, code: int, message: str, headers: Optional[Dict[str, str]] = None) -> JSONResponse:
        return JSONResponse(status_code=status, content=rpc_error(None, code, message), headers=headers)

    @r.api_route("/mcp", methods=["GET", "DELETE"])
    async def mcp_other():
        # 无状态：不提供服务端推送流，也没有会话可删
        return Response(status_code=405, headers={"Allow": "POST"})

    @r.post("/mcp")
    async def mcp_post(request: Request):
        set_context(None)
        origin = request.headers.get("origin")
        # 规范要求校验 Origin，防 DNS 重绑定；非浏览器客户端不带 Origin
        if origin and origin.split("://", 1)[-1] != request.headers.get("host", "") \
                and origin not in settings.allowed_origins:
            return deny(403, FORBIDDEN, "来源不被允许")
        ip = client_ip(request)
        ok, wait = gate.limiter.hit(f"mcpip:{ip}", IP_PER_MIN, 60)
        if not ok:
            return deny(429, RATE_LIMITED, "请求过于频繁", {"Retry-After": str(wait)})

        header = request.headers.get("authorization", "")
        row, user = tokens.authenticate(header[7:].strip()) if header.lower().startswith("bearer ") else (None, None)
        if row is None:
            return deny(401, AUTH_ERROR, "MCP 令牌无效、已过期或已吊销，请在账号页重新生成",
                        {"WWW-Authenticate": 'Bearer realm="mcp"'})
        if user["disabled"]:
            return deny(403, FORBIDDEN, "账号已停用")
        if user["must_change_password"]:
            return deny(403, FORBIDDEN, "请先在网页修改初始密码")
        if not allowed(user):
            return deny(403, FORBIDDEN, "MCP 内测暂未对该账号开放")
        left = gate.blocklist.remaining(f"user:{user['id']}")
        if left:
            return deny(429, RATE_LIMITED, "账号请求异常，已被临时限制", {"Retry-After": str(left)})

        try:
            msg = json.loads(await request.body())
        except ValueError:
            return JSONResponse(status_code=400, content=rpc_error(None, PARSE_ERROR, "JSON 解析失败"))
        if isinstance(msg, dict) and "method" not in msg and ("result" in msg or "error" in msg):
            return Response(status_code=202)       # 客户端对服务端请求的响应：本服务不发请求，直接接受
        if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0" or not isinstance(msg.get("method"), str):
            return JSONResponse(status_code=400, content=rpc_error(
                msg.get("id") if isinstance(msg, dict) else None, INVALID_REQUEST, "无效的 JSON-RPC 请求（不支持批量）"))
        if "id" not in msg:
            return Response(status_code=202)       # 通知（如 notifications/initialized）无需响应

        p = access.principal_for(user, "mcp", f"mcp{row['id']}", "")
        msg_id, method = msg["id"], msg["method"]
        params = msg.get("params") if isinstance(msg.get("params"), dict) else {}
        if method == "initialize":
            asked = params.get("protocolVersion")
            return rpc_result(msg_id, {
                "protocolVersion": asked if asked in PROTOCOL_VERSIONS else PROTOCOL_VERSIONS[0],
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": SERVER_INFO, "instructions": INSTRUCTIONS})
        if method == "ping":
            return rpc_result(msg_id, {})
        if method == "tools/list":
            return rpc_result(msg_id, {"tools": [t.spec() for t in TOOLS if permitted(t, p)]})
        if method == "tools/call":
            return await call_tool(request, msg_id, params, p, row)
        return rpc_error(msg_id, METHOD_NOT_FOUND, f"不支持的方法: {method}")

    def permitted(tool: Tool, p) -> bool:
        if tool.page is None:
            return True
        if not p.can(f"page.{tool.page}"):
            return False
        return pages.series_ok(p) if tool.name == "get_industry_series" else True

    async def call_tool(request: Request, msg_id, params: Dict[str, Any], p, row):
        name, raw = params.get("name"), params.get("arguments") or {}
        tool = TOOLS_BY_NAME.get(name) if isinstance(name, str) else None
        if tool is None or not isinstance(raw, dict):
            return rpc_error(msg_id, INVALID_PARAMS, f"未知工具: {name}")
        started = time.perf_counter()

        def log(result: str) -> None:
            ctx = current_context()
            tokens.log_call(ctx.request_id if ctx else new_request_id(), p.user_id, row["prefix"], p.role,
                            tool.name, raw, result, int((time.perf_counter() - started) * 1000))
            logger.info("mcp_call tool=%s user=%s result=%s args=%s", tool.name, p.user_id, result, params_hash(raw))

        per_min, per_day = RATE_LIMITS.get(p.role, RATE_LIMITS["free"])
        for key, limit, window, text in (
                (f"mcp:d:{row['id']}", per_day, 86400, f"已达 24 小时调用上限（当前等级 {per_day} 次）"),
                (f"mcp:m:{row['id']}", per_min, 60, f"调用过于频繁（当前等级每分钟最多 {per_min} 次）")):
            ok, wait = gate.limiter.hit(key, limit, window)
            if not ok:
                log("rate_limited")
                return rpc_error(msg_id, RATE_LIMITED, f"{text}，请 {wait} 秒后再试", {"retry_after": wait})

        if not permitted(tool, p):
            log("denied")
            return rpc_result(msg_id, text_result({"error": f"当前账号等级不能使用「{tool.title}」，该内容需要更高等级",
                                                   "disclaimer": DISCLAIMER}, True))
        try:
            args = validate_args(tool, raw)
        except ValueError as e:
            log("invalid")
            return rpc_result(msg_id, text_result({"error": f"参数错误：{e}"}, True))

        try:
            if tool.load is None:
                payload = list_datasets(p) if tool.name == "list_datasets" else describe_dataset(p, args["name"])
            else:
                pages.bind(p, args.get(tool.date_arg))
                out = await tool.load(pages, request.app.state.upstream, p, args)
                payload = {"dataset": tool.page, "data_date": out.get("trade_date"), "status": out.get("status"),
                           "source_note": SOURCE_NOTE, "disclaimer": DISCLAIMER, "result": strip_internal(out)}
        except HTTPException as e:
            log("denied")
            return rpc_result(msg_id, text_result({"error": e.detail, "disclaimer": DISCLAIMER}, True))
        except RouteRejected as e:
            logger.warning("mcp route_rejected %s", e)
            log("route_rejected")
            return rpc_result(msg_id, text_result({"error": "当前账号等级暂无数据权限"}, True))
        except UpstreamError as e:
            logger.warning("mcp upstream_error %s", e)
            log("upstream_error")
            return rpc_result(msg_id, text_result({"error": "数据服务暂不可用，请稍后再试"}, True))
        except ContentGuardViolation as e:
            logger.error("mcp content_guard_violation %s", e)
            log("guard_violation")
            return rpc_result(msg_id, text_result({"error": "数据校验未通过，本次不返回数据"}, True))
        log(payload.get("status") or "ok")
        return rpc_result(msg_id, text_result(payload))

    def visible(p, ind) -> bool:
        allowed_ids = p.extra.get("indicators")
        return ind.id in allowed_ids if allowed_ids is not None else (not ind.detail or p.can("data.detail"))

    def list_datasets(p) -> Dict[str, Any]:
        items = []
        for page, title in PAGES.items():
            if not p.can(f"page.{page}"):
                continue
            modules = list(dict.fromkeys(i.module_label for i in by_page(page) if visible(p, i)))
            items.append({"name": page, "title": title, "modules": modules,
                          "tools": [t.name for t in TOOLS if t.page == page and permitted(t, p)]})
        return {"role": p.role, "role_label": access.role_label(p.role), "history_days": p.history_days,
                "datasets": items, "note": "未列出的数据集需要更高等级", "disclaimer": DISCLAIMER}

    def describe_dataset(p, name: str) -> Dict[str, Any]:
        if not p.can(f"page.{name}"):
            raise HTTPException(403, f"当前账号等级不能读取「{PAGES[name]}」，该内容需要更高等级")
        fields = [{"id": i.id, "module": i.module_label, "label": i.label, "unit": i.unit,
                   "path": list(i.paths), "visible": visible(p, i)} for i in by_page(name)]
        content = [{"id": c["id"], "item": c["item"]} for c in CONTENT_SCOPE
                   if c["v1"] == DELIVERED and c["page"] in (PAGES[name], "全部页面")]
        return {"name": name, "title": PAGES[name], "tools": [t.name for t in TOOLS if t.page == name],
                "fields": fields, "content_items": content,
                "path_note": "path 为字段在工具返回 result 中的位置：a.b 为对象键，a[].x 为列表每项的键，a[key=k] 为列表中 key=k 的一项",
                "source_note": SOURCE_NOTE, "disclaimer": DISCLAIMER}

    return r
