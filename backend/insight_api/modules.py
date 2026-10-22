"""各页面模块的取数与投影（字段白名单见 openspec design D3）。"""

from __future__ import annotations

import statistics
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from .content_scope import gap
from .projection import (
    clean,
    envelope,
    first,
    is_bad,
    issue_gaps,
    missing_list,
    parse_json,
    pick,
    source_entry,
    split_sign,
    status_from,
    to_float,
    to_int,
)
from .upstream import Upstream, UpstreamError

SENTIMENT = "review-market-sentiment"
INDUSTRY = "review-industry"
FORWARD = "review-forward-risk"
THEME = "review-theme"
POOLS = "review-pools"
DAILY = "review-daily"
LIMIT_DETAIL = "review-limit-list-detail"

IDX_TYPES = ("行业板块", "概念板块", "地域板块")

INDUSTRY_FIELDS = [
    "sector_code", "sector_name", "idx_type",
    "sector_return", "sector_return_5d", "sector_return_20d", "sector_return_60d",
    "amount", "turnover_rate", "up_num", "down_num", "member_count",
    "up_stock_ratio", "above_ma20_ratio", "new_high_20d_ratio", "di",
    "market_amount_share", "amount_ratio_ma20",
    "rs_ratio", "rs_momentum",
    "net_flow_1d", "net_flow_5d", "net_flow_20d",
    "coverage_ratio", "is_fallback",
]

FIELD_UNITS = {
    "sector_return": "小数(0.015=+1.5%)", "sector_return_5d": "小数", "sector_return_20d": "小数",
    "sector_return_60d": "小数", "amount": "亿元", "net_flow_1d": "亿元", "net_flow_5d": "亿元",
    "net_flow_20d": "亿元", "turnover_yi": "亿元",
}

ERP_FIELDS = [
    "earnings_yield", "erp_value_pct", "yield_10y", "erp_change_5d_pct", "erp_change_20d_pct",
    "erp_percentile_252d", "erp_percentile_3y", "erp_percentile_5y", "yield_source_flag",
    "available_count", "total_count",
]
VALUATION_FIELDS = [
    "current_pe_median", "hist_90d_pe_median", "break_ratio_pct", "discount_pct",
    "available_count", "total_count",
]
LIMIT_UP_FIELDS = [
    "seal_rate", "consecutive_board_count", "max_consecutive_days",
    "first_board_premium", "broken_repair_rate",
]
DERIVATIVE_FIELDS = [
    "instrument", "basis_value", "basis_zscore_60d", "position_ratio", "pcr_value",
    "pcr_zscore_60d", "oi_volume_crowding_zscore_60d", "basis_source_date",
    "pcr_source_date", "position_source_date", "missing_reason",
]
CALENDAR_FIELDS = {
    "event_id": "event_id", "event_date": "event_date", "event_time": "event_time",
    "country": "country", "event_type_label": "event_type_label", "title": "title",
    "indicator_code": "indicator_code", "period": "period", "unit": "unit",
    "publication_status": "publication_status", "previous_value": "macro_previous_value",
    "actual_value": "macro_actual_value", "consensus_value": "macro_forecast_value",
    "consensus_source": "source", "source_importance": "source_importance",
}

# CNT-006: 只交付原始统计；状态标签 (participation_state 等)、图景文案、interpretation、复合分均不进入白名单
PARTICIPATION_OBS_FIELDS = [
    "trade_date", "source_trade_date", "count_stocks", "amount_ratio_20d",
    "participation_pctile_60d", "participation_pctile_250d", "low_participation_streak",
    "active_sell_ratio", "sell_pressure_change_1d", "sell_pressure_change_3d",
    "order_imbalance", "order_imbalance_delta_1d", "data_status", "calc_version",
]
OPEN5_FIELDS = {
    "trade_date": "trade_date", "metric_version": "metric_version", "expected_stock_count": "expected_stock_count",
    "open5_ready_count": "open5_ready_count", "close_ready_count": "close_ready_count",
    "open5_observed_count": "open5_observed_count", "open5_incomplete_count": "open5_incomplete_count",
    "open5_unavailable_count": "open5_unavailable_count", "coverage_ratio": "coverage_ratio",
    "positive_open5_ratio": "positive_open5_ratio", "continuation_ratio": "continuation_ratio",
    # 上游字段名含 "reaction"，会命中禁止键守卫 (action)，输出名改为 over_response_ratio
    "over_response_ratio": "overreaction_ratio", "data_status": "data_status",
}
# CNT-009: 上游因子键名含 "impact"（禁止模式），必须重命名为中性键后才能输出
SMART_MONEY_FACTOR_KEYS = {
    "informed_flow_direction": ("direction", "方向"),
    "informed_flow_persistence": ("persistence", "持续性"),
    "informed_flow_price_confirmation": ("price_confirmation", "价格确认"),
    "informed_flow_low_impact_stealth": ("stealth", "低冲击隐蔽"),
    "informed_flow_uncrowded_liquidity": ("uncrowded_liquidity", "非拥挤流动性"),
}
# CNT-011: 只取阵营级相对强度序列；leader/leader_label/signal/trend/acceleration（当前风格选择与加速度解读）不进白名单
STYLE_CAMP_FIELDS = ["key", "label", "index_name", "index_code", "strength_score", "z_score",
                     "strength_series", "source_date", "available", "missing_reason"]
THEME_RANK_FIELDS = ["industry", "up_count", "broken_count", "highest_tier", "avg_pct"]
# 封板时间分桶 (HHMMSS 整数, 左闭右开)
SEAL_BUCKETS = [
    ("09:30前（含集合竞价）", 0, 93000),
    ("09:30–10:00", 93000, 100000),
    ("10:00–11:30", 100000, 113000),
    ("13:00–14:00", 130000, 140000),
    ("14:00–15:00", 140000, 150001),
]

def _industry_sources(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    cov = [to_float(r.get("coverage_ratio")) for r in rows]
    cov = [c for c in cov if c is not None]
    entry = source_entry(INDUSTRY, first(rows), "source_max_updated_at",
                         statistics.mean(cov) if cov else None)
    entry["fallback_rows"] = sum(1 for r in rows if r.get("is_fallback") in (1, True, "1"))
    entry["row_count"] = len(rows)
    return entry


async def _optional_source(up: Upstream, service_key: str, trade_date: Optional[str], snapshot_key: str,
                           gaps: List[Dict[str, Any]], content_id: str) -> Optional[Dict[str, Any]]:
    """总览页只用这些来源报告新鲜度；失败时降级为缺口，不拖垮核心数据。"""
    try:
        res = await up.fetch(service_key, {"trade_date": trade_date}, max_rows=1)
    except UpstreamError as e:
        gaps.append(gap(content_id, f"{service_key} 新鲜度不可用: {e}"))
        return None
    row = first(res.rows)
    if not row:
        return source_entry(service_key, None)
    return source_entry(service_key, row, snapshot_key, row.get("coverage_ratio"),
                        missing_list(row.get("missing_sources_json")))


async def _latest_date(up: Upstream, service_key: str, trade_date: Optional[str],
                       params: Optional[Dict[str, str]] = None) -> Optional[str]:
    """所选日无数据时取上游最新一行的日期, 供页面跳转; 只报日期, 不拿该行冒充所选日。"""
    if not trade_date:
        return None
    res = await up.fetch(service_key, dict(params or {}), max_rows=1)
    row = first(res.rows)
    return str(row.get("trade_date"))[:10] if row and row.get("trade_date") else None


async def overview(up: Upstream, trade_date: Optional[str]) -> Dict[str, Any]:
    ids = ["CNT-002", "CNT-004"]
    res = await up.fetch(INDUSTRY, {"trade_date": trade_date, "idx_type": "行业板块"}, max_rows=1)
    row = first(res.rows)
    if not row:
        return envelope("overview", ids, up.data_mode, status="empty", trade_date=trade_date,
                        latest_available_date=await _latest_date(up, INDUSTRY, trade_date, {"idx_type": "行业板块"}))
    gaps: List[Dict[str, Any]] = []
    up_n, down_n = to_int(row.get("market_ctx_up_count")), to_int(row.get("market_ctx_down_count"))
    total = (up_n or 0) + (down_n or 0)
    data = {
        "index_code": row.get("market_ctx_index_code") or None,
        "index_change_pct": clean(to_float(row.get("market_ctx_index_change_pct"))),
        "up_count": up_n,
        "down_count": down_n,
        "up_ratio": clean(up_n / total) if total and up_n is not None else None,
        # 上游 market_ctx_turnover_billion 实为"千亿元"(千元金额 / 1e8, 实测 14.3 ≈ 1.43 万亿)，换算为亿元输出
        "turnover_yi": clean(to_float(row.get("market_ctx_turnover_billion")) * 1000
                             if to_float(row.get("market_ctx_turnover_billion")) is not None else None),
        "units": {"turnover_yi": "亿元", "index_change_pct": "%"},
    }
    td = row.get("trade_date")
    sources = [source_entry(INDUSTRY, row, "source_max_updated_at", row.get("coverage_ratio"),
                            missing_list(row.get("missing_sources")))]
    for key, snap in ((SENTIMENT, "snapshot_time"), (FORWARD, "snapshot_time")):
        s = await _optional_source(up, key, td, snap, gaps, "CNT-002")
        if s:
            sources.append(s)
    return envelope("overview", ids, up.data_mode, trade_date=td, status=status_from(gaps, res.issues),
                    sources=sources, gaps=gaps + issue_gaps("CNT-002", res.issues), data=data)


def _smart_money_factors(indicators: Any) -> Optional[Dict[str, Any]]:
    """CNT-009: 只投影五因子截面统计（净广度与正负占比）；共振评分、风险分、dual_run 等不进入响应。"""
    sm = indicators.get("smart_money") if isinstance(indicators, dict) else None
    metrics = sm.get("metrics") if isinstance(sm, dict) else None
    if not isinstance(metrics, dict) or metrics.get("available") is False:
        return None
    raw = metrics.get("raw")
    if not isinstance(raw, dict):
        return None
    display, net = raw.get("factor_display") or {}, raw.get("factor_net_breadth") or {}
    pos, neg = raw.get("factor_pos_share") or {}, raw.get("factor_neg_share") or {}
    factors = [{
        "key": key, "label": label,
        "net_breadth_pct": to_float(display.get(src)),
        "net_breadth": to_float(net.get(src)),
        "pos_share": to_float(pos.get(src)),
        "neg_share": to_float(neg.get(src)),
    } for src, (key, label) in SMART_MONEY_FACTOR_KEYS.items()]
    if all(f["net_breadth_pct"] is None and f["net_breadth"] is None for f in factors):
        return None
    threshold = to_float(raw.get("factor_breadth_threshold"))
    return {
        "factors": factors,
        "sample_rows": to_int(raw.get("rows")),
        "pool_rows": to_int(raw.get("candidate_expected_pool_rows")),
        "breadth_threshold": threshold,
        "model_version": raw.get("model_version"),
        "trade_date": str(raw.get("trade_date"))[:10] if raw.get("trade_date") else None,
        "note": "净广度% = 该因子下偏多证据股票占比 − 偏空证据占比；截面统计，非个股或方向结论",
    }


def _style_strength(rot: Any) -> Optional[Dict[str, Any]]:
    """CNT-011: 只投影各阵营相对强度序列；保持上游固定阵营顺序，不按强度排序、不输出 leader/signal。"""
    if not isinstance(rot, dict) or not isinstance(rot.get("camps"), list):
        return None
    camps = [pick(c, STYLE_CAMP_FIELDS) for c in rot["camps"] if isinstance(c, dict)]
    camps = [c for c in camps if c.get("available")]
    if not camps:
        return None
    return {
        "camps": camps,
        "definition": "强度分为阵营指数相对强度的历史评分（0–100）；序列为近 20 个交易日",
    }


def _bottom_conditions(ns: Any) -> Optional[Dict[str, Any]]:
    """CNT-013: 只投影三项条件观察值与阈值对比；下一状态预测、准备度总分与解读文字不进入响应。"""
    if not isinstance(ns, dict) or not isinstance(ns.get("conditions"), list):
        return None
    conds = [pick(c, ["key", "label", "value", "threshold", "condition"])
             for c in ns["conditions"] if isinstance(c, dict)]
    if not conds:
        return None
    return {
        "trade_date": str(ns.get("trade_date"))[:10] if ns.get("trade_date") else None,
        "history_obs": to_int(ns.get("history_obs")),
        "data_status": ns.get("data_status"),
        "calc_version": ns.get("calc_version"),
        "conditions": conds,
        "note": "条件值为当日观察值与规则阈值对比（met/near/unmet 为阈值比较结果），不构成状态预测",
    }


def _pool_counts(summary: Any) -> Optional[Dict[str, Any]]:
    """CNT-027: 只交付各池当日个股数与数据状态；池内名单、排序与风险指令（risk_summary）不进入响应。"""
    if not isinstance(summary, dict):
        return None
    hr, me = summary.get("high_recognition"), summary.get("momentum_extreme")
    counts: Dict[str, Any] = {}
    if isinstance(hr, dict):
        counts["high_recognition"] = pick(hr, ["count", "status", "latest_date", "lag_days"])
    if isinstance(me, dict) and me:
        counts["momentum_extreme"] = {
            k: pick(v, ["window_days", "status", "reason", "latest_avail_date", "count"])
            for k, v in me.items() if isinstance(v, dict)
        }
    return counts or None


async def participation(up: Upstream, trade_date: Optional[str]) -> Dict[str, Any]:
    ids = ["CNT-006", "CNT-007", "CNT-008", "CNT-009", "CNT-010", "CNT-011", "CNT-013"]
    res = await up.fetch(SENTIMENT, {"trade_date": trade_date}, max_rows=1)
    row = first(res.rows)
    gaps: List[Dict[str, Any]] = []
    if not row:
        return envelope("participation", ids, up.data_mode, status="empty", trade_date=trade_date, gaps=gaps,
                        latest_available_date=await _latest_date(up, SENTIMENT, trade_date))

    blocks: Dict[str, Any] = {}
    for name, column, fields, cid in (
        ("erp", "erp_filter_json", ERP_FIELDS, "CNT-007"),
        ("valuation", "valuation_filter_json", VALUATION_FIELDS, "CNT-007"),
        ("limit_up_structure", "micro_atomic_json", LIMIT_UP_FIELDS, "CNT-008"),
    ):
        parsed = parse_json(row.get(column))
        if is_bad(parsed) or parsed is None:
            gaps.append(gap(cid, f"{column} 缺失或无法解析"))
            parsed = None
        blocks[name] = pick(parsed, fields)
    blocks["limit_up_structure"]["note"] = "首板溢价为历史观察值，不代表未来收益"

    obs = parse_json(row.get("participation_observation_json"))
    if is_bad(obs) or not isinstance(obs, dict):
        gaps.append(gap("CNT-006", "participation_observation_json 缺失或无法解析"))
        blocks["participation_observation"] = None
    elif obs.get("data_status") == "missing":
        gaps.append(gap("CNT-006", f"参与观察上游标记缺失: {obs.get('status_reason') or 'missing'}"))
        blocks["participation_observation"] = None
    else:
        picked = pick(obs, PARTICIPATION_OBS_FIELDS)
        total = to_float(obs.get("total_amount"))
        picked["total_amount_billion"] = clean(total / 1e8) if total is not None else None
        picked["units"] = {"total_amount_billion": "亿元", "amount_ratio_20d": "倍（相对此前20日中位数）",
                           "participation_pctile_60d": "0–100，此前60个交易日成交额历史分位（不含目标日）",
                           "participation_pctile_250d": "0–100，此前250个交易日成交额历史分位",
                           "active_sell_ratio": "0–1，主动卖出占比"}
        blocks["participation_observation"] = picked

    matrix = parse_json(row.get("derivatives_matrix_json"))
    if is_bad(matrix) or not isinstance(matrix, list):
        gaps.append(gap("CNT-010", "derivatives_matrix_json 缺失或无法解析"))
        matrix = []
    blocks["derivatives"] = [pick(m, DERIVATIVE_FIELDS) for m in matrix if isinstance(m, dict)]

    indicators = parse_json(row.get("indicators_json"))
    blocks["smart_money_factors"] = _smart_money_factors(indicators)
    if blocks["smart_money_factors"] is None:
        sm = indicators.get("smart_money") if isinstance(indicators, dict) else None
        metrics = sm.get("metrics") if isinstance(sm, dict) else None
        reason = metrics.get("missing_reason") if isinstance(metrics, dict) else None
        gaps.append(gap("CNT-009", f"聪明钱五因子当日不可用: {reason or '上游缺数或门禁未通过'}"))

    blocks["style_strength"] = _style_strength(parse_json(row.get("style_rotation_json")))
    if blocks["style_strength"] is None:
        gaps.append(gap("CNT-011", "风格轮动序列当日不可用"))

    blocks["bottom_conditions"] = _bottom_conditions(parse_json(row.get("next_state_json")))
    if blocks["bottom_conditions"] is None:
        gaps.append(gap("CNT-013", "底部条件观察值当日不可用"))

    sources = [source_entry(SENTIMENT, row, "snapshot_time", row.get("coverage_ratio"),
                            missing_list(row.get("missing_sources_json")))]
    status = "partial" if gaps or res.issues else "ok"
    return envelope("participation", ids, up.data_mode, trade_date=row.get("trade_date"), status=status,
                    sources=sources, gaps=gaps + issue_gaps("CNT-007", res.issues), data=blocks)


async def _industry_rows(up: Upstream, trade_date: Optional[str], idx_type: str):
    return await up.fetch(INDUSTRY, {"trade_date": trade_date, "idx_type": idx_type})


async def industries(up: Upstream, trade_date: Optional[str], idx_type: str) -> Dict[str, Any]:
    ids = ["CNT-014", "CNT-015", "CNT-016", "CNT-020"]
    res = await _industry_rows(up, trade_date, idx_type)
    if not res.rows:
        return envelope("industries", ids, up.data_mode, status="empty", trade_date=trade_date,
                        latest_available_date=await _latest_date(up, INDUSTRY, trade_date, {"idx_type": idx_type}))
    items = [pick(r, INDUSTRY_FIELDS) for r in res.rows]
    items.sort(key=lambda x: (x["sector_return"] is None, -(x["sector_return"] or 0)))
    data = {"idx_type": idx_type, "idx_types": list(IDX_TYPES), "items": items, "units": FIELD_UNITS,
            "rrg_reference": 100}
    return envelope("industries", ids, up.data_mode, trade_date=res.rows[0].get("trade_date"),
                    status=status_from([], res.issues), sources=[_industry_sources(res.rows)],
                    gaps=issue_gaps("CNT-014", res.issues), data=data)


SERIES_FIELDS = ["sector_return", "net_flow_1d", "amount", "rs_ratio", "rs_momentum", "di"]


async def industry_series(up: Upstream, sector_code: str, end_date: Optional[str], days: int) -> Dict[str, Any]:
    ids = ["CNT-032", "CNT-015"]
    res = await up.fetch_range(INDUSTRY, end_date, days, {"industry_code": sector_code})
    rows = sorted(res.rows, key=lambda r: str(r.get("trade_date")))
    if not rows:
        return envelope("industry_series", ids, up.data_mode, status="empty", trade_date=end_date)
    head = rows[-1]
    rows = [r for r in rows if r.get("idx_type") == head.get("idx_type")][-days:]
    points = [{"trade_date": r["trade_date"], **pick(r, SERIES_FIELDS)} for r in rows]
    gaps = []
    if len(points) < days:
        gaps.append(gap("CNT-032", f"查找窗口内仅找到 {len(points)}/{days} 个有数交易日，未插值"))
    data = {"sector_code": sector_code, "sector_name": head.get("sector_name"), "idx_type": head.get("idx_type"),
            "requested_days": days, "points": points, "units": FIELD_UNITS}
    return envelope("industry_series", ids, up.data_mode, trade_date=head["trade_date"],
                    status=status_from(gaps, res.issues), sources=[_industry_sources([head])],
                    gaps=gaps + issue_gaps("CNT-032", res.issues), data=data)


def _seal_bucket(hhmmss: Any) -> Optional[str]:
    n = to_int(hhmmss)
    if n is None:
        return None
    for label, lo, hi in SEAL_BUCKETS:
        if lo <= n < hi:
            return label
    return None


def _board_counts(summary: Any) -> Optional[Dict[str, Any]]:
    """从股票池 ADS 的 pool_summary 取当日涨停/炸板/跌停计数；未知梯队即炸板，不计入涨停。"""
    if not isinstance(summary, dict):
        return None
    tiers = summary.get("board_tier_counts") or {}
    ladder = {k: to_int(v) for k, v in tiers.items() if k != "unknown"}
    limit_up = sum(v for v in ladder.values() if v is not None)
    broken = to_int(summary.get("broken_board_count"))
    limit_down = to_int(summary.get("limit_down_count"))
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


async def themes(up: Upstream, trade_date: Optional[str]) -> Dict[str, Any]:
    ids = ["CNT-022", "CNT-025", "CNT-027"]
    res = await up.fetch(THEME, {"trade_date": trade_date}, max_rows=1)
    row = first(res.rows)
    if not row:
        return envelope("themes", ids, up.data_mode, status="empty", trade_date=trade_date,
                        latest_available_date=await _latest_date(up, THEME, trade_date))
    td = str(row.get("trade_date"))[:10]
    gaps: List[Dict[str, Any]] = []
    sources = [source_entry(THEME, row, "snapshot_time", None, missing_list(row.get("missing_sources_json")))]

    rankings = parse_json(row.get("theme_rankings_json"))
    if is_bad(rankings) or not isinstance(rankings, list):
        gaps.append(gap("CNT-022", "theme_rankings_json 缺失或无法解析"))
        rankings = []
    ranked = [pick(r, THEME_RANK_FIELDS) for r in rankings if isinstance(r, dict)]
    names = {r["industry"] for r in ranked if r.get("industry")}

    # 封板时间分布: 涨停个股明细按所属行业归类；只取时间与行业，不输出个股
    seal: Dict[str, Dict[str, int]] = {}
    seal_total = 0
    try:
        detail = await up.fetch(LIMIT_DETAIL, {"trade_date": td, "board_type": "U"})
        for d in detail.rows:
            seal_total += 1
            ind = d.get("industry")
            label = _seal_bucket(d.get("first_board_time"))
            if ind in names and label:
                seal.setdefault(ind, {}).setdefault(label, 0)
                seal[ind][label] += 1
        issues = detail.issues
    except UpstreamError as e:
        gaps.append(gap("CNT-022", f"封板时间明细不可用: {e}"))
        issues = []
    for r in ranked:
        r["seal_time_buckets"] = seal.get(r.get("industry"), {})
        r["avg_return_pct"] = r.pop("avg_pct", None)

    tiers = parse_json(row.get("board_tiers_json"))
    tiers = [pick(t, ["tier", "count"]) for t in tiers if isinstance(t, dict)] if isinstance(tiers, list) else []

    # 股票池结构 (CNT-025) + 各池计数 (CNT-027): 当日计数 + 近 N 日历史
    structure = None
    pools_counts = None
    history: List[Dict[str, Any]] = []
    try:
        pool = await up.fetch(POOLS, {"trade_date": td}, max_rows=1)
        prow = first(pool.rows)
        summary = parse_json(prow.get("pool_summary_json")) if prow else None
        counts = _board_counts(summary)
        if counts is None:
            gaps.append(gap("CNT-025", "股票池 ADS 当日缺行或 pool_summary 无法解析"))
        else:
            structure = counts
            sources.append(source_entry(POOLS, prow, "snapshot_time", None, missing_list(prow.get("missing_sources_json"))))
        pools_counts = _pool_counts(summary)
        if pools_counts is None:
            gaps.append(gap("CNT-027", "高标/动量极端等池计数当日不可用"))
        series = await up.fetch_range(POOLS, td, 10)
        for r in sorted(series.rows, key=lambda x: str(x.get("trade_date"))):
            c = _board_counts(parse_json(r.get("pool_summary_json")))
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
    return envelope("themes", ids, up.data_mode, trade_date=td, status=status_from(gaps, res.issues + issues),
                    sources=sources, gaps=gaps + issue_gaps("CNT-022", res.issues + issues), data=data)


def _ratio(num: int, den: int) -> Dict[str, Any]:
    return {"value": clean(num / den) if den else None, "numerator": num, "denominator": den}


def structure_stats(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    returns = [to_float(i.get("sector_return")) for i in items]
    returns = [r for r in returns if r is not None]
    di = [v for v in (to_float(i.get("di")) for i in items) if v is not None]
    ma20 = [v for v in (to_float(i.get("above_ma20_ratio")) for i in items) if v is not None]
    amounts = sorted((v for v in (to_float(i.get("amount")) for i in items) if v is not None), reverse=True)
    comparable = diverged = 0
    for i in items:
        ok, diff = split_sign(to_float(i.get("net_flow_1d")), to_float(i.get("sector_return")))
        comparable += ok
        diverged += diff
    total_amount = sum(amounts)
    return {
        "rising_sector_ratio": _ratio(sum(1 for r in returns if r > 0), len(returns)),
        "di_mean": {"value": clean(statistics.mean(di)) if di else None, "denominator": len(di)},
        "above_ma20_ratio_median": {"value": clean(statistics.median(ma20)) if ma20 else None,
                                    "denominator": len(ma20)},
        "top10_amount_concentration": {
            "value": clean(sum(amounts[:10]) / total_amount) if total_amount else None,
            "numerator": clean(sum(amounts[:10])), "denominator": clean(total_amount), "unit": "亿元",
        },
        "flow_price_divergence_ratio": _ratio(diverged, comparable),
    }


async def history(up: Upstream, trade_date: Optional[str], idx_type: str, period: str) -> Dict[str, Any]:
    ids = ["CNT-029", "CNT-030", "CNT-031"]
    gaps: List[Dict[str, Any]] = []
    res = await _industry_rows(up, trade_date, idx_type)
    if not res.rows:
        return envelope("history", ids, up.data_mode, status="empty", trade_date=trade_date, gaps=gaps,
                        latest_available_date=await _latest_date(up, INDUSTRY, trade_date, {"idx_type": idx_type}))
    flow_key = f"net_flow_{period}"
    items = [pick(r, ["sector_code", "sector_name", "sector_return", "amount", "di", "above_ma20_ratio",
                      "net_flow_1d", "net_flow_5d", "net_flow_20d"]) for r in res.rows]
    ranking = sorted(
        ({"sector_code": i["sector_code"], "sector_name": i["sector_name"], "net_flow": i[flow_key],
          "sector_return": i["sector_return"]} for i in items),
        key=lambda x: (x["net_flow"] is None, -(x["net_flow"] or 0)),
    )
    td = str(res.rows[0].get("trade_date"))[:10]
    sources = [_industry_sources(res.rows)]
    open5 = None
    try:
        dres = await up.fetch(DAILY, {"trade_date": td}, max_rows=1)
        drow = first(dres.rows)
        raw = parse_json(drow.get("opening_price_discovery_json")) if drow else None
        if is_bad(raw) or not isinstance(raw, dict):
            gaps.append(gap("CNT-031", "每日复盘 ADS 当日缺行或 Open5 汇总无法解析"))
        else:
            open5 = pick(raw, OPEN5_FIELDS)
            open5["definition"] = {
                "coverage_ratio": "open5_ready_count / expected_stock_count",
                "positive_open5_ratio": "开盘5分钟累计收益>0 且数据完整的占比 (分母 open5_ready_count)",
                "continuation_ratio": "收盘延续占比 (分母 close_ready_count)",
                "over_response_ratio": "过度反应占比 (分母 close_ready_count)",
            }
            sources.append(source_entry(DAILY, drow, "snapshot_time", None, missing_list(drow.get("missing_sources_json"))))
    except UpstreamError as e:
        gaps.append(gap("CNT-031", f"每日复盘 ADS 不可用: {e}"))
    data = {"idx_type": idx_type, "period": period, "flow_unit": "亿元", "flow_ranking": ranking,
            "structure": structure_stats(items), "open5": open5}
    return envelope("history", ids, up.data_mode, trade_date=td,
                    status="partial" if gaps or res.issues else "ok", sources=sources,
                    gaps=gaps + issue_gaps("CNT-029", res.issues), data=data)


async def calendar(up: Upstream, trade_date: Optional[str], days: int = 14) -> Dict[str, Any]:
    ids = ["CNT-034", "CNT-035"]
    res = await up.fetch(FORWARD, {"trade_date": trade_date}, max_rows=1)
    row = first(res.rows)
    if not row:
        return envelope("calendar", ids, up.data_mode, status="empty", trade_date=trade_date,
                        latest_available_date=await _latest_date(up, FORWARD, trade_date))
    gaps: List[Dict[str, Any]] = []
    raw_events = parse_json(row.get("calendar_events_json"))
    if is_bad(raw_events) or (raw_events is not None and not isinstance(raw_events, list)):
        gaps.append(gap("CNT-034", "calendar_events_json 无法解析"))
        raw_events = []
    window = parse_json(row.get("calendar_window_json"))
    window = window if isinstance(window, dict) else {}
    # 只保留宏观日历族 (event_id "macro:")：lockup/policy 族为前瞻风险中心的解禁/政策事件，
    # 不在 CNT-034/035 审定范围；同时按锚点日前瞻 days 天窗口截取，避免一次下发全部事件
    anchor = str(row.get("trade_date"))[:10]
    try:
        end = (date.fromisoformat(anchor) + timedelta(days=days)).isoformat()
    except ValueError:
        anchor, end = "", ""
    events = [
        pick(e, CALENDAR_FIELDS)
        for e in (raw_events or [])
        # fallback_contract 是旧系统占位事件，不是真实日历
        if isinstance(e, dict) and e.get("source") != "fallback_contract"
        and str(e.get("event_id", "")).startswith("macro:")
        and (not anchor or anchor <= str(e.get("event_date") or "") < end)
    ]
    events.sort(key=lambda e: (str(e.get("event_date") or ""), str(e.get("event_time") or "")))
    data = {
        "window": pick(window, ["start_date", "end_date", "complete"]),
        "family_filter": "仅宏观日历事件；解禁/政策事件族不在本页范围",
        "view_days": days,
        "events": events,
        "consensus_label": "第三方发布的市场预期，非本平台预测",
    }
    sources = [source_entry(FORWARD, row, "snapshot_time", None, missing_list(row.get("missing_sources_json")))]
    status = status_from(gaps, res.issues)
    if status == "ok" and not events:
        status = "empty"
    return envelope("calendar", ids, up.data_mode, trade_date=row.get("trade_date"), status=status,
                    sources=sources, gaps=gaps + issue_gaps("CNT-034", res.issues), data=data)
