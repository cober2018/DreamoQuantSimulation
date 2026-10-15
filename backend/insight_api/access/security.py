"""密码哈希 / JWT / 邀请码生成 / 请求签名。"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
from typing import Any, Dict, Optional

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

_hasher = PasswordHasher()  # argon2id 默认参数

# 邀请码字符集: 去掉 0/O/1/I/L 等易混字符
CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
ACCESS_TTL = 15 * 60
REFRESH_TTL = 14 * 24 * 3600
SIGN_WINDOW = 60


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(hashed: str, password: str) -> bool:
    try:
        return _hasher.verify(hashed, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_policy_error(password: str, username: str = "") -> Optional[str]:
    if len(password) < 10:
        return "密码至少 10 位"
    if password.lower() == username.lower() or len(set(password)) < 5:
        return "密码过于简单"
    classes = sum(any(f(c) for c in password) for f in (str.islower, str.isupper, str.isdigit))
    if classes < 2:
        return "密码需包含大小写字母与数字中的至少两类"
    return None


def new_invite_code() -> str:
    body = "".join(secrets.choice(CODE_ALPHABET) for _ in range(11))
    check = CODE_ALPHABET[sum(CODE_ALPHABET.index(c) * (i + 1) for i, c in enumerate(body)) % len(CODE_ALPHABET)]
    raw = body + check
    return f"{raw[:4]}-{raw[4:8]}-{raw[8:]}"


def normalize_code(code: str) -> str:
    return "".join(ch for ch in (code or "").upper() if ch.isalnum())


def code_checksum_ok(code: str) -> bool:
    raw = normalize_code(code)
    if len(raw) != 12 or any(c not in CODE_ALPHABET for c in raw):
        return False
    body, check = raw[:11], raw[11]
    return CODE_ALPHABET[sum(CODE_ALPHABET.index(c) * (i + 1) for i, c in enumerate(body)) % len(CODE_ALPHABET)] == check


def opaque_token() -> str:
    return secrets.token_urlsafe(48)


def sign_key() -> str:
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")


def make_access_token(secret: str, *, user_id: int, token_version: int, client: str, sk: str, session: str) -> str:
    now = int(time.time())
    return jwt.encode({"sub": str(user_id), "tv": token_version, "cl": client, "sk": sk, "ses": session,
                       "iat": now, "exp": now + ACCESS_TTL}, secret, algorithm="HS256")


def decode_access_token(secrets_list: list, token: str) -> Optional[Dict[str, Any]]:
    """支持密钥轮换: 依次用新旧密钥验签。"""
    for secret in secrets_list:
        try:
            return jwt.decode(token, secret, algorithms=["HS256"], options={"require": ["exp", "sub"]})
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            continue
    return None


def request_signature(key: str, method: str, path: str, query: str, ts: str, nonce: str) -> str:
    canonical = "\n".join([method.upper(), path, query, ts, nonce])
    return hmac.new(key.encode(), canonical.encode(), hashlib.sha256).hexdigest()


def constant_eq(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())
