"""新旧链路对数（openspec govern-upstream-via-public-services-v1 D5）。

对同一组交易日分别用 modules.py（review-* + 旧 Key）与 public_modules.py（public-* 事实视图 + 等级账号 Key）
生成本平台对外响应，逐字段比较。只发 GET records，不写任何上游数据；Key 从 env 文件读取，不打印。

运行：backend/.venv/bin/python scripts/sandbox/2026-11-15_verify_public_parity.py \
        --env-file .env.integration.local --base-url http://127.0.0.1:8796 --dates 2026-09-01:2026-09-09 --extra 2026-09-06
"""
import argparse
import asyncio
import json
import math
import os
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

# 已知、不算口径差异的字段：服务名不同、事件引用改为不透明编号、事实视图不提供模型版本
IGNORED_KEYS = {"service_key", "event_id", "model_version", "snapshot_time", "missing_sources"}
REL_TOL = 1e-6


def load_env(path: Path) -> dict:
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def diff(a, b, path="$", out=None):
    out = [] if out is None else out
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k in IGNORED_KEYS:
                continue
            if k not in a or k not in b:
                out.append((f"{path}.{k}", a.get(k, "<缺>"), b.get(k, "<缺>")))
            else:
                diff(a[k], b[k], f"{path}.{k}", out)
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            out.append((f"{path}[len]", len(a), len(b)))
        for i, (x, y) in enumerate(zip(a, b)):
            diff(x, y, f"{path}[{i}]", out)
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and not isinstance(b, bool):
        if not math.isclose(a, b, rel_tol=REL_TOL, abs_tol=1e-9):
            out.append((path, a, b))
    elif a != b:
        out.append((path, a, b))
    return out


def normalize(env):
    """gaps 的说明文字两条链路措辞可能不同，只比内容编号；其余原样比较。"""
    e = json.loads(json.dumps(env, ensure_ascii=False))
    e["gaps"] = sorted(g.get("content_id") for g in e.get("gaps", []))
    e.pop("disclaimer", None)
    return e


def dates_from(spec: str):
    start, end = (date.fromisoformat(x) for x in spec.split(":"))
    d, out = start, []
    while d <= end:
        if d.weekday() < 5:
            out.append(d.isoformat())
        d += timedelta(days=1)
    return out


async def run(args):
    env = load_env(Path(args.env_file))
    for k in [k for k in os.environ if k.startswith("INSIGHT_")]:
        del os.environ[k]
    os.environ.update({"INSIGHT_DATA_MODE": "live", "INSIGHT_ENV": "development",
                       "INSIGHT_UPSTREAM_BASE_URL": args.base_url,
                       "INSIGHT_UPSTREAM_API_KEY": env.get("INSIGHT_UPSTREAM_API_KEY", ""),
                       "INSIGHT_UPSTREAM_LEGACY_API_KEY": env.get("INSIGHT_UPSTREAM_LEGACY_API_KEY", "")})
    if not os.environ["INSIGHT_UPSTREAM_API_KEY"] or not os.environ["INSIGHT_UPSTREAM_LEGACY_API_KEY"]:
        raise SystemExit("env 文件需同时含 INSIGHT_UPSTREAM_API_KEY 与 INSIGHT_UPSTREAM_LEGACY_API_KEY")
    from insight_api import modules, public_modules
    from insight_api.config import load_settings
    from insight_api.tier_routing import RequestContext, TierRouter, set_context
    from insight_api.upstream import Upstream, UpstreamError

    s = load_settings()
    router = TierRouter(None, dict(s.account_keys), s.legacy_api_key, require_keys=True, dev_fallback=True)
    up = Upstream(s, router)
    wide = set()
    orig_page = up._source.page

    async def watch(service_key, params, headers=None):
        for attempt in range(6):  # 对数请求密集，遇到 Key 限流 429 退避重试
            try:
                rows, meta = await orig_page(service_key, params, headers)
                break
            except UpstreamError as e:
                if e.status != 429 or attempt == 5:
                    raise
                await asyncio.sleep(2 ** attempt)
        if service_key.startswith("public-") and params.get("fields"):
            asked = set(params["fields"].split(","))
            for r in rows:
                for k in set(r) - asked:
                    wide.add(f"{service_key}/{params.get('view')}.{k}")
        return rows, meta
    up._source.page = watch
    set_context(RequestContext(request_id="parity", user_id=0, end_user_ref="parity-check", role="dev", client="web"))

    days = dates_from(args.dates) + [d for d in args.extra.split(",") if d]
    pages = {
        "calendar": lambda m, d: m.calendar(up, d, 14),
        "participation": lambda m, d: m.participation(up, d),
        "themes": lambda m, d: m.themes(up, d),
        "history": lambda m, d: m.history(up, d, "行业板块", "1d"),
        "overview": lambda m, d: m.overview(up, d),
        "industries": lambda m, d: m.industries(up, d, "行业板块"),
    }
    pages = {k: v for k, v in pages.items() if not args.pages or k in args.pages.split(",")}
    report = {}
    for page, call in pages.items():
        rows = []
        for d in days:
            res = {}
            for name, mod in (("old", modules), ("new", public_modules)):
                try:
                    res[name] = normalize(await call(mod, d))
                except UpstreamError as e:
                    res[name] = {"error": str(e)}
            if "error" in res["old"] or "error" in res["new"]:
                rows.append((d, "无法比较", res["old"].get("error") or res["old"].get("status"),
                             res["new"].get("error") or res["new"].get("status")))
                continue
            dd = diff(res["old"], res["new"])
            rows.append((d, "一致" if not dd else f"{len(dd)} 处差异", res["old"]["status"], res["new"]["status"], dd[:int(os.environ.get("PARITY_MAX", "8"))]))
        report[page] = rows
    await up.close()

    print("| 页面 | 交易日 | 结论 | 旧链路 | 新链路 |\n|---|---|---|---|---|")
    for page, rows in report.items():
        for r in rows:
            print(f"| {page} | {r[0]} | {r[1]} | {str(r[2])[:60]} | {str(r[3])[:60]} |")
    print("\n上游模板偏宽（返回了未请求的字段）：" + ("无" if not wide else "⚠ " + ", ".join(sorted(wide))))
    print("\n差异明细（每页每日最多 8 处）：")
    for page, rows in report.items():
        for r in rows:
            if len(r) > 4 and r[4]:
                print(f"- {page} {r[0]}")
                for p, a, b in r[4]:
                    print(f"    {p}: 旧={json.dumps(a, ensure_ascii=False)[:90]} 新={json.dumps(b, ensure_ascii=False)[:90]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--env-file", default=str(ROOT / ".env.integration.local"))
    ap.add_argument("--base-url", default="http://127.0.0.1:8796")
    ap.add_argument("--dates", default="2026-08-27:2026-09-09")
    ap.add_argument("--extra", default="2026-09-06")
    ap.add_argument("--pages", default="")
    asyncio.run(run(ap.parse_args()))


if __name__ == "__main__":
    main()
