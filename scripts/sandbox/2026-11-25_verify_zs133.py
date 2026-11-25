"""ZS-133 涨跌停个股名单、行业成分股统计的网关侧验证（临时 SQLite + 脚本里现造的夹具，不连上游）。

夹具按数据中台 DA-202 的合同造（中台新字段当时还没上生产），名称、代码、数值都是合成的。
运行：backend/.venv/bin/python scripts/sandbox/2026-11-25_verify_zs133.py
"""
import asyncio
import importlib.util
import json
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("access_suite", ROOT / "scripts/sandbox/2026-10-15_verify_insight_access.py")
suite = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(suite)
make_app, Client, PW = suite.make_app, suite.Client, suite.PW

RESULTS = []
DAY = "2026-09-09"
V1 = {"routes": {"free": "insight-svip", "vip": "insight-svip", "svip": "insight-svip", "admin": "insight-svip"}}
# 不允许出现在成分股统计返回里的东西：评分、名次、角色、方向、准入、挑出来的名单
JUDGEMENT = ("score", "rank", "role", "direction", "admission", "strength", "opportunity", "intent", "continuation", "path_state")


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), str(detail)[:200]))


def member_row(i, **kw):
    return {"stock_code": f"T{i:04d}.SH", "stock_name": f"样本{i}", "member_count": 4, "change_pct": [1.5, -2.0, None, 0.3][i % 4],
            "change_5d_pct": 3.0 - i, "above_ma20": i % 2 == 0, "large_order_net_5d": None if i == 1 else 0.5 * i,
            # 上游不该给、合同里也没有的判断类字段：必须被白名单丢掉
            "role": "chase_up", "strength_rank": i + 1, "opportunity_score": 88, "fund_direction": "accumulating",
            "admission": "allow_new", "capital_intent": 0.7, **kw}


def columns():
    return {"stock_code": {"name": "股票代码", "type": "string", "unit": None, "description": "A股代码。"},
            "change_pct": {"name": "当日涨跌幅", "type": "number", "unit": "%", "description": "当日收盘相对前收的涨跌幅。true：高于；false：不高于。数据不全时为 null。"},
            "large_order_net_5d": {"name": "超大单加大单净额近5日累计", "type": "number", "unit": "亿元", "description": "东方财富按单笔成交金额划分。"},
            "days_above_industry_median_5d": {"name": "近5日跑赢行业中位数天数", "type": "integer", "unit": "天", "description": "近 5 个交易日中，该股当日涨跌幅高于本行业成分股当日涨跌幅中位数的天数，0–5。"},
            "above_ma20": {"name": "主力吸筹位置", "type": "boolean", "unit": None, "description": "故意放进禁用词，验证不外露。"}}


def fixture_dir():
    d = Path(tempfile.mkdtemp())
    for f in (ROOT / "backend" / "fixtures").glob("*.json"):
        shutil.copy(f, d / f.name)
    rows = [member_row(i) for i in range(4)]
    (d / "public-industry-members.json").write_text(json.dumps({
        f"list|{DAY}|idx_type=行业板块|industry_code=BK0001.DC": {"trade_date": DAY, "context": {}, "columns": columns(), "rows": rows}},
        ensure_ascii=False), encoding="utf-8")
    pool = json.loads((d / "public-limit-pool-structure.json").read_text(encoding="utf-8"))
    row = pool[f"current|{DAY}|"]["rows"][0]
    for t in row["tier_counts"]:
        t["stocks"] = [{"stock_code": "T9001.SZ", "stock_name": "样本涨停", "change_pct": 10.0, "first_seal_time": "09:31:05",
                        "seal_strength": 9.9, "decision_score": 80}]  # 后两项是不该给的判断字段
    row["limit_down_tiers"] = [{"tier": "首次跌停", "count": 400, "stocks": [{"stock_code": "T9002.SH", "stock_name": "样本跌停", "change_pct": -10.0,
                                                                          "first_seal_time": None, "repair_tag": "核按钮"}]},
                               {"tier": "2连跌停", "count": 0, "stocks": []}]
    (d / "public-limit-pool-structure.json").write_text(json.dumps(pool, ensure_ascii=False), encoding="utf-8")
    return d


def keys_of(value):
    if isinstance(value, dict):
        for k, v in value.items():
            yield k
            yield from keys_of(v)
    elif isinstance(value, list):
        for v in value:
            yield from keys_of(v)


def unit_checks():
    from insight_api import public_modules as pm
    from insight_api.upstream import FetchResult, UpstreamError

    class FakeUp:
        data_mode = "fixture"

        def __init__(self, table):
            self.table, self.calls = table, []

        async def fetch(self, service_key, params=None, max_rows=None):
            self.calls.append((service_key, dict(params or {})))
            got = self.table.get((service_key, (params or {}).get("view")), FetchResult(rows=[], meta={"trade_date": None}))
            if callable(got):
                got = got(params or {})
            if isinstance(got, Exception):
                raise got
            return got

    async def run():
        rows = [member_row(i) for i in range(7)]
        up = FakeUp({pm.MEMBERS: FetchResult(rows=rows, meta={"trade_date": DAY, "columns": columns(), "context": {
            "large_order_coverage": {"with_daily_record": 6, "with_5d_value": 5, "member_count": 7, "internal_note": "x"}}})})
        out = await pm.industry_members(up, "BK0001.DC", None, "概念板块", "change_5d_pct", "desc", 3, 3)
        sent = up.calls[0][1]
        check("排序参数、板块类型原样交给上游", sent.get("sort_by") == "change_5d_pct" and sent.get("sort_order") == "desc"
              and sent.get("idx_type") == "概念板块" and sent.get("industry_code") == "BK0001.DC", sent)
        check("只向上游请求白名单里的 24 个字段", sent.get("fields", "").split(",") == pm.MEMBER_FIELDS and len(pm.MEMBER_FIELDS) == 24)
        d = out["data"]
        check("分页：按 limit / offset 切片，顺序不动，total 为全量", [i["stock_code"] for i in d["items"]] == ["T0003.SH", "T0004.SH", "T0005.SH"]
              and d["pagination"] == {"limit": 3, "offset": 3, "total": 7, "has_more": True}, d["pagination"])
        check("资金类覆盖情况透传三个只数，多余的键丢掉，不随分页变", d["large_order_coverage"] == {"with_daily_record": 6, "with_5d_value": 5, "member_count": 7})
        old = await pm.industry_members(FakeUp({pm.MEMBERS: FetchResult(rows=rows, meta={"trade_date": DAY, "columns": columns()})}), "BK0001.DC", None, "行业板块", "stock_code", "asc", 3, 0)
        check("中台旧版本没有覆盖情况时为空，不报错", old["status"] == "ok" and old["data"]["large_order_coverage"] is None)
        check("每行恰好是白名单字段", all(list(i) == pm.MEMBER_FIELDS for i in d["items"]))
        hit = sorted({k for k in keys_of(out) for w in JUDGEMENT if w in k.lower()})
        check("返回里没有任何评分、名次、角色、方向、准入类的键", hit == [], hit)
        check("白名单本身不含判断类字段", not [f for f in pm.MEMBER_FIELDS for w in JUDGEMENT if w in f]
              and not pm.MEMBER_SORT_FIELDS & {"stock_name", "member_count"})
        cols = {c["key"]: c for c in d["columns"]}
        check("列名和说明用上游原文", cols["change_pct"]["label"] == "当日涨跌幅" and cols["change_pct"]["unit"] == "%"
              and cols["large_order_net_5d"]["description"].startswith("东方财富"))
        check("说明里的 null、true、false 换成中文，其余原文不动", cols["change_pct"]["description"] == "当日收盘相对前收的涨跌幅。是：高于；否：不高于。数据不全时为空。", cols["change_pct"]["description"])
        check("「跑赢」那一列改用中性显示名，说明仍是上游原文", cols["days_above_industry_median_5d"]["label"] == "近5日涨跌幅高于行业中位数的天数"
              and cols["days_above_industry_median_5d"]["description"].startswith("近 5 个交易日中，该股当日涨跌幅高于"))
        check("名称或说明里出现禁用词的列不外露文字", cols["above_ma20"]["label"] is None and cols["above_ma20"]["description"] is None)
        check("缺值保持为空，不补 0", d["items"][0]["change_pct"] == 0.3 and (await pm.industry_members(up, "BK0001.DC", None, "行业板块", "stock_code", "asc", 50, 0))["data"]["items"][2]["change_pct"] is None)
        empty = await pm.industry_members(FakeUp({}), "BK0001.DC", DAY, "行业板块", "stock_code", "asc", 50, 0)
        check("没有数据时返回 empty，不造数", empty["status"] == "empty" and empty["data"] == {})

        # 中台还没发布跌停梯队字段：带新字段的请求被拒（4xx）时退回原字段清单
        def pool(params):
            if "limit_down_tiers" in params.get("fields", ""):
                return UpstreamError("public-limit-pool-structure 返回 HTTP 400", 400)
            return FetchResult(rows=[{"trade_date": DAY, "tier_counts": [{"tier": "首板", "count": 2}], "broken_board_count": 1, "limit_down_count": 1}],
                               meta={"trade_date": DAY})
        up = FakeUp({pm.THEMES: FetchResult(rows=[{"theme": "塑料", "up_count": 3}], meta={"trade_date": DAY}),
                     pm.LADDER: FetchResult(rows=[{"tier": "首板", "count": 2}], meta={"trade_date": DAY}),
                     pm.POOL_CURRENT: pool})
        out = await pm.themes(up, None)
        check("跌停梯队字段被上游拒绝时退回旧字段，家数照常，名单为空（页面写数据待更新）",
              out["data"]["structure"]["limit_up_count"] == 2 and out["data"]["limit_down_tiers"] is None
              and "stocks" not in out["data"]["board_tiers"][0], out["data"]["board_tiers"])
    asyncio.run(run())


def app_checks(TestClient):
    import os
    fx = fixture_dir()
    app = make_app(INSIGHT_FIXTURE_DIR=str(fx), INSIGHT_PUBLIC_PAGES="themes,industries", INSIGHT_MP_MOCK_LOGIN="1",
                   INSIGHT_MCP_ENABLED="1", INSIGHT_MCP_USERS="svipuser")
    dbp = os.environ["INSIGHT_DB_PATH"]
    with TestClient(app, base_url="http://testserver") as tc:
        adm = Client(tc)
        adm.login("root", "Init-Passw0rd-1")
        adm.post("/api/v1/auth/change-password", json={"old_password": "Init-Passw0rd-1", "new_password": "Admin-Passw0rd-2"})
        adm.login("root", "Admin-Passw0rd-2")
        v = adm.post("/api/v1/admin/policy/drafts", json={"policy": V1, "reason": "初始"}).json()["version"]
        adm.post(f"/api/v1/admin/policy/versions/{v}/confirm")
        for name, role in (("svipuser", "svip"), ("vipuser", "vip")):
            tc.post("/api/v1/auth/register", json={"username": name, "password": PW, "accept_terms": True})
            c = sqlite3.connect(dbp); c.execute("UPDATE users SET base_role=? WHERE username=?", (role, name)); c.commit(); c.close()
        svip, vip = Client(tc), Client(tc)
        svip.login("svipuser", PW); vip.login("vipuser", PW)
        url = f"/api/v1/industries/BK0001.DC/members?trade_date={DAY}"

        # ---- 权限点 data.members ----
        me = svip.get("/api/v1/auth/me").json()
        check("svip 默认有 data.members，vip 没有", "data.members" in me["permissions"]
              and "data.members" not in vip.get("/api/v1/auth/me").json()["permissions"], me["permissions"])
        check("权限点出现在最低等级提示里", me.get("perm_min_role", {}).get("data.members") == "SVIP", me.get("perm_min_role"))
        r = svip.get(url)
        check("有权限：200，返回 4 只，默认按代码升序", r.status_code == 200 and [i["stock_code"] for i in r.json()["data"]["items"]] == [f"T{i:04d}.SH" for i in range(4)]
              and r.json()["data"]["sort_by"] == "stock_code", r.text[:160])
        check("有页面权限但没有 data.members：403", vip.get(url).status_code == 403, vip.get(url).text[:120])
        check("未登录：401", tc.get(url).status_code == 401)
        body = r.json()
        hit = sorted({k for k in keys_of(body["data"]) for w in JUDGEMENT if w in k.lower()})
        check("接口返回的数据部分没有判断类的键（信封里的 entitlement.role 是账号等级，不算）", hit == [], hit)
        check("带一句非投资建议的说明", "不构成投资建议" in body["data"]["note"])

        # ---- 排序、分页参数 ----
        r = svip.get(url + "&sort_by=change_pct&sort_order=desc&limit=2&offset=0")
        check("按列排序由上游完成，缺值排最后", r.status_code == 200 and [i["change_pct"] for i in r.json()["data"]["items"]] == [1.5, 0.3]
              and r.json()["data"]["pagination"] == {"limit": 2, "offset": 0, "total": 4, "has_more": True}, r.text[:200])
        r = svip.get(url + "&sort_by=change_pct&sort_order=desc&limit=2&offset=2")
        check("第二页：缺值的一行在最后", [i["change_pct"] for i in r.json()["data"]["items"]] == [-2.0, None], r.text[:200])
        check("不在白名单里的排序字段：422", all(svip.get(url + f"&sort_by={f}").status_code == 422 for f in ("role", "strength_rank", "stock_name", "member_count")))
        check("排序方向、limit 越界：422", svip.get(url + "&sort_order=up").status_code == 422 and svip.get(url + "&limit=501").status_code == 422)

        # ---- 涨跌停个股名单（网页端）----
        d = svip.get(f"/api/v1/themes?trade_date={DAY}").json()["data"]
        stocks = [s for t in d["board_tiers"] for s in t.get("stocks", [])]
        check("涨停梯队每档带名单，只有四项事实字段", stocks and all(list(s) == ["stock_code", "stock_name", "change_pct", "first_seal_time"] for s in stocks), stocks[:1])
        down = d["limit_down_tiers"]
        check("跌停梯队按档给出家数和名单，判断标签被丢掉", [t["tier"] for t in down] == ["首次跌停", "2连跌停"]
              and list(down[0]["stocks"][0]) == ["stock_code", "stock_name", "change_pct", "first_seal_time"], down)
        check("名单被截断时家数仍是全量（页面据此写明）", down[0]["count"] == 400 and len(down[0]["stocks"]) == 1)
        check("口径说明：名单和计数同为沪深口径，不含北交所", "都只统计沪深 A 股，不含北交所" in d["stock_list_scope"] and "含北交所，所以" not in d["stock_list_scope"], d["stock_list_scope"])

        # ---- 小程序、MCP 不带出新数据 ----
        r = tc.post("/api/v1/auth/wechat", json={"code": "mock:mpuser", "accept_terms": True})
        mp = Client(tc); mp.token, mp.sk = r.json()["access_token"], r.json()["sign_key"]
        c = sqlite3.connect(dbp); c.execute("UPDATE users SET base_role='svip' WHERE wechat_openid IS NOT NULL"); c.commit(); c.close()
        r = tc.post("/api/v1/auth/wechat", json={"code": "mock:mpuser", "accept_terms": True})
        mp.token, mp.sk = r.json()["access_token"], r.json()["sign_key"]
        md = mp.get(f"/api/v1/themes?trade_date={DAY}")
        check("小程序读题材页：家数照常，没有个股名单和跌停梯队", md.status_code == 200 and md.json()["data"]["board_tiers"]
              and all("stocks" not in t for t in md.json()["data"]["board_tiers"]) and "limit_down_tiers" not in md.json()["data"], md.text[:160])
        check("小程序读成分股统计：403", mp.get(url).status_code == 403)
        tok = svip.post("/api/v1/account/mcp-tokens", json={"name": "t", "expires_days": 7}).json().get("token")
        hdr = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json", "Accept": "application/json"}
        call = lambda method, params=None, i=1: tc.post("/mcp", headers=hdr, json={"jsonrpc": "2.0", "id": i, "method": method, "params": params or {}}).json()
        tools = call("tools/list")["result"]["tools"]
        check("MCP 工具清单里没有成分股相关工具", tools and not [t["name"] for t in tools if "member" in t["name"] or "成分股" in json.dumps(t, ensure_ascii=False)],
              [t["name"] for t in tools])
        text = lambda res: res["result"]["content"][0]["text"]
        themes_mcp = json.loads(text(call("tools/call", {"name": "get_themes", "arguments": {"trade_date": DAY}}, 2)))
        check("MCP 读题材：没有个股名单和跌停梯队", "limit_down_tiers" not in json.dumps(themes_mcp) and "stock_name" not in json.dumps(themes_mcp), list(themes_mcp.get("data", themes_mcp))[:8])
        desc = text(call("tools/call", {"name": "describe_dataset", "arguments": {"name": "industries"}}, 3)) + text(call("tools/call", {"name": "describe_dataset", "arguments": {"name": "themes"}}, 4)) \
            + text(call("tools/call", {"name": "list_datasets", "arguments": {}}, 5))
        check("MCP 的数据集说明里不出现成分股统计和个股名单", "成分股统计" not in desc and "个股名单" not in desc and "CNT-038" not in desc and "CNT-039" not in desc)

    # ---- 已有库的一次性迁移 ----
    c = sqlite3.connect(dbp)
    c.execute("DELETE FROM role_permissions WHERE perm='data.members'"); c.execute("DELETE FROM meta WHERE key='perm_seed_data_members'")
    c.execute("INSERT INTO roles(name,label,builtin) VALUES('gold','黄金',0)"); c.execute("INSERT INTO role_permissions(role,perm,value) VALUES('gold','data.detail',1)")
    c.commit(); c.close()
    from insight_api.access.store import Store
    Store(dbp)
    c = sqlite3.connect(dbp)
    got = sorted(r[0] for r in c.execute("SELECT role FROM role_permissions WHERE perm='data.members'"))
    check("旧库升级：原来有 data.detail 的角色各补一条 data.members", got == ["admin", "gold", "svip"], got)
    c.execute("DELETE FROM role_permissions WHERE perm='data.members' AND role='gold'"); c.commit(); c.close()
    Store(dbp)
    c = sqlite3.connect(dbp)
    got = sorted(r[0] for r in c.execute("SELECT role FROM role_permissions WHERE perm='data.members'")); c.close()
    check("迁移只做一次：管理员之后取消的授权不会被加回来", got == ["admin", "svip"], got)


def main():
    from fastapi.testclient import TestClient
    app_checks(TestClient)
    unit_checks()
    print("| 检查项 | 结果 |\n|---|---|")
    for name, ok, detail in RESULTS:
        print(f"| {name} | {'✅' if ok else '❌ ' + detail} |")
    passed = sum(1 for _, ok, _ in RESULTS if ok)
    print(f"\n{passed}/{len(RESULTS)} 通过")
    sys.exit(0 if passed == len(RESULTS) else 1)


if __name__ == "__main__":
    main()
