"""看板 × 指标目录（openspec govern-upstream-via-public-services-v1 D9 9.2）。

配置页与后端裁剪只认这里的编号。`paths` 是指标在本平台对外响应里的位置：
  `data.a.b`        删除 data.a 下的键 b
  `data.items[].x`  删除列表 data.items 每一项的键 x
  `data.c[key=k]`   删除列表 data.c 中 key 等于 k 的那一项
单位说明、definition、来源元数据、gaps 不算指标，始终返回。`upstream` 是依赖的 (服务, 视图, 字段)，用于上限判断。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

PAGES = {
    "overview": "市场总览", "participation": "参与度与资金环境", "industries": "行业比较与轮动",
    "themes": "题材与涨跌结构", "history": "开盘五分钟与板块统计", "calendar": "事件日历",
}
PAGE_OF_PERM = {f"page.{p}": p for p in PAGES}


@dataclass(frozen=True)
class Indicator:
    id: str
    page: str
    module: str
    module_label: str
    label: str
    unit: str
    cnt: str
    paths: Tuple[str, ...]
    upstream: Tuple[Tuple[str, str, str], ...]
    detail: bool = False


_ITEMS: List[Indicator] = []


def _add(page, module, module_label, cnt, rows, service, view, base="", detail=False):
    """rows: (指标键, 名称, 单位, 响应路径或 None, 上游字段或元组)"""
    for key, label, unit, path, fields in rows:
        fields = (fields,) if isinstance(fields, str) else tuple(fields)
        paths = (path,) if isinstance(path, str) else tuple(path or (f"{base}.{key}",))
        _ITEMS.append(Indicator(f"{page}.{module}.{key}", page, module, module_label, label, unit, cnt, paths,
                                tuple((service, view, f) for f in fields), detail))


# ---- 市场总览 ----
_add("overview", "market", "大盘与成交", "CNT-004", [
    ("index_change_pct", "指数涨跌幅", "%", None, ("index_code", "index_change_pct")),
    ("up_count", "上涨家数", "家", None, "up_count"),
    ("down_count", "下跌家数", "家", None, "down_count"),
    ("up_ratio", "上涨占比", "比例", None, ("up_count", "down_count")),
    ("turnover_yi", "全市场成交额", "亿元", None, "turnover_yi"),
], "public-market-participation", "breadth", base="data")

# ---- 参与度与资金环境 ----
P = "public-market-participation"
_add("participation", "observation", "市场参与与卖压", "CNT-006", [
    ("total_amount_billion", "全市场成交额", "亿元", None, "total_amount_yi"),
    ("count_stocks", "统计股票数", "只", None, "count_stocks"),
    ("amount_ratio_20d", "成交额 / 前 20 日中位数", "倍", None, "amount_ratio_20d"),
    ("participation_pctile_60d", "成交额分位（60 日）", "0–100", None, "participation_pctile_60d"),
    ("participation_pctile_250d", "成交额分位（250 日）", "0–100", None, "participation_pctile_250d"),
    ("low_participation_streak", "低参与连续天数", "交易日", None, "low_participation_streak"),
    ("active_sell_ratio", "主动卖出占比", "0–1", None, "active_sell_ratio"),
    ("sell_pressure_change_1d", "卖压缓和程度（1 日变化）", "正值为缓和", None, "sell_pressure_change_1d"),
    ("sell_pressure_change_3d", "卖压缓和程度（3 日变化）", "正值为缓和", None, "sell_pressure_change_3d"),
    ("order_imbalance", "委托失衡", "", None, "order_imbalance"),
    ("order_imbalance_delta_1d", "委托失衡 1 日变化", "", None, "order_imbalance_delta_1d"),
], P, "observation", base="data.participation_observation")
_add("participation", "erp", "股权风险溢价（ERP）", "CNT-007", [
    ("earnings_yield", "盈利收益率", "比例", None, "earnings_yield"),
    ("erp_value_pct", "ERP", "%", None, "erp_value_pct"),
    ("yield_10y", "10 年期国债收益率", "%", None, ("yield_10y", "yield_source_flag")),
    ("erp_change_5d_pct", "ERP 5 日变化", "百分点", None, "erp_change_5d_pct"),
    ("erp_change_20d_pct", "ERP 20 日变化", "百分点", None, "erp_change_20d_pct"),
    ("erp_percentile_252d", "ERP 近 252 日分位", "0–1", None, "erp_percentile_252d"),
    ("erp_percentile_3y", "ERP 近 3 年分位", "0–1", None, "erp_percentile_3y"),
    ("erp_percentile_5y", "ERP 近 5 年分位", "0–1", None, "erp_percentile_5y"),
], "public-market-compensation", "erp-filter", base="data.erp")
_add("participation", "valuation", "估值统计", "CNT-007", [
    ("current_pe_median", "当前 PE 中位数", "倍", None, "current_pe_median"),
    ("hist_90d_pe_median", "近 90 日 PE 中位数", "倍", None, "hist_90d_pe_median"),
    ("break_ratio_pct", "破净占比", "%", None, "break_ratio_pct"),
    ("discount_pct", "折价幅度", "%", None, "discount_pct"),
], "public-market-compensation", "valuation-breadth", base="data.valuation")
_add("participation", "limit_up", "涨停结构", "CNT-008", [
    ("seal_rate", "封板率", "比例", None, "seal_rate_pct"),
    ("consecutive_board_count", "连板股数", "只", None, "consecutive_count"),
    ("max_consecutive_days", "最高连板天数", "天", None, "maximum_boards"),
    ("first_board_premium", "首板溢价", "%", None, "first_board_return_pct"),
    ("broken_repair_rate", "炸板回封率", "比例", None, "repair_rate_pct"),
], "public-market-short-feedback", "current", base="data.limit_up_structure")
_add("participation", "smart_money", "聪明钱五因子", "CNT-009", [
    ("net_breadth_pct", "净广度%", "%", "data.smart_money_factors.factors[].net_breadth_pct", "display"),
    ("net_breadth", "净广度", "", "data.smart_money_factors.factors[].net_breadth", "net_breadth"),
    ("pos_share", "偏多占比", "比例", "data.smart_money_factors.factors[].pos_share", "pos_share"),
    ("neg_share", "偏空占比", "比例", "data.smart_money_factors.factors[].neg_share", "neg_share"),
], "public-market-capital-behavior", "factor-breadth")
_add("participation", "derivatives", "衍生品原始统计", "CNT-010", [
    ("basis_value", "基差", "", "data.derivatives[].basis_value", "basis_value"),
    ("basis_zscore_60d", "基差 z 分（60 日）", "", "data.derivatives[].basis_zscore_60d", "basis_zscore_60d"),
    ("position_ratio", "持仓比", "", "data.derivatives[].position_ratio", "position_ratio"),
    ("pcr_value", "PCR", "", "data.derivatives[].pcr_value", "pcr_value"),
    ("pcr_zscore_60d", "PCR z 分（60 日）", "", "data.derivatives[].pcr_zscore_60d", "pcr_zscore_60d"),
    ("oi_volume_zscore_60d", "成交持仓比 z 分（60 日）", "", "data.derivatives[].oi_volume_crowding_zscore_60d",
     "oi_volume_ratio_zscore_60d"),
], "public-market-derivatives", "raw-stats")
_add("participation", "style", "风格相对强度", "CNT-011", [
    ("strength_score", "强度分", "0–100", "data.style_strength.camps[].strength_score", "strength"),
    ("z_score", "z 分", "", "data.style_strength.camps[].z_score", "z_score"),
    ("strength_series", "近 20 日强度序列", "", "data.style_strength.camps[].strength_series", "strength_series"),
], "public-market-style-rotation", "current")
_add("participation", "bottom", "底部条件观察值", "CNT-013", [
    ("breadth", "宽度承接", "", "data.bottom_conditions.conditions[key=breadth]", "conditions"),
    ("risk", "风险偏好", "", "data.bottom_conditions.conditions[key=risk]", "conditions"),
    ("liquidity", "流动性", "", "data.bottom_conditions.conditions[key=liquidity]", "conditions"),
], P, "bottom-observation")

# ---- 行业比较与轮动 ----
F = "public-industry-review"
_add("industries", "list", "板块列表", "CNT-014/016", [
    ("sector_return", "当日涨跌幅", "小数", None, "sector_return"),
    ("sector_return_5d", "5 日涨跌幅", "小数", None, "sector_return_5d"),
    ("sector_return_20d", "20 日涨跌幅", "小数", None, "sector_return_20d"),
    ("sector_return_60d", "60 日涨跌幅", "小数", None, "sector_return_60d"),
    ("amount", "成交额", "亿元", None, "amount"),
    ("turnover_rate", "换手率", "", None, "turnover_rate_1d"),
    ("up_num", "上涨家数", "家", None, "up_num"),
    ("down_num", "下跌家数", "家", None, "down_num"),
    ("member_count", "成分股数", "只", None, "member_count"),
    ("up_stock_ratio", "上涨占比", "比例", None, "up_stock_ratio"),
    ("above_ma20_ratio", "站上 MA20 占比", "比例", None, "above_ma20_ratio"),
    ("new_high_20d_ratio", "创 20 日新高占比", "比例", None, "new_high_20d_ratio"),
    ("di", "方向指标 DI", "", None, "di"),
    ("market_amount_share", "占全市场成交额", "比例", None, "market_amount_share"),
    ("amount_ratio_ma20", "成交额 / 20 日均值", "倍", None, "amount_ratio_ma20"),
    ("net_flow_1d", "1 日资金净流入", "亿元", None, "net_flow_1d"),
    ("net_flow_5d", "5 日资金净流入", "亿元", None, "net_flow_5d"),
    ("net_flow_20d", "20 日资金净流入", "亿元", None, "net_flow_20d"),
], F, "facts", base="data.items[]")
_add("industries", "rrg", "RRG 相对强度", "CNT-015", [
    ("rs_ratio", "相对强度 RS-Ratio", "0 为参考线", "data.items[].rs_ratio", "rs_ratio"),
    ("rs_momentum", "相对动量 RS-Momentum", "0 为参考线", "data.items[].rs_momentum", "rs_momentum"),
], F, "facts")
_add("industries", "series", "板块近 N 日序列（下钻）", "CNT-032", [
    ("sector_return", "涨跌幅序列", "小数", "data.points[].sector_return", "sector_return"),
    ("net_flow_1d", "资金净流入序列", "亿元", "data.points[].net_flow_1d", "net_flow_1d"),
    ("amount", "成交额序列", "亿元", "data.points[].amount", "amount"),
    ("rs_ratio", "RS-Ratio 序列", "0 为参考线", "data.points[].rs_ratio", "rs_ratio"),
    ("rs_momentum", "RS-Momentum 序列", "0 为参考线", "data.points[].rs_momentum", "rs_momentum"),
    ("di", "DI 序列", "", "data.points[].di", "di"),
], F, "series", detail=True)

# ---- 题材与涨跌结构 ----
T, L = "public-theme-limit-stats", "public-limit-pool-structure"
_add("themes", "themes", "题材统计", "CNT-022", [
    ("up_count", "涨停数", "只", "data.themes[].up_count", "up_count"),
    ("broken_count", "炸板数", "只", "data.themes[].broken_count", "broken_count"),
    ("highest_tier", "最高连板", "", "data.themes[].highest_tier", "highest_tier"),
    ("avg_return_pct", "平均涨幅", "%", "data.themes[].avg_return_pct", "avg_pct"),
], T, "themes")
_add("themes", "ladder", "连板梯队", "CNT-022", [
    ("board_tiers", "连板梯队计数", "只", "data.board_tiers", ("tier", "count")),
], T, "ladder")
_add("themes", "seal_time", "封板时间分布（下钻）", "CNT-022", [
    ("seal_time_buckets", "各题材封板时间 5 档计数", "只",
     ("data.themes[].seal_time_buckets", "data.seal_time_buckets"), ("theme", "bucket", "count")),
], T, "seal-time", detail=True)
_add("themes", "structure", "涨跌停结构", "CNT-025", [
    ("limit_up_count", "涨停数", "只", "data.structure.limit_up_count", "tier_counts"),
    ("broken_board_count", "炸板数", "只", "data.structure.broken_board_count", "broken_board_count"),
    ("limit_down_count", "跌停数", "只", "data.structure.limit_down_count", "limit_down_count"),
    ("broken_board_rate", "炸板率", "比例", "data.structure.broken_board_rate", ("tier_counts", "broken_board_count")),
    ("limit_up_down_ratio", "涨跌停比", "倍", "data.structure.limit_up_down_ratio", ("tier_counts", "limit_down_count")),
    ("ladder", "梯队结构", "只", "data.structure.ladder", "tier_counts"),
], L, "current")
_add("themes", "history", "近 10 日结构序列", "CNT-025", [
    ("history", "涨停/炸板/跌停与炸板率序列", "", "data.history", ("tier_counts", "broken_board_count", "limit_down_count")),
], L, "history")
_add("themes", "pools", "股票池计数", "CNT-027", [
    ("high_recognition", "高标池个股数", "只", "data.pools.high_recognition", ("pool", "count", "status")),
    ("momentum_extreme", "动量极端池个股数", "只", "data.pools.momentum_extreme", ("pool", "window_days", "count")),
], L, "pool-counts")

# ---- 开盘五分钟与板块统计（原历史复盘：网页已拆到参与度页和行业页，接口与权限点保留）----
_add("history", "structure", "板块结构统计", "CNT-030", [
    ("rising_sector_ratio", "上涨板块占比", "比例", "data.structure.rising_sector_ratio", "sector_return"),
    ("di_mean", "扩散度均值", "", "data.structure.di_mean", "di"),
    ("above_ma20_ratio_median", "站上 MA20 占比中位数", "比例", "data.structure.above_ma20_ratio_median", "above_ma20_ratio"),
    ("top10_amount_concentration", "成交额前十集中度", "比例", "data.structure.top10_amount_concentration", "amount"),
    ("flow_price_divergence_ratio", "资金与价格方向背离比例", "比例", "data.structure.flow_price_divergence_ratio",
     ("net_flow_1d", "sector_return")),
], F, "facts")
_add("history", "flow", "板块资金净流入排行", "CNT-029", [
    ("net_flow", "资金净流入", "亿元", "data.flow_ranking[].net_flow", ("net_flow_1d", "net_flow_5d", "net_flow_20d")),
    ("sector_return", "当日涨跌幅", "小数", "data.flow_ranking[].sector_return", "sector_return"),
], F, "facts")
_add("history", "open5", "开盘五分钟统计", "CNT-031", [
    ("coverage_ratio", "覆盖率", "比例", "data.open5.coverage_ratio", ("coverage_ratio", "expected_stock_count", "open5_ready_count")),
    ("positive_open5_ratio", "开盘 5 分钟为正占比", "比例", "data.open5.positive_open5_ratio", "positive_open5_ratio"),
    ("continuation_ratio", "收盘延续占比", "比例", "data.open5.continuation_ratio", "continuation_ratio"),
    ("over_response_ratio", "过度反应占比", "比例", "data.open5.over_response_ratio", "over_response_ratio"),
], "public-daily-review-summary", "open5")

# ---- 事件日历 ----
_add("calendar", "events", "宏观事件", "CNT-034/035", [
    ("previous_value", "前值", "", "data.events[].previous_value", "previous_value"),
    ("actual_value", "公布值", "", "data.events[].actual_value", "actual_value"),
    ("publication_status", "公布状态", "", "data.events[].publication_status", "publication_status"),
    ("consensus_value", "市场预期（第三方）", "", ("data.events[].consensus_value", "data.events[].consensus_source"),
     ("consensus_value", "consensus_source")),
    ("source_importance", "来源重要性", "星", "data.events[].source_importance", "source_importance"),
], "public-forward-risk-events", "calendar-facts")

INDICATORS: Dict[str, Indicator] = {i.id: i for i in _ITEMS}
assert len(INDICATORS) == len(_ITEMS), "指标编号重复"


def by_page(page: str) -> List[Indicator]:
    return [i for i in _ITEMS if i.page == page]


def catalog_payload() -> List[Dict]:
    """给配置页用：看板 → 模块 → 指标。"""
    out = []
    for page, label in PAGES.items():
        modules: Dict[str, Dict] = {}
        for i in by_page(page):
            m = modules.setdefault(i.module, {"module": i.module, "label": i.module_label, "cnt": i.cnt,
                                              "detail": i.detail, "indicators": []})
            m["indicators"].append({"id": i.id, "label": i.label, "unit": i.unit,
                                    "upstream": [list(u) for u in i.upstream]})
        out.append({"page": page, "label": label, "modules": list(modules.values())})
    return out
