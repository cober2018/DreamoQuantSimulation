"""数据中台 records 上游：HTTP 客户端与夹具源共用同一分页逻辑。

数据中台第二期（已发布）为 records 提供了同日稳定排序键，offset 分页不再重复或漏行
（2026-10-15 对生产 review-industry 概念板块重叠分页实测确认），客户端去重降级已移除；
分页上限保护保留，触界仍显式上报为 partial。
"""

from __future__ import annotations

import contextvars
import json
import time
from dataclasses import dataclass, field
from datetime import date, datetime, time as dtime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

from .config import Settings
from .tier_routing import RouteRejected, TierRouter, RouteLog, audit_headers, current_context

PAGE_LIMIT = 500
MAX_PAGES = 10
HISTORICAL_TTL = 24 * 3600

# ZS-135：上海时间 21:30 前不对外显示当天数据（全站只在这里定义这个时刻；网页从 /api/v1/meta/visible-date 读取）。
# 规则是一个日期上限：21:30 前为昨天，21:30 起为今天（按日历日）。每个上游视图取「不晚于上限、自己最近一个有数据的日子」，
# 所以周末、节假日自然落到最近一个交易日，当天还没写完的视图继续给它上一交易日的数据，不会变空。
VISIBLE_CUTOFF = dtime(21, 30)
SHANGHAI = timezone(timedelta(hours=8))  # 中国不实行夏令时，固定 UTC+8
FALLBACK_HOPS = 10  # 往前找有数据的日子最多试几次（国庆长假 8 天）
_RANGE_KEYS = ("start_date", "end_date", "from", "to")
# 本次请求是否跟随最新日：不带日期、或带的日期晚于上限时为真。为真时页面里每个区块各自回落；
# 为假（用户指定了历史日期）时各区块严格按那一天取，缺了就缺，和原来一样
_follow_latest: contextvars.ContextVar[bool] = contextvars.ContextVar("insight_follow_latest", default=False)


def date_cap(now: datetime) -> str:
    local = now.astimezone(SHANGHAI)
    day = local.date() if local.time() >= VISIBLE_CUTOFF else local.date() - timedelta(days=1)
    return day.isoformat()


def _has_data(res: "FetchResult") -> bool:
    # public-* 某天有数据但零行时（例如当天没有连板）仍带 trade_date；没有这一天的数据时 trade_date 为空
    return bool(res.rows or res.meta.get("trade_date"))


def first_row(rows: List[Dict[str, Any]]) -> Any:
    return rows[0] if rows else None


def _row_day(row: Any) -> str:
    if not isinstance(row, dict):
        return ""
    return str(row.get("trade_date") or row.get("date") or "")[:10]


class UpstreamError(RuntimeError):
    def __init__(self, message: str, status: Optional[int] = None):
        super().__init__(message)
        self.status = status


class UpstreamUnsupported(UpstreamError):
    """上游对该参数返回 422 (例如尚未发布的日期区间能力)，调用方可降级。"""


# 投研平台对未过审的文本统一返回这个占位；对外一律当缺值，由页面显示「—」，网页、小程序、MCP 口径一致
UNAVAILABLE_TEXT = "说明暂不可用"


def _scrub(value: Any) -> Any:
    if isinstance(value, str):
        return None if value.strip() == UNAVAILABLE_TEXT else value
    if isinstance(value, dict):
        return {k: _scrub(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_scrub(v) for v in value]
    return value


@dataclass
class FetchResult:
    rows: List[Dict[str, Any]]
    issues: List[str] = field(default_factory=list)
    # public-* 响应里 rows 以外的部分（trade_date、context、availability 等），取首页；review-* 为空
    meta: Dict[str, Any] = field(default_factory=dict)


class HttpSource:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._client = httpx.AsyncClient(
            base_url=settings.upstream_base_url,
            timeout=settings.upstream_timeout,
        )

    async def page(self, service_key: str, params: Dict[str, str],
                   headers: Optional[Dict[str, str]] = None) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        try:
            resp = await self._client.get(f"/api/v1/data/apis/{service_key}/records", params=params,
                                          headers=headers or {})
        except httpx.HTTPError as e:
            raise UpstreamError(f"{service_key} 请求失败: {type(e).__name__}") from None
        if resp.status_code == 422:
            raise UpstreamUnsupported(f"{service_key} 返回 HTTP 422", 422)
        if resp.status_code != 200:
            raise UpstreamError(f"{service_key} 返回 HTTP {resp.status_code}", resp.status_code)
        try:
            body = resp.json()
            data = body["data"]
            rows = data["rows"]
        except (ValueError, KeyError, TypeError):
            raise UpstreamError(f"{service_key} 响应结构不符合 records 合同") from None
        if not isinstance(rows, list):
            raise UpstreamError(f"{service_key} rows 不是列表")
        return rows, {k: v for k, v in data.items() if k != "rows"}

    async def close(self) -> None:
        await self._client.aclose()


class FixtureSource:
    """模拟 records 的过滤与分页语义；夹具文件是上游整行形状。"""

    _PARAM_COLUMNS = {"industry_code": "sector_code", "idx_type": "idx_type", "board_type": "board_type"}

    def __init__(self, settings: Settings):
        self._dir = settings.fixture_dir

    async def page(self, service_key: str, params: Dict[str, str],
                   headers: Optional[Dict[str, str]] = None) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        path = self._dir / f"{service_key}.json"
        if not path.exists():
            raise UpstreamError(f"{service_key} 夹具不存在")
        loaded = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(loaded, dict):
            return self._public_page(service_key, loaded, params)
        rows: List[Dict[str, Any]] = loaded
        if params.get("start_date") or params.get("end_date"):
            rows = [r for r in rows if params.get("start_date", "") <= str(r.get("trade_date")) <= params.get("end_date", "9999")]
        else:
            trade_date = params.get("trade_date") or "latest"
            if trade_date == "latest":
                trade_date = max((r["trade_date"] for r in rows), default=None)
            rows = [r for r in rows if r.get("trade_date") == trade_date]
        for name, column in self._PARAM_COLUMNS.items():
            if params.get(name):
                rows = [r for r in rows if str(r.get(column)) == params[name]]
        offset = int(params.get("offset", 0))
        limit = int(params.get("limit", 100))
        return rows[offset:offset + limit], {}

    @staticmethod
    def _public_page(service_key: str, loaded: Dict[str, Any], params: Dict[str, str]):
        """public-* 夹具: {"<view>|<trade_date>|<其他参数 k=v 按键排序>": data 对象}; latest 取该视图最大日期。"""
        view = params.get("view", "")
        extra = "|".join(f"{k}={params[k]}" for k in sorted(params)
                         if k not in ("view", "trade_date", "limit", "offset", "fields", "sort_by", "sort_order"))
        day = params.get("trade_date", "latest")
        if day == "latest":
            days = sorted(k.split("|")[1] for k in loaded if k.split("|")[0] == view)
            day = days[-1] if days else ""
        data = loaded.get(f"{view}|{day}|{extra}")
        if data is None:
            return [], {"trade_date": None, "requested_trade_date": params.get("trade_date"),
                        "context": {"empty_reason": "no_data_for_trade_date", "latest_available_date": None}}
        rows = data.get("rows") or []
        if params.get("sort_by"):  # 模拟上游排序：缺值总排在最后
            key, desc = params["sort_by"], params.get("sort_order") == "desc"
            have = sorted((r for r in rows if r.get(key) is not None), key=lambda r: r[key], reverse=desc)
            rows = have + [r for r in rows if r.get(key) is None]
        offset, limit = int(params.get("offset", 0)), int(params.get("limit", 100))
        return rows[offset:offset + limit], {k: v for k, v in data.items() if k != "rows"}

    async def close(self) -> None:
        return None


class Upstream:
    def __init__(self, settings: Settings, router: TierRouter, route_log: Optional[RouteLog] = None,
                 clock=None):
        self.data_mode = settings.data_mode
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self._resolved: Dict[str, tuple[float, str]] = {}  # 上限日无数据时回落到的日子，短缓存，避免每次先空查一次
        self._source = FixtureSource(settings) if settings.data_mode == "fixture" else HttpSource(settings)
        self._ttl = settings.cache_ttl
        self._cache: Dict[str, tuple[float, FetchResult]] = {}
        self._router = router
        self._route_log = route_log or RouteLog(None)

    def date_cap(self) -> str:
        return date_cap(self.clock())

    def follow_latest(self, trade_date: Optional[str]) -> None:
        """每个数据请求开头调用一次（main.bind）：记下本次是否跟随最新日。"""
        _follow_latest.set(not trade_date or trade_date > self.date_cap())

    async def fetch(
        self,
        service_key: str,
        params: Optional[Dict[str, str]] = None,
        max_rows: Optional[int] = None,
    ) -> FetchResult:
        """按 21:30 上限取数：不带日期、或日期晚于上限时取上限；跟随最新日时，上限日没有数据就往前找该视图最近有数据的日子。
        带 from/to、start_date/end_date 的区间请求不改参数，只去掉晚于上限的行。"""
        params = {k: v for k, v in (params or {}).items() if v not in (None, "")}
        cap = self.date_cap()
        day = params.get("trade_date")
        if day is None and any(k in params for k in _RANGE_KEYS):
            res = await self._fetch(service_key, params, max_rows)
        else:
            fallback = day in (None, "latest") or day > cap or _follow_latest.get()
            day = cap if day in (None, "latest") or day > cap else day
            memo_key = f"{service_key}|{max_rows}|{json.dumps({**params, 'trade_date': day}, sort_keys=True)}"
            memo = self._resolved.get(memo_key)
            if fallback and memo and time.monotonic() - memo[0] < self._ttl:
                day = memo[1]
            res = await self._fetch(service_key, {**params, "trade_date": day}, max_rows)
            if fallback and not _has_data(res):
                res = await self._earlier(service_key, params, max_rows, day, res, memo_key)
        if any(_row_day(r) > cap for r in res.rows):
            res = FetchResult(rows=[r for r in res.rows if _row_day(r) <= cap], issues=res.issues, meta=res.meta)
        return res

    async def _earlier(self, service_key: str, params: Dict[str, str], max_rows: Optional[int], day: str,
                       res: FetchResult, memo_key: str) -> FetchResult:
        """day 没有数据：找这个视图早于 day、最近一个有数据的日子。先用中台给的 latest_available_date；
        没有提示时取一次它自己的最新，早于 day 才用（晚于的不用，不会露出上限之后的数据）；都不行再逐日往前。"""
        latest: Optional[FetchResult] = None
        for _ in range(FALLBACK_HOPS):
            ctx = res.meta.get("context") if isinstance(res.meta.get("context"), dict) else {}
            hint = str(ctx.get("latest_available_date") or "")[:10]
            if hint and hint < day:
                day = hint
            elif latest is None:
                probe = {**params, "trade_date": "latest"} if service_key.startswith("public-") else \
                    {k: v for k, v in params.items() if k != "trade_date"}
                latest = await self._fetch(service_key, probe, max_rows)
                got = str(latest.meta.get("trade_date") or _row_day(first_row(latest.rows)))[:10]
                if _has_data(latest) and got and got < day:
                    self._resolved[memo_key] = (time.monotonic(), got)
                    return latest
                day = (date.fromisoformat(day[:10]) - timedelta(days=1)).isoformat()
            else:
                day = (date.fromisoformat(day[:10]) - timedelta(days=1)).isoformat()
            res = await self._fetch(service_key, {**params, "trade_date": day}, max_rows)
            if _has_data(res):
                self._resolved[memo_key] = (time.monotonic(), day)
                return res
        return res

    async def _fetch(self, service_key: str, params: Dict[str, str], max_rows: Optional[int]) -> FetchResult:
        ctx = current_context()
        view = params.get("view")
        try:
            key, account, rule_version = self._router.resolve(service_key, ctx)
        except RouteRejected:
            self._route_log.write(ctx, service_key, view, None, self._router.active_version(), False,
                                  "rejected", None, None)
            raise
        # 缓存键含账号名：不同等级账号可读字段不同，不能共用缓存 (D2)
        cache_key = f"{account}|{service_key}|{max_rows}|{json.dumps(params, sort_keys=True)}"
        ttl = self._ttl_for(params)
        hit = self._cache.get(cache_key)
        if hit and time.monotonic() - hit[0] < ttl:
            self._route_log.write(ctx, service_key, view, account, rule_version, True,
                                  "ok" if hit[1].rows else "empty", None, 0)
            return hit[1]

        headers = {"X-API-Key": key, **audit_headers(ctx, rule_version)}
        limit = min(max_rows or PAGE_LIMIT, PAGE_LIMIT)
        rows: List[Dict[str, Any]] = []
        issues: List[str] = []
        meta: Dict[str, Any] = {}
        started = time.monotonic()
        try:
            for page_no in range(MAX_PAGES):
                page, page_meta = await self._source.page(
                    service_key, {**params, "limit": str(limit), "offset": str(page_no * limit)}, headers)
                if page_no == 0:
                    meta = page_meta
                rows.extend(page)
                if len(page) < limit or (max_rows and len(rows) >= max_rows):
                    break
            else:
                issues.append(f"{service_key} 达到分页上限 {MAX_PAGES} 页，结果可能不完整")
        except UpstreamError as e:
            result_code = "upstream_4xx" if e.status and 400 <= e.status < 500 else "upstream_5xx"
            self._route_log.write(ctx, service_key, view, account, rule_version, False, result_code, e.status,
                                  int((time.monotonic() - started) * 1000))
            raise
        self._route_log.write(ctx, service_key, view, account, rule_version, False, "ok" if rows else "empty", 200,
                              int((time.monotonic() - started) * 1000))

        result = FetchResult(rows=[_scrub(r) for r in rows], issues=issues, meta=_scrub(meta))
        if rows:  # 空结果不缓存: 当日数据可能稍后就绪
            self._cache[cache_key] = (time.monotonic(), result)
        return result

    def _ttl_for(self, params: Dict[str, str]) -> float:
        """历史交易日结果不会再变，长缓存；最新日按配置短缓存，避免用户数放大上游请求。"""
        day = params.get("end_date") or params.get("trade_date")
        if day and day != "latest":
            try:
                if date.fromisoformat(day[:10]) < date.today() - timedelta(days=1):
                    return float(max(self._ttl, HISTORICAL_TTL))
            except ValueError:
                pass
        return float(self._ttl)

    async def fetch_range(
        self,
        service_key: str,
        end_date: Optional[str],
        days: int,
        params: Optional[Dict[str, str]] = None,
    ) -> FetchResult:
        """取截至 end_date 的近 days 个交易日。优先用上游日期区间; 上游尚不支持 (422) 时逐日降级。"""
        params = dict(params or {})
        if end_date and end_date[:10] > self.date_cap():
            end_date = None
        if end_date is None:
            head = await self.fetch(service_key, {**params}, max_rows=1)
            if not head.rows:
                return FetchResult(rows=[], issues=head.issues)
            end_date = str(head.rows[0].get("trade_date"))[:10]
        end = date.fromisoformat(end_date[:10])
        start = end - timedelta(days=min(int(days * 1.6) + 4, 89))
        try:
            res = await self.fetch(service_key, {**params, "start_date": start.isoformat(), "end_date": end.isoformat()})
            rows = res.rows
            issues = list(res.issues)
        except UpstreamUnsupported:
            rows, issues = [], []
            cursor, budget = end, int(days * 1.6) + 6
            seen_dates: set = set()
            while len(seen_dates) < days and budget > 0:
                budget -= 1
                if cursor.weekday() < 5:
                    r = await self.fetch(service_key, {**params, "trade_date": cursor.isoformat()})
                    # 跟随最新日时 fetch 会回落到更早的日子，这里只要正好是这一天的行
                    if r.rows and str(r.rows[0].get("trade_date"))[:10] == cursor.isoformat():
                        rows.extend(r.rows)
                        seen_dates.add(cursor.isoformat())
                        issues.extend(r.issues)
                cursor -= timedelta(days=1)
        wanted = sorted({str(r.get("trade_date"))[:10] for r in rows}, reverse=True)[:days]
        rows = [r for r in rows if str(r.get("trade_date"))[:10] in set(wanted)]
        return FetchResult(rows=rows, issues=issues)

    async def close(self) -> None:
        await self._source.close()
