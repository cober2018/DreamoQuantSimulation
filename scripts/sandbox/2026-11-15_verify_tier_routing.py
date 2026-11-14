"""等级路由、角色策略版本、路由记录、匿名编号、审计头、过渡期两把 Key 的验证
(openspec: govern-upstream-via-public-services-v1 D2 / D7)。

运行：backend/.venv/bin/python scripts/sandbox/2026-11-15_verify_tier_routing.py
使用临时 SQLite 与夹具数据；不连任何上游，不碰生产。
"""
import asyncio
import importlib.util
import json
import re
import shutil
import sqlite3
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("access_suite", ROOT / "scripts/sandbox/2026-10-15_verify_insight_access.py")
suite = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(suite)
make_app, Client, PW = suite.make_app, suite.Client, suite.PW

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), str(detail)[:160]))


V1 = {"routes": {"free": "insight-svip", "vip": "insight-svip", "svip": "insight-svip", "admin": "insight-svip"}}


def fixture_dir_with_public():
    d = Path(tempfile.mkdtemp())
    for f in (ROOT / "backend/fixtures").glob("*.json"):
        shutil.copy(f, d / f.name)
    (d / "public-test.json").write_text(json.dumps({"facts|2026-10-15|": {"trade_date": "2026-10-15", "context": {},
                                                   "rows": [{"v": 1}]}, "|2026-10-15|": {"trade_date": "2026-10-15",
                                                   "context": {}, "rows": [{"v": 1}]}}), encoding="utf-8")
    return d


def admin_client(tc):
    adm = Client(tc)
    adm.login("root", "Init-Passw0rd-1")
    adm.post("/api/v1/auth/change-password", json={"old_password": "Init-Passw0rd-1", "new_password": "Admin-Passw0rd-2"})
    adm.login("root", "Admin-Passw0rd-2")
    return adm


def db(app_env_db):
    c = sqlite3.connect(app_env_db)
    c.row_factory = sqlite3.Row
    return c


def verify_policy(TestClient):
    import os
    app = make_app()
    dbp = os.environ["INSIGHT_DB_PATH"]
    with TestClient(app, base_url="http://testserver") as tc:
        adm = admin_client(tc)
        tc.post("/api/v1/auth/register", json={"username": "frank", "password": PW, "accept_terms": True})
        u = Client(tc); u.login("frank", PW)

        check("初始无生效规则：健康检查报告缺失", tc.get("/api/v1/health").json()["route_rule"] == {"active_version": None, "ok": False})
        check("非管理员不能提交策略 403", u.post("/api/v1/admin/policy/drafts", json={"policy": V1, "reason": "x"}).status_code == 403)
        check("原因必填 422", adm.post("/api/v1/admin/policy/drafts", json={"policy": V1, "reason": "  "}).status_code == 422)
        bad = {"routes": {"vip": "insight-svip"}}
        check("缺 admin 路由（防自锁）422", adm.post("/api/v1/admin/policy/drafts", json={"policy": bad, "reason": "x"}).status_code == 422)
        check("未知角色 422", adm.post("/api/v1/admin/policy/drafts", json={"policy": {"routes": {**V1["routes"], "ghost": "insight-svip"}}, "reason": "x"}).status_code == 422)
        check("未知账号 422", adm.post("/api/v1/admin/policy/drafts", json={"policy": {"routes": {**V1["routes"], "vip": "insight-nope"}}, "reason": "x"}).status_code == 422)

        r = adm.post("/api/v1/admin/policy/drafts", json={"policy": V1, "reason": "初始版本（D7 7.2）"})
        body = r.json()
        check("提交返回草稿与差异", r.status_code == 200 and body["status"] == "draft" and body["based_on"] is None
              and set(body["diff"]["routes"]["added"]) == {"free", "vip", "svip", "admin"}, body)
        v1 = body["version"]
        check("未确认的草稿不生效", tc.get("/api/v1/health").json()["route_rule"]["active_version"] is None)
        r = adm.post(f"/api/v1/admin/policy/versions/{v1}/confirm")
        check("二次确认后生效", r.status_code == 200 and r.json()["status"] == "active", r.text)
        check("健康检查显示生效版本", tc.get("/api/v1/health").json()["route_rule"] == {"active_version": v1, "ok": True})
        check("非管理员不能确认 403", u.post(f"/api/v1/admin/policy/versions/{v1}/confirm").status_code == 403)
        check("未开双人审批时 approve 409", adm.post(f"/api/v1/admin/policy/versions/{v1}/approve").status_code == 409)

        # 并发：两份草稿都基于 v1，先确认一份，另一份应被拒绝
        v2 = adm.post("/api/v1/admin/policy/drafts", json={"policy": V1, "reason": "草稿 A"}).json()["version"]
        v3 = adm.post("/api/v1/admin/policy/drafts", json={"policy": V1, "reason": "草稿 B"}).json()["version"]
        adm.post(f"/api/v1/admin/policy/versions/{v2}/confirm")
        check("基于旧版本的草稿确认被拒 409", adm.post(f"/api/v1/admin/policy/versions/{v3}/confirm").status_code == 409)
        check("放弃草稿需原因", adm.post(f"/api/v1/admin/policy/versions/{v3}/reject", json={"reason": ""}).status_code == 422)
        check("放弃草稿", adm.post(f"/api/v1/admin/policy/versions/{v3}/reject", json={"reason": "已过期"}).json()["status"] == "rejected")

        lst = adm.get("/api/v1/admin/policy/versions").json()
        status = {i["version"]: i["status"] for i in lst["items"]}
        check("同一时刻只有一个生效版本，旧版本退役", status == {v1: "retired", v2: "active", v3: "rejected"}, status)
        check("任意两版差异", adm.get(f"/api/v1/admin/policy/diff?from_version={v1}&to_version={v2}").json()
              == {"routes": {"added": {}, "removed": {}, "changed": {}}})

        rows = db(dbp).execute("SELECT actor, action, detail FROM audit_log WHERE action LIKE 'role_policy.%' ORDER BY id").fetchall()
        acts = [r["action"] for r in rows]
        activate = json.loads(next(r["detail"] for r in rows if r["action"] == "role_policy.activate"))
        check("变更记录：提交/生效/驳回齐全", {"role_policy.submit", "role_policy.activate", "role_policy.reject"} <= set(acts), acts)
        check("变更记录含操作人、改前改后与原因", rows[0]["actor"] == "root" and activate["before"] is None
              and activate["after"]["version"] == v1 and activate["reason"] == "初始版本（D7 7.2）", activate)


def verify_second_approver(TestClient):
    import os
    app = make_app(INSIGHT_POLICY_REQUIRE_SECOND_APPROVER="1")
    dbp = os.environ["INSIGHT_DB_PATH"]
    with TestClient(app, base_url="http://testserver") as tc:
        adm = admin_client(tc)
        tc.post("/api/v1/auth/register", json={"username": "grace", "password": PW, "accept_terms": True})
        c = db(dbp); c.execute("UPDATE users SET base_role='admin' WHERE username='grace'"); c.commit()
        g = Client(tc); g.login("grace", PW)
        v = adm.post("/api/v1/admin/policy/drafts", json={"policy": V1, "reason": "双人审批"}).json()["version"]
        r = adm.post(f"/api/v1/admin/policy/versions/{v}/confirm")
        check("开关打开：确认后进入待审批", r.json().get("status") == "pending", r.text)
        check("开关打开：待审批不生效", tc.get("/api/v1/health").json()["route_rule"]["active_version"] is None)
        check("开关打开：禁止自审 403", adm.post(f"/api/v1/admin/policy/versions/{v}/approve").status_code == 403)
        r = g.post(f"/api/v1/admin/policy/versions/{v}/approve")
        check("开关打开：另一名管理员审批后生效", r.status_code == 200 and r.json()["status"] == "active", r.text)
        row = db(dbp).execute("SELECT created_by, approved_by FROM role_policy_versions WHERE version=?", (v,)).fetchone()
        check("记录提交人与审批人", (row["created_by"], row["approved_by"]) == ("root", "grace"), dict(row))


def verify_routing(TestClient):
    import os
    fx = fixture_dir_with_public()
    app = make_app(INSIGHT_FIXTURE_DIR=str(fx), INSIGHT_UPSTREAM_API_KEY="svip-key-for-test",
                   INSIGHT_UPSTREAM_LEGACY_API_KEY="legacy-key-for-test")
    dbp = os.environ["INSIGHT_DB_PATH"]
    with TestClient(app, base_url="http://testserver") as tc:
        from insight_api.tier_routing import RequestContext, RouteRejected, set_context
        adm = admin_client(tc)
        v1 = adm.post("/api/v1/admin/policy/drafts", json={"policy": V1, "reason": "初始"}).json()["version"]
        adm.post(f"/api/v1/admin/policy/versions/{v1}/confirm")

        up = app.state.upstream
        seen = []
        orig = up._source.page

        async def spy(service_key, params, headers=None):
            seen.append((service_key, dict(headers or {})))
            return await orig(service_key, params, headers)
        up._source.page = spy

        def run(coro):
            return asyncio.new_event_loop().run_until_complete(coro)

        ctx = RequestContext(request_id="a" * 32, user_id=7, end_user_ref="f" * 32, role="vip", client="mp")
        set_context(ctx)
        run(up.fetch("public-test", {"trade_date": "2026-10-15", "view": "facts"}))
        svc, h = seen[-1]
        check("public-* 用等级账号 Key", h.get("X-API-Key") == "svip-key-for-test", h.get("X-API-Key", "")[:4])
        check("四个审计头齐全且取值正确", h.get("X-End-User-Ref") == "f" * 32 and h.get("X-Client-Entry") == "mp"
              and h.get("X-Request-Id") == "a" * 32 and h.get("X-Route-Rule-Version") == str(v1),
              {k: v for k, v in h.items() if k != "X-API-Key"})
        run(up.fetch("review-industry", {"trade_date": "2026-10-15", "idx_type": "行业板块"}, max_rows=1))
        svc, h = seen[-1]
        check("review-* 用过渡期旧 Key", h.get("X-API-Key") == "legacy-key-for-test" and h.get("X-Route-Rule-Version") == "legacy")
        n = len(seen)
        run(up.fetch("public-test", {"trade_date": "2026-10-15", "view": "facts"}))
        check("缓存命中不发上游", len(seen) == n)
        check("缓存键含账号名", any(k.startswith("insight-svip|public-test|") for k in up._cache), list(up._cache)[:2])

        set_context(RequestContext(request_id="b" * 32, user_id=8, end_user_ref="e" * 32, role="ghost", client="web"))
        try:
            run(up.fetch("public-test", {"trade_date": "2026-10-15"}))
            check("未登记等级被拒绝", False)
        except RouteRejected:
            check("未登记等级被拒绝", len(seen) == n)
        set_context(None)
        try:
            run(up.fetch("public-test", {"trade_date": "2026-10-15"}))
            check("无请求上下文被拒绝", False)
        except RouteRejected:
            check("无请求上下文被拒绝", True)

        logs = db(dbp).execute("SELECT * FROM upstream_route_log ORDER BY id").fetchall()
        by_req = [(r["request_id"][:1], r["service_key"], r["cache_hit"], r["result"], r["account"]) for r in logs]
        check("路由记录：直连、缓存命中、拒绝各一条",
              ("a", "public-test", 0, "ok", "insight-svip") in by_req and ("a", "public-test", 1, "ok", "insight-svip") in by_req
              and ("b", "public-test", 0, "rejected", None) in by_req, by_req)
        first = logs[0]
        check("路由记录字段完整", first["user_id"] == 7 and first["role_at_request"] == "vip" and first["client"] == "mp"
              and first["rule_version"] == v1 and first["view"] == "facts" and first["upstream_status"] == 200, dict(first))

        # 经 HTTP 的真实请求：上下文由 entitled 注入，匿名编号稳定、不含 user_id
        tc.post("/api/v1/auth/register", json={"username": "henry", "password": PW, "accept_terms": True})
        hc = Client(tc); hc.login("henry", PW)
        r1 = hc.get("/api/v1/overview"); hc.get("/api/v1/overview")
        c = db(dbp)
        uid = c.execute("SELECT id FROM users WHERE username='henry'").fetchone()["id"]
        refs = c.execute("SELECT DISTINCT end_user_ref, request_id, client, role_at_request FROM upstream_route_log WHERE user_id=?", (uid,)).fetchall()
        ref_values = {r["end_user_ref"] for r in refs}
        ref = next(iter(ref_values)) if ref_values else ""
        check("HTTP 请求写路由记录", r1.status_code == 200 and refs, r1.status_code)
        check("匿名编号为 32 位十六进制且同一用户固定", len(ref_values) == 1 and re.fullmatch(r"[0-9a-f]{32}", ref), ref_values)
        other = c.execute("SELECT ref FROM end_user_refs WHERE user_id<>?", (uid,)).fetchall()
        check("匿名编号不等于 user_id / 用户名，且各用户不同", ref not in (str(uid), "henry")
              and "henry" not in ref and ref not in {o["ref"] for o in other})
        check("匿名编号映射存于 end_user_refs",
              c.execute("SELECT ref FROM end_user_refs WHERE user_id=?", (uid,)).fetchone()["ref"] == ref)
        check("每次请求的 request_id 不同", len({r["request_id"] for r in refs}) >= 2)
        check("入口与等级记录正确", {(r["client"], r["role_at_request"]) for r in refs} == {("web", "free")})

        # 保留 180 天
        from insight_api.tier_routing import ROUTE_LOG_RETENTION_DAYS
        c.execute("INSERT INTO upstream_route_log(at,request_id,user_id,end_user_ref,role_at_request,client,service_key,cache_hit,result) "
                  "VALUES(?,?,?,?,?,?,?,?,?)", (time.time() - (ROUTE_LOG_RETENTION_DAYS + 1) * 86400, "old", 1, "x", "vip", "web", "s", 0, "ok"))
        c.commit()
        up._route_log._last_cleanup = 0
        set_context(ctx)
        run(up.fetch("public-test", {"trade_date": "2026-10-15", "view": "facts"}))
        check("超过 180 天的路由记录被清理",
              db(dbp).execute("SELECT COUNT(*) FROM upstream_route_log WHERE request_id='old'").fetchone()[0] == 0)
        set_context(None)


def verify_public_pages(TestClient):
    """按页切换到 public-*：夹具模式下题材、参与度走事实视图；多给字段被丢弃，禁止键整体失败。"""
    import os
    fx = fixture_dir_with_public()
    th = json.loads((fx / "public-theme-limit-stats.json").read_text(encoding="utf-8"))
    for k, v in th.items():
        if k.startswith("themes|2026-09-09"):
            for r in v["rows"]:
                r["rotation_zone"] = "leading"  # 上游多给的字段
    (fx / "public-theme-limit-stats.json").write_text(json.dumps(th, ensure_ascii=False), encoding="utf-8")
    app = make_app(INSIGHT_FIXTURE_DIR=str(fx), INSIGHT_PUBLIC_PAGES="themes,participation")
    dbp = os.environ["INSIGHT_DB_PATH"]
    with TestClient(app, base_url="http://testserver") as tc:
        adm = admin_client(tc)
        tc.post("/api/v1/auth/register", json={"username": "ivy", "password": PW, "accept_terms": True})
        c = db(dbp); c.execute("UPDATE users SET base_role='svip' WHERE username='ivy'"); c.commit()
        u = Client(tc); u.login("ivy", PW)
        check("切换后未确认路由规则：public 页 403", u.get("/api/v1/themes?trade_date=2026-09-09").status_code == 403)
        v = adm.post("/api/v1/admin/policy/drafts", json={"policy": V1, "reason": "初始"}).json()["version"]
        adm.post(f"/api/v1/admin/policy/versions/{v}/confirm")
        r = u.get("/api/v1/themes?trade_date=2026-09-09")
        body = r.json()
        check("题材页走事实视图返回 200", r.status_code == 200 and body["status"] in ("ok", "partial")
              and len(body["data"]["themes"]) == 4 and body["data"]["limit_up_sample_size"] == 48, r.text[:200])
        check("上游多给的字段被投影丢弃", all("rotation_zone" not in t for t in body["data"]["themes"]))
        check("题材页来源为 public 服务", {s["service_key"] for s in body["sources"]} <= {"public-theme-limit-stats", "public-limit-pool-structure"})
        r = u.get("/api/v1/participation?trade_date=2026-09-09")
        lus = r.json()["data"]["limit_up_structure"]
        check("参与度走事实视图，封板率按比例口径", r.status_code == 200 and lus["seal_rate"] == 0.3878, lus)
        check("未切换的页面仍走 review-*", u.get("/api/v1/overview").json()["sources"][0]["service_key"] == "review-industry")
        logs = {(x["service_key"], x["account"]) for x in db(dbp).execute("SELECT service_key, account FROM upstream_route_log").fetchall()}
        check("路由记录：public 走 insight-svip、review 走 legacy",
              ("public-theme-limit-stats", "insight-svip") in logs and ("review-industry", "legacy") in logs, sorted(map(str, logs))[:4])
        r = u.get("/api/v1/themes?trade_date=2026-09-06")
        check("新链路缺数据日返回 empty", r.json()["status"] == "empty", r.json().get("status"))

    st = json.loads((fx / "public-market-style-rotation.json").read_text(encoding="utf-8"))
    for k, v in st.items():
        for row in v["rows"]:
            row.update({"available": True, "strength_series": [{"impact": 1}]})
    (fx / "public-market-style-rotation.json").write_text(json.dumps(st, ensure_ascii=False), encoding="utf-8")
    app = make_app(INSIGHT_FIXTURE_DIR=str(fx), INSIGHT_PUBLIC_PAGES="participation")
    with TestClient(app, base_url="http://testserver") as tc:
        adm = admin_client(tc)
        v = adm.post("/api/v1/admin/policy/drafts", json={"policy": V1, "reason": "初始"}).json()["version"]
        adm.post(f"/api/v1/admin/policy/versions/{v}/confirm")
        r = adm.get("/api/v1/participation?trade_date=2026-09-09")
        check("禁止键混入透传字段时整体失败", r.status_code == 500 and r.json()["status"] == "content_guard_violation", r.status_code)
    try:
        make_app(INSIGHT_PUBLIC_PAGES="themes,bogus")
        check("未知切换页面拒绝启动", False)
    except Exception as e:
        check("未知切换页面拒绝启动", "bogus" in str(e), e)


def verify_units():
    from insight_api.tier_routing import RouteRejected, TierRouter, account_keys, RequestContext
    keys = account_keys("k-svip", {"INSIGHT_UPSTREAM_API_KEY_VIP": "k-vip", "INSIGHT_UPSTREAM_API_KEY_": "x", "OTHER": "y"})
    check("账号 Key 变量解析", keys == {"insight-svip": "k-svip", "insight-vip": "k-vip"}, keys)
    r = TierRouter(None, {"insight-svip": ""}, "legacy", require_keys=True, dev_fallback=True)
    ctx = RequestContext("r", 0, "dev-anonymous", "dev", "web")
    try:
        r.resolve("public-x", ctx)
        check("live 模式账号无 Key 拒绝", False)
    except RouteRejected:
        check("live 模式账号无 Key 拒绝", True)
    r2 = TierRouter(None, {"insight-svip": "k"}, "legacy", require_keys=True, dev_fallback=False)
    try:
        r2.resolve("public-x", ctx)
        check("无规则时 public-* 一律拒绝", False)
    except RouteRejected:
        check("无规则时 public-* 一律拒绝", True)
    check("开发态关闭鉴权时 dev 路由到 insight-svip",
          TierRouter(None, {"insight-svip": "k"}, "legacy", True, dev_fallback=True).resolve("public-x", ctx)[1] == "insight-svip")


def main():
    from fastapi.testclient import TestClient
    verify_units()
    verify_policy(TestClient)
    verify_second_approver(TestClient)
    verify_routing(TestClient)
    verify_public_pages(TestClient)
    print("| 测试项 | 结果 |\n|---|---|")
    for n, ok, d in RESULTS:
        print(f"| {n} | {'✅' if ok else '❌ ' + d} |")
    failed = [x for x in RESULTS if not x[1]]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} 通过")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
