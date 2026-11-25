"""各页面经投研平台 public-* 事实视图取数（openspec govern-upstream-via-public-services-v1 D4）。

对外响应与 modules.py（review-* 链路）逐字段一致：前端、小程序不改。按页切换由 INSIGHT_PUBLIC_PAGES 控制，
同一页的全部模块同时走 public-*。字段映射见 field-inventory.md 第五节。
"""

from __future__ import annotations

import asyncio
import re
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
LEVELS = ("public-industry-review", "overview")
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
MEMBERS = ("public-industry-members", "list")

# CNT-038 涨跌停个股名单：每只股票只取这四项事实
POOL_STOCK_FIELDS = ["stock_code", "stock_name", "change_pct", "first_seal_time"]
# 中台加上跌停梯队之前的字段清单；新清单被中台拒绝（4xx）时退回它，页面照常显示家数
POOL_CURRENT_LEGACY = ["trade_date", "tier_counts", "broken_board_count", "limit_down_count"]

# CNT-039 行业成分股统计：只取这 24 个字段（中台 public-industry-members / list 的全部对外字段）。
# 评分、名次、角色、资金方向、准入、任何挑出来的名单都不在这里，上游多给也会被丢掉
MEMBER_FIELDS = [
    "stock_code", "stock_name", "member_count",
    "change_pct", "change_5d_pct",
    "change_pct_percentile", "change_5d_pct_percentile", "days_above_industry_median_5d",
    "path_efficiency_5d", "max_drawdown_5d_pct", "top_day_gain_share_5d",
    "intraday_path_efficiency", "intraday_close_location", "intraday_late_move_share", "intraday_max_drawdown_pct",
    "open5_change_pct", "after_open5_change_pct",
    "large_order_net_5d", "large_order_net_20d", "large_order_net_positive_days", "active_net_amount_ratio_pct",
    "above_ma20", "ma20_deviation_pct", "is_3d_high",
]
# 可排序的字段：代码，加全部数值和真假字段（与中台合同一致）；默认按代码
MEMBER_SORT_FIELDS = frozenset(f for f in MEMBER_FIELDS if f not in ("stock_name", "member_count"))
# 字段名称和说明直接用中台返回的原文；出现这些词就不外露（合规硬约束，正常情况下不会命中）
MEMBER_BANNED_WORDS = ("强度", "机会", "主力", "吸筹", "派发", "准入", "推荐", "信号", "龙头")
# 个别列的显示名改用中性写法（只改名称，说明仍用中台原文）。中台原名是「近5日跑赢行业中位数天数」
MEMBER_LABEL_OVERRIDE = {"days_above_industry_median_5d": "近5日涨跌幅高于行业中位数的天数"}

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
# 衍生品「缺失原因」上游给的是英文代码，页面、小程序、MCP 一律给中文说明；未登记的代码不外露
DERIVATIVE_REASON_TEXT = {
    "csi1000_etf_option_not_listed": "没有对应的 ETF 期权，认沽认购比不提供",
    "star50_proxy": "没有对应的股指期货，基差、持仓比、成交持仓比不提供",
}
# 相对强度、相对动量：事实视图给的是以 0 为参考的小数（0.01 = 1 个百分点），不是以 100 为基准的刻度
RRG_REFERENCE = 0
RRG_UNIT = "小数（0.01 = 1 个百分点），0 为参考线"
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
    LEVELS: ["industry_code", "level"],
    SERIES: ["trade_date", *SERIES_FIELDS, "coverage_ratio"],
    CALENDAR: list(dict.fromkeys([*CALENDAR_PUBLIC.values(), *([CALENDAR_AI_FIELD] if CALENDAR_AI_FIELD else [])])),
    THEMES: ["theme", "up_count", "broken_count", "highest_tier", "avg_pct"],
    LADDER: ["tier", "count"],
    SEAL: ["theme", "bucket", "count"],
    POOL_CURRENT: [*POOL_CURRENT_LEGACY, "limit_down_tiers"],
    MEMBERS: MEMBER_FIELDS,
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


def _series_points(series: Any) -> tuple:
    """事实视图的序列是 [{sequence, date, value}]，本平台对外给数字数组和等长的日期数组（按 sequence 升序）。
    返回 (数值, 日期)；不是这个形状时原样返回 (series, None)，交给出口禁止键守卫判定，不在这里悄悄丢掉。"""
    if not isinstance(series, list) or not any(isinstance(p, dict) for p in series):
        return series, None
    if any(not isinstance(p, dict) or not set(p) <= {"sequence", "date", "value"} for p in series):
        return series, None
    points = sorted(series, key=lambda p: to_int(p.get("sequence")) or 0)
    dates = [str(p["date"])[:10] if p.get("date") else None for p in points]
    return [clean(to_float(p.get("value"))) for p in points], dates if any(dates) else None


def _reason_text(code: Any) -> Optional[str]:
    if not code:
        return None
    for prefix, text in DERIVATIVE_REASON_TEXT.items():
        if str(code).startswith(prefix):
            return text
    return "部分指标暂不提供"


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
        blocks["derivatives"] = [pick({**m, "oi_volume_crowding_zscore_60d": m.get("oi_volume_ratio_zscore_60d"),
                                       "missing_reason": _reason_text(m.get("missing_reason"))},
                                      DERIVATIVE_FIELDS) for m in der.rows if isinstance(m, dict)]
    except UpstreamError:
        gaps.append(gap("CNT-010", "derivatives_matrix_json 缺失或无法解析"))
        blocks["derivatives"] = []

    try:
        dh = await _get(up, DERIVATIVES_HISTORY, td, sessions="60")
        issues.extend(dh.issues)
        blocks["derivatives_history"] = [pick({**m, "missing_reason": _reason_text(m.get("missing_reason"))},
                                              DERIVATIVE_HISTORY_FIELDS) for m in dh.rows if isinstance(m, dict)]
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
        out = []
        for c in camps:
            if not c.get("available"):
                continue
            values, dates = _series_points(c.get("strength_series"))
            out.append({**c, "strength_series": values, "series_dates": dates})
        camps = out
        n = max((len(c["strength_series"]) for c in camps if isinstance(c["strength_series"], list)), default=0)
        blocks["style_strength"] = {"camps": camps, "definition": f"强度分为阵营指数相对强度的历史评分（0–100）；序列为近 {n} 个交易日"} if camps else None
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


# 最近一次成功取到的层级表。层级是板块代码的分类属性（一级 31、二级 128、三级 337，各交易日相同），不是当日行情；
# overview 视图偶尔慢或失败时沿用它，不让行业页多等一个超时
_LAST_LEVELS: Dict[str, int] = {}
LEVELS_TIMEOUT = 8.0


async def _levels(up: Upstream, trade_date: Optional[str], rows: List[Dict[str, Any]]) -> Dict[str, int]:
    """行业层级（东财一级 1、二级 2、三级 3）。facts 视图的 level 目前全为空，改用同一服务 overview 视图给出的 level；
    两处都是中台的原值，本平台不按名称推算。取不到时返回空，页面按全部行业显示并注明。"""
    own = {r.get("industry_code"): to_int(r.get("level")) for r in rows}
    if any(v in (1, 2, 3) for v in own.values()):
        return {k: v for k, v in own.items() if v in (1, 2, 3)}
    try:
        res = await asyncio.wait_for(_get(up, LEVELS, trade_date, idx_type="行业板块"), LEVELS_TIMEOUT)
    except (UpstreamError, asyncio.TimeoutError):
        return dict(_LAST_LEVELS)
    got = {r.get("industry_code"): to_int(r.get("level")) for r in res.rows if isinstance(r, dict)}
    got = {k: v for k, v in got.items() if v in (1, 2, 3)}
    if got:
        _LAST_LEVELS.clear()
        _LAST_LEVELS.update(got)
    return got or dict(_LAST_LEVELS)


async def industries(up: Upstream, trade_date: Optional[str], idx_type: str) -> Dict[str, Any]:
    ids = ["CNT-014", "CNT-015", "CNT-016", "CNT-020"]
    res = await _facts(up, trade_date, idx_type)
    if not res.rows:
        return envelope("industries", ids, up.data_mode, status="empty", trade_date=trade_date,
                        latest_available_date=_latest(res))
    # level：东财一级/二级/三级 = 1/2/3，概念、地域板块为 null；ZS-116 发版前的历史分区全是 null
    # field_status 的行号是本页 rows 的下标；在转换前按原下标挂到每一行上，排序后不会错位
    fs_map = (res.meta or {}).get("field_status") or {}
    levels = await _levels(up, _date(res), res.rows) if idx_type == "行业板块" else {}
    items = []
    for idx, r in enumerate(res.rows):
        it = _rename(r, [*INDUSTRY_FIELDS, "level"], INDUSTRY_RENAME)
        it["level"] = levels.get(it["sector_code"])
        st = {k: v for k, v in (fs_map.get(str(idx)) or {}).items() if not (k == "level" and it["level"])}
        if st:
            it["field_status"] = st
        items.append(it)
    items.sort(key=lambda x: (x["sector_return"] is None, -(x["sector_return"] or 0)))
    data = {"idx_type": idx_type, "idx_types": list(IDX_TYPES), "items": items,
            "units": {**FIELD_UNITS, "rs_ratio": RRG_UNIT, "rs_momentum": RRG_UNIT},
            "rrg_reference": RRG_REFERENCE, "notes": [str(n) for n in ((res.meta or {}).get("notes") or []) if isinstance(n, str)]}
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
            "requested_days": days, "points": points,
            "units": {**FIELD_UNITS, "rs_ratio": RRG_UNIT, "rs_momentum": RRG_UNIT}, "rrg_reference": RRG_REFERENCE}
    return envelope("industry_series", ids, up.data_mode, trade_date=str(head["trade_date"])[:10],
                    status=status_from(gaps, res.issues), sources=[_industry_source(res, [head])],
                    gaps=gaps + issue_gaps("CNT-032", res.issues), data=data)


def _member_columns(meta: Dict[str, Any]) -> List[Dict[str, Any]]:
    """各列的名称、单位、说明：用中台随数据返回的原文，本平台不另写。命中禁用词的名称或说明不外露。"""
    cols = meta.get("columns") if isinstance(meta.get("columns"), dict) else {}
    out = []
    for f in MEMBER_FIELDS:
        c = cols.get(f) if isinstance(cols.get(f), dict) else {}
        label, desc = c.get("name"), c.get("description")
        if label and f in MEMBER_LABEL_OVERRIDE:
            label = MEMBER_LABEL_OVERRIDE[f]
        if any(w in str(label or "") + str(desc or "") for w in MEMBER_BANNED_WORDS):
            label = desc = None
        if isinstance(desc, str):
            # 说明里的三个英文词换成页面上的写法（表格里就是这么显示的），其余文字不动
            desc = re.sub(r"\s*null\b", "空", re.sub(r"\btrue\b", "是", re.sub(r"\bfalse\b", "否", desc)))
        out.append({"key": f, "label": label, "unit": c.get("unit"), "kind": c.get("type"), "description": desc,
                    "sortable": f in MEMBER_SORT_FIELDS})
    return out


def _large_order_coverage(res: FetchResult) -> Optional[Dict[str, Any]]:
    """资金类数据的覆盖情况（按全部成分股算，不随分页变）：只取三个只数。中台旧版本没有这一项时返回 None，页面不显示这一行。"""
    cov = _ctx(res).get("large_order_coverage")
    if not isinstance(cov, dict):
        return None
    return {k: to_int(cov.get(k)) for k in ("with_daily_record", "with_5d_value", "member_count")}


async def industry_members(up: Upstream, sector_code: str, trade_date: Optional[str], idx_type: str,
                           sort_by: str, sort_order: str, limit: int, offset: int) -> Dict[str, Any]:
    """CNT-039 行业成分股逐只历史统计。排序参数原样交给中台（缺值总排在最后），本平台不做任何排序、打分或挑选；
    中台单页最多 500 行，这里取全后按 limit / offset 切片返回。"""
    ids = ["CNT-039"]
    res = await _get(up, MEMBERS, trade_date, industry_code=sector_code, idx_type=idx_type, sort_by=sort_by, sort_order=sort_order)
    rows = [pick(r, MEMBER_FIELDS) for r in res.rows if isinstance(r, dict)]
    if not rows:
        return envelope("industry_members", ids, up.data_mode, status="empty", trade_date=trade_date,
                        latest_available_date=_latest(res))
    data = {
        "sector_code": sector_code, "idx_type": idx_type,
        "member_count": next((r["member_count"] for r in rows if r.get("member_count") is not None), None),
        "sort_by": sort_by, "sort_order": sort_order,
        "pagination": {"limit": limit, "offset": offset, "total": len(rows), "has_more": offset + limit < len(rows)},
        "columns": _member_columns(res.meta or {}),
        "large_order_coverage": _large_order_coverage(res),
        "items": rows[offset:offset + limit],
        "note": "以上为历史数据统计，不构成投资建议。",
    }
    return envelope("industry_members", ids, up.data_mode, trade_date=_date(res), status=status_from([], res.issues),
                    sources=[_source(MEMBERS[0], res)], gaps=issue_gaps("CNT-039", res.issues), data=data)


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


def _stock_list(stocks: Any) -> Optional[List[Dict[str, Any]]]:
    """涨跌停个股名单：只留四项事实字段，顺序用中台给的（按涨跌幅），不重排。不是列表时返回 None。"""
    if not isinstance(stocks, list):
        return None
    return [pick(s, POOL_STOCK_FIELDS) for s in stocks if isinstance(s, dict)]


async def _pool_current(up: Upstream, trade_date: Optional[str]) -> FetchResult:
    """当日涨跌停结构。中台还没发布跌停梯队字段时，带新字段的请求会被拒绝（4xx），这时用原来的字段清单再取一次。"""
    try:
        return await _get(up, POOL_CURRENT, trade_date)
    except UpstreamError as e:
        if not (e.status and 400 <= e.status < 500):
            raise
    service, view = POOL_CURRENT
    return await up.fetch(service, {"view": view, "trade_date": trade_date or "latest", "fields": ",".join(POOL_CURRENT_LEGACY)})


def _tier_rank(tier: Any) -> int:
    """梯队名称的高低：首板 1、N 连板 N、高板排最后。原先按字符串比大小，会把「首板」排在「3连板」之上。"""
    s = str(tier)
    digits = "".join(ch for ch in s if ch.isdigit())
    return int(digits) if digits else 1 if "首" in s else 99 if "高" in s else 0


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
    seal: Dict[str, Dict[str, int]] = {}
    seal_total = 0
    try:
        sres = await _get(up, SEAL, td)
        labels = {b[0] for b in SEAL_BUCKETS}
        for d in sres.rows:
            if d.get("theme") and d.get("bucket") in labels:
                seal.setdefault(d["theme"], {})[d["bucket"]] = to_int(d.get("count")) or 0
        seal_total = to_int(_ctx(sres).get("limit_up_total")) or 0
        issues.extend(sres.issues)
    except UpstreamError as e:
        gaps.append(gap("CNT-022", f"封板时间明细不可用: {e}"))
    # 行业榜视图只列涨停不少于 3 只的行业；其余行业的涨停只数由封板时间视图按行业加总补齐，使归类覆盖当日全部涨停股
    listed = {r["industry"] for r in ranked if r.get("industry")}
    for name, buckets in seal.items():
        if name not in listed:
            ranked.append({"industry": name, "up_count": sum(buckets.values()), "broken_count": None,
                           "highest_tier": None, "avg_pct": None})
    ranked.sort(key=lambda r: -(to_int(r.get("up_count")) or 0))
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
    down_tiers: Optional[List[Dict[str, Any]]] = None
    history: List[Dict[str, Any]] = []
    try:
        cur = await _pool_current(up, td)
        pool_row = first(cur.rows)
        if isinstance(pool_row, dict):
            # 涨停名单挂到对应的梯队上；跌停梯队中台没给时保持 None（页面写「数据待更新」，不当作没有跌停）
            by_tier = {t.get("tier"): t for t in pool_row.get("tier_counts") or [] if isinstance(t, dict)}
            for t in tiers:
                stocks = _stock_list((by_tier.get(t.get("tier")) or {}).get("stocks"))
                if stocks is not None:
                    t["stocks"] = stocks
            if isinstance(pool_row.get("limit_down_tiers"), list):
                down_tiers = [{**pick(t, ["tier", "count"]), "stocks": _stock_list(t.get("stocks")) or []}
                              for t in pool_row["limit_down_tiers"] if isinstance(t, dict)]
        counts = _board_counts(pool_row)
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
                                "max_ladder": max((k for k, v in c["ladder"].items() if v and k), key=_tier_rank, default=None)})
    except UpstreamError as e:
        gaps.append(gap("CNT-025", f"股票池 ADS 不可用: {e}"))
    if structure is not None and len(history) < 2:
        gaps.append(gap("CNT-025", "历史序列不足 2 个交易日"))

    data = {
        "themes": ranked,
        "theme_member_rule": "按涨停个股所属行业归类（行业分类口径，不是概念题材）；炸板数、平均涨幅只对涨停不少于 3 只的行业提供",
        "theme_coverage": {"classified": sum(to_int(r.get("up_count")) or 0 for r in ranked), "total": seal_total or None},
        "limit_up_sample_size": seal_total,
        "seal_time_buckets": [b[0] for b in SEAL_BUCKETS],
        "board_tiers": tiers,
        "limit_down_tiers": down_tiers,
        "stock_list_scope": "个股名单和上方的涨停数、跌停数、炸板数、各梯队家数都只统计沪深 A 股，不含北交所；名单来自交易所涨跌停明细，每档最多列 300 只",
        "structure": structure,
        "pools": pools_counts,
        "history": history,
        "units": {"avg_return_pct": "%"},
    }
    return envelope("themes", ids, up.data_mode, trade_date=td, status=status_from(gaps, issues),
                    sources=sources, gaps=gaps + issue_gaps("CNT-022", issues), data=data)


# ---------------- 开盘五分钟与板块统计（原历史复盘；网页拆到参与度页、行业页，小程序与 MCP 仍用本接口）----------------
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
