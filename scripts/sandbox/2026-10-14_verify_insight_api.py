"""按 openspec 场景逐项验证后端网关；输出表格，任一失败则退出码 1。

运行：backend/.venv/bin/python scripts/sandbox/2026-10-14_verify_insight_api.py
"""

import asyncio
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import httpx  # noqa: E402

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))


def fresh_app(handler=None, **env):
    """重新导入以读取新环境变量；handler 给出时用 MockTransport 替换上游 HTTP。"""
    for k in [k for k in os.environ if k.startswith("INSIGHT_")]:
        del os.environ[k]
    os.environ["INSIGHT_AUTH_MODE"] = "off"   # 本脚本验证数据网关本身; 鉴权见 2026-10-15_verify_insight_access.py
    os.environ.update(env)
    for m in [m for m in sys.modules if m.startswith("insight_api")]:
        del sys.modules[m]
    if handler:
        from insight_api import upstream as up_mod
        real_init = up_mod.HttpSource.__init__

        def patched_init(self, settings):
            real_init(self, settings)
            self._client = httpx.AsyncClient(base_url="http://up", transport=httpx.MockTransport(handler),
                                             headers={"X-API-Key": settings.upstream_api_key})
        up_mod.HttpSource.__init__ = patched_init
    from insight_api.main import create_app
    return create_app()


def client(app):
    from fastapi.testclient import TestClient
    return TestClient(app)


ENDPOINTS = [
    "/api/v1/overview", "/api/v1/participation", "/api/v1/industries", "/api/v1/industries?idx_type=概念板块",
    "/api/v1/industries/BK1003/series", "/api/v1/themes", "/api/v1/history", "/api/v1/history?period=20d",
    "/api/v1/calendar",
]
FORBIDDEN_VALUES = ["主攻", "优先关注", "利空成长", "外部宏观事件窗口待接入", "acceleration", "leading", "局部恐慌区",
                    "incubating", "首板为主", "低参与｜承接改善", "减仓", "动能加速",
                    # 新接入内容中必须被投影排除的结论性文案 (来自真实上游行)
                    "红利防御主线领跑", "底部观察区", "建议仓位"]


def run_fixture_checks():
    from insight_api.content_scope import CONTENT_SCOPE, DISCLAIMER, FORBIDDEN_KEY_RE

    app = fresh_app(INSIGHT_DATA_MODE="fixture")
    with client(app) as c:
        scope = c.get("/api/v1/meta/content-scope").json()["items"]
        check("注册表 37 条且编号连续", [i["id"] for i in scope] == [f"CNT-{n:03d}" for n in range(1, 38)])
        check("非保留项无一 delivered",
              all(i["v1"] != "delivered" for i in scope if i["selection"] != "keep"))
        delivered = {i["id"] for i in CONTENT_SCOPE if i["v1"] == "delivered"}

        all_ok = True
        for url in ENDPOINTS:
            r = c.get(url)
            body = r.json()
            text = json.dumps(body, ensure_ascii=False)
            keys = re.findall(r'"([^"]+)":', text)
            bad_keys = [k for k in keys if FORBIDDEN_KEY_RE.search(k)]
            bad_vals = [v for v in FORBIDDEN_VALUES if v in text]
            ids_ok = all(cid in delivered for cid in body["content_ids"])
            ids_ok &= bool(body["content_ids"]) or body["status"] == "not_connected"
            ok = (r.status_code == 200 and not bad_keys and not bad_vals and ids_ok
                  and body["disclaimer"] == DISCLAIMER and body["data_mode"] == "fixture")
            all_ok &= ok
            check(f"{url} 白名单/内容ID/声明/夹具标识", ok, f"keys={bad_keys} vals={bad_vals} status={body['status']}")

        ind = c.get("/api/v1/industries").json()["data"]["items"]
        from insight_api.modules import INDUSTRY_FIELDS
        check("行业行字段恰为白名单", all(list(i.keys()) == INDUSTRY_FIELDS for i in ind))
        check("行业默认按当日涨跌幅降序且不截断",
              [i["sector_return"] for i in ind] == sorted((i["sector_return"] for i in ind), reverse=True)
              and len(ind) == 30)
        hist = c.get("/api/v1/history").json()["data"]
        check("资金排行全量不截断", len(hist["flow_ranking"]) == 30)
        rs = hist["structure"]["rising_sector_ratio"]
        check("结构统计含分子分母", rs["denominator"] == 30 and rs["value"] == round(rs["numerator"] / 30, 6))
        cal = c.get("/api/v1/calendar").json()["data"]["events"]
        check("日历仅宏观族且默认 14 天前瞻窗口", cal and all(e["event_id"].startswith("macro:") for e in cal)
              and max(e["event_date"] for e in cal) < "2026-10-28")
        cal7 = c.get("/api/v1/calendar?days=7").json()["data"]["events"]
        check("日历 days 参数收窄窗口", cal7 and all(e["event_date"] < "2026-10-21" for e in cal7))
        series = c.get("/api/v1/industries/BK1003/series?days=7").json()
        check("7 日序列满额 ok", series["status"] == "ok" and len(series["data"]["points"]) == 7)
        series = c.get("/api/v1/industries/BK1003/series?days=10").json()
        check("序列不足标 partial 且不插值", series["status"] == "partial" and len(series["data"]["points"]) == 7)
        check("未知板块返回 empty", c.get("/api/v1/industries/NOPE/series").json()["status"] == "empty")
        check("非法日期参数 422", c.get("/api/v1/overview?trade_date=2026/09/09").status_code == 422)
        check("非法板块类型 422", c.get("/api/v1/industries?idx_type=x").status_code == 422)
        check("历史日期可选", c.get("/api/v1/history?trade_date=2026-09-03").json()["trade_date"] == "2026-09-03")
        th = c.get("/api/v1/themes").json()
        check("题材页已接入: ok 且含 CNT-022/025/027", th["status"] in ("ok", "partial") and
              set(th["content_ids"]) == {"CNT-022", "CNT-025", "CNT-027"}, th["status"])
        tdata = th["data"]
        check("题材行只含允许字段", all(set(t) == {"industry", "up_count", "broken_count", "highest_tier",
                                              "seal_time_buckets", "avg_return_pct"} for t in tdata["themes"]))
        check("封板时间分布按题材汇总且不含个股", any(t["seal_time_buckets"] for t in tdata["themes"])
              and "ts_code" not in json.dumps(tdata))
        st = tdata["structure"]
        check("炸板率带分子分母与定义", st["broken_board_rate"]["denominator"] ==
              st["limit_up_count"] + st["broken_board_count"] and "炸板数" in st["broken_board_rate"]["definition"])
        check("历史序列按日期升序且不插值", [h["trade_date"] for h in tdata["history"]] ==
              sorted(h["trade_date"] for h in tdata["history"]) and len(tdata["history"]) >= 5)
        pools = tdata["pools"]
        check("各池计数 (CNT-027): 计数与数据状态、无名单/指令", pools is not None
              and isinstance(pools.get("high_recognition", {}).get("count"), int)
              and set(pools.get("momentum_extreme", {})) == {"10d", "20d"}
              and "risk_command" not in json.dumps(tdata) and "position_guidance" not in json.dumps(tdata))
        part = c.get("/api/v1/participation").json()
        po = part["data"]["participation_observation"]
        senti = json.loads((ROOT / "backend/fixtures/review-market-sentiment.json").read_text())[0]
        raw_total = json.loads(senti["participation_observation_json"])["total_amount"]
        check("参与观察只含原始统计 (CNT-006)", "CNT-006" in part["content_ids"] and po is not None
              and "participation_state" not in po and "market_picture" not in po and "absorption_score" not in po
              and abs(po["total_amount_billion"] - raw_total / 1e8) < 0.1)
        from insight_api.modules import STYLE_CAMP_FIELDS
        sm = part["data"]["smart_money_factors"]
        check("聪明钱五因子 (CNT-009): 中性键名且无评分/风险分", sm is not None
              and {f["key"] for f in sm["factors"]} == {"direction", "persistence", "price_confirmation",
                                                        "stealth", "uncrowded_liquidity"}
              and "impact" not in json.dumps(sm) and "panic" not in json.dumps(sm)
              and isinstance(sm["sample_rows"], int))
        sty = part["data"]["style_strength"]
        check("风格强度 (CNT-011): 阵营字段恰为白名单且无 leader/signal", sty is not None
              and len(sty["camps"]) == 3
              and all(set(camp) == set(STYLE_CAMP_FIELDS) for camp in sty["camps"])
              and "leader" not in json.dumps(sty) and "signal" not in json.dumps(sty))
        bc = part["data"]["bottom_conditions"]
        check("底部条件 (CNT-013): 观察值+阈值且无预测/总分字段", bc is not None
              and len(bc["conditions"]) == 3
              and all(set(cd) == {"key", "label", "value", "threshold", "condition"} for cd in bc["conditions"])
              and "candidate_state" not in json.dumps(bc) and "readiness" not in json.dumps(bc))
        o5 = c.get("/api/v1/history").json()["data"]["open5"]
        check("Open5 汇总带分母 (CNT-031)", o5 is not None and o5["expected_stock_count"] == 5300
              and "source_table" not in o5)


def run_guard_check():
    app = fresh_app(INSIGHT_DATA_MODE="fixture")
    from insight_api import modules

    original = modules.INDUSTRY_FIELDS[:]
    modules.INDUSTRY_FIELDS.append("review_group")
    try:
        with client(app) as c:
            r = c.get("/api/v1/industries?trade_date=2026-09-08")
            check("禁止键守卫失败关闭 500 且无数据",
                  r.status_code == 500 and r.json().get("data") == {} and "BK" not in r.text)
    finally:
        modules.INDUSTRY_FIELDS[:] = original


def run_upstream_checks():
    seen_headers = {}

    def failing(request):
        seen_headers.update(request.headers)
        return httpx.Response(503, json={"detail": "down"})

    with client(fresh_app(failing, INSIGHT_UPSTREAM_API_KEY="sk-secret-123")) as c:
        r = c.get("/api/v1/overview")
        check("上游 5xx → 502 upstream_error 且无数据",
              r.status_code == 502 and r.json()["status"] == "upstream_error" and r.json()["data"] == {})
        check("API Key 只走上游请求头", seen_headers.get("x-api-key") == "sk-secret-123"
              and "sk-secret-123" not in r.text)

    def empty(request):
        return httpx.Response(200, json={"success": True, "data": {"rows": [], "trade_date": "latest"}})

    with client(fresh_app(empty, INSIGHT_UPSTREAM_API_KEY="k")) as c:
        check("上游 0 行 → 200 empty", c.get("/api/v1/participation").json()["status"] == "empty")

    def malformed(request):
        return httpx.Response(200, json={"success": True, "data": "oops"})

    with client(fresh_app(malformed, INSIGHT_UPSTREAM_API_KEY="k")) as c:
        check("上游结构不符 → 502", c.get("/api/v1/calendar").status_code == 502)

    def stable_pages(request):
        offset = int(request.url.params["offset"])
        base = {"trade_date": "2026-09-09", "idx_type": "行业板块", "sector_name": "x", "sector_return": 0.01}
        rows = [{**base, "sector_code": f"BK{i}"} for i in range(offset, min(offset + 500, 520))]
        return httpx.Response(200, json={"success": True, "data": {"rows": rows, "trade_date": "latest"}})

    with client(fresh_app(stable_pages, INSIGHT_UPSTREAM_API_KEY="k")) as c:
        body = c.get("/api/v1/industries").json()
        check("上游已稳定排序: 分页取全且不再去重降级", body["status"] == "ok"
              and len(body["data"]["items"]) == 520)
        check("交易日取自行而非上游回显 latest", body["trade_date"] == "2026-09-09")

    def bad_json(request):
        row = {"trade_date": "2026-09-09", "erp_filter_json": "{bad", "micro_atomic_json": None,
               "valuation_filter_json": "{}", "derivatives_matrix_json": "[]"}
        return httpx.Response(200, json={"success": True, "data": {"rows": [row]}})

    with client(fresh_app(bad_json, INSIGHT_UPSTREAM_API_KEY="k")) as c:
        body = c.get("/api/v1/participation").json()
        check("坏 JSON 列 → 字段 null + partial", body["status"] == "partial"
              and body["data"]["erp"]["erp_value_pct"] is None)


def run_config_checks():
    from fastapi.testclient import TestClient

    app = fresh_app(INSIGHT_DATA_MODE="fixture", INSIGHT_ACCESS_TOKEN="tok")
    with TestClient(app) as c:
        check("配置令牌时无令牌 401", c.get("/api/v1/overview").status_code == 401)
        check("错误令牌 401", c.get("/api/v1/overview", headers={"Authorization": "Bearer x"}).status_code == 401)
        check("正确令牌 200", c.get("/api/v1/overview", headers={"Authorization": "Bearer tok"}).status_code == 200)
        check("health 免令牌", c.get("/api/v1/health").status_code == 200)
    try:
        fresh_app(INSIGHT_DATA_MODE="fixture", INSIGHT_ENV="production")
        check("production + fixture 拒绝启动", False)
    except Exception as e:
        check("production + fixture 拒绝启动", "production" in str(e))
    try:
        fresh_app()
        check("live 无 Key 拒绝启动", False)
    except Exception as e:
        check("live 无 Key 拒绝启动", "API_KEY" in str(e))


def run_isolation_check():
    out = subprocess.run(
        ["grep", "-rnE", r"dreamo_platform|from domains|apps\.api|DreamOAgents",
         "--include=*.py", "--include=*.ts", "--include=*.vue", "--include=*.js", "backend/insight_api", "web/src"],
        cwd=ROOT, capture_output=True, text=True)
    check("与旧平台零代码引用", out.stdout.strip() == "", out.stdout[:200])


def main():
    run_fixture_checks()
    run_guard_check()
    run_upstream_checks()
    run_config_checks()
    run_isolation_check()
    print("| 测试项 | 结果 |\n|---|---|")
    for name, ok, detail in RESULTS:
        print(f"| {name} | {'✅' if ok else '❌ ' + detail} |")
    failed = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} 通过")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
