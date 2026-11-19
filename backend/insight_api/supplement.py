"""补充视图（ZS-117 精简版所需）：只读取数据中台已对外的视图，按白名单挑字段，不做任何判断加工。

每个条目：service/view 为中台视图；perm 为页面权限点；params 为固定请求参数；fields 为白名单；
history 视图按 sessions 取序列；index_history 对每个指数分别取一次。
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from .projection import pick
from .upstream import FetchResult, Upstream, UpstreamError

log = logging.getLogger(__name__)

INDEX_CODES = ["000001.SH", "399001.SZ", "399006.SZ", "000688.SH", "000300.SH", "000905.SH", "000852.SH", "000985.SH"]

SUPPLEMENT: Dict[str, Dict[str, Any]] = {
    "index_overview": {
        "service": "public-market-index-position", "view": "overview", "perm": "page.overview", "params": {},
        # 套餐未授权的字段（volatility_pct、price_date、valuation_date、valuation_position_252d_pct、valuation_state_252d）不请求，否则整条 403
        "fields": ["date", "index_code", "index_name", "close", "valuation", "return_1d_pct", "return_20d_pct",
                   "drawdown_pct"],
    },
    "index_history": {
        "service": "public-market-index-position", "view": "history", "perm": "page.overview",
        "params": {"sessions": "60"}, "per_index": True,
        # status 未授权，不请求
        "fields": ["date", "index_code", "close", "valuation"],
    },
    "pool_counts": {
        "service": "public-limit-pool-structure", "view": "pool-counts", "perm": "page.overview", "params": {},
        "fields": ["pool", "window_days", "count", "status", "reason", "latest_date", "lag_days"],
    },
    "participation_history": {
        "service": "public-market-participation", "view": "history", "perm": "page.participation",
        # heat、participation_state、pressure_state 未授权，不请求
        "params": {"sessions": "60"},
        "fields": ["date", "turnover", "relative_turnover",
                   "low_participation_days", "duration_is_lower_bound", "selling_pressure_pct",
                   "selling_share_reference_pct", "buy_sell_change_pp"],
    },
    "compensation_history": {
        # 该视图不支持 sessions；不传时返回全部（按日期升序），取最后 60 行
        "service": "public-market-compensation", "view": "history-position", "perm": "page.participation",
        "params": {}, "tail": 60, "fields": ["date", "compensation_pct"],
    },
    "style_history": {
        "service": "public-market-style-rotation", "view": "history", "perm": "page.participation",
        "params": {"sessions": "20"}, "fields": ["key", "name", "strength", "z_score", "strength_series", "missing_reason"],
    },
    "open5_history": {
        "service": "public-daily-review-summary", "view": "open5-history", "perm": "page.history",
        "params": {"sessions": "20"},
        "fields": ["trade_date", "expected_stock_count", "open5_ready_count", "close_ready_count",
                   "open5_observed_count", "open5_incomplete_count", "open5_unavailable_count", "coverage_ratio",
                   "positive_open5_ratio", "continuation_ratio", "over_response_ratio", "data_status"],
    },
}


async def _one(up: Upstream, name: str, spec: Dict[str, Any], trade_date: Optional[str], extra: Dict[str, str]):
    params = {"view": spec["view"], "trade_date": trade_date or "latest",
              "fields": ",".join(spec["fields"]), **spec["params"], **extra}
    try:
        res: FetchResult = await up.fetch(spec["service"], params)
    except UpstreamError as e:
        # 原因只写日志，不返回给页面（错误文本含内部服务名）
        log.warning("supplement %s upstream error: %s params=%s", name, e, sorted(params.keys()))
        return None
    return [pick(r, spec["fields"]) for r in res.rows if isinstance(r, dict)]


async def load(up: Upstream, name: str, trade_date: Optional[str]) -> Dict[str, Any]:
    """返回 {rows: [...]} 或 {rows: None, reason: str}。失败不抛出，只标注。指数序列并发读取。"""
    spec = SUPPLEMENT[name]
    if spec.get("per_index"):
        parts = await asyncio.gather(*[_one(up, name, spec, trade_date, {"index_code": c}) for c in INDEX_CODES])
        if all(p is None for p in parts):
            return {"rows": None, "reason": "暂不可用"}
        rows = [r for p in parts if p for r in p]
    else:
        got = await _one(up, name, spec, trade_date, {})
        if got is None:
            return {"rows": None, "reason": "暂不可用"}
        rows = got
    if spec.get("tail"):
        rows = rows[-spec["tail"]:]
    return {"rows": rows, "reason": None}
