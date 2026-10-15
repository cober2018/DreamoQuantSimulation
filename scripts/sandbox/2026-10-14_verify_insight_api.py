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
                    "incubating", "首板为主", "低参与｜承接改善", "减仓"]


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
        check("日历剔除 fallback 占位事件", all(not e["event_id"].startswith("fallback") for e in cal) and len(cal) == 5)
        series = c.get("/api/v1/industries/BK1003/series?days=7").json()
        check("7 日序列满额 ok", series["status"] == "ok" and len(series["data"]["points"]) == 7)
        series = c.get("/api/v1/industries/BK1003/series?days=10").json()
        check("序列不足标 partial 且不插值", series["status"] == "partial" and len(series["data"]["points"]) == 7)
        check("未知板块返回 empty", c.get("/api/v1/industries/NOPE/series").json()["status"] == "empty")
        check("非法日期参数 422", c.get("/api/v1/overview?trade_date=2026/09/09").status_code == 422)
        check("非法板块类型 422", c.get("/api/v1/industries?idx_type=x").status_code == 422)
        check("历史日期可选", c.get("/api/v1/history?trade_date=2026-09-03").json()["trade_date"] == "2026-09-03")
        th = c.get("/api/v1/themes").json()
        check("题材页已接入: ok 且含 CNT-022/025", th["status"] in ("ok", "partial") and
              set(th["content_ids"]) == {"CNT-022", "CNT-025"}, th["status"])
        tdata = th["data"]
        check("题材行只含允许字段", all(set(t) == {"industry", "up_count", "broken_count", "highest_tier",
                                              "seal_time_buckets", "avg_return_pct"} for t in tdata["themes"]))
        check("封板时间分布按题材汇总且不含个股", any(t["seal_time_buckets"] for t in tdata["themes"])
              and "ts_code" not in json.dumps(tdata))
        st = tdata["structure"]
        check("炸板率带分子分母与定义", st["broken_board_rate"]["denominator"] ==
              st["limit_up_count"] + st["broken_board_count"] and "炸板数" in st["broken_board_rate"]["definition"])
        check("历史序列 7 个交易日按日期升序", [h["trade_date"] for h in tdata["history"]] ==
              sorted(h["trade_date"] for h in tdata["history"]) and len(tdata["history"]) == 7)
        part = c.get("/api/v1/participation").json()
        po = part["data"]["participation_observation"]
        check("参与观察只含原始统计 (CNT-006)", "CNT-006" in part["content_ids"] and po is not None
              and "participation_state" not in po and "market_picture" not in po and "absorption_score" not in po
              and po["total_amount_billion"] == 14000.0)
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

    def dup_pages(request):
        offset = int(request.url.params["offset"])
        base = {"trade_date": "2026-09-09", "idx_type": "行业板块", "sector_name": "x", "sector_return": 0.01}
        lo, hi = (0, 500) if offset == 0 else (495, 520)
        rows = [{**base, "sector_code": f"BK{i}"} for i in range(lo, hi)]
        return httpx.Response(200, json={"success": True, "data": {"rows": rows, "trade_date": "latest"}})

    with client(fresh_app(dup_pages, INSIGHT_UPSTREAM_API_KEY="k")) as c:
        body = c.get("/api/v1/industries").json()
        check("分页重复 → 去重并 partial", body["status"] == "partial" and len(body["data"]["items"]) == 520)
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
