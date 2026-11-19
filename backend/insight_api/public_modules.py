"""各页面经投研平台 public-* 事实视图取数（openspec govern-upstream-via-public-services-v1 D4）。

对外响应与 modules.py（review-* 链路）逐字段一致：前端、小程序不改。按页切换由 INSIGHT_PUBLIC_PAGES 控制，
同一页的全部模块同时走 public-*。字段映射见 field-inventory.md 第五节。
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from .content_scope import gap
from .modules import (
    CALENDAR_FIELDS, DERIVATIVE_FIELDS, DERIVATIVE_HISTORY_FIELDS, ERP_FIELDS, FIELD_UNITS, IDX_TYPES, INDUSTRY_FIELDS, LIMIT_UP_FIELDS,
    OPEN5_FIELDS, PARTICIPATION_OBS_FIELDS, SEAL_BUCKETS, SERIES_FIELDS, SMART_MONEY_FACTOR_KEYS, STYLE_CAMP_FIELDS,
    VALUATION_FIELDS, _bottom_conditions, _ratio, structure_stats,
)
from .projection import clean, envelope, first, issue_gaps, pick, status_from, to_float, to_int
from .upstream import FetchResult, Upstream, UpstreamError

BREADTH = ("public-market-participation", "breadth")
OBSERVATION = ("public-market-participation", "observation")
BOTTOM = ("public-market-participation", "bottom-observation")
ERP = ("public-market-compensation", "erp-filter")
VALUATION = ("public-market-compensation", "valuation-breadth")
SHORT = ("public-market-short-feedback", "current")
FACTORS = ("public-market-capital-behavior", "factor-breadth")
DERIVATIVES = ("public-market-derivatives", "raw-stats")
DERIVATIVES_HISTORY = ("public-market-derivatives", "raw-stats-history")
STYLE = ("public-market-style-rotation", "current")
FACTS = ("public-industry-review", "facts")
SERIES = ("public-industry-review", "series")
CALENDAR = ("public-forward-risk-events", "calendar-facts")
SHARE_UNLOCK = ("public-share-unlock", "calendar")
THEMES = ("public-theme-limit-stats", "themes")
LADDER = ("public-theme-limit-stats", "ladder")
SEAL = ("public-theme-limit-stats", "seal-time")
POOL_CURRENT = ("public-limit-pool-structure", "current")
POOL_HISTORY = ("public-limit-pool-structure", "history")
POOL_COUNTS = ("public-limit-pool-structure", "pool-counts")
OPEN5 = ("public-daily-review-summary", "open5")

# 上游改名对照（field-inventory 5.2）：本平台输出名 → 事实视图字段名
INDUSTRY_RENAME = {"sector_code": "industry_code", "sector_name": "industry_name", "turnover_rate": "turnover_rate_1d"}
OPEN5_PUBLIC = {**OPEN5_FIELDS, "over_response_ratio": "over_response_ratio"}
CALENDAR_PUBLIC = {**CALENDAR_FIELDS, "event_id": "event_ref", "previous_value": "previous_value",
                   "actual_value": "actual_value", "consensus_value": "consensus_value",
                   "consensus_source": "consensus_source"}
# ZS-104：AI 周报整理的事件由投研平台在合同里打标识（布尔，展示时须标明「AI 整理」）。
# 上游拒绝未公开字段：必须在投研平台发布 ai_curated 之后再部署本值；置空即回到不请求、不显示
CALENDAR_AI_FIELD = "ai_curated"
# short-feedback 以百分数给出（如 seal_rate_pct=38.78），本平台沿用比例口径（0.3878）；待投研平台确认是否改给原始值
SHORT_MAP = {"seal_rate": ("seal_rate_pct", 0.01), "consecutive_board_count": ("consecutive_count", 1),
             "max_consecutive_days": ("maximum_boards", 1), "first_board_premium": ("first_board_return_pct", 1),
             "broken_repair_rate": ("repair_rate_pct", 0.01)}
STYLE_RENAME = {"label": "name", "strength_score": "strength", "source_date": "date"}
FACTOR_PUBLIC_KEYS = {key: key for key, _ in SMART_MONEY_FACTOR_KEYS.values()}
FACTOR_PUBLIC_KEYS["uncrowded_liquidity"] = "uncongested_liquidity"


# 每个视图只请求本平台用到的字段（field-inventory.md 第五节）；上游多返回的字段由投影丢弃
REQUEST_FIELDS = {
    BREADTH: ["index_code", "index_change_pct", "up_count", "down_count", "turnover_yi"],
    OBSERVATION: ["trade_date", "source_trade_date", "total_amount_yi", "count_stocks", "amount_ratio_20d",
                  "participation_pctile_60d", "participation_pctile_250d", "low_participation_streak",
                  "active_sell_ratio", "sell_pressure_change_1d", "sell_pressure_change_3d", "order_imbalance",
                  "order_imbalance_delta_1d", "data_status", "status_reason", "calc_version"],
    BOTTOM: ["trade_date", "history_obs", "data_status", "calc_version", "conditions"],
    ERP: ERP_FIELDS,
    VALUATION: VALUATION_FIELDS,
    SHORT: [src for src, _ in SHORT_MAP.values()],
    FACTORS: ["factor", "display", "net_breadth", "pos_share", "neg_share"],
    DERIVATIVES: [("oi_volume_ratio_zscore_60d" if f == "oi_volume_crowding_zscore_60d" else f) for f in DERIVATIVE_FIELDS],
    DERIVATIVES_HISTORY: DERIVATIVE_HISTORY_FIELDS,
    STYLE: ["key", "name", "index_name", "index_code", "strength", "z_score", "strength_series", "missing_reason", "date",
            "available"],
    FACTS: ["industry_code", "industry_name", "idx_type", "level", "sector_return", "sector_return_5d", "sector_return_20d",
            "sector_return_60d", "amount", "turnover_rate_1d", "up_num", "down_num", "member_count", "up_stock_ratio",
            "above_ma20_ratio", "new_high_20d_ratio", "di", "market_amount_share", "amount_ratio_ma20", "rs_ratio",
            "rs_momentum", "net_flow_1d", "net_flow_5d", "net_flow_20d", "coverage_ratio", "is_fallback"],
    SERIES: ["trade_date", *SERIES_FIELDS, "coverage_ratio"],
    CALENDAR: list(dict.fromkeys([*CALENDAR_PUBLIC.values(), *([CALENDAR_AI_FIELD] if CALENDAR_AI_FIELD else [])])),
    THEMES: ["theme", "up_count", "broken_count", "highest_tier", "avg_pct"],
    LADDER: ["tier", "count"],
    SEAL: ["theme", "bucket", "count"],
    POOL_CURRENT: ["trade_date", "tier_counts", "broken_board_count", "limit_down_count"],
    POOL_HISTORY: ["trade_date", "tier_counts", "broken_board_count", "limit_down_count"],
    POOL_COUNTS: ["pool", "window_days", "count", "status", "reason", "latest_date", "lag_days"],
    OPEN5: list(OPEN5_PUBLIC.values()),
}


def _ctx(res: FetchResult) -> Dict[str, Any]:
    c = res.meta.get("context")
    return c if isinstance(c, dict) else {}


def _date(res: FetchResult) -> Optional[str]:
    d = res.meta.get("trade_date")
    return str(d)[:10] if d else None


def _source(service_key: str, res: FetchResult) -> Dict[str, Any]:
    c = _ctx(res)
    return {"service_key": service_key, "source_date": _date(res), "snapshot_time": c.get("snapshot_time"),
            "coverage_ratio": clean(to_float(c.get("coverage_ratio"))),
            "missing_sources": [str(x) for x in c.get("missing_sources") or []]}


def _latest(res: FetchResult) -> Optional[str]:
    d = _ctx(res).get("latest_available_date")
    return str(d)[:10] if d else None


async def _get(up: Upstream, target, trade_date: Optional[str], **params) -> FetchResult:
    service, view = target
    return await up.fetch(service, {"view": view, "trade_date": trade_date or "latest",
                                    "fields": ",".join(REQUEST_FIELDS[target]), **params})


def _rename(row: Dict[str, Any], fields: List[str], rename: Dict[str, str]) -> Dict[str, Any]:
    return pick(row, {f: rename.get(f, f) for f in fields})


def _series_values(series: Any) -> Optional[List[Any]]:
    """事实视图的序列是 [{sequence, value}]，本平台对外沿用 review-* 的数字数组（按 sequence 升序）。"""
    if not isinstance(series, list):
        return series
    if not any(isinstance(p, dict) for p in series):
        return series
    # 只转换合同内的 {sequence, value}；出现其他键就原样返回，交给出口禁止键守卫判定，不在这里悄悄丢掉
    if any(not isinstance(p, dict) or not set(p) <= {"sequence", "value"} for p in series):
        return series
    points = sorted((p for p in series if isinstance(p, dict)), key=lambda p: to_int(p.get("sequence")) or 0)
    return [clean(to_float(p.get("value"))) for p in points]


def _ai_flag(row: Dict[str, Any]) -> Optional[bool]:
    """只认明确的真值；字段缺失或上游旧版本返回 None，页面不显示标签。"""
    if not CALENDAR_AI_FIELD or CALENDAR_AI_FIELD not in row:
        return None
    v = row.get(CALENDAR_AI_FIELD)
    if isinstance(v, str):
        return v.strip().lower() in ("true", "1", "yes", "ai")
    return bool(v) if isinstance(v, (bool, int)) else False


# ---------------- 总览 ----------------
async def overview(up: Upstream, trade_date: Optional[str]) -> Dict[str, Any]:
    ids = ["CNT-002", "CNT-004"]
    res = await _get(up, BREADTH, trade_date)
    row = first(res.rows)
    if not row:
        return envelope("overview", ids, up.data_mode, status="empty", trade_date=trade_date,
                        latest_available_date=_latest(res))
    gaps: List[Dict[str, Any]] = []
    up_n, down_n = to_int(row.get("up_count")), to_int(row.get("down_count"))
    total = (up_n or 0) + (down_n or 0)
    data = {
        "index_code": row.get("index_code") or None,
        "index_change_pct": clean(to_float(row.get("index_change_pct"))),
        "up_count": up_n,
        "down_count": down_n,
        "up_ratio": clean(up_n / total) if total and up_n is not None else None,
        "turnover_yi": clean(to_float(row.get("turnover_yi"))),  # 上游已换算为亿元，不再 ×1000
        "units": {"turnover_yi": "亿元", "index_change_pct": "%"},
    }
    td = _date(res)
    sources = [_source(BREADTH[0], res)]
    for target, extra in ((OBSERVATION, {}), (CALENDAR, {"event_family": "macro", "window_days": "14"})):
        try:
            sources.append(_source(target[0], await _get(up, target, td, **extra)))
        except UpstreamError as e:
            gaps.append(gap("CNT-002", f"{target[0]} 新鲜度不可用: {e}"))
    return envelope("overview", ids, up.data_mode, trade_date=td, status=status_from(gaps, res.issues),
                    sources=sources, gaps=gaps + issue_gaps("CNT-002", res.issues), data=data)


# ---------------- 参与度 ----------------
async def participation(up: Upstream, trade_date: Optional[str]) -> Dict[str, Any]:
    ids = ["CNT-006", "CNT-007", "CNT-008", "CNT-009", "CNT-010", "CNT-011", "CNT-013"]
    obs_res = await _get(up, OBSERVATION, trade_date)
    obs = first(obs_res.rows)
    if not obs:
        return envelope("participation", ids, up.data_mode, status="empty", trade_date=trade_date, gaps=[],
                        latest_available_date=_latest(obs_res))
    td = _date(obs_res)
    gaps: List[Dict[str, Any]] = []
    issues = list(obs_res.issues)
    blocks: Dict[str, Any] = {}

    async def one(target, cid: str, label: str):
        try:
            r = await _get(up, target, td)
        except UpstreamError as e:
            gaps.append(gap(cid, f"{label} 不可用: {e}"))
            return None, None
        issues.extend(r.issues)
        return first(r.rows), r

    erp, _ = await one(ERP, "CNT-007", "erp_filter_json")
    if erp is None:
        gaps.append(gap("CNT-007", "erp_filter_json 缺失或无法解析"))
    blocks["erp"] = pick(erp, ERP_FIELDS)
    val, _ = await one(VALUATION, "CNT-007", "valuation_filter_json")
    if val is None:
        gaps.append(gap("CNT-007", "valuation_filter_json 缺失或无法解析"))
    blocks["valuation"] = pick(val, VALUATION_FIELDS)
    short, _ = await one(SHORT, "CNT-008", "micro_atomic_json")
    if short is None:
        gaps.append(gap("CNT-008", "micro_atomic_json 缺失或无法解析"))
    lus = {}
    for out, (src, scale) in SHORT_MAP.items():
        cell = (short or {}).get(src)
        v = to_float(cell.get("value")) if isinstance(cell, dict) and cell.get("available") is not False else None
        lus[out] = clean(v * scale) if v is not None else None
        if out in ("consecutive_board_count", "max_consecutive_days") and lus[out] is not None:
            lus[out] = int(lus[out])
    blocks["limit_up_structure"] = {**{f: lus.get(f) for f in LIMIT_UP_FIELDS},
                                    "note": "首板溢价为历史观察值，不代表未来收益"}

    if obs.get("data_status") == "missing":
        gaps.append(gap("CNT-006", f"参与观察上游标记缺失: {obs.get('status_reason') or 'missing'}"))
        blocks["participation_observation"] = None
    else:
        picked = pick(obs, PARTICIPATION_OBS_FIELDS)
        picked["total_amount_billion"] = clean(to_float(obs.get("total_amount_yi")))  # 上游已为亿元，不再 ÷1e8
        picked["units"] = {"total_amount_billion": "亿元", "amount_ratio_20d": "倍（相对此前20日中位数）",
                           "participation_pctile_60d": "0–100，此前60个交易日成交额历史分位（不含目标日）",
                           "participation_pctile_250d": "0–100，此前250个交易日成交额历史分位",
                           "active_sell_ratio": "0–1，主动卖出占比"}
        blocks["participation_observation"] = picked

    try:
        der = await _get(up, DERIVATIVES, td)
        issues.extend(der.issues)
        blocks["derivatives"] = [pick({**m, "oi_volume_crowding_zscore_60d": m.get("oi_volume_ratio_zscore_60d")},
                                      DERIVATIVE_FIELDS) for m in der.rows if isinstance(m, dict)]
    except UpstreamError:
        gaps.append(gap("CNT-010", "derivatives_matrix_json 缺失或无法解析"))
        blocks["derivatives"] = []

    try:
        dh = await _get(up, DERIVATIVES_HISTORY, td, sessions="60")
        issues.extend(dh.issues)
        blocks["derivatives_history"] = [pick(m, DERIVATIVE_HISTORY_FIELDS) for m in dh.rows if isinstance(m, dict)]
    except UpstreamError:
        gaps.append(gap("CNT-010", "衍生品标准分历史不可用"))
        blocks["derivatives_history"] = []

    try:
        fac = await _get(up, FACTORS, td)
        blocks["smart_money_factors"] = _factors(fac)
        reason = _ctx(fac).get("factor_missing_reason")
    except UpstreamError as e:
        blocks["smart_money_factors"], reason = None, str(e)
    if blocks["smart_money_factors"] is None:
        gaps.append(gap("CNT-009", f"聪明钱五因子当日不可用: {reason or '上游缺数或门禁未通过'}"))

    try:
        sty = await _get(up, STYLE, td)
        camps = [_rename(c, STYLE_CAMP_FIELDS, STYLE_RENAME) for c in sty.rows if isinstance(c, dict)]
        camps = [{**c, "strength_series": _series_values(c.get("strength_series"))} for c in camps if c.get("available")]
        blocks["style_strength"] = {"camps": camps, "definition": "强度分为阵营指数相对强度的历史评分（0–100）；序列为近 20 个交易日"} if camps else None
    except UpstreamError:
        blocks["style_strength"] = None
    if blocks["style_strength"] is None:
        gaps.append(gap("CNT-011", "风格轮动序列当日不可用"))

    bottom, _ = await one(BOTTOM, "CNT-013", "next_state_json")
    blocks["bottom_conditions"] = _bottom_conditions(bottom)
    if blocks["bottom_conditions"] is None:
        gaps.append(gap("CNT-013", "底部条件观察值当日不可用"))

    status = "partial" if gaps or issues else "ok"
    return envelope("participation", ids, up.data_mode, trade_date=td, status=status,
                    sources=[_source(OBSERVATION[0], obs_res)], gaps=gaps + issue_gaps("CNT-007", issues), data=blocks)


def _factors(res: FetchResult) -> Optional[Dict[str, Any]]:
    c = _ctx(res)
    if c.get("factor_available") is False or not res.rows:
        return None
    by_key = {r.get("factor"): r for r in res.rows if isinstance(r, dict)}
    factors = []
    for _, (key, label) in SMART_MONEY_FACTOR_KEYS.items():
        r = by_key.get(FACTOR_PUBLIC_KEYS[key]) or {}
        factors.append({"key": key, "label": label, "net_breadth_pct": to_float(r.get("display")),
                        "net_breadth": to_float(r.get("net_breadth")), "pos_share": to_float(r.get("pos_share")),
                        "neg_share": to_float(r.get("neg_share"))})
    if all(f["net_breadth_pct"] is None and f["net_breadth"] is None for f in factors):
        return None
    return {
        "factors": factors,
        "sample_rows": to_int(c.get("factor_rows")),
        "pool_rows": to_int(c.get("factor_expected_pool_rows")),
        "breadth_threshold": to_float(c.get("factor_breadth_threshold")),
        "model_version": None,  # 事实视图不提供模型版本
        "trade_date": str(c.get("factor_date"))[:10] if c.get("factor_date") else None,
        "note": "净广度% = 该因子下偏多证据股票占比 − 偏空证据占比；截面统计，非个股或方向结论",
    }


# ---------------- 行业 ----------------
def _industry_source(res: FetchResult, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    entry = _source(FACTS[0], res)
    c = _ctx(res)
    if c.get("source_max_updated_at"):
        entry["snapshot_time"] = c.get("source_max_updated_at")
    cov = [v for v in (to_float(r.get("coverage_ratio")) for r in rows) if v is not None]
    if cov:
        entry["coverage_ratio"] = clean(sum(cov) / len(cov))
    entry["fallback_rows"] = sum(1 for r in rows if r.get("is_fallback") in (1, True, "1"))
    entry["row_count"] = len(rows)
    return entry


async def _facts(up: Upstream, trade_date: Optional[str], idx_type: str) -> FetchResult:
    return await _get(up, FACTS, trade_date, idx_type=idx_type)


async def industries(up: Upstream, trade_date: Optional[str], idx_type: str) -> Dict[str, Any]:
    ids = ["CNT-014", "CNT-015", "CNT-016", "CNT-020"]
    res = await _facts(up, trade_date, idx_type)
    if not res.rows:
        return envelope("industries", ids, up.data_mode, status="empty", trade_date=trade_date,
                        latest_available_date=_latest(res))
    # level：东财一级/二级/三级 = 1/2/3，概念、地域板块为 null；ZS-116 发版前的历史分区全是 null
    # field_status 的行号是本页 rows 的下标；在转换前按原下标挂到每一行上，排序后不会错位
    fs_map = (res.meta or {}).get("field_status") or {}
    items = []
    for idx, r in enumerate(res.rows):
        it = _rename(r, [*INDUSTRY_FIELDS, "level"], INDUSTRY_RENAME)
        st = fs_map.get(str(idx))
        if st:
            it["field_status"] = st
        items.append(it)
    items.sort(key=lambda x: (x["sector_return"] is None, -(x["sector_return"] or 0)))
    data = {"idx_type": idx_type, "idx_types": list(IDX_TYPES), "items": items, "units": FIELD_UNITS,
            "rrg_reference": 100, "notes": [str(n) for n in ((res.meta or {}).get("notes") or []) if isinstance(n, str)]}
    return envelope("industries", ids, up.data_mode, trade_date=_date(res), status=status_from([], res.issues),
                    sources=[_industry_source(res, res.rows)], gaps=issue_gaps("CNT-014", res.issues), data=data)


async def industry_series(up: Upstream, sector_code: str, end_date: Optional[str], days: int) -> Dict[str, Any]:
    ids = ["CNT-032", "CNT-015"]
    res = await _get(up, SERIES, end_date, industry_code=sector_code, sessions=str(days))
    rows = sorted(res.rows, key=lambda r: str(r.get("trade_date")))
    if not rows:
        return envelope("industry_series", ids, up.data_mode, status="empty", trade_date=end_date)
    head = rows[-1]
    c = _ctx(res)
    points = [{"trade_date": str(r["trade_date"])[:10], **pick(r, SERIES_FIELDS)} for r in rows[-days:]]
    gaps = []
    if len(points) < days or c.get("series_partial"):
        gaps.append(gap("CNT-032", f"查找窗口内仅找到 {len(points)}/{days} 个有数交易日，未插值"))
    data = {"sector_code": sector_code, "sector_name": c.get("industry_name") or res.meta.get("industry_name"),
            "idx_type": c.get("idx_type") or res.meta.get("idx_type"),
            "requested_days": days, "points": points, "units": FIELD_UNITS}
    return envelope("industry_series", ids, up.data_mode, trade_date=str(head["trade_date"])[:10],
                    status=status_from(gaps, res.issues), sources=[_industry_source(res, [head])],
                    gaps=gaps + issue_gaps("CNT-032", res.issues), data=data)


# ---------------- 题材 ----------------
def _board_counts(row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not isinstance(row, dict):
        return None
    ladder = {t.get("tier"): to_int(t.get("count")) for t in row.get("tier_counts") or [] if isinstance(t, dict)}
    limit_up = sum(v for v in ladder.values() if v is not None)
    broken = to_int(row.get("broken_board_count"))
    limit_down = to_int(row.get("limit_down_count"))
    touched = limit_up + (broken or 0)
    return {
        "limit_up_count": limit_up,
        "broken_board_count": broken,
        "limit_down_count": limit_down,
        "ladder": ladder,
        "broken_board_rate": {"value": clean(broken / touched) if touched and broken is not None else None,
                              "numerator": broken, "denominator": touched,
                              "definition": "炸板数 / (涨停数 + 炸板数)"},
        "limit_up_down_ratio": {"value": clean(limit_up / limit_down) if limit_down else None,
                                "numerator": limit_up, "denominator": limit_down},
    }


def _pool_counts(rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    counts: Dict[str, Any] = {}
    me: Dict[str, Any] = {}
    for r in rows:
        pool = str(r.get("pool") or "")
        if pool == "high_recognition":
            counts["high_recognition"] = pick(r, ["count", "status", "latest_date", "lag_days"])
        elif pool.startswith("momentum_extreme_"):
            me[pool[len("momentum_extreme_"):]] = pick(r, {"window_days": "window_days", "status": "status",
                                                           "reason": "reason", "latest_avail_date": "latest_date",
                                                           "count": "count"})
    if me:
        counts["momentum_extreme"] = me
    return counts or None


async def themes(up: Upstream, trade_date: Optional[str]) -> Dict[str, Any]:
    ids = ["CNT-022", "CNT-025", "CNT-027"]
    res = await _get(up, THEMES, trade_date)
    if not res.rows:
        return envelope("themes", ids, up.data_mode, status="empty", trade_date=trade_date,
                        latest_available_date=_latest(res))
    td = _date(res)
    gaps: List[Dict[str, Any]] = []
    issues = list(res.issues)
    sources = [_source(THEMES[0], res)]
    ranked = [pick(r, {"industry": "theme", "up_count": "up_count", "broken_count": "broken_count",
                       "highest_tier": "highest_tier", "avg_pct": "avg_pct"}) for r in res.rows if isinstance(r, dict)]
    names = {r["industry"] for r in ranked if r.get("industry")}

    seal: Dict[str, Dict[str, int]] = {}
    seal_total = 0
    try:
        sres = await _get(up, SEAL, td)
        labels = {b[0] for b in SEAL_BUCKETS}
        for d in sres.rows:
            if d.get("theme") in names and d.get("bucket") in labels:
                seal.setdefault(d["theme"], {})[d["bucket"]] = to_int(d.get("count")) or 0
        seal_total = to_int(_ctx(sres).get("limit_up_total")) or 0
        issues.extend(sres.issues)
    except UpstreamError as e:
        gaps.append(gap("CNT-022", f"封板时间明细不可用: {e}"))
    for r in ranked:
        r["seal_time_buckets"] = seal.get(r.get("industry"), {})
        r["avg_return_pct"] = r.pop("avg_pct", None)

    tiers: List[Dict[str, Any]] = []
    try:
        lres = await _get(up, LADDER, td)
        tiers = [pick(t, ["tier", "count"]) for t in lres.rows if isinstance(t, dict)]
    except UpstreamError as e:
        gaps.append(gap("CNT-022", f"连板梯队不可用: {e}"))

    structure = pools_counts = None
    history: List[Dict[str, Any]] = []
    try:
        cur = await _get(up, POOL_CURRENT, td)
        counts = _board_counts(first(cur.rows))
        if counts is None:
            gaps.append(gap("CNT-025", "股票池 ADS 当日缺行或 pool_summary 无法解析"))
        else:
            structure = counts
            sources.append(_source(POOL_CURRENT[0], cur))
        pools_counts = _pool_counts((await _get(up, POOL_COUNTS, td)).rows)
        if pools_counts is None:
            gaps.append(gap("CNT-027", "高标/动量极端等池计数当日不可用"))
        hist = await _get(up, POOL_HISTORY, td, sessions="10")
        for r in sorted(hist.rows, key=lambda x: str(x.get("trade_date"))):
            c = _board_counts(r)
            if c:
                history.append({"trade_date": str(r.get("trade_date"))[:10], "limit_up_count": c["limit_up_count"],
                                "broken_board_count": c["broken_board_count"], "limit_down_count": c["limit_down_count"],
                                "broken_board_rate": c["broken_board_rate"]["value"],
                                "max_ladder": max((k for k, v in c["ladder"].items() if v), default=None)})
    except UpstreamError as e:
        gaps.append(gap("CNT-025", f"股票池 ADS 不可用: {e}"))
    if structure is not None and len(history) < 2:
        gaps.append(gap("CNT-025", "历史序列不足 2 个交易日"))

    data = {
        "themes": ranked,
        "theme_member_rule": "按涨停个股所属行业归类（行业分类，非概念板块），仅统计当日进入题材榜的行业",
        "limit_up_sample_size": seal_total,
        "seal_time_buckets": [b[0] for b in SEAL_BUCKETS],
        "board_tiers": tiers,
        "structure": structure,
        "pools": pools_counts,
        "history": history,
        "units": {"avg_return_pct": "%"},
    }
    return envelope("themes", ids, up.data_mode, trade_date=td, status=status_from(gaps, issues),
                    sources=sources, gaps=gaps + issue_gaps("CNT-022", issues), data=data)


# ---------------- 历史复盘 ----------------
async def history(up: Upstream, trade_date: Optional[str], idx_type: str, period: str) -> Dict[str, Any]:
    ids = ["CNT-029", "CNT-030", "CNT-031"]
    gaps: List[Dict[str, Any]] = []
    res = await _facts(up, trade_date, idx_type)
    if not res.rows:
        return envelope("history", ids, up.data_mode, status="empty", trade_date=trade_date, gaps=gaps,
                        latest_available_date=_latest(res))
    flow_key = f"net_flow_{period}"
    items = [_rename(r, ["sector_code", "sector_name", "sector_return", "amount", "di", "above_ma20_ratio",
                         "net_flow_1d", "net_flow_5d", "net_flow_20d"], INDUSTRY_RENAME) for r in res.rows]
    ranking = sorted(
        ({"sector_code": i["sector_code"], "sector_name": i["sector_name"], "net_flow": i[flow_key],
          "sector_return": i["sector_return"]} for i in items),
        key=lambda x: (x["net_flow"] is None, -(x["net_flow"] or 0)),
    )
    td = _date(res)
    sources = [_industry_source(res, res.rows)]
    open5 = None
    try:
        ores = await _get(up, OPEN5, td)
        raw = first(ores.rows)
        if raw is None:
            gaps.append(gap("CNT-031", "每日复盘 ADS 当日缺行或 Open5 汇总无法解析"))
        else:
            open5 = pick(raw, OPEN5_PUBLIC)
            open5["definition"] = {
                "coverage_ratio": "open5_ready_count / expected_stock_count",
                "positive_open5_ratio": "开盘5分钟累计收益>0 且数据完整的占比 (分母 open5_ready_count)",
                "continuation_ratio": "收盘延续占比 (分母 close_ready_count)",
                "over_response_ratio": "过度反应占比 (分母 close_ready_count)",
            }
            sources.append(_source(OPEN5[0], ores))
    except UpstreamError as e:
        gaps.append(gap("CNT-031", f"每日复盘 ADS 不可用: {e}"))
    data = {"idx_type": idx_type, "period": period, "flow_unit": "亿元", "flow_ranking": ranking,
            "structure": structure_stats(items), "open5": open5}
    return envelope("history", ids, up.data_mode, trade_date=td,
                    status="partial" if gaps or res.issues else "ok", sources=sources,
                    gaps=gaps + issue_gaps("CNT-029", res.issues), data=data)


# ---------------- 事件日历 ----------------
async def calendar(up: Upstream, trade_date: Optional[str], days: int = 14) -> Dict[str, Any]:
    ids = ["CNT-034", "CNT-035"]
    # 事件族与窗口过滤、占位事件剔除由投研平台服务端完成
    res = await _get(up, CALENDAR, trade_date, event_family="macro", window_days=str(days))
    c = _ctx(res)
    td = _date(res)
    if not res.rows and not td:
        return envelope("calendar", ids, up.data_mode, status="empty", trade_date=trade_date,
                        latest_available_date=_latest(res))
    events = [{**pick(e, CALENDAR_PUBLIC), "ai_curated": _ai_flag(e)} for e in res.rows if isinstance(e, dict)]
    unlock_rows, unlock_gap = await _share_unlock_calendar(up)
    events.sort(key=lambda e: (str(e.get("event_date") or ""), str(e.get("event_time") or "")))
    data = {
        "window": {"start_date": c.get("window_start"), "end_date": c.get("window_end"),
                   "complete": c.get("window_complete")},
        "family_filter": "仅宏观日历事件；解禁/政策事件族不在本页范围",
        "view_days": days,
        "events": events,
        "consensus_label": "第三方发布的市场预期，非本平台预测",
        "share_unlock": unlock_rows,
        "share_unlock_label": "限售股解禁按参考价估算参考市值，不代表解禁日实际市值，不构成判断",
        "ai_curated_label": "标有「AI 整理」的事件由模型从公开资讯中整理，可能有遗漏或错误，请以官方发布为准",
    }
    status = status_from([], res.issues)
    if status == "ok" and not events:
        status = "empty"
    gaps = issue_gaps("CNT-034", res.issues) + ([unlock_gap] if unlock_gap else [])
    return envelope("calendar", ids, up.data_mode, trade_date=td, status=status,
                    sources=[_source(CALENDAR[0], res)], gaps=gaps, data=data)


async def _share_unlock_calendar(up: Upstream):
    """限售股解禁日历：窗口为上海时间今天 −7 至 +30。失败时返回 None 并记缺口，不影响宏观日历。"""
    from .modules import SHARE_UNLOCK_CALENDAR_FIELDS
    today = datetime.now(timezone(timedelta(hours=8))).date()
    try:
        res = await up.fetch(SHARE_UNLOCK[0], {
            "view": SHARE_UNLOCK[1], "from": (today - timedelta(days=7)).isoformat(),
            "to": (today + timedelta(days=30)).isoformat(), "limit": "100", "offset": "0",
            "fields": ",".join(SHARE_UNLOCK_CALENDAR_FIELDS)})
    except UpstreamError:
        return None, gap("CNT-034", "限售股解禁日历暂不可用")
    rows = [pick(r, SHARE_UNLOCK_CALENDAR_FIELDS) for r in res.rows if isinstance(r, dict)]
    rows.sort(key=lambda r: str(r.get("event_date") or ""))
    return rows, None
