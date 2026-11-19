"""补充视图（ZS-117 精简版所需）：只读取数据中台已对外的视图，按白名单挑字段，不做任何判断加工。

每个条目：service/view 为中台视图；perm 为页面权限点；params 为固定请求参数；fields 为白名单；
history 视图按 sessions 取序列；index_history 对每个指数分别取一次。
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .projection import pick
from .upstream import FetchResult, Upstream, UpstreamError

INDEX_CODES = ["000001.SH", "399001.SZ", "399006.SZ", "000688.SH", "000300.SH", "000905.SH", "000852.SH", "000985.SH"]

SUPPLEMENT: Dict[str, Dict[str, Any]] = {
    "index_overview": {
        "service": "public-market-index-position", "view": "overview", "perm": "page.overview", "params": {},
        "fields": ["date", "index_code", "index_name", "close", "valuation", "return_1d_pct", "return_20d_pct",
                   "drawdown_pct", "volatility_pct", "price_date", "valuation_date",
                   "valuation_position_252d_pct", "valuation_state_252d"],
    },
    "index_history": {
        "service": "public-market-index-position", "view": "history", "perm": "page.overview",
        "params": {"sessions": "60"}, "per_index": True,
        "fields": ["date", "index_code", "close", "valuation", "status"],
    },
    "pool_counts": {
        "service": "public-limit-pool-structure", "view": "pool-counts", "perm": "page.overview", "params": {},
        "fields": ["pool", "window_days", "count", "status", "reason", "latest_date", "lag_days"],
    },
    "participation_history": {
        "service": "public-market-participation", "view": "history", "perm": "page.participation",
        "params": {"sessions": "60"},
        "fields": ["date", "heat", "participation_state", "turnover", "relative_turnover",
                   "low_participation_days", "duration_is_lower_bound", "selling_pressure_pct", "pressure_state",
                   "selling_share_reference_pct", "buy_sell_change_pp"],
    },
    "compensation_history": {
        "service": "public-market-compensation", "view": "history-position", "perm": "page.participation",
        "params": {"sessions": "60"}, "fields": ["date", "compensation_pct"],
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


async def load(up: Upstream, name: str, trade_date: Optional[str]) -> Dict[str, Any]:
    """返回 {rows: [...]} 或 {rows: None, reason: str}。失败不抛出，只标注。"""
    spec = SUPPLEMENT[name]
    targets = [{"index_code": c} for c in INDEX_CODES] if spec.get("per_index") else [{}]
    rows: List[Dict[str, Any]] = []
    for extra in targets:
        params = {"view": spec["view"], "trade_date": trade_date or "latest",
                  "fields": ",".join(spec["fields"]), **spec["params"], **extra}
        try:
            res: FetchResult = await up.fetch(spec["service"], params)
        except UpstreamError:
            if spec.get("per_index"):
                continue
            return {"rows": None, "reason": "暂不可用"}
        rows.extend(pick(r, spec["fields"]) for r in res.rows if isinstance(r, dict))
    return {"rows": rows, "reason": None}
