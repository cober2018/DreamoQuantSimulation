"""ZS-109 R1 回放：只读。用线上网关同一套模块取近 N 个交易日数据，按 brief 规则生成要点，输出 JSON 到 stdout。
不写网关库（RouteLog 无 store）；上游请求标记 X-End-User-Ref=zs112-r1-replay。"""
import asyncio, json, sys, time
from datetime import date, timedelta
sys.path.insert(0, "/opt/dk-insight/app/current/backend")
sys.path.insert(0, sys.argv[1])  # brief.py 所在临时目录
from insight_api.config import load_settings
from insight_api.upstream import Upstream
from insight_api import public_modules as pm
from insight_api.tier_routing import RequestContext, set_context
from brief import daily_brief

N = int(sys.argv[2]) if len(sys.argv) > 2 else 20
settings = load_settings()

class Router:
    def resolve(self, service_key, ctx):
        return settings.upstream_api_key, "insight-svip", None
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
        result.append(b)
    print(json.dumps({"generated_at": time.strftime("%Y-%m-%d %H:%M:%S"), "days": result}, ensure_ascii=False))

asyncio.run(main())
