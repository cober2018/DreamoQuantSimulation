"""数据中台 records 上游：HTTP 客户端与夹具源共用同一分页/去重逻辑。

records 接口按 trade_date DESC 排序且无同日二级排序，offset 分页可能重复或漏行，
因此这里去重并把异常显式上报为 partial，而不是假装取全。
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

import httpx

from .config import Settings

PAGE_LIMIT = 500
MAX_PAGES = 10
HISTORICAL_TTL = 24 * 3600


class UpstreamError(RuntimeError):
    pass


class UpstreamUnsupported(UpstreamError):
    """上游对该参数返回 422 (例如尚未发布的日期区间能力)，调用方可降级。"""


@dataclass
class FetchResult:
    rows: List[Dict[str, Any]]
    issues: List[str] = field(default_factory=list)


class HttpSource:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._client = httpx.AsyncClient(
            base_url=settings.upstream_base_url,
            timeout=settings.upstream_timeout,
            headers={"X-API-Key": settings.upstream_api_key},
        )

    async def page(self, service_key: str, params: Dict[str, str]) -> List[Dict[str, Any]]:
        try:
            resp = await self._client.get(f"/api/v1/data/apis/{service_key}/records", params=params)
        except httpx.HTTPError as e:
            raise UpstreamError(f"{service_key} 请求失败: {type(e).__name__}") from None
        if resp.status_code == 422:
            raise UpstreamUnsupported(f"{service_key} 返回 HTTP 422")
        if resp.status_code != 200:
            raise UpstreamError(f"{service_key} 返回 HTTP {resp.status_code}")
        try:
            body = resp.json()
            rows = body["data"]["rows"]
        except (ValueError, KeyError, TypeError):
            raise UpstreamError(f"{service_key} 响应结构不符合 records 合同") from None
        if not isinstance(rows, list):
            raise UpstreamError(f"{service_key} rows 不是列表")
        return rows

    async def close(self) -> None:
        await self._client.aclose()


class FixtureSource:
    """模拟 records 的过滤与分页语义；夹具文件是上游整行形状。"""

    _PARAM_COLUMNS = {"industry_code": "sector_code", "idx_type": "idx_type", "board_type": "board_type"}

    def __init__(self, settings: Settings):
        self._dir = settings.fixture_dir

    async def page(self, service_key: str, params: Dict[str, str]) -> List[Dict[str, Any]]:
        path = self._dir / f"{service_key}.json"
        if not path.exists():
            raise UpstreamError(f"{service_key} 夹具不存在")
        rows: List[Dict[str, Any]] = json.loads(path.read_text(encoding="utf-8"))
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
        return rows[offset:offset + limit]

    async def close(self) -> None:
        return None


class Upstream:
    def __init__(self, settings: Settings):
        self.data_mode = settings.data_mode
        self._source = FixtureSource(settings) if settings.data_mode == "fixture" else HttpSource(settings)
        self._ttl = settings.cache_ttl
        self._cache: Dict[str, tuple[float, FetchResult]] = {}

    async def fetch(
        self,
        service_key: str,
        params: Optional[Dict[str, str]] = None,
        key_field: Optional[str] = None,
        max_rows: Optional[int] = None,
    ) -> FetchResult:
        params = {k: v for k, v in (params or {}).items() if v not in (None, "")}
        cache_key = f"{service_key}|{max_rows}|{json.dumps(params, sort_keys=True)}"
        ttl = self._ttl_for(params)
        hit = self._cache.get(cache_key)
        if hit and time.monotonic() - hit[0] < ttl:
            return hit[1]

        limit = min(max_rows or PAGE_LIMIT, PAGE_LIMIT)
        rows: List[Dict[str, Any]] = []
        issues: List[str] = []
        seen: set = set()
        duplicated = False
        for page_no in range(MAX_PAGES):
            page = await self._source.page(service_key, {**params, "limit": str(limit), "offset": str(page_no * limit)})
            for row in page:
                if key_field:
                    key = (row.get("trade_date"), row.get(key_field))
                    if key in seen:
                        duplicated = True
                        continue
                    seen.add(key)
                rows.append(row)
            if len(page) < limit or (max_rows and len(rows) >= max_rows):
                break
        else:
            issues.append(f"{service_key} 达到分页上限 {MAX_PAGES} 页，结果可能不完整")
        if duplicated:
            issues.append(f"{service_key} 分页出现重复行（上游同日无稳定排序），已去重，可能存在漏行")

        result = FetchResult(rows=rows, issues=issues)
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
        key_field: Optional[str] = None,
    ) -> FetchResult:
        """取截至 end_date 的近 days 个交易日。优先用上游日期区间; 上游尚不支持 (422) 时逐日降级。"""
        params = dict(params or {})
        if end_date is None:
            head = await self.fetch(service_key, {**params}, max_rows=1)
            if not head.rows:
                return FetchResult(rows=[], issues=head.issues)
            end_date = str(head.rows[0].get("trade_date"))[:10]
        end = date.fromisoformat(end_date[:10])
        start = end - timedelta(days=min(int(days * 1.6) + 4, 89))
        try:
            res = await self.fetch(service_key, {**params, "start_date": start.isoformat(), "end_date": end.isoformat()},
                                   key_field=key_field)
            rows = res.rows
            issues = list(res.issues)
        except UpstreamUnsupported:
            rows, issues = [], []
            cursor, budget = end, int(days * 1.6) + 6
            seen_dates: set = set()
            while len(seen_dates) < days and budget > 0:
                budget -= 1
                if cursor.weekday() < 5:
                    r = await self.fetch(service_key, {**params, "trade_date": cursor.isoformat()}, key_field=key_field)
                    if r.rows:
                        rows.extend(r.rows)
                        seen_dates.add(cursor.isoformat())
                        issues.extend(r.issues)
                cursor -= timedelta(days=1)
        wanted = sorted({str(r.get("trade_date"))[:10] for r in rows}, reverse=True)[:days]
        rows = [r for r in rows if str(r.get("trade_date"))[:10] in set(wanted)]
        return FetchResult(rows=rows, issues=issues)

    async def close(self) -> None:
        await self._source.close()
