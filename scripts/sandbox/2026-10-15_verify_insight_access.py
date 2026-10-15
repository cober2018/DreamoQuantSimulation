"""账号/角色/邀请码/会话/防爬 验证 (openspec: add-insight-access-control-v1, add-insight-wechat-miniprogram-v1 后端部分)。

运行：backend/.venv/bin/python scripts/sandbox/2026-10-15_verify_insight_access.py
使用临时 SQLite 与夹具数据；不碰生产。
"""
import hashlib
import json
import os
import secrets
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), str(detail)[:140]))


def make_app(**env):
    for k in [k for k in os.environ if k.startswith("INSIGHT_")]:
        del os.environ[k]
    tmp = tempfile.mkdtemp()
    os.environ.update({"INSIGHT_DATA_MODE": "fixture", "INSIGHT_ENV": "development",
                       "INSIGHT_DB_PATH": f"{tmp}/t.sqlite3", "INSIGHT_JWT_SECRET": secrets.token_urlsafe(48),
                       "INSIGHT_BOOTSTRAP_ADMIN_USER": "root", "INSIGHT_BOOTSTRAP_ADMIN_PASSWORD": "Init-Passw0rd-1",
                       **env})
    for m in [m for m in sys.modules if m.startswith("insight_api")]:
        del sys.modules[m]
    from insight_api.main import create_app
    return create_app()


class Client:
    """带签名的测试客户端。"""

    def __init__(self, tc):
        self.tc, self.token, self.sk = tc, None, None

    def sign_headers(self, method, url):
        from urllib.parse import urlsplit, parse_qsl
        from insight_api.access.security import request_signature
        u = urlsplit(url)
        query = "&".join(f"{k}={v}" for k, v in sorted(parse_qsl(u.query)))
        ts, nonce = str(time.time()), secrets.token_hex(12)
        return {"Authorization": f"Bearer {self.token}", "X-Ts": ts, "X-Nonce": nonce,
                "X-Sign": request_signature(self.sk, method, u.path, query, ts, nonce)}

    def get(self, url, signed=True, **kw):
        h = self.sign_headers("GET", url) if signed and self.token else ({"Authorization": f"Bearer {self.token}"} if self.token else {})
        return self.tc.get(url, headers={**h, **kw.pop("headers", {})}, **kw)

    def post(self, url, json=None, signed=True, **kw):
        h = self.sign_headers("POST", url) if signed and self.token else ({"Authorization": f"Bearer {self.token}"} if self.token else {})
        return self.tc.post(url, json=json, headers={**h, **kw.pop("headers", {})}, **kw)

    def patch(self, url, json=None):
        return self.tc.patch(url, json=json, headers=self.sign_headers("PATCH", url))

    def put(self, url, json=None):
        return self.tc.put(url, json=json, headers=self.sign_headers("PUT", url))

    def delete(self, url):
        return self.tc.delete(url, headers=self.sign_headers("DELETE", url))

    def login(self, user, pw):
        r = self.tc.post("/api/v1/auth/login", json={"username": user, "password": pw})
        if r.status_code == 200:
            body = r.json()
            self.token, self.sk = body["access_token"], body["sign_key"]
        return r


PW = "Passw0rd-Test-1"


def main():
    from fastapi.testclient import TestClient
    app = make_app()
    with TestClient(app, base_url="http://testserver") as tc:
        anon = Client(tc)
        check("未登录访问数据接口 401", tc.get("/api/v1/overview").status_code == 401)
        check("health 免登录", tc.get("/api/v1/health").status_code == 200)

        # 注册规则
        r = tc.post("/api/v1/auth/register", json={"username": "alice", "password": PW, "accept_terms": False})
        check("未同意协议注册被拒 422", r.status_code == 422, r.status_code)
        r = tc.post("/api/v1/auth/register", json={"username": "alice", "password": "short", "accept_terms": True})
        check("弱密码被拒 422", r.status_code == 422, r.json().get("detail"))
        for u in ("alice", "bob", "carol"):
            r = tc.post("/api/v1/auth/register", json={"username": u, "password": PW, "accept_terms": True})
        check("注册成功", r.status_code == 200)
        check("重名被拒 409", tc.post("/api/v1/auth/register", json={"username": "ALICE", "password": PW,
                                                                     "accept_terms": True}).status_code == 409)

        # 登录与错误文案一致
        bad_user = tc.post("/api/v1/auth/login", json={"username": "nobody", "password": PW})
        bad_pw = tc.post("/api/v1/auth/login", json={"username": "alice", "password": PW + "x"})
        check("账号不存在与密码错误文案一致", bad_user.status_code == 401 and bad_user.json() == bad_pw.json())

        # 免费用户可见性
        a = Client(tc)
        r = a.login("alice", PW)
        check("登录成功含 sign_key 且 refresh 只在 HttpOnly Cookie", r.status_code == 200 and "sign_key" in r.json()
              and "refresh_token" not in r.json() and "HttpOnly" in r.headers.get("set-cookie", "")
              and "SameSite=strict" in r.headers.get("set-cookie", "").replace("samesite", "SameSite"), r.headers.get("set-cookie"))
        check("免费: 总览 200", a.get("/api/v1/overview").status_code == 200)
        check("免费: 日历 200", a.get("/api/v1/calendar").status_code == 200)
        check("免费: 参与度 403", a.get("/api/v1/participation").status_code == 403)
        check("免费: 行业 403", a.get("/api/v1/industries").status_code == 403)
        check("免费: 历史复盘 403", a.get("/api/v1/history").status_code == 403)
        check("免费: 超出历史范围 403", a.get("/api/v1/overview?trade_date=2026-01-05").status_code == 403)
        me = a.get("/api/v1/auth/me", signed=False).json()
        check("me 返回角色/权限/历史天数", me["role"] == "free" and me["history_days"] == 5)

        # 签名与重放
        h = a.sign_headers("GET", "/api/v1/overview")
        check("签名请求 200", tc.get("/api/v1/overview", headers=h).status_code == 200)
        check("同一签名重放被拒", tc.get("/api/v1/overview", headers=h).status_code == 401)
        h2 = a.sign_headers("GET", "/api/v1/overview")
        h2["X-Ts"] = str(time.time() - 600)
        check("过期时间戳被拒", tc.get("/api/v1/overview", headers=h2).status_code == 401)
        h3 = a.sign_headers("GET", "/api/v1/overview")
        h3["X-Sign"] = "0" * 64
        check("签名错误被拒", tc.get("/api/v1/overview", headers=h3).status_code == 401)
        check("缺少签名被拒", tc.get("/api/v1/overview", headers={"Authorization": f"Bearer {a.token}"}).status_code == 401)
        check("篡改令牌被拒", tc.get("/api/v1/overview", headers={"Authorization": "Bearer " + a.token[:-3] + "abc"}).status_code == 401)

        # 管理员
        adm = Client(tc)
        r = adm.login("root", "Init-Passw0rd-1")
        check("引导管理员首次登录要求改密(数据接口 403)", r.status_code == 200 and adm.get("/api/v1/overview").status_code == 403)
        r = adm.post("/api/v1/auth/change-password", json={"old_password": "Init-Passw0rd-1", "new_password": "Admin-Passw0rd-2"})
        check("改密成功并使旧会话失效", r.status_code == 200 and adm.get("/api/v1/overview").status_code == 401)
        adm.login("root", "Admin-Passw0rd-2")
        check("管理员可访问全部页面", all(adm.get(u).status_code == 200 for u in (
            "/api/v1/overview", "/api/v1/participation", "/api/v1/industries", "/api/v1/themes", "/api/v1/history",
            "/api/v1/calendar")))
        check("非管理员访问管理接口 403", a.get("/api/v1/admin/users").status_code == 403)
        users = adm.get("/api/v1/admin/users").json()["items"]
        alice_id = next(u["id"] for u in users if u["username"] == "alice")
        bob_id = next(u["id"] for u in users if u["username"] == "bob")

        # 邀请码
        r = adm.post("/api/v1/admin/invites", json={"role": "vip", "duration_days": 30, "count": 2, "max_uses": 1})
        codes = r.json()["codes"]
        check("管理员生成邀请码", r.status_code == 200 and len(codes) == 2 and codes[0].count("-") == 2)
        listing = json.dumps(adm.get("/api/v1/admin/invites").json())
        check("邀请码库内只存哈希/列表不含明文", codes[0].replace("-", "") not in listing and codes[0] not in listing)
        r = a.post("/api/v1/invite/redeem", json={"code": codes[0]})
        check("兑换 VIP 成功并带到期时间", r.status_code == 200 and r.json()["role"] == "vip" and r.json()["member_expires_at"] > time.time())
        check("兑换后无需重新登录即升级: 参与度 200", a.get("/api/v1/participation").status_code == 200)
        check("VIP: 历史复盘仍 403", a.get("/api/v1/history").status_code == 403)
        b = Client(tc); b.login("bob", PW)
        r = b.post("/api/v1/invite/redeem", json={"code": codes[0]})
        check("已用完的邀请码被拒", r.status_code == 422, r.status_code)
        r = b.post("/api/v1/invite/redeem", json={"code": "AAAA-BBBB-CCCC"})
        check("校验位错误的邀请码被拒", r.status_code == 422)
        code_exp = adm.post("/api/v1/admin/invites", json={"role": "svip", "duration_days": 7, "expires_at": time.time() - 10}).json()["codes"][0]
        check("过期邀请码被拒", b.post("/api/v1/invite/redeem", json={"code": code_exp}).status_code == 422)
        r = adm.post("/api/v1/admin/invites", json={"role": "admin", "duration_days": 7})
        check("邀请码不能授予管理员", r.status_code == 422)
        # 暴力兑换冻结
        c = Client(tc); c.login("carol", PW)
        codes_bad = [c.post("/api/v1/invite/redeem", json={"code": "AAAA-BBBB-CCCC"}).status_code for _ in range(6)]
        good = adm.post("/api/v1/admin/invites", json={"role": "vip", "duration_days": 1}).json()["codes"][0]
        r = c.post("/api/v1/invite/redeem", json={"code": good})
        check("连续失败后冻结: 即使有效码也被拒 429", r.status_code == 429 and 429 in codes_bad, (codes_bad, r.status_code))

        # SVIP 与明细
        svip = adm.post("/api/v1/admin/invites", json={"role": "svip", "duration_days": 30}).json()["codes"][0]
        check("SVIP 兑换", b.post("/api/v1/invite/redeem", json={"code": svip}).json().get("role") == "svip")
        check("SVIP: 历史复盘 200", b.get("/api/v1/history").status_code == 200)
        check("SVIP: 板块序列(下钻) 200", b.get("/api/v1/industries/BK1003/series").status_code == 200)
        check("VIP: 板块序列(下钻) 403", a.get("/api/v1/industries/BK1003/series").status_code == 403)
        th_v = a.get("/api/v1/themes").json()["data"]
        th_s = b.get("/api/v1/themes").json()["data"]
        check("VIP 题材封板分布被锁, SVIP 可见", th_v.get("detail_locked") is True
              and all("seal_time_buckets" not in t for t in th_v["themes"])
              and any(t.get("seal_time_buckets") for t in th_s["themes"]))
        full = b.get("/api/v1/themes").json()
        check("响应含溯源标记且不含明文用户名", "trace" in full and "bob" not in json.dumps(full))

        # 管理员自定义: 即时生效
        roles = adm.get("/api/v1/admin/roles").json()
        vip = next(x for x in roles["items"] if x["name"] == "vip")
        newperm = {k: v for k, v in vip["permissions"].items() if k != "page.themes"}
        r = adm.put("/api/v1/admin/roles/vip", json={"label": "VIP", "permissions": newperm})
        check("管理员移除 VIP 的题材页", r.status_code == 200)
        check("变更即时生效(无需重新登录): VIP 题材 403", a.get("/api/v1/themes").status_code == 403)
        r = adm.post("/api/v1/admin/roles", json={"name": "trial", "label": "体验",
                                                  "permissions": {"page.overview": 1, "page.themes": 1, "client.web": 1,
                                                                  "data.history_days": 3, "max_sessions": 1}})
        check("新建自定义角色", r.status_code == 200)
        check("内置角色不可删", adm.delete("/api/v1/admin/roles/vip").status_code == 409)
        check("未知权限点被拒", adm.put("/api/v1/admin/roles/trial", json={"label": "x", "permissions": {"nope": 1}}).status_code == 422)
        r = adm.patch(f"/api/v1/admin/users/{bob_id}", json={"member_role": "trial"})
        check("为用户指定自定义角色", r.status_code == 200 and b.get("/api/v1/history").status_code == 403)

        # 会员到期自动降级
        adm.patch(f"/api/v1/admin/users/{alice_id}", json={"member_role": "vip", "member_expires_at": time.time() - 5})
        check("会员到期按免费权限处理", a.get("/api/v1/participation").status_code == 403)
        check("不能禁用最后一个管理员", adm.patch(f"/api/v1/admin/users/1", json={"disabled": True}).status_code == 409)

        # 会话与刷新令牌
        s = Client(tc)
        r = s.login("alice", PW)
        rt = r.cookies.get("insight_rt")
        r1 = tc.post("/api/v1/auth/refresh", cookies={"insight_rt": rt})
        check("刷新令牌轮换成功", r1.status_code == 200 and r1.cookies.get("insight_rt") != rt)
        r2 = tc.post("/api/v1/auth/refresh", cookies={"insight_rt": rt})
        check("旧刷新令牌复用被拒", r2.status_code == 401)
        r3 = tc.post("/api/v1/auth/refresh", cookies={"insight_rt": r1.cookies.get("insight_rt")})
        check("复用后该用户全部会话被吊销", r3.status_code == 401)

        # 登录锁定
        for _ in range(5):
            tc.post("/api/v1/auth/login", json={"username": "carol", "password": "wrong-Passw0rd"})
        r = tc.post("/api/v1/auth/login", json={"username": "carol", "password": PW})
        check("连续失败 5 次后锁定 429", r.status_code == 429 and "Retry-After" in r.headers)

        # 管理员重置密码
        r = adm.post(f"/api/v1/admin/users/{alice_id}/reset-password")
        tmp = r.json().get("temporary_password")
        al = Client(tc)
        check("管理员重置密码后需改密", al.login("alice", tmp).status_code == 200 and al.get("/api/v1/overview").status_code == 403)

        # 审计
        audit = adm.get("/api/v1/admin/audit")
        blob = json.dumps(audit.json(), ensure_ascii=False)
        need = {x: (x in blob) for x in ("login", "invite_redeem", "role_update")}
        secrets_leak = {"pw": PW in blob, "code": codes[0] in blob, "token": a.token in blob}
        check("审计含登录/兑换/权限变更且无口令令牌明文", all(need.values()) and not any(secrets_leak.values()),
              (need, secrets_leak))

        # 限流
        l = Client(tc); l.login("bob", PW)
        codes_ = [l.get("/api/v1/health", signed=False).status_code for _ in range(3)]
        spam = [adm.get("/api/v1/overview").status_code for _ in range(130)]
        check("用户限流: 超出每分钟上限返回 429", 429 in spam, set(spam))

    # 微信登录
    app = make_app(INSIGHT_MP_MOCK_LOGIN="1")
    with TestClient(app) as tc:
        r = tc.post("/api/v1/auth/wechat", json={"code": "mock:tester", "accept_terms": True})
        body = r.json()
        check("开发模拟微信登录: 带 mock=true 且 client=mp", r.status_code == 200 and body.get("mock") is True
              and body["user"]["client"] == "mp" and "refresh_token" in body)
        m = Client(tc); m.token, m.sk = body["access_token"], body["sign_key"]
        check("小程序令牌: 总览 200", m.get("/api/v1/overview").status_code == 200)
        check("小程序令牌: 日历(不在小程序范围) 403", m.get("/api/v1/calendar").status_code == 403)
        check("未同意协议的微信首次登录被拒", tc.post("/api/v1/auth/wechat", json={"code": "mock:newbie"}).status_code == 422)
    app = make_app()
    with TestClient(app) as tc:
        r = tc.post("/api/v1/auth/wechat", json={"code": "mock:x", "accept_terms": True})
        check("无资质(未配置 AppID)且未开启模拟: 503 不签发令牌", r.status_code == 503 and "access_token" not in r.text)
    for env, label in (({"INSIGHT_ENV": "production", "INSIGHT_AUTH_MODE": "off"}, "production 禁止关闭鉴权"),
                       ({"INSIGHT_ENV": "production", "INSIGHT_DATA_MODE": "live", "INSIGHT_UPSTREAM_API_KEY": "k",
                         "INSIGHT_JWT_SECRET": ""}, "production 无 JWT 密钥拒绝启动"),
                       ({"INSIGHT_ENV": "production", "INSIGHT_DATA_MODE": "live", "INSIGHT_UPSTREAM_API_KEY": "k",
                         "INSIGHT_JWT_SECRET": "x" * 40, "INSIGHT_MP_MOCK_LOGIN": "1"}, "production 禁止模拟登录")):
        try:
            make_app(**env)
            check(label, False)
        except Exception as e:
            check(label, True, e)

    print("| 测试项 | 结果 |\n|---|---|")
    for n, ok, d in RESULTS:
        print(f"| {n} | {'✅' if ok else '❌ ' + d} |")
    failed = [x for x in RESULTS if not x[1]]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} 通过")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
