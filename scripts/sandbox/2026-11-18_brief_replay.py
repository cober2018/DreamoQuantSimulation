"""ZS-109 R1 回放：只读。用线上网关同一套模块取近 N 个交易日数据，按 brief 规则生成要点，输出 JSON 到 stdout。
不写网关库（RouteLog 无 store）；上游请求标记 X-End-User-Ref=zs112-r1-replay。
ZS-113 教训：批量请求禁止用线上 svip Key；这里用 v1 路由下线上不使用的 insight-vip Key（额度独立），
全局限速每分钟 ≤ 50 次，遇 429 退避重试。"""
import asyncio, json, os, sys, time
from datetime import date, timedelta
sys.path.insert(0, "/opt/dk-insight/app/current/backend")
sys.path.insert(0, sys.argv[1])  # brief.py 所在临时目录
from insight_api.config import load_settings
from insight_api.upstream import HttpSource, Upstream, UpstreamError
from insight_api import public_modules as pm
from insight_api.tier_routing import RequestContext, set_context
from brief import daily_brief

N = int(sys.argv[2]) if len(sys.argv) > 2 else 20
settings = load_settings()

MIN_INTERVAL = 60 / 50  # 每分钟最多 50 次
_last = [0.0]
_orig_page = HttpSource.page
REQUESTS = [0, 0]  # 总请求, 429 次数


async def _paced_page(self, service_key, params, headers=None):
    for attempt in range(4):
        wait = _last[0] + MIN_INTERVAL - time.monotonic()
        if wait > 0:
            await asyncio.sleep(wait)
        _last[0] = time.monotonic()
        REQUESTS[0] += 1
        try:
            return await _orig_page(self, service_key, params, headers)
        except UpstreamError as e:
            if e.status != 429 or attempt == 3:
                raise
            REQUESTS[1] += 1
            await asyncio.sleep(30 * (attempt + 1))


HttpSource.page = _paced_page
VIP_KEY = os.environ["INSIGHT_UPSTREAM_API_KEY_VIP"]


class Router:
    def resolve(self, service_key, ctx):
        return VIP_KEY, "insight-vip", None
    def active_version(self):
        return None

async def main():
    set_context(RequestContext(request_id="zs112-r1", user_id=0, end_user_ref="zs112-r1-replay", role="svip", client="api"))
    up = Upstream(settings, Router())
    async def pause():
        await asyncio.sleep(0.3)
    async def page(d):
        out = {}
        for name, fn in (("overview", lambda: pm.overview(up, d)), ("participation", lambda: pm.participation(up, d)),
                         ("industries", lambda: pm.industries(up, d, "行业板块")), ("themes", lambda: pm.themes(up, d)),
                         ("history", lambda: pm.history(up, d, "行业板块", "1d")), ("calendar", lambda: pm.calendar(up, d, 14))):
            try:
                out[name] = await fn()
            except Exception as e:
                out[name] = {"status": "error", "error": f"{type(e).__name__}: {e}"[:200]}
            await pause()
        return out
    days, d = [], date.today()
    while len(days) < N + 1 and (date.today() - d).days < 60:
        ov = await pm.overview(up, d.isoformat()); await pause()
        if ov.get("status") in ("ok", "partial") and ov.get("trade_date") == d.isoformat():
            days.append(d.isoformat())
        d -= timedelta(days=1)
    days.sort()
    pages = {}
    for d in days:
        pages[d] = await page(d)
    result = []
    for i in range(1, len(days)):
        b = daily_brief(pages[days[i]], pages[days[i - 1]])
        b["trade_date"] = days[i]
        b["module_status"] = {k: v.get("status") for k, v in pages[days[i]].items()}
        b["module_dates"] = {k: v.get("trade_date") for k, v in pages[days[i]].items()}
        b["module_errors"] = {k: v.get("error") for k, v in pages[days[i]].items() if v.get("status") == "error"}
        result.append(b)
    print(json.dumps({"generated_at": time.strftime("%Y-%m-%d %H:%M:%S"), "requests": REQUESTS[0], "retries_429": REQUESTS[1],
                      "days": result}, ensure_ascii=False))

asyncio.run(main())
