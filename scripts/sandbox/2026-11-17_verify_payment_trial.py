"""DK-001 / DK2 验证：付费开关默认关闭、关闭后无任何下单路径；全站试用的等级、到期与配置校验。

运行：backend/.venv/bin/python scripts/sandbox/2026-11-17_verify_payment_trial.py
使用临时 SQLite 与夹具数据；不碰生产。
"""
import importlib.util
import sys
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("access_helpers", HERE / "2026-10-15_verify_insight_access.py")
H = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(H)
make_app, Client, PW = H.make_app, H.Client, H.PW

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), str(detail)[:140]))


def admin_client(tc):
    adm = Client(tc)
    adm.login("root", "Init-Passw0rd-1")
    adm.post("/api/v1/auth/change-password", json={"old_password": "Init-Passw0rd-1", "new_password": "Admin-Passw0rd-2"})
    adm.login("root", "Admin-Passw0rd-2")
    return adm


def user_client(tc, name):
    tc.post("/api/v1/auth/register", json={"username": name, "password": PW, "accept_terms": True})
    c = Client(tc)
    c.login(name, PW)
    return c


def uid(adm, name):
    return next(u["id"] for u in adm.get("/api/v1/admin/users").json()["items"] if u["username"] == name)


def verify_payment_off(TestClient):
    with TestClient(make_app(), base_url="http://testserver") as tc:
        adm, u = admin_client(tc), user_client(tc, "frank")
        me = u.get("/api/v1/auth/me", signed=False).json()
        check("默认 payment_enabled=false 并下发给前端", me.get("payment_enabled") is False, me)
        r = adm.post("/api/v1/admin/plans", json={"name": "VIP 月卡", "role": "vip", "duration_days": 30,
                                                   "price_cents": 9900, "listed": True})
        plan_id = r.json().get("id")
        adm.put(f"/api/v1/admin/plans/{plan_id}", json={"name": "VIP 月卡", "role": "vip", "duration_days": 30,
                                                         "price_cents": 9900, "listed": True})
        for signed in (False, True):
            r = u.get("/api/v1/plans", signed=signed)
            check(f"关闭时用户取套餐 403（{'签名' if signed else '未签名'}），不含价格", r.status_code == 403
                  and "price" not in r.text, r.text)
        check("关闭时管理员取套餐也走同一接口 403", adm.get("/api/v1/plans", signed=False).status_code == 403)
        fid = uid(adm, "frank")
        check("关闭时按套餐开通被拒", adm.post(f"/api/v1/admin/users/{fid}/grant", json={"plan_id": plan_id}).status_code == 403)
        check("关闭时带金额开通被拒", adm.post(f"/api/v1/admin/users/{fid}/grant",
                                          json={"role": "vip", "days": 30, "amount_cents": 9900}).status_code == 403)
        r = adm.post(f"/api/v1/admin/users/{fid}/grant", json={"role": "vip", "days": 7})
        check("关闭时仍可免费按角色+天数开通（运营补偿）", r.status_code == 200 and r.json()["role"] == "vip", r.text)
        grants = adm.get("/api/v1/admin/grants").json()["items"]
        check("开通记录里没有任何金额", all(g["amount_cents"] == 0 for g in grants), grants)
    with TestClient(make_app(INSIGHT_PAYMENT_ENABLED="1"), base_url="http://testserver") as tc:
        u = user_client(tc, "gina")
        check("打开开关后套餐接口恢复 200", u.get("/api/v1/plans", signed=False).status_code == 200)
        check("打开开关后 payment_enabled=true", u.get("/api/v1/auth/me", signed=False).json().get("payment_enabled") is True)


def verify_trial(TestClient):
    future = (date.today() + timedelta(days=30)).isoformat()
    past = (date.today() - timedelta(days=1)).isoformat()
    with TestClient(make_app(INSIGHT_TRIAL_ROLE="svip", INSIGHT_TRIAL_UNTIL=future), base_url="http://testserver") as tc:
        adm, u = admin_client(tc), user_client(tc, "hana")
        me = u.get("/api/v1/auth/me", signed=False).json()
        check("试用期内新注册用户生效等级为 svip", me["role"] == "svip", me.get("role"))
        check("试用信息下发（等级、截止时间）", (me.get("trial") or {}).get("role") == "svip"
              and me["trial"]["until"] > 0, me.get("trial"))
        check("试用期内不显示会员到期提醒", me.get("member_expires_at") is None)
        check("试用不影响管理员", adm.get("/api/v1/auth/me", signed=False).json()["role"] == "admin")
        hid = uid(adm, "hana")
        r = adm.post(f"/api/v1/admin/users/{hid}/grant", json={"role": "vip", "days": 30})
        check("试用期内给免费用户开 vip 不会因试用等级被拒", r.status_code == 200 and r.json()["role"] == "vip", r.text)
        u.login("hana", PW)
        check("真实等级低于试用等级时仍按试用等级", u.get("/api/v1/auth/me", signed=False).json()["role"] == "svip")
        users = {x["username"]: x for x in adm.get("/api/v1/admin/users").json()["items"]}
        check("试用不写库：用户表里的会员等级仍是开通的 vip", users["hana"]["member_role"] == "vip", users["hana"])
        check("试用期内行业页接口可用", u.get("/api/v1/industries").status_code == 200)
    with TestClient(make_app(INSIGHT_TRIAL_ROLE="svip", INSIGHT_TRIAL_UNTIL=past), base_url="http://testserver") as tc:
        u = user_client(tc, "ivan")
        me = u.get("/api/v1/auth/me", signed=False).json()
        check("试用截止后回到真实等级 free，trial 为空", me["role"] == "free" and me.get("trial") is None, me)
    for env, label in (({"INSIGHT_TRIAL_ROLE": "svip"}, "只设试用等级不设截止日：拒绝启动"),
                       ({"INSIGHT_TRIAL_UNTIL": future}, "只设截止日不设等级：拒绝启动"),
                       ({"INSIGHT_TRIAL_ROLE": "admin", "INSIGHT_TRIAL_UNTIL": future}, "试用等级不能是 admin"),
                       ({"INSIGHT_TRIAL_ROLE": "svip", "INSIGHT_TRIAL_UNTIL": "2026/12/31"}, "截止日格式错误：拒绝启动"),
                       ({"INSIGHT_TRIAL_ROLE": "nope", "INSIGHT_TRIAL_UNTIL": future}, "试用等级不存在：拒绝启动")):
        try:
            make_app(**env)
            check(label, False)
        except Exception as e:
            check(label, True, e)


def main():
    from fastapi.testclient import TestClient
    verify_payment_off(TestClient)
    verify_trial(TestClient)
    print("| 测试项 | 结果 |\n|---|---|")
    for n, ok, d in RESULTS:
        print(f"| {n} | {'✅' if ok else '❌ ' + d} |")
    failed = [x for x in RESULTS if not x[1]]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} 通过")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
