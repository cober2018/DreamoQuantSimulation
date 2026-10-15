"""运行配置：全部来自环境变量，启动时一次性校验。"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

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
    )
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
    if settings.data_mode == "live" and not settings.upstream_api_key:
        raise ConfigError("live 模式必须配置 INSIGHT_UPSTREAM_API_KEY")
    return settings
