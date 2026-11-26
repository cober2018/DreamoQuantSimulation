"""ZS-135 「上海时间 21:30 前不显示当天数据」的网关侧验证（假上游 + 可注入时钟，不连中台、不等真实时间）。

假上游按中台 public-* 合同的空结果形状回答：没有所请求日期的数据时 trade_date 为 null，
context 给 latest_available_date；trade_date=latest 时取它自己的最大日期（模拟中台不带日期时会露出当天）。
运行：backend/.venv/bin/python scripts/sandbox/2026-11-26_verify_zs135.py
"""
import asyncio
import importlib.util
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
_spec = importlib.util.spec_from_file_location("access_suite", ROOT / "scripts/sandbox/2026-10-15_verify_insight_access.py")
suite = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(suite)

RESULTS = []
SH = timezone(timedelta(hours=8))


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), str(detail)[:300]))


def at(text):
    """上海时间 'YYYY-MM-DD HH:MM' → 时钟函数（返回 UTC 时间，验证不依赖服务器时区）。"""
    t = datetime.strptime(text, "%Y-%m-%d %H:%M").replace(tzinfo=SH).astimezone(timezone.utc)
    return lambda: t


class FakeSource:
    """data: {(service, view): {date: [rows]}}。view 为空串表示 review-* 服务。"""

    def __init__(self, data):
        self.data = data
        self.calls = []

    async def page(self, service_key, params, headers=None):
        self.calls.append((service_key, dict(params)))
        by_day = self.data.get((service_key, params.get("view", "")), {})
        day = params.get("trade_date")
        public = service_key.startswith("public-")
        if params.get("start_date"):  # 区间（review-* 的 fetch_range）
            rows = [r for d, rs in sorted(by_day.items()) if params["start_date"] <= d <= params["end_date"] for r in rs]
            return rows[int(params.get("offset", 0)):][:int(params.get("limit", 100))], {}
        if day in (None, "latest"):
            day = max(by_day, default=None)
        rows = by_day.get(day)
        offset = int(params.get("offset", 0))
        if rows is None:
            if not public:
                return [], {}
            return [], {"trade_date": None, "requested_trade_date": params.get("trade_date"),
                        "context": {"empty_reason": "no_data_for_trade_date",
                                    "latest_available_date": max(by_day, default=None)}}
        rows = rows[offset:offset + int(params.get("limit", 100))]
        return rows, ({"trade_date": day, "context": {}} if public else {})

    async def close(self):
        return None


def make_upstream(data, clock):
    from insight_api.config import load_settings
    from insight_api.upstream import Upstream

    class Router:  # 路由不是这一单的内容：固定给一个账号
        def resolve(self, service_key, ctx):
            return "k", "insight-svip", 1

        def active_version(self):
            return 1
    os.environ["INSIGHT_DATA_MODE"] = "fixture"
    up = Upstream(load_settings(), Router(), clock=clock)
    up._source = FakeSource(data)
    return up


def pub(day, **extra):
    return [{"trade_date": day, **extra}]


# 交易日：11-20(五) 11-23(一) 11-24 11-25 11-26(四) 11-27(五)；国庆：09-30(三) 后 10-09(五) 开市
DAYS = ["2026-09-30", "2026-10-09", "2026-11-20", "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"]
BREADTH = ("public-market-participation", "breadth")


def unit_checks():
    from insight_api.upstream import date_cap

    # ---- 时刻：21:29 / 21:30，按上海时区 ----
    check("date_cap 21:29 → 前一天", date_cap(at("2026-11-26 21:29")()) == "2026-11-25", date_cap(at("2026-11-26 21:29")()))
    check("date_cap 21:30 → 当天", date_cap(at("2026-11-26 21:30")()) == "2026-11-26")
    check("date_cap 00:10 上海（UTC 仍是前一天）→ 上海日历前一天", date_cap(at("2026-11-27 00:10")()) == "2026-11-26")

    async def run():
        data = {BREADTH: {d: pub(d) for d in DAYS}}

        # 1) 21:29：中台已有当天，但不带日期的请求只给前一交易日；不会把 latest 交给中台
        up = make_upstream(data, at("2026-11-26 21:29"))
        r = await up.fetch(*BREADTH[:1], {"view": BREADTH[1], "trade_date": "latest"})
        check("21:29 不带日期 → 11-25", r.meta.get("trade_date") == "2026-11-25", r.meta)
        sent = [p.get("trade_date") for _, p in up._source.calls]
        check("21:29 发给中台的日期里没有 latest 和当天", "latest" not in sent and "2026-11-26" not in sent, sent)

        # 2) 21:30：切到当天
        up = make_upstream(data, at("2026-11-26 21:30"))
        r = await up.fetch(BREADTH[0], {"view": BREADTH[1], "trade_date": "latest"})
        check("21:30 不带日期 → 11-26", r.meta.get("trade_date") == "2026-11-26", r.meta)

        # 3) 缓存跨 21:30：同一个 Upstream，21:29 取过一次，时钟走到 21:30 立刻是当天（不被缓存卡住）
        now = {"t": at("2026-11-26 21:29")()}
        up = make_upstream(data, lambda: now["t"])
        a = await up.fetch(BREADTH[0], {"view": BREADTH[1], "trade_date": "latest"})
        now["t"] = at("2026-11-26 21:30")()
        b = await up.fetch(BREADTH[0], {"view": BREADTH[1], "trade_date": "latest"})
        check("缓存跨 21:30：21:29 是 11-25、21:30 是 11-26",
              a.meta.get("trade_date") == "2026-11-25" and b.meta.get("trade_date") == "2026-11-26",
              (a.meta.get("trade_date"), b.meta.get("trade_date")))
        # 21:30 后缓存里已有当天；同一进程回到 21:29（另一个请求仍在上限前）也不能读到当天
        now["t"] = at("2026-11-26 21:29")()
        c = await up.fetch(BREADTH[0], {"view": BREADTH[1], "trade_date": "latest"})
        check("缓存里已有当天时，上限前的请求仍是 11-25", c.meta.get("trade_date") == "2026-11-25", c.meta.get("trade_date"))

        # 4) 周一早上：上限是周日，落到上周五
        up = make_upstream(data, at("2026-11-23 09:00"))
        r = await up.fetch(BREADTH[0], {"view": BREADTH[1], "trade_date": "latest"})
        check("周一 09:00 → 上周五 11-20", r.meta.get("trade_date") == "2026-11-20", r.meta)
        n1 = len(up._source.calls)
        await up.fetch(BREADTH[0], {"view": BREADTH[1], "trade_date": "latest"})
        check("回落结果被缓存：同一分钟再取不再访问中台", len(up._source.calls) == n1, up._source.calls[n1:])

        # 5) 节假日后第一个交易日：21:30 前是节前最后一个交易日，21:30 起是当天
        up = make_upstream(data, at("2026-10-09 10:00"))
        r = await up.fetch(BREADTH[0], {"view": BREADTH[1], "trade_date": "latest"})
        check("节后首日 10:00 → 节前 09-30", r.meta.get("trade_date") == "2026-09-30", r.meta)
        up = make_upstream(data, at("2026-10-09 21:30"))
        r = await up.fetch(BREADTH[0], {"view": BREADTH[1], "trade_date": "latest"})
        check("节后首日 21:30 → 10-09", r.meta.get("trade_date") == "2026-10-09", r.meta)

        # 6) 带当天日期（晚于上限）的请求：按可见最新日返回，日期是实际数据日期
        up = make_upstream(data, at("2026-11-26 15:00"))
        r = await up.fetch(BREADTH[0], {"view": BREADTH[1], "trade_date": "2026-11-26"})
        check("15:00 指定 11-26 → 实际给 11-25，日期如实", r.meta.get("trade_date") == "2026-11-25", r.meta)
        r = await up.fetch(BREADTH[0], {"view": BREADTH[1], "trade_date": "2026-11-24"})
        check("指定历史日期照旧", r.meta.get("trade_date") == "2026-11-24", r.meta)

        # 7) review-*（没有 latest_available_date 提示）也能回落：周一早上逐日往前找到上周五
        rdata = {("review-industry", ""): {d: [{"trade_date": d, "idx_type": "行业板块"}] for d in DAYS}}
        up = make_upstream(rdata, at("2026-11-23 09:00"))
        r = await up.fetch("review-industry", {"idx_type": "行业板块"}, max_rows=1)
        check("review-* 周一早上 → 11-20", r.rows and r.rows[0]["trade_date"] == "2026-11-20", r.rows)
        r = await up.fetch_range("review-industry", "2026-11-23", 3, {"idx_type": "行业板块"})
        got = sorted({x["trade_date"] for x in r.rows})
        check("近 N 日序列终点截到上限（指定 11-23 → 截止 11-20）", got and got[-1] == "2026-11-20", got)

        # 7b) 没有 latest_available_date 提示、上限日恰好缺数、中台自己的最新是当天：不能用当天，逐日往前
        class NoHint(FakeSource):
            async def page(self, service_key, params, headers=None):
                rows, meta = await super().page(service_key, params, headers)
                meta.get("context", {}).pop("latest_available_date", None)
                return rows, meta
        gap_data = {BREADTH: {d: pub(d) for d in ["2026-11-24", "2026-11-26"]}}
        up = make_upstream({}, at("2026-11-26 20:00"))
        up._source = NoHint(gap_data)
        r = await up.fetch(BREADTH[0], {"view": BREADTH[1], "trade_date": "latest"})
        check("无提示、11-25 缺、中台最新是 11-26 → 给 11-24，不露当天", r.meta.get("trade_date") == "2026-11-24", r.meta)

        # 8) 中台序列视图多给了晚于上限的行：网关丢掉
        sdata = {("public-industry-review", "series"): {"2026-11-25": [{"trade_date": "2026-11-24"}, {"trade_date": "2026-11-25"},
                                                                       {"trade_date": "2026-11-26"}]}}
        up = make_upstream(sdata, at("2026-11-26 20:00"))
        r = await up.fetch("public-industry-review", {"view": "series", "trade_date": "latest", "sessions": "5"})
        check("序列里晚于上限的行被去掉", [x["trade_date"] for x in r.rows] == ["2026-11-24", "2026-11-25"], r.rows)

        # 9) 限售股解禁（from/to 窗口、按解禁日存）不受上限影响，参数原样
        udata = {("public-share-unlock", "calendar"): {}}
        up = make_upstream(udata, at("2026-11-26 20:00"))
        await up.fetch("public-share-unlock", {"view": "calendar", "from": "2026-11-19", "to": "2026-12-26"})
        check("解禁日历请求不加 trade_date", "trade_date" not in up._source.calls[0][1], up._source.calls[0][1])

    asyncio.run(run())


def page_data():
    """各页 public-* 视图：11-25 全有；11-26 只有 21:30 前就写完的那些（开盘五分钟 22:10、事件日历 23:00 还没有）。"""
    full = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26"]
    early = ["2026-11-23", "2026-11-24", "2026-11-25"]
    d = {}

    def put(service, view, days, row):
        d[(service, view)] = {x: [{**row, "trade_date": x}] for x in days}
    put("public-market-participation", "breadth", full, {"up_count": 3000, "down_count": 2000, "index_code": "000001.SH"})
    put("public-market-participation", "observation", full, {"data_status": "ok"})
    put("public-industry-review", "facts", full, {"industry_code": "BK1", "industry_name": "样本", "idx_type": "行业板块",
                                                  "level": 1, "sector_return": 0.01})
    put("public-daily-review-summary", "open5", ["2026-11-23", "2026-11-25"], {"expected_stock_count": 5000})
    d[("public-forward-risk-events", "calendar-facts")] = {x: [{"event_ref": "macro:1", "event_date": "2026-11-28",
                                                                 "title": "样本事件"}] for x in early}
    return d


def app_checks():
    from fastapi.testclient import TestClient
    app = suite.make_app(INSIGHT_AUTH_MODE="off",
                         INSIGHT_PUBLIC_PAGES="overview,participation,industries,themes,history,calendar")
    with TestClient(app, base_url="http://testserver") as tc:
        up = app.state.upstream
        up._source = FakeSource(page_data())
        now = {"t": at("2026-11-26 21:29")()}
        up.clock = lambda: now["t"]

        r = tc.get("/api/v1/meta/visible-date").json()
        check("21:29 日期选择上限 = 11-25，并给出时刻", r.get("max_date") == "2026-11-25" and r.get("cutoff") == "21:30", r)
        check("21:29 总览 → 11-25", tc.get("/api/v1/overview").json().get("trade_date") == "2026-11-25")
        j = tc.get("/api/v1/overview?trade_date=2026-11-26").json()
        check("21:29 总览指定 11-26 → 返回 11-25 的数据，日期如实", j.get("trade_date") == "2026-11-25" and j["status"] != "empty", j.get("trade_date"))

        now["t"] = at("2026-11-26 21:45")()
        check("21:45 日期选择上限 = 11-26", tc.get("/api/v1/meta/visible-date").json().get("max_date") == "2026-11-26")
        check("21:45 总览 → 11-26", tc.get("/api/v1/overview").json().get("trade_date") == "2026-11-26")
        h = tc.get("/api/v1/history").json()
        o5 = (h.get("data") or {}).get("open5") or {}
        src = {s["service_key"]: s.get("source_date") for s in h.get("sources", [])}
        check("21:45 开盘五分钟当天未写：板块统计 11-26，开盘五分钟回落 11-25 并标明日期",
              h.get("trade_date") == "2026-11-26" and o5.get("trade_date") == "2026-11-25"
              and src.get("public-daily-review-summary") == "2026-11-25", (h.get("trade_date"), o5.get("trade_date"), src))
        c = tc.get("/api/v1/calendar").json()
        check("21:45 事件日历当天未写：不变空，用 11-25 那一行", c.get("trade_date") == "2026-11-25" and c["data"]["events"],
              (c.get("trade_date"), c.get("status")))

        # 指定历史日期时，各块仍按那一天取，不回落到更早（保持原行为：11-24 开盘五分钟缺，就显示缺）
        h = tc.get("/api/v1/history?trade_date=2026-11-24").json()
        check("指定 11-24：开盘五分钟缺就是缺，不拿 11-23 顶替", h.get("trade_date") == "2026-11-24" and (h.get("data") or {}).get("open5") is None,
              (h.get("trade_date"), (h.get("data") or {}).get("open5")))
        r = tc.get("/api/v1/industries").json()
        check("21:45 行业 → 11-26", r.get("trade_date") == "2026-11-26", r.get("trade_date"))


if __name__ == "__main__":
    unit_checks()
    app_checks()
    width = max(len(n) for n, _, _ in RESULTS)
    for name, ok, detail in RESULTS:
        print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(width)}  {'' if ok else detail}")
    failed = sum(1 for _, ok, _ in RESULTS if not ok)
    print(f"\n{len(RESULTS) - failed}/{len(RESULTS)} 通过")
    sys.exit(1 if failed else 0)
