"""生成开发夹具中的合成部分（固定随机种子，可重复）。

- review-industry.json：合成板块行，故意带上禁用列，用来证明投影会剔除它们。
- review-forward-risk.json：在真实导出的最新一行里注入合成日历事件（含一个 fallback 占位事件）。
数值不是行情，只用于离线演示和验证。
"""

import json
import random
from datetime import date, timedelta
from pathlib import Path

FIXTURES = Path(__file__).resolve().parents[2] / "backend" / "fixtures"
rng = random.Random(20261014)

SECTORS = (
    [(f"BK{1000 + i}", n, "行业板块") for i, n in enumerate(
        ["银行", "证券", "保险", "半导体", "软件开发", "通信设备", "光伏设备", "电池", "汽车整车", "白酒",
         "医疗器械", "化学制药", "中药", "房地产开发", "工程机械", "煤炭开采", "有色金属", "钢铁", "电力", "航运港口",
         "物流", "家电", "食品加工", "农牧饲渔", "军工电子", "游戏", "传媒", "消费电子", "化肥", "水泥建材"])]
    + [(f"BK{2000 + i}", n, "概念板块") for i, n in enumerate(
        ["人工智能", "机器人", "数据中心", "低空经济", "固态电池", "创新药", "算力租赁", "卫星互联网", "国企改革", "高股息"])]
    + [(f"BK{3000 + i}", n, "地域板块") for i, n in enumerate(["北京", "上海", "广东", "浙江", "江苏"])]
)


def trading_days(end: date, n: int):
    days, d = [], end
    while len(days) < n:
        if d.weekday() < 5:
            days.append(d)
        d -= timedelta(days=1)
    return sorted(days)


def industry_rows():
    rows = []
    for d in trading_days(date(2026, 9, 9), 7):
        up, down = rng.randint(1200, 3800), 0
        down = 5200 - up
        for code, name, idx in SECTORS:
            ret = round(rng.gauss(0.002, 0.018), 5)
            amount = round(rng.uniform(20, 900), 2)
            rows.append({
                "trade_date": d.isoformat(), "sector_code": code, "sector_name": name, "idx_type": idx,
                "sector_return": ret, "sector_return_5d": round(ret * 3 + rng.gauss(0, 0.02), 5),
                "sector_return_20d": round(rng.gauss(0.01, 0.06), 5), "sector_return_60d": round(rng.gauss(0.02, 0.1), 5),
                "amount": amount, "turnover_rate": round(rng.uniform(0.5, 6), 3),
                "up_num": rng.randint(0, 80), "down_num": rng.randint(0, 80), "member_count": rng.randint(20, 160),
                "up_stock_ratio": round(rng.random(), 4), "above_ma20_ratio": round(rng.random(), 4),
                "new_high_20d_ratio": round(rng.random() * 0.3, 4), "di": round(rng.uniform(-1, 1), 4),
                "market_amount_share": round(amount / 12000, 5), "amount_ratio_ma20": round(rng.uniform(0.6, 1.8), 3),
                "rs_ratio": round(rng.gauss(100, 2), 3), "rs_momentum": round(rng.gauss(100, 1.5), 3),
                "net_flow_1d": round(rng.gauss(0, 8), 3), "net_flow_5d": round(rng.gauss(0, 20), 3),
                "net_flow_20d": round(rng.gauss(0, 50), 3),
                "coverage_ratio": 1.0, "is_fallback": 0, "missing_sources": [],
                "source_max_updated_at": f"{d.isoformat()}T18:30:00+08:00",
                "market_ctx_index_code": "000001.SH", "market_ctx_index_change_pct": round(rng.gauss(0, 1), 3),
                "market_ctx_up_count": up, "market_ctx_down_count": down,
                "market_ctx_turnover_billion": round(rng.uniform(8, 15), 1),
                # 以下为不迁入列：夹具故意保留，验证投影会剔除
                "lifecycle_phase": "acceleration", "review_group": "focus", "opportunity_tags": ["主攻"],
                "signal_priority_group": "top", "signal_priority_summary": "优先关注", "crowding_level": "high",
                "rrg_v3_quadrant": "leading", "leader_stock_codes": ["000001.SZ"], "phase_reason": "示例叙述",
            })
    return rows


def calendar_events(anchor: str):
    base = date.fromisoformat(anchor)
    specs = [
        (1, "09:30", "中国", "宏观", "CPI 年率", "CN_CPI_YOY", "2026-08", "%", "published", "0.4", "0.6", "0.5"),
        (1, "09:30", "中国", "宏观", "PPI 年率", "CN_PPI_YOY", "2026-08", "%", "scheduled", "-1.2", "", "-1.0"),
        (3, "20:30", "美国", "宏观", "非农就业人数", "US_NFP", "2026-08", "万人", "scheduled", "14.2", "", "16.0"),
        (5, "02:00", "美国", "央行", "联邦基金利率决议上限", "US_FED_RATE", "2026-09", "%", "scheduled", "4.50", "", "4.25"),
        (7, "10:00", "中国", "宏观", "社会消费品零售总额同比", "CN_RETAIL_YOY", "2026-08", "%", "scheduled", "3.1", "", ""),
    ]
    events = []
    for i, (offset, t, country, label, title, code, period, unit, status, prev, actual, cons) in enumerate(specs):
        events.append({
            "event_id": f"synthetic:{i}", "event_date": (base + timedelta(days=offset)).isoformat(), "event_time": t,
            "country": country, "event_type_label": label, "title": title, "indicator_code": code, "period": period,
            "unit": unit, "publication_status": status, "macro_previous_value": prev, "macro_actual_value": actual,
            "macro_forecast_value": cons, "source": "synthetic_fixture", "source_importance": 3 - i % 3,
            # 不迁入字段：验证会被剔除
            "impact_text": "利空成长", "impact_asset": "沪深300", "risk_score": 70, "transmission_path": ["x"],
        })
    events.append({"event_id": "fallback:macro", "event_date": base.isoformat(), "title": "外部宏观事件窗口待接入",
                   "source": "fallback_contract", "status": "unknown"})
    return events


def theme_pool_rows():
    """review-theme / review-pools / review-daily / review-limit-list-detail 的合成行 (故意带上禁用列)。"""
    names = ["半导体", "软件开发", "汽车整车", "光伏设备", "医疗器械", "传媒"]
    themes, pools, daily, detail = [], [], [], []
    for d in trading_days(date(2026, 9, 9), 7):
        td = d.isoformat()
        board = {"首板": rng.randint(15, 40), "2连板": rng.randint(5, 14), "3连板": rng.randint(0, 5), "高板": rng.randint(0, 4)}
        broken, down = rng.randint(8, 30), rng.randint(3, 20)
        rankings = [{"industry": n, "up_count": rng.randint(3, 9), "broken_count": rng.randint(0, 4),
                     "highest_tier": rng.choice(["2连板", "3连板", None]), "avg_pct": round(rng.uniform(4, 10), 2),
                     "net_inflow": round(rng.uniform(-5, 9), 2),
                     # 不迁入字段: 强度分/阶段
                     "strength_score": round(rng.uniform(40, 90), 1), "stage": "incubating", "stage_reason": "首板为主"}
                    for n in names[:4]]
        themes.append({"trade_date": td, "theme_rankings_json": json.dumps(rankings, ensure_ascii=False),
                       "board_tiers_json": json.dumps([{"tier": k, "count": v} for k, v in board.items()], ensure_ascii=False),
                       "freshness_json": "{}", "missing_sources_json": "[]", "consumer_policy_json": "{}",
                       "scoring_contract_json": "{}", "theme_horizon_rankings_json": "{}",
                       "snapshot_time": f"{td}T22:10:00+08:00"})
        pools.append({"trade_date": td, "risk_summary_json": json.dumps({"risk_command": "减仓", "position_guidance": "x"}, ensure_ascii=False),
                      "limit_down_anchor_json": "{}", "freshness_json": "{}", "missing_sources_json": "[]",
                      "pool_summary_json": json.dumps({"board_tier_counts": {**board, "unknown": broken},
                                                        "broken_board_count": broken, "limit_down_count": down}, ensure_ascii=False),
                      "consumer_policy_json": "{}", "scoring_contract_json": "{}", "snapshot_time": f"{td}T22:10:00+08:00"})
        ready = rng.randint(4000, 5000)
        daily.append({"trade_date": td, "market_state_json": "{}", "guidance_json": json.dumps([{"type": "watch"}]),
                      "missing_sources_json": "[]", "snapshot_time": f"{td}T22:10:00+08:00",
                      "opening_price_discovery_json": json.dumps({
                          "trade_date": td, "metric_version": "open5_price_discovery_v1", "expected_stock_count": 5300,
                          "open5_ready_count": ready, "close_ready_count": ready + 100, "open5_observed_count": ready + 50,
                          "open5_incomplete_count": 5300 - ready - 100, "open5_unavailable_count": 100,
                          "coverage_ratio": round(ready / 5300, 6), "positive_open5_ratio": round(rng.uniform(0.2, 0.6), 6),
                          "continuation_ratio": round(rng.uniform(0.05, 0.3), 6), "overreaction_ratio": round(rng.uniform(0.05, 0.3), 6),
                          "data_status": "partial", "source_table": "quant.dws_astock_opening_price_discovery_daily_df"})})
        for n in names[:4]:
            for k in range(rng.randint(3, 8)):
                hh = rng.choice([93005, 93410, 94530, 101500, 103000, 133020, 141000, 143500])
                detail.append({"trade_date": td, "ts_code": f"{600000 + len(detail)}.SH", "name": f"合成{len(detail)}",
                               "industry": n, "board_type": "U", "first_board_time": str(hh), "limit_times": rng.randint(1, 4)})
    return themes, pools, daily, detail


def main():
    themes, pools, daily, detail = theme_pool_rows()
    for name, rows in (("review-theme", themes), ("review-pools", pools), ("review-daily", daily),
                       ("review-limit-list-detail", detail)):
        (FIXTURES / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    sp = FIXTURES / "review-market-sentiment.json"
    rows = json.loads(sp.read_text(encoding="utf-8"))
    for r in rows:
        r["participation_observation_json"] = json.dumps({
            "trade_date": r["trade_date"], "source_trade_date": r["trade_date"], "total_amount": 1.4e12,
            "count_stocks": 5300, "amount_ratio_20d": 0.93, "participation_pctile_60d": 11.7,
            "participation_pctile_250d": 6.0, "low_participation_streak": 2, "active_sell_ratio": 0.49,
            "sell_pressure_change_1d": 0.03, "sell_pressure_change_3d": 0.0006, "order_imbalance": 0.02,
            "order_imbalance_delta_1d": 0.058, "data_status": "ok", "calc_version": "participation_observation_v2",
            # 不迁入字段: 状态标签、图景文案、复合分
            "participation_state": "low", "pressure_state": "low_easing", "market_picture": "低参与｜承接改善",
            "absorption_score": 50.0, "breadth_tape_score": 82.0, "interpretation": {"market_picture": "x"}})
    sp.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    (FIXTURES / "review-industry.json").write_text(
        json.dumps(industry_rows(), ensure_ascii=False, indent=1), encoding="utf-8")
    path = FIXTURES / "review-forward-risk.json"
    rows = json.loads(path.read_text(encoding="utf-8"))
    latest = max(rows, key=lambda r: r["trade_date"])
    latest["calendar_events_json"] = json.dumps(calendar_events(latest["trade_date"]), ensure_ascii=False)
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print("ok", len(SECTORS), "sectors; calendar injected into", latest["trade_date"])


if __name__ == "__main__":
    main()
