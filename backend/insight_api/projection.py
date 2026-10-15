"""允许清单投影与统一信封。

投影只按映射复制字段；未登记字段在这里就被丢弃，禁止键守卫只是第二道防线。
"""

from __future__ import annotations

import json
import math
from typing import Any, Dict, Iterable, List, Optional, Tuple

from .content_scope import DISCLAIMER, assert_delivered, scan_forbidden_keys

_MISSING = object()


def parse_json(value: Any) -> Any:
    """上游 JSON 列是字符串；解析失败返回 _MISSING，让调用方能区分"空"和"坏"。"""
    if value is None or value == "":
        return None
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return _MISSING


def is_bad(value: Any) -> bool:
    return value is _MISSING


def clean(value: Any) -> Any:
    if isinstance(value, bool):
        return value
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return round(value, 6)
    return value


def to_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else f


def to_int(value: Any) -> Optional[int]:
    f = to_float(value)
    return int(f) if f is not None else None


def pick(source: Optional[Dict[str, Any]], fields: Iterable[str] | Dict[str, str]) -> Dict[str, Any]:
    """fields 为列表时同名复制；为字典时 {输出名: 来源键}。"""
    mapping = dict(fields) if isinstance(fields, dict) else {f: f for f in fields}
    src = source if isinstance(source, dict) else {}
    return {out: clean(src.get(key)) for out, key in mapping.items()}


def source_entry(
    service_key: str,
    row: Optional[Dict[str, Any]],
    snapshot_key: Optional[str] = None,
    coverage: Any = None,
    missing: Optional[List[str]] = None,
) -> Dict[str, Any]:
    return {
        "service_key": service_key,
        "source_date": (row or {}).get("trade_date"),
        "snapshot_time": (row or {}).get(snapshot_key) if snapshot_key else None,
        "coverage_ratio": clean(to_float(coverage)),
        "missing_sources": missing or [],
    }


def envelope(
    module: str,
    content_ids: List[str],
    data_mode: str,
    *,
    trade_date: Optional[str] = None,
    status: str = "ok",
    sources: Optional[List[Dict[str, Any]]] = None,
    gaps: Optional[List[Dict[str, Any]]] = None,
    data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    assert_delivered(content_ids)
    body = {
        "module": module,
        "content_ids": content_ids,
        "trade_date": trade_date,
        "status": status,
        "data_mode": data_mode,
        "sources": sources or [],
        "gaps": gaps or [],
        "data": data or {},
        "disclaimer": DISCLAIMER,
    }
    scan_forbidden_keys(body)
    return body


def status_from(gaps: List[Dict[str, Any]], issues: List[str]) -> str:
    return "partial" if gaps or issues else "ok"


def issue_gaps(content_id: str, issues: List[str]) -> List[Dict[str, Any]]:
    return [{"content_id": content_id, "item": "数据完整性", "reason": msg} for msg in issues]


def missing_list(value: Any) -> List[str]:
    parsed = parse_json(value) if isinstance(value, str) else value
    return [str(x) for x in parsed] if isinstance(parsed, list) else []


def first(rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return rows[0] if rows else None


def split_sign(a: Optional[float], b: Optional[float]) -> Tuple[bool, bool]:
    """返回 (可比较, 方向不一致)。任一为 0 或空即不可比较。"""
    if not a or not b:
        return False, False
    return True, (a > 0) != (b > 0)
