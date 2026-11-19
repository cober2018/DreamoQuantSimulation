"""运行配置：全部来自环境变量，启动时一次性校验。"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from .tier_routing import account_keys

PAGES = frozenset({"overview", "participation", "industries", "themes", "history", "calendar"})
FIXTURE_DIR = Path(__file__).resolve().parent.parent / "fixtures"


class ConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class Settings:
    env: str
    data_mode: str
    upstream_base_url: str
    upstream_api_key: str
    upstream_timeout: float
    access_token: str
    cache_ttl: int
    fixture_dir: Path
    auth_mode: str = "required"        # required | off (production 禁止 off)
    jwt_secrets: tuple = ()
    db_path: str = "data/insight.sqlite3"
    registration: str = "open"         # open | invite_only
    bootstrap_admin_user: str = ""
    bootstrap_admin_password: str = ""
    allowed_origins: tuple = ()
    wechat_appid: str = ""
    wechat_secret: str = ""
    mp_mock_login: bool = False
    # 过渡期旧 Key：只用于 review-*；未设置时 review-* 沿用 INSIGHT_UPSTREAM_API_KEY（切换前的兼容）
    legacy_api_key: str = ""
    # 等级账号名 → Key（D2）：insight-svip 用 INSIGHT_UPSTREAM_API_KEY，其余用 INSIGHT_UPSTREAM_API_KEY_<后缀>
    account_keys: tuple = ()
    policy_require_second_approver: bool = False
    # 已切到 public-* 事实视图的页面 (D4)：overview,participation,industries,themes,history,calendar
    public_pages: frozenset = frozenset()
    # DK2：上线先免费试用、不开支付。付费入口（套餐、带金额/套餐的开通）默认关闭，=1 才打开
    payment_enabled: bool = False
    # 全站试用：截止日（北京时间当天结束）之前，非管理员用户的生效等级至少为 trial_role；不写库
    trial_role: str = ""
    trial_until: float = 0.0
    email_verify: bool = False
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    mail_from: str = ""


_CN = timezone(timedelta(hours=8))


def _trial_until(value: str) -> float:
    """YYYY-MM-DD → 该日北京时间 24:00 的时间戳；空串 → 0（不启用）。"""
    if not value:
        return 0.0
    try:
        day = date.fromisoformat(value)
    except ValueError:
        raise ConfigError("INSIGHT_TRIAL_UNTIL 格式为 YYYY-MM-DD") from None
    return datetime(day.year, day.month, day.day, tzinfo=_CN).timestamp() + 86400


def load_settings() -> Settings:
    settings = Settings(
        env=os.getenv("INSIGHT_ENV", "development").strip().lower(),
        data_mode=os.getenv("INSIGHT_DATA_MODE", "live").strip().lower(),
        upstream_base_url=os.getenv("INSIGHT_UPSTREAM_BASE_URL", "http://127.0.0.1:8000").rstrip("/"),
        upstream_api_key=os.getenv("INSIGHT_UPSTREAM_API_KEY", ""),
        upstream_timeout=float(os.getenv("INSIGHT_UPSTREAM_TIMEOUT", "15")),
        access_token=os.getenv("INSIGHT_ACCESS_TOKEN", ""),
        cache_ttl=int(os.getenv("INSIGHT_CACHE_TTL", "60")),
        fixture_dir=Path(os.getenv("INSIGHT_FIXTURE_DIR", str(FIXTURE_DIR))),
        auth_mode=os.getenv("INSIGHT_AUTH_MODE", "required").strip().lower(),
        jwt_secrets=tuple(x for x in (os.getenv("INSIGHT_JWT_SECRET", ""), os.getenv("INSIGHT_JWT_SECRET_PREVIOUS", "")) if x),
        db_path=os.getenv("INSIGHT_DB_PATH", "data/insight.sqlite3"),
        registration=os.getenv("INSIGHT_REGISTRATION", "open").strip().lower(),
        bootstrap_admin_user=os.getenv("INSIGHT_BOOTSTRAP_ADMIN_USER", "").strip(),
        bootstrap_admin_password=os.getenv("INSIGHT_BOOTSTRAP_ADMIN_PASSWORD", ""),
        allowed_origins=tuple(x.strip() for x in os.getenv("INSIGHT_ALLOWED_ORIGINS", "").split(",") if x.strip()),
        wechat_appid=os.getenv("INSIGHT_WECHAT_APPID", "").strip(),
        wechat_secret=os.getenv("INSIGHT_WECHAT_SECRET", "").strip(),
        mp_mock_login=os.getenv("INSIGHT_MP_MOCK_LOGIN", "") == "1",
        legacy_api_key=os.getenv("INSIGHT_UPSTREAM_LEGACY_API_KEY", ""),
        account_keys=tuple(sorted(account_keys(os.getenv("INSIGHT_UPSTREAM_API_KEY", ""), dict(os.environ)).items())),
        policy_require_second_approver=os.getenv("INSIGHT_POLICY_REQUIRE_SECOND_APPROVER", "") == "1",
        public_pages=frozenset(x.strip() for x in os.getenv("INSIGHT_PUBLIC_PAGES", "").split(",") if x.strip()),
        payment_enabled=os.getenv("INSIGHT_PAYMENT_ENABLED", "") == "1",
        trial_role=os.getenv("INSIGHT_TRIAL_ROLE", "").strip().lower(),
        trial_until=_trial_until(os.getenv("INSIGHT_TRIAL_UNTIL", "").strip()),
        email_verify=os.getenv("INSIGHT_EMAIL_VERIFY", "") == "1",
        smtp_host=os.getenv("INSIGHT_SMTP_HOST", "").strip(),
        smtp_port=int(os.getenv("INSIGHT_SMTP_PORT", "465") or 465),
        smtp_user=os.getenv("INSIGHT_SMTP_USER", "").strip(),
        smtp_password=os.getenv("INSIGHT_SMTP_PASSWORD", ""),
        mail_from=os.getenv("INSIGHT_MAIL_FROM", "").strip(),
    )
    if settings.email_verify and not (settings.smtp_host and settings.smtp_user and settings.smtp_password and settings.mail_from):
        raise ConfigError("INSIGHT_EMAIL_VERIFY=1 时必须设置 INSIGHT_SMTP_HOST / USER / PASSWORD 和 INSIGHT_MAIL_FROM")
    if bool(settings.trial_role) != bool(settings.trial_until):
        raise ConfigError("INSIGHT_TRIAL_ROLE 与 INSIGHT_TRIAL_UNTIL 必须同时设置或同时不设")
    if settings.trial_role in {"admin", "free"}:
        raise ConfigError("INSIGHT_TRIAL_ROLE 不能是 admin 或 free")
    if settings.data_mode not in {"live", "fixture"}:
        raise ConfigError("INSIGHT_DATA_MODE 只允许 live / fixture")
    # 夹具含合成数据，绝不能出现在对外环境
    if settings.env == "production" and settings.data_mode == "fixture":
        raise ConfigError("production 环境禁止启用 fixture 数据模式")
    if settings.auth_mode not in {"required", "off"}:
        raise ConfigError("INSIGHT_AUTH_MODE 只允许 required / off")
    if settings.registration not in {"open", "invite_only"}:
        raise ConfigError("INSIGHT_REGISTRATION 只允许 open / invite_only")
    if settings.env == "production":
        if settings.auth_mode == "off":
            raise ConfigError("production 环境禁止关闭鉴权")
        if not settings.jwt_secrets or len(settings.jwt_secrets[0]) < 32:
            raise ConfigError("production 必须配置至少 32 位的 INSIGHT_JWT_SECRET")
        if settings.mp_mock_login:
            raise ConfigError("production 环境禁止启用小程序模拟登录")
    unknown_pages = settings.public_pages - PAGES
    if unknown_pages:
        raise ConfigError(f"INSIGHT_PUBLIC_PAGES 含未知页面: {', '.join(sorted(unknown_pages))}")
    if settings.data_mode == "live" and not settings.upstream_api_key:
        raise ConfigError("live 模式必须配置 INSIGHT_UPSTREAM_API_KEY")
    return settings
