"""录制 public-* 事实视图夹具（openspec govern-upstream-via-public-services-v1 tasks 3.2）。

用 public_modules 实际发出的请求参数，向投研平台**本地**实例只读取数，按 FixtureSource 的 public 格式写入
backend/fixtures/public-*.json（键 "<view>|<trade_date>|<其他参数>"）。不录 Key、不录请求头。

运行：backend/.venv/bin/python scripts/sandbox/2026-11-15_build_public_fixtures.py --dates 2026-09-08,2026-09-09
"""
import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))


async def run(args):
    env = {}
    for line in Path(args.env_file).read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    if "127.0.0.1" not in args.base_url and "localhost" not in args.base_url:
        raise SystemExit("只允许从本地实例录制夹具")
    for k in [k for k in os.environ if k.startswith("INSIGHT_")]:
        del os.environ[k]
    os.environ.update({"INSIGHT_DATA_MODE": "live", "INSIGHT_ENV": "development", "INSIGHT_UPSTREAM_BASE_URL": args.base_url,
                       "INSIGHT_UPSTREAM_API_KEY": env["INSIGHT_UPSTREAM_API_KEY"],
                       "INSIGHT_UPSTREAM_LEGACY_API_KEY": env.get("INSIGHT_UPSTREAM_LEGACY_API_KEY", "")})
    from insight_api import public_modules as pm
    from insight_api.config import load_settings
    from insight_api.tier_routing import RequestContext, TierRouter, set_context
    from insight_api.upstream import Upstream, UpstreamError

    s = load_settings()
    up = Upstream(s, TierRouter(None, dict(s.account_keys), s.legacy_api_key, True, dev_fallback=True))
    set_context(RequestContext("fixture", 0, "fixture-build", "dev", "web"))
    recorded = {}
    orig = up._source.page

    async def rec(service_key, params, headers=None):
        rows, meta = await orig(service_key, {**params, "limit": "500", "offset": "0"}, headers)
        extra = "|".join(f"{k}={params[k]}" for k in sorted(params)
                         if k not in ("view", "trade_date", "limit", "offset", "fields"))
        day = meta.get("trade_date") or params.get("trade_date")
        recorded.setdefault(service_key, {})[f"{params.get('view')}|{day}|{extra}"] = {**meta, "rows": rows}
        off, lim = int(params.get("offset", 0)), int(params.get("limit", 100))
        return rows[off:off + lim], meta
    up._source.page = rec

    for d in args.dates.split(","):
        for call in (pm.themes(up, d), pm.participation(up, d), pm.calendar(up, d, 14)):
            try:
                await call
            except UpstreamError as e:
                print(f"跳过 {d}: {e}")
    await up.close()
    out = ROOT / "backend" / "fixtures"
    for svc, data in recorded.items():
        (out / f"{svc}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{svc}.json: {len(data)} 条")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--env-file", default=str(ROOT / ".env.integration.local"))
    ap.add_argument("--base-url", default="http://127.0.0.1:8796")
    ap.add_argument("--dates", default="2026-09-08,2026-09-09")
    asyncio.run(run(ap.parse_args()))


if __name__ == "__main__":
    main()
