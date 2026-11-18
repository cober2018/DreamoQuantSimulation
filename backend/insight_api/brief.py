"""每日事实要点（ZS-109 R1）：按固定规则从各页模块输出中提炼「今天哪里不一样」。

只陈述数值与参照，不含建议或带判断色彩的形容词；每条要点带指标、数值、参照、数据日期与口径来源，
nature 一律为「统计」。网页首页、小程序首屏与 MCP 共用本函数（R2 接入）。阈值为初稿，R1 回放后由用户定。
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

# 要点正文禁用词：建议、判断色彩的形容词。命中即视为模板缺陷，回放和上线前都要扫
BANNED_WORDS = ("建议", "买入", "卖出建议", "加仓", "减仓", "仓位", "关注", "值得", "机会", "抄底", "逃顶", "利好", "利空",
                "看多", "看空", "低位", "高位", "过热", "过冷", "见底", "见顶", "风险偏好", "强势", "弱势", "收益预测", "必然")

MAX_FACTS = 8
MAX_PER_KIND = 2


def _num(v: Any) -> Optional[float]:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f else None


def _pct(v: float, digits: int = 1) -> str:
    return f"{v * 100:.{digits}f}%"


def _signed(v: float, digits: int = 2, unit: str = "") -> str:
    return f"{v:+.{digits}f}{unit}"


def _fact(kind: str, statement: str, strength: float, data_date: Optional[str], source: str,
          fields: List[str], **extra) -> Dict[str, Any]:
    return {"kind": kind, "statement": statement, "strength": round(max(0.0, min(100.0, strength)), 1),
            "data_date": data_date, "source": source, "fields": fields, "nature": "统计", **extra}


def _data(env: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not env or env.get("status") not in ("ok", "partial"):
        return {}
    return env.get("data") or {}


# ---------------- 规则 ----------------

def r1_amount_extreme(part, _prev, d):
    obs = part.get("participation_observation") or {}
    p, amt = _num(obs.get("participation_pctile_60d")), _num(obs.get("total_amount_billion"))
    if p is None or amt is None or 10 < p < 90:
        return []
    return [_fact("极值", f"两市成交额 {amt:,.0f} 亿元，处在此前 60 个交易日的第 {p:.0f} 百分位", abs(p - 50) * 2, d,
                  "参与度与资金环境 · 成交额历史分位", ["total_amount_yi", "participation_pctile_60d"])]


def r2_low_streak(part, _prev, d):
    obs = part.get("participation_observation") or {}
    n = _num(obs.get("low_participation_streak"))
    if n is None or n < 3:
        return []
    return [_fact("连续", f"成交额已连续 {int(n)} 个交易日处于此前 60 日第 20 百分位以下", 50 + 10 * n, d,
                  "参与度与资金环境 · 成交额历史分位", ["low_participation_streak"],
                  definition="数据中台口径：参与度热度（60 日分位）< 20 的连续交易日数，缺数即中断")]


def r3_active_sell_change(part, prev_part, d):
    cur = _num((part.get("participation_observation") or {}).get("active_sell_ratio"))
    old = _num((prev_part.get("participation_observation") or {}).get("active_sell_ratio"))
    if cur is None or old is None:
        return []
    delta_pp = (cur - old) * 100
    if abs(delta_pp) < 2:
        return []
    return [_fact("变化", f"主动卖出占比 {_pct(cur)}，较前一交易日 {_signed(delta_pp, 1)} 个百分点", abs(delta_pp) * 15, d,
                  "参与度与资金环境 · 主动卖出占比", ["active_sell_ratio"])]


def r4_index_breadth(ov, _prev, d):
    chg, up, down = _num(ov.get("index_change_pct")), _num(ov.get("up_count")), _num(ov.get("down_count"))
    if chg is None or not up or down is None:
        return []
    ratio = up / (up + down)
    if not ((chg > 0 and ratio < 0.4) or (chg < 0 and ratio > 0.6)):
        return []
    return [_fact("背离", f"上证指数 {_signed(chg)}%，上涨家数占 {_pct(ratio)}（{int(up):,} / {int(up + down):,}）",
                  abs(ratio - 0.5) * 200 + min(abs(chg), 2) * 10, d, "市场总览 · 指数涨跌与涨跌家数",
                  ["index_change_pct", "up_count", "down_count"])]


def r5_erp_extreme(part, _prev, d):
    erp = part.get("erp") or {}
    val = _num(erp.get("erp_value_pct"))
    for key, label in (("erp_percentile_252d", "近一年"), ("erp_percentile_3y", "近三年")):
        p = _num(erp.get(key))
        if p is not None:
            break
    else:
        return []
    if val is None or 10 < p < 90:
        return []
    return [_fact("极值", f"股债收益差 {val:.2f}%，处在{label}第 {p:.0f} 百分位", abs(p - 50) * 2, d,
                  "参与度与资金环境 · 股债收益差", ["erp_value_pct", key])]


# PCR 来自期权，基差与持仓成交比来自股指期货，正文要写对品种
_DERIV_NAMES = {"basis_zscore_60d": ("股指期货", "基差"), "pcr_zscore_60d": ("期权", "PCR"),
                "oi_volume_crowding_zscore_60d": ("股指期货", "持仓成交比")}
_INSTRUMENTS = {"CSI300": "沪深300", "HS300": "沪深300", "CSI500": "中证500", "CSI1000": "中证1000", "SSE50": "上证50",
                "LEGACY50ETF": "上证50ETF"}


# 用户 11-18：期指 z 门槛从 2 提到 2.5（R1 回放 20 天 18 条 → 11 条），R2 回放后再确认
DERIV_Z_MIN = 2.5


def r6_derivatives(part, _prev, d):
    out = []
    for m in part.get("derivatives") or []:
        inst = _INSTRUMENTS.get(str(m.get("instrument")), str(m.get("instrument")))
        for key, (kind_name, name) in _DERIV_NAMES.items():
            z = _num(m.get(key))
            if z is not None and abs(z) >= DERIV_Z_MIN:
                out.append(_fact("极值", f"{inst} {kind_name}{name}的 60 日标准分为 {_signed(z)}", abs(z) * 33, d,
                                 "参与度与资金环境 · 衍生品统计", [key]))
    return out


def r7_style(part, _prev, d):
    out = []
    for c in ((part.get("style_strength") or {}).get("camps") or []):
        name, s, z = c.get("label"), _num(c.get("strength_score")), _num(c.get("z_score"))
        series = [v for v in (_num(x) for x in (c.get("strength_series") or [])) if v is not None]
        if s is None:
            continue
        if len(series) >= 10 and s <= min(series):
            out.append(_fact("极值", f"风格「{name}」强弱分 {s:.1f}，为近 {len(series)} 个交易日最低", 70, d,
                             "参与度与资金环境 · 风格强弱分", ["strength", "strength_series"]))
        elif len(series) >= 10 and s >= max(series):
            out.append(_fact("极值", f"风格「{name}」强弱分 {s:.1f}，为近 {len(series)} 个交易日最高", 70, d,
                             "参与度与资金环境 · 风格强弱分", ["strength", "strength_series"]))
        elif z is not None and abs(z) >= 1.5:
            out.append(_fact("极值", f"风格「{name}」强弱分 {s:.1f}，标准分 {_signed(z)}", abs(z) * 40, d,
                             "参与度与资金环境 · 风格强弱分", ["strength", "z_score"]))
    return out


log = logging.getLogger(__name__)


def _level1(ind, rule):
    """板块排名只看东财一级。整天都没有 level（ZS-116 之前的历史分区）时跳过该规则，不退回混合层级排名。"""
    items = ind.get("items") or []
    if items and all(r.get("level") is None for r in items):
        log.info("brief %s skipped: industries.level 全为空（ZS-116 之前的分区）", rule)
        return []
    return [r for r in items if _num(r.get("level")) == 1]


def _flows(rows):
    rows = [r for r in rows if _num(r.get("net_flow_1d")) is not None]
    return sorted(rows, key=lambda r: _num(r["net_flow_1d"]), reverse=True)


def r8_flow_rank(ind, _prev, d):
    rows = _flows(_level1(ind, "r8"))
    if len(rows) < 6:
        return []
    fmt = lambda rs: "、".join(f"{r['sector_name']} {_signed(_num(r['net_flow_1d']), 1)} 亿" for r in rs)
    return [_fact("排名", f"行业板块单日资金净流入前 3：{fmt(rows[:3])}；净流出前 3：{fmt(rows[-3:][::-1])}", 40, d,
                  "行业比较与轮动 · 资金净流入", ["net_flow_1d", "sector_name"])]


def r9_ma20_change(ind, prev_ind, d):
    old = {r.get("sector_code"): _num(r.get("above_ma20_ratio")) for r in (prev_ind.get("items") or [])}
    best = None
    for r in _level1(ind, "r9"):
        cur, o = _num(r.get("above_ma20_ratio")), old.get(r.get("sector_code"))
        if cur is None or o is None or (_num(r.get("member_count")) or 0) < 10:
            continue
        if best is None or abs(cur - o) > abs(best[1] - best[2]):
            best = (r, cur, o)
    if not best or abs(best[1] - best[2]) < 0.3:
        return []
    r, cur, o = best
    return [_fact("变化", f"「{r['sector_name']}」成分股站上 20 日均线的比例从 {_pct(o, 0)} 变为 {_pct(cur, 0)}",
                  abs(cur - o) * 100, d, "行业比较与轮动 · 站上 20 日线比例", ["above_ma20_ratio"])]


def r11_limit_structure(themes, prev_themes, part, prev_part, d):
    out = []
    s, ps = (themes.get("structure") or {}), (prev_themes.get("structure") or {})
    up, pup = _num(s.get("limit_up_count")), _num(ps.get("limit_up_count"))
    if up is not None and pup:
        chg = (up - pup) / pup
        if abs(chg) >= 0.3:
            out.append(_fact("变化", f"涨停 {int(up)} 家，前一交易日 {int(pup)} 家", min(abs(chg), 1.5) * 60, d,
                             "题材与涨跌结构 · 涨停数", ["limit_up_count"]))
    lus, plus = (part.get("limit_up_structure") or {}), (prev_part.get("limit_up_structure") or {})
    sr, psr = _num(lus.get("seal_rate")), _num(plus.get("seal_rate"))
    if sr is not None and psr is not None and abs(sr - psr) >= 0.1:
        out.append(_fact("变化", f"封板率 {_pct(sr)}，较前一交易日 {_signed((sr - psr) * 100, 1)} 个百分点",
                         abs(sr - psr) * 300, d, "参与度与资金环境 · 涨停结构", ["seal_rate"]))
    mx, pmx = _num(lus.get("max_consecutive_days")), _num(plus.get("max_consecutive_days"))
    if mx is not None and pmx is not None and mx != pmx:
        out.append(_fact("变化", f"最高连板 {int(mx)} 天，前一交易日 {int(pmx)} 天", 30 + abs(mx - pmx) * 10, d,
                         "参与度与资金环境 · 涨停结构", ["max_consecutive_days"]))
    return out


def r12_open5(hist, _prev, d):
    o5 = hist.get("open5") or {}
    r, cov = _num(o5.get("positive_open5_ratio")), _num(o5.get("coverage_ratio"))
    if r is None or (cov is not None and cov < 0.8) or 0.2 < r < 0.8:
        return []
    return [_fact("极值", f"开盘五分钟累计上涨的个股占 {_pct(r)}（样本覆盖 {_pct(cov or 0, 0)}）", abs(r - 0.5) * 200,
                  o5.get("trade_date") or d, "历史复盘 · 开盘五分钟统计", ["positive_open5_ratio", "coverage_ratio"])]


def schedule(cal: Dict[str, Any], d: Optional[str], days: int = 3, min_stars: int = 4, limit: int = 6) -> List[Dict[str, Any]]:
    """数据日之后 days 个自然日内、来源重要性 ≥ min_stars 的事件；AI 整理的事件带标识。"""
    if not d:
        return []
    start, end = date.fromisoformat(d), date.fromisoformat(d) + timedelta(days=days)
    out = []
    for e in cal.get("events") or []:
        try:
            day = date.fromisoformat(str(e.get("event_date"))[:10])
        except ValueError:
            continue
        stars = _num(e.get("source_importance"))
        if not (start < day <= end) or stars is None or stars < min_stars or not e.get("title"):
            continue
        out.append({"kind": "日程", "date": str(day), "time": e.get("event_time") or "待定", "country": e.get("country"),
                    "title": e["title"], "stars": int(stars), "ai_curated": e.get("ai_curated") is True,
                    "statement": f"{day.month}月{day.day}日 {e.get('event_time') or '时间待定'} {e['title']}（{'★' * int(stars)}）"
                                 + ("〔AI 整理〕" if e.get("ai_curated") is True else ""),
                    "source": "事件日历", "fields": ["event_date", "event_time", "title", "source_importance", "ai_curated"],
                    "nature": "统计"})
    out.sort(key=lambda x: (x["date"], x["time"]))
    return out[:limit]


def banned_hits(text: str) -> List[str]:
    return [w for w in BANNED_WORDS if w in text]


def daily_brief(today: Dict[str, Dict[str, Any]], prev: Optional[Dict[str, Dict[str, Any]]] = None) -> Dict[str, Any]:
    """today / prev：{"overview","participation","industries","themes","history","calendar"} → 各页模块输出（envelope）。"""
    prev = prev or {}
    t = {k: _data(v) for k, v in today.items()}
    p = {k: _data(v) for k, v in prev.items()}
    dd = {k: (v or {}).get("trade_date") for k, v in today.items()}
    facts: List[Dict[str, Any]] = []
    facts += r1_amount_extreme(t.get("participation", {}), None, dd.get("participation"))
    facts += r2_low_streak(t.get("participation", {}), None, dd.get("participation"))
    facts += r3_active_sell_change(t.get("participation", {}), p.get("participation", {}), dd.get("participation"))
    facts += r4_index_breadth(t.get("overview", {}), None, dd.get("overview"))
    facts += r5_erp_extreme(t.get("participation", {}), None, dd.get("participation"))
    facts += r6_derivatives(t.get("participation", {}), None, dd.get("participation"))
    facts += r7_style(t.get("participation", {}), None, dd.get("participation"))
    facts += r8_flow_rank(t.get("industries", {}), None, dd.get("industries"))
    facts += r9_ma20_change(t.get("industries", {}), p.get("industries", {}), dd.get("industries"))
    facts += r11_limit_structure(t.get("themes", {}), p.get("themes", {}), t.get("participation", {}),
                                 p.get("participation", {}), dd.get("themes"))
    facts += r12_open5(t.get("history", {}), None, dd.get("history"))

    facts.sort(key=lambda f: f["strength"], reverse=True)
    picked, per_kind = [], {}
    for f in facts:
        if per_kind.get(f["kind"], 0) >= MAX_PER_KIND:
            continue
        per_kind[f["kind"]] = per_kind.get(f["kind"], 0) + 1
        picked.append(f)
        if len(picked) >= MAX_FACTS:
            break
    sched = schedule(t.get("calendar", {}), dd.get("calendar") or dd.get("overview"))
    hits = sorted({w for f in [*facts, *sched] for w in banned_hits(f["statement"])})
    return {"data_date": dd.get("overview") or dd.get("participation"), "facts": picked, "candidates": len(facts),
            "schedule": sched, "banned_word_hits": hits,
            "disclaimer": "以上为按固定规则计算的市场统计事实，不构成投资建议。"}
