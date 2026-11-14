"""角色权限配置（看板 × 指标）验证 (openspec govern-upstream-via-public-services-v1 D9)。

重点：迁移第 2 步——由 role_permissions 生成完整策略并确认生效后，逐角色、逐页比对新旧裁剪结果必须完全一致。
运行：backend/.venv/bin/python scripts/sandbox/2026-11-15_verify_role_policy.py   （临时 SQLite + 夹具，不连上游）
"""
import importlib.util
import json
import os
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
V1 = {"routes": {"free": "insight-svip", "vip": "insight-svip", "svip": "insight-svip", "admin": "insight-svip"}}
URLS = ["/api/v1/overview", "/api/v1/participation", "/api/v1/industries", "/api/v1/themes", "/api/v1/history",
        "/api/v1/calendar", "/api/v1/industries/{code}/series?days=5"]
META = {"restricted", "module_access", "restricted_modules", "module_counts"}


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), str(detail)[:200]))


def strip(body):
    return {k: v for k, v in body.items() if k not in META} if isinstance(body, dict) else body


def main():
    from fastapi.testclient import TestClient
    fx = Path(tempfile.mkdtemp())
    for f in (ROOT / "backend/fixtures").glob("*.json"):
        shutil.copy(f, fx / f.name)
    app = make_app(INSIGHT_FIXTURE_DIR=str(fx))
    dbp = os.environ["INSIGHT_DB_PATH"]
    with TestClient(app, base_url="http://testserver") as tc:
        adm = Client(tc)
        adm.login("root", "Init-Passw0rd-1")
        adm.post("/api/v1/auth/change-password", json={"old_password": "Init-Passw0rd-1", "new_password": "Admin-Passw0rd-2"})
        adm.login("root", "Admin-Passw0rd-2")
        v = adm.post("/api/v1/admin/policy/drafts", json={"policy": V1, "reason": "初始路由"}).json()["version"]
        adm.post(f"/api/v1/admin/policy/versions/{v}/confirm")

        db = sqlite3.connect(dbp)
        users = {}
        for role in ("free", "vip", "svip"):
            name = f"u_{role}"
            tc.post("/api/v1/auth/register", json={"username": name, "password": PW, "accept_terms": True})
            db.execute("UPDATE users SET base_role=? WHERE username=?", (role, name))
            db.commit()
            c = Client(tc)
            c.login(name, PW)
            users[role] = c
        users["admin"] = adm
        code = adm.get("/api/v1/industries").json()["data"]["items"][0]["sector_code"]

        def snapshot():
            out = {}
            for role, c in users.items():
                for u in URLS:
                    r = c.get(u.format(code=code))
                    out[(role, u)] = (r.status_code, strip(r.json()))
            return out

        before = snapshot()
        r = adm.post("/api/v1/admin/policy/drafts/from-legacy", json={"reason": "迁移第 2 步：由现有权限点生成"})
        draft = r.json()
        check("由现有权限生成完整策略草稿", r.status_code == 200 and "roles" in draft["diff"], r.text[:200])
        r = adm.post(f"/api/v1/admin/policy/versions/{draft['version']}/confirm")
        check("完整策略二次确认生效", r.json().get("status") == "active", r.text[:200])
        after = snapshot()
        diffs = [k for k in before if before[k] != after[k]]
        if diffs and os.environ.get("POLICY_DEBUG"):
            k = diffs[0]
            def walk(a, b, path="$"):
                if isinstance(a, dict) and isinstance(b, dict):
                    for x in set(a) | set(b):
                        if a.get(x) != b.get(x):
                            walk(a.get(x), b.get(x), f"{path}.{x}")
                elif isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
                    for i, (x, y) in enumerate(zip(a, b)):
                        walk(x, y, f"{path}[{i}]")
                else:
                    print("DIFF", path, json.dumps(a, ensure_ascii=False)[:120], "=>", json.dumps(b, ensure_ascii=False)[:120])
            walk(before[k][1], after[k][1])
        check(f"迁移前后逐角色逐页一致（{len(before)} 组）", not diffs,
              [(k, before[k][0], after[k][0]) for k in diffs[:4]])

        full = adm.get(f"/api/v1/admin/policy/versions/{draft['version']}").json()["policy"]
        me = users["vip"].get("/api/v1/auth/me").json()
        check("权限点改由策略生成：vip 无 page.history", "page.history" not in me["permissions"]
              and me["perm_min_role"]["page.history"] == "SVIP", me["permissions"])

        # 指标级裁剪：vip 去掉 ERP 5 年分位
        pol = json.loads(json.dumps(full))
        pol["roles"]["vip"]["pages"]["participation"].remove("participation.erp.erp_percentile_5y")
        r = adm.post("/api/v1/admin/policy/drafts", json={"policy": pol, "reason": "vip 不看 ERP 5 年分位"})
        d = r.json()
        check("差异列出移除的指标", d["diff"]["roles"].get("vip", {}).get("indicators_removed") == ["participation.erp.erp_percentile_5y"], d.get("diff"))
        adm.post(f"/api/v1/admin/policy/versions/{d['version']}/confirm")
        body = users["vip"].get("/api/v1/participation").json()
        check("后端裁掉未授权指标", "erp_percentile_5y" not in body["data"]["erp"] and "erp_percentile_3y" in body["data"]["erp"])
        check("响应列出 restricted 与模块状态", body["restricted"] == ["participation.erp.erp_percentile_5y"]
              and body["module_access"]["erp"] == "partial", (body.get("restricted"), body.get("module_access", {}).get("erp")))
        check("模块开放数：ERP 本等级开放 7/8", body["module_counts"]["erp"] == [7, 8]
              and {"module": "erp", "label": "股权风险溢价（ERP）", "state": "partial", "open": 7, "total": 8} in body["restricted_modules"],
              body.get("module_counts", {}).get("erp"))
        check("svip 不受影响", "erp_percentile_5y" in users["svip"].get("/api/v1/participation").json()["data"]["erp"])

        # 下钻：svip 保留封板时间但去掉板块序列 → 序列 403，题材仍含封板时间
        pol2 = json.loads(json.dumps(pol))
        pol2["roles"]["svip"]["pages"]["industries"] = [i for i in pol2["roles"]["svip"]["pages"]["industries"]
                                                        if not i.startswith("industries.series.")]
        d = adm.post("/api/v1/admin/policy/drafts", json={"policy": pol2, "reason": "svip 去掉板块序列"}).json()
        adm.post(f"/api/v1/admin/policy/versions/{d['version']}/confirm")
        check("去掉序列指标后板块序列 403", users["svip"].get(f"/api/v1/industries/{code}/series?days=5").status_code == 403)
        th = users["svip"].get("/api/v1/themes").json()["data"]
        check("封板时间按自身指标保留", not th.get("detail_locked") and th["themes"] and "seal_time_buckets" in th["themes"][0])

        # 看板关闭 → 403
        pol3 = json.loads(json.dumps(pol2))
        pol3["roles"]["vip"]["pages"].pop("calendar")
        d = adm.post("/api/v1/admin/policy/drafts", json={"policy": pol3, "reason": "vip 关闭日历"}).json()
        check("差异列出关闭的看板", d["diff"]["roles"]["vip"].get("pages_removed") == ["calendar"], d["diff"]["roles"].get("vip"))
        adm.post(f"/api/v1/admin/policy/versions/{d['version']}/confirm")
        check("关闭的看板返回 403", users["vip"].get("/api/v1/calendar").status_code == 403)

        # 防自锁与授权限制
        bad = json.loads(json.dumps(pol3)); bad["roles"]["admin"]["admin_console"] = False
        check("admin 失去管理后台权限被拒 422", adm.post("/api/v1/admin/policy/drafts", json={"policy": bad, "reason": "x"}).status_code == 422)
        bad = json.loads(json.dumps(pol3)); bad["roles"]["admin"]["entries"] = ["mp"]
        check("admin 失去网页入口被拒 422", adm.post("/api/v1/admin/policy/drafts", json={"policy": bad, "reason": "x"}).status_code == 422)
        bad = json.loads(json.dumps(pol3)); bad["roles"]["svip"]["admin_console"] = True
        check("管理后台权限授给非 admin 被拒 422", adm.post("/api/v1/admin/policy/drafts", json={"policy": bad, "reason": "x"}).status_code == 422)
        bad = json.loads(json.dumps(pol3)); bad["roles"]["vip"]["pages"]["overview"].append("calendar.events.actual_value")
        check("指标放错看板被拒 422", adm.post("/api/v1/admin/policy/drafts", json={"policy": bad, "reason": "x"}).status_code == 422)
        bad = json.loads(json.dumps(pol3)); bad["roles"]["vip"]["history_days"] = 999
        check("数值越界被拒 422", adm.post("/api/v1/admin/policy/drafts", json={"policy": bad, "reason": "x"}).status_code == 422)
        bad = json.loads(json.dumps(pol3)); bad["roles"].pop("free")
        check("路由与权限角色不一致被拒 422", adm.post("/api/v1/admin/policy/drafts", json={"policy": bad, "reason": "x"}).status_code == 422)
        check("非管理员不能生成迁移草稿 403", users["svip"].post("/api/v1/admin/policy/drafts/from-legacy", json={"reason": "x"}).status_code == 403)

        # 旧的直接改权限接口
        r = adm.put("/api/v1/admin/roles/vip", json={"label": "VIP", "permissions": {"page.history": 1}})
        check("旧接口直接改权限返回 410", r.status_code == 410, r.status_code)
        check("旧接口只改名称仍可用", adm.put("/api/v1/admin/roles/vip", json={"label": "VIP", "permissions": {}}).status_code == 200)

        # 配置页数据
        cat = adm.get("/api/v1/admin/policy/catalog").json()
        n = sum(len(m["indicators"]) for p in cat["pages"] for m in p["modules"])
        check("配置页目录：6 个看板、全部指标、上限可用且无置灰", len(cat["pages"]) == 6 and n >= 100
              and cat["accounts"]["insight-svip"]["available"] and cat["accounts"]["insight-svip"]["blocked"] == {}, n)

        # 上限收窄：去掉一个字段 → 置灰并拒绝提交
        sc = json.loads((fx / "upstream-scope.json").read_text(encoding="utf-8"))
        sc["insight-svip"]["public-market-compensation"]["erp-filter"].remove("erp_percentile_5y")
        (fx / "upstream-scope.json").write_text(json.dumps(sc), encoding="utf-8")
    # 新进程以清掉上限缓存
    app = make_app(INSIGHT_FIXTURE_DIR=str(fx), INSIGHT_DB_PATH=dbp)
    with TestClient(app, base_url="http://testserver") as tc:
        adm = Client(tc); adm.login("root", "Admin-Passw0rd-2")
        cat = adm.get("/api/v1/admin/policy/catalog").json()
        blocked = cat["accounts"]["insight-svip"]["blocked"]
        check("超上限指标置灰并注明原因", "participation.erp.erp_percentile_5y" in blocked
              and "erp-filter" in blocked["participation.erp.erp_percentile_5y"], blocked)
        pol = cat["active"]["policy"]
        r = adm.post("/api/v1/admin/policy/drafts", json={"policy": pol, "reason": "含超上限指标"})
        check("含超上限指标的草稿被拒 422", r.status_code == 422 and "erp_percentile_5y" in r.text, r.text[:160])
        (fx / "upstream-scope.json").write_text(json.dumps({}), encoding="utf-8")
    app = make_app(INSIGHT_FIXTURE_DIR=str(fx), INSIGHT_DB_PATH=dbp)
    with TestClient(app, base_url="http://testserver") as tc:
        adm = Client(tc); adm.login("root", "Admin-Passw0rd-2")
        cat = adm.get("/api/v1/admin/policy/catalog").json()
        check("上限查询失败：配置页标为不可用", cat["accounts"]["insight-svip"]["available"] is False)
        r = adm.post("/api/v1/admin/policy/drafts", json={"policy": cat["active"]["policy"], "reason": "x"})
        check("上限不可用时不能提交 503", r.status_code == 503, r.status_code)
        check("上限不可用不影响已生效版本", adm.get("/api/v1/participation").status_code == 200)

    print("| 测试项 | 结果 |\n|---|---|")
    for n, ok, d in RESULTS:
        print(f"| {n} | {'✅' if ok else '❌ ' + d} |")
    failed = [x for x in RESULTS if not x[1]]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} 通过")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
