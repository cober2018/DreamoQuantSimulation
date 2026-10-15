"""请求级防护: 滑动窗口限流、异常检测与临时封禁、签名随机数去重。进程内实现 (单节点)。"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Optional, Set, Tuple


class SlidingLimiter:
    def __init__(self) -> None:
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, window: float, now: Optional[float] = None) -> Tuple[bool, int]:
        """返回 (放行, 需等待秒数)。"""
        now = now or time.time()
        with self._lock:
            q = self._hits[key]
            while q and q[0] <= now - window:
                q.popleft()
            if len(q) >= limit:
                return False, max(1, int(q[0] + window - now) + 1)
            q.append(now)
            return True, 0


class Blocklist:
    def __init__(self) -> None:
        self._until: Dict[str, float] = {}
        self._lock = threading.Lock()

    def block(self, key: str, seconds: float) -> None:
        with self._lock:
            self._until[key] = time.time() + seconds

    def remaining(self, key: str) -> int:
        with self._lock:
            until = self._until.get(key, 0)
            left = int(until - time.time())
            if left <= 0:
                self._until.pop(key, None)
                return 0
            return left


class NonceStore:
    """签名随机数去重: 窗口内重复即重放。"""

    def __init__(self, ttl: int = 120) -> None:
        self._seen: Dict[str, float] = {}
        self._ttl = ttl
        self._lock = threading.Lock()
        self._last_purge = 0.0

    def seen_before(self, scope: str, nonce: str) -> bool:
        now = time.time()
        key = f"{scope}:{nonce}"
        with self._lock:
            if now - self._last_purge > 30:
                self._seen = {k: v for k, v in self._seen.items() if v > now}
                self._last_purge = now
            if key in self._seen:
                return True
            self._seen[key] = now + self._ttl
            return False


class AnomalyDetector:
    """短时遍历大量不同日期/板块、同一令牌多 IP 使用 → 判异常。"""

    def __init__(self, date_limit: int = 25, ip_limit: int = 4, window: float = 600.0) -> None:
        self._dates: Dict[str, Deque[Tuple[float, str]]] = defaultdict(deque)
        self._ips: Dict[str, Deque[Tuple[float, str]]] = defaultdict(deque)
        self._date_limit, self._ip_limit, self._window = date_limit, ip_limit, window
        self._lock = threading.Lock()

    def observe(self, user: str, ip: Optional[str], trade_date: Optional[str]) -> Optional[str]:
        now = time.time()
        with self._lock:
            if trade_date:
                q = self._dates[user]
                q.append((now, trade_date))
                while q and q[0][0] < now - 60:
                    q.popleft()
                if len({d for _, d in q}) > self._date_limit:
                    return "sequential_date_traversal"
            if ip:
                q = self._ips[user]
                q.append((now, ip))
                while q and q[0][0] < now - self._window:
                    q.popleft()
                if len({i for _, i in q}) >= self._ip_limit:
                    return "token_shared_across_ips"
        return None
