"""ZS-132 看板修复的网关侧验证（不连上游、不用夹具文件，全部用内存里的假上游）。

运行：backend/.venv/bin/python scripts/sandbox/2026-11-25_verify_zs132.py
"""
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.update({"INSIGHT_DATA_MODE": "fixture", "INSIGHT_ENV": "development", "INSIGHT_AUTH_MODE": "off"})

from insight_api import public_modules as pm  # noqa: E402
from insight_api.upstream import FetchResult, UpstreamError  # noqa: E402

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), str(detail)[:160]))


class FakeUp:
    """按 (服务, 视图) 返回预置结果；值为异常时抛出。记录请求过的视图。"""
    data_mode = "fixture"

    def __init__(self, table):
        self.table, self.seen = table, []

    async def fetch(self, service_key, params=None, max_rows=None):
        key = (service_key, (params or {}).get("view"))
        self.seen.append(key)
        got = self.table.get(key, FetchResult(rows=[], meta={"trade_date": None}))
        if isinstance(got, Exception):
            raise got
        return got


def fact(code, name, **kw):
    return {"industry_code": code, "industry_name": name, "idx_type": "行业板块", "level": None, "sector_return": 0.01,
            "rs_ratio": 0.004, "rs_momentum": -0.002, "member_count": 30, **kw}


async def main():
    # ---- 1. 相对强度：参考线为 0（中台给的是以 0 为中心的小数） ----
    facts = FetchResult(rows=[fact("BK1201.DC", "电子"), fact("BK1036.DC", "半导体"), fact("BK1331.DC", "数字芯片设计")],
                        meta={"trade_date": "2026-11-24", "field_status": {"0": {"level": "unavailable"}, "1": {"level": "unavailable", "di": "unavailable"}}})
    levels = FetchResult(rows=[{"industry_code": "BK1201.DC", "level": 1}, {"industry_code": "BK1036.DC", "level": 2},
                               {"industry_code": "BK1331.DC", "level": 3}], meta={"trade_date": "2026-11-24"})
    up = FakeUp({pm.FACTS: facts, pm.LEVELS: levels})
    out = await pm.industries(up, None, "行业板块")
    items = {i["sector_code"]: i for i in out["data"]["items"]}
    check("旋转图参考线为 0", out["data"]["rrg_reference"] == 0 and "百分点" in out["data"]["units"]["rs_ratio"])
    # ---- 2. 行业层级：facts 没有时用 overview 视图补 ----
    check("facts 无层级时从 overview 视图补齐", [items[c]["level"] for c in ("BK1201.DC", "BK1036.DC", "BK1331.DC")] == [1, 2, 3], items)
    check("补到层级后不再带 level 的缺数标记，其他缺数标记保留",
          "field_status" not in items["BK1201.DC"] and items["BK1036.DC"].get("field_status") == {"di": "unavailable"})
    up = FakeUp({pm.FACTS: FetchResult(rows=[fact("BK1201.DC", "电子", level=1), fact("BK1036.DC", "半导体", level=2)],
                                       meta={"trade_date": "2026-11-24"})})
    out = await pm.industries(up, None, "行业板块")
    check("facts 自带层级时不再多请求 overview", pm.LEVELS not in up.seen and [i["level"] for i in out["data"]["items"]] == [1, 2])
    up = FakeUp({pm.FACTS: facts, pm.LEVELS: UpstreamError("403", 403)})
    out = await pm.industries(up, None, "行业板块")
    check("层级视图失败时沿用最近一次取到的层级表", out["status"] == "ok" and [i["level"] for i in out["data"]["items"]] == [1, 2, 3])
    pm._LAST_LEVELS.clear()
    out = await pm.industries(up, None, "行业板块")
    check("从未取到过层级时照常返回，level 为空（页面按全部行业显示）", out["status"] == "ok" and all(i["level"] is None for i in out["data"]["items"]))
    up = FakeUp({pm.FACTS: FetchResult(rows=[fact("BK0001.DC", "某概念")], meta={"trade_date": "2026-11-24"})})
    out = await pm.industries(up, None, "概念板块")
    check("概念板块不取层级", pm.LEVELS not in up.seen and out["data"]["items"][0]["level"] is None)

    # ---- 3. 风格序列：带日期的点转成数值数组 + 日期数组 ----
    values, dates = pm._series_points([{"sequence": 1, "date": "2026-11-24", "value": 100}, {"sequence": 0, "date": "2026-11-23", "value": None}])
    check("风格序列按序号排序，缺数保持空值，不补 0", values == [None, 100.0] and dates == ["2026-11-23", "2026-11-24"])
    check("旧形状（纯数字、无日期）照常通过", pm._series_points([1, 2]) == ([1, 2], None)
          and pm._series_points([{"sequence": 0, "value": 3}]) == ([3.0], None))
    raw = [{"sequence": 0, "value": 1, "leader": True}]
    check("序列里出现未登记的键时不转换，原样交给出口守卫", pm._series_points(raw) == (raw, None))

    # ---- 4. 衍生品缺失原因：英文代码一律转中文 ----
    texts = [pm._reason_text(c) for c in ("csi1000_etf_option_not_listed", "star50_proxy_via_CSI1000_IM_same_run", "some_new_code")]
    check("缺失原因转中文，未登记的代码不外露", all(t and t.isascii() is False and "_" not in t for t in texts) and pm._reason_text(None) is None, texts)

    # ---- 5. 涨停个股的行业归类覆盖全部涨停股 ----
    b1, b2 = pm.SEAL_BUCKETS[0][0], pm.SEAL_BUCKETS[1][0]
    up = FakeUp({
        pm.THEMES: FetchResult(rows=[{"theme": "汽车零部件", "up_count": 3, "broken_count": 1, "highest_tier": None, "avg_pct": 10.1}], meta={"trade_date": "2026-11-24"}),
        pm.SEAL: FetchResult(rows=[{"theme": "汽车零部件", "bucket": b1, "count": 2}, {"theme": "汽车零部件", "bucket": b2, "count": 1},
                                   {"theme": "塑料", "bucket": b1, "count": 2}, {"theme": "元件", "bucket": b2, "count": 1}],
                             meta={"trade_date": "2026-11-24", "context": {"limit_up_total": 6}}),
        pm.POOL_HISTORY: FetchResult(rows=[
            {"trade_date": "2026-11-23", "tier_counts": [{"tier": "首板", "count": 5}, {"tier": "3连板", "count": 1}], "broken_board_count": 1, "limit_down_count": 0},
            {"trade_date": "2026-11-24", "tier_counts": [{"tier": "首板", "count": 3}, {"tier": "2连板", "count": 2}, {"tier": "高板", "count": 1}], "broken_board_count": 2, "limit_down_count": 1}],
            meta={"trade_date": "2026-11-24"}),
    })
    out = await pm.themes(up, None)
    th = out["data"]["themes"]
    check("行业榜之外的行业由封板时间视图补齐，按涨停只数从多到少", [(t["industry"], t["up_count"]) for t in th] == [("汽车零部件", 3), ("塑料", 2), ("元件", 1)], th)
    check("覆盖数等于当日涨停总数", out["data"]["theme_coverage"] == {"classified": 6, "total": 6})
    check("补齐的行业没有的统计保持空值，不补 0", th[1]["broken_count"] is None and th[1]["avg_return_pct"] is None)
    check("最高连板按梯队高低取，不按字符串比大小", [h["max_ladder"] for h in out["data"]["history"]] == ["3连板", "高板"], out["data"]["history"])


asyncio.run(main())
print("| 检查项 | 结果 |\n|---|---|")
for name, ok, detail in RESULTS:
    print(f"| {name} | {'✅' if ok else '❌ ' + detail} |")
passed = sum(1 for _, ok, _ in RESULTS if ok)
print(f"\n{passed}/{len(RESULTS)} 通过")
sys.exit(0 if passed == len(RESULTS) else 1)
