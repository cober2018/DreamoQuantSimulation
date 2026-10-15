"""内容范围注册表与禁止键守卫。

来源：docs/source/EXTERNAL_ANALYTICS_CONTENT_SCOPE.md V0.3 §4（37 条 CNT）。
selection 记录内容去留决定；v1 记录首版是否真正交付。二者分开，
避免"保留设计"被误读成"已交付"，也避免"待定"被悄悄放出。
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

DISCLAIMER = "本平台仅提供证券信息汇总与历史数据统计，不构成任何证券投资建议。"

KEEP, EXCLUDE, PENDING = "keep", "exclude", "pending"
DELIVERED, NOT_CONNECTED, V1_PENDING, EXCLUDED = "delivered", "not_connected", "pending", "excluded"

_NO_SOURCE = "数据中台暂无对应服务，待另立变更接入"

CONTENT_SCOPE: List[Dict[str, str]] = [
    {"id": "CNT-001", "source": "首页", "item": "主仪表板跳转和最近分析下载", "selection": EXCLUDE, "v1": EXCLUDED, "page": "-", "reason": "不复制旧完整报告和快速分析入口"},
    {"id": "CNT-002", "source": "首页/复盘总览", "item": "数据日期、新鲜度、缺失说明", "selection": KEEP, "v1": DELIVERED, "page": "全部页面", "reason": "数据身份、覆盖与更新状态"},
    {"id": "CNT-003", "source": "复盘总览", "item": "今日决策、position_guidance", "selection": EXCLUDE, "v1": EXCLUDED, "page": "-", "reason": "仓位指导、风险指令、操作理由不迁入"},
    {"id": "CNT-004", "source": "复盘总览", "item": "市场水温（仅涨跌家数原始统计）", "selection": KEEP, "v1": DELIVERED, "page": "市场总览", "reason": "只交付涨跌家数与比例；水温复合分及附带提示仍待定"},
    {"id": "CNT-005", "source": "复盘总览", "item": "个股动作Top列表", "selection": EXCLUDE, "v1": EXCLUDED, "page": "-", "reason": "按决策分选出的名单本身即选择语义"},
    {"id": "CNT-006", "source": "市场情绪", "item": "市场参与与压力观察（统计部分）", "selection": KEEP, "v1": DELIVERED, "page": "参与度与资金环境", "reason": "只交付成交额、分位、卖出占比、委托失衡等原始统计；状态标签与图景文案、复合分不交付"},
    {"id": "CNT-007", "source": "市场情绪", "item": "ERP及股票/利率端拆解（统计部分）", "selection": KEEP, "v1": DELIVERED, "page": "参与度与资金环境", "reason": "数值、历史分位、来源；估值状态标签与推导不迁入"},
    {"id": "CNT-008", "source": "市场情绪", "item": "封板率、连板数、最高连板、首板溢价、回封率", "selection": KEEP, "v1": DELIVERED, "page": "参与度与资金环境", "reason": "当日观察统计；首板溢价标注非未来收益"},
    {"id": "CNT-009", "source": "市场情绪", "item": "聪明钱五因子（截面统计部分）", "selection": KEEP, "v1": DELIVERED, "page": "参与度与资金环境", "reason": "只交付五因子净广度%、正/负占比与样本量；共振评分、风险分与解释不迁入（因子键名含 impact，投影时重命名）"},
    {"id": "CNT-010", "source": "市场情绪", "item": "双口径衍生品、期权情绪矩阵（原始统计）", "selection": KEEP, "v1": DELIVERED, "page": "参与度与资金环境", "reason": "只交付基差、持仓比、PCR 及其 z 分；复合分待定"},
    {"id": "CNT-011", "source": "市场情绪", "item": "风格轮动（相对强度序列部分）", "selection": KEEP, "v1": DELIVERED, "page": "参与度与资金环境", "reason": "只交付三阵营强度分、z 分与近 20 日序列，保持固定阵营顺序；leader/signal（当前应选哪种风格）不迁入"},
    {"id": "CNT-012", "source": "市场情绪", "item": "仓位建议与短线预算卡", "selection": EXCLUDE, "v1": EXCLUDED, "page": "-", "reason": "参与配置及新增许可不迁入"},
    {"id": "CNT-013", "source": "市场情绪", "item": "底部条件观察值（三项指标部分）", "selection": KEEP, "v1": DELIVERED, "page": "参与度与资金环境", "reason": "只交付宽度承接/风险偏好/流动性的观察值与规则阈值对比及样本数；下一状态预测、准备度总分与解读不迁入"},
    {"id": "CNT-014", "source": "行业复盘", "item": "行业/概念/地域切换和搜索", "selection": KEEP, "v1": DELIVERED, "page": "行业比较与轮动", "reason": "同一时点分类、搜索与资料导航"},
    {"id": "CNT-015", "source": "行业复盘", "item": "RRG 散点和历史轨迹", "selection": KEEP, "v1": DELIVERED, "page": "行业比较与轮动", "reason": "只画原始坐标；象限配色与操作解读不复制"},
    {"id": "CNT-016", "source": "行业复盘/每日复盘", "item": "行业热力、扩散、成交指标", "selection": KEEP, "v1": DELIVERED, "page": "行业比较与轮动", "reason": "只交付价格/成交/扩散事实；拥挤度标签不迁入"},
    {"id": "CNT-017", "source": "行业复盘", "item": "Focus主攻/Hold观察/Avoid规避", "selection": EXCLUDE, "v1": EXCLUDED, "page": "-", "reason": "操作分组不迁入，也不以中性名称复现"},
    {"id": "CNT-018", "source": "行业生命周期", "item": "行业阶段和阶段变化", "selection": EXCLUDE, "v1": EXCLUDED, "page": "-", "reason": "阶段标签与变化解读不迁入；阶段所依据的原始指标（涨跌幅/扩散/MA20 等）已在行业比较页交付"},
    {"id": "CNT-019", "source": "行业生命周期", "item": "机会风险分布环图、优先级筛选", "selection": EXCLUDE, "v1": EXCLUDED, "page": "-", "reason": "评级分布与优先级筛选是行业选择入口，无独立事实部分，不迁入"},
    {"id": "CNT-020", "source": "行业生命周期", "item": "来源日、覆盖、历史入口", "selection": KEEP, "v1": DELIVERED, "page": "行业比较与轮动", "reason": "以来源表和覆盖率呈现"},
    {"id": "CNT-021", "source": "行业生命周期", "item": "个股强度/CQ/机会排名与新增准入", "selection": EXCLUDE, "v1": EXCLUDED, "page": "-", "reason": "操作许可不迁入；原始评分待另审（SEC-005/008）"},
    {"id": "CNT-022", "source": "题材", "item": "题材涨停/炸板数、最高板、平均涨幅、封板时间", "selection": KEEP, "v1": DELIVERED, "page": "题材与涨跌结构", "reason": "题材统计取自题材 ADS，封板时间分布取自涨跌停明细；不交付强度分、阶段、代表股"},
    {"id": "CNT-023", "source": "题材", "item": "题材强度分、决策分、代表股选择", "selection": EXCLUDE, "v1": EXCLUDED, "page": "-", "reason": "强度分、决策分与代表股入选规则不迁入；题材事实（涨停/炸板/梯队/封板时间）已由 CNT-022 覆盖"},
    {"id": "CNT-024", "source": "题材/股票池", "item": "active_suggest_action", "selection": EXCLUDE, "v1": EXCLUDED, "page": "-", "reason": "动作及等价专用分一并排除"},
    {"id": "CNT-025", "source": "股票池", "item": "炸板率、涨跌比、连板/断板历史结构", "selection": KEEP, "v1": DELIVERED, "page": "题材与涨跌结构", "reason": "取自股票池 ADS 的计数，带分子分母与历史序列；不交付风险指令与池内个股"},
    {"id": "CNT-026", "source": "股票池", "item": "风险指令 riskBadge", "selection": EXCLUDE, "v1": EXCLUDED, "page": "-", "reason": "指令形态不迁入"},
    {"id": "CNT-027", "source": "股票池", "item": "高标抱团、动量极端等池（计数部分）", "selection": KEEP, "v1": DELIVERED, "page": "题材与涨跌结构", "reason": "只交付各池当日个股数与窗口/数据状态说明；池内名单、排序与入选规则不迁入，风险指令另由 CNT-026 排除"},
    {"id": "CNT-028", "source": "每日复盘", "item": "明日操作指引 watch/neutral/avoid", "selection": EXCLUDE, "v1": EXCLUDED, "page": "-", "reason": "涨跌+资金筛选并截断前三的指引不迁入"},
    {"id": "CNT-029", "source": "每日复盘", "item": "行业资金排行与主力净流入", "selection": KEEP, "v1": DELIVERED, "page": "历史复盘", "reason": "全量排行、标明期间与单位，不截断"},
    {"id": "CNT-030", "source": "每日复盘", "item": "行业结构摘要统计", "selection": KEEP, "v1": DELIVERED, "page": "历史复盘", "reason": "带分子分母；领先改善比例依赖象限判定，首版不提供"},
    {"id": "CNT-031", "source": "每日复盘", "item": "Open5 覆盖/正向/延续/过度反应占比", "selection": KEEP, "v1": DELIVERED, "page": "历史复盘", "reason": "取自每日复盘 ADS 的市场汇总，带分母与数据状态"},
    {"id": "CNT-032", "source": "每日复盘", "item": "近5日行业趋势", "selection": KEEP, "v1": DELIVERED, "page": "行业比较与轮动", "reason": "完整同口径日期序列，不足即标 partial"},
    {"id": "CNT-033", "source": "每日复盘", "item": "市场评分、风险等级及自由文本摘要", "selection": EXCLUDE, "v1": EXCLUDED, "page": "-", "reason": "评分、风险等级与自由文本属择时判断不迁入；事实性概述（涨跌家数、成交额）已由市场总览覆盖"},
    {"id": "CNT-034", "source": "前瞻风险", "item": "事件日期、类型、地区、期间、单位、公布状态、公布值/前值", "selection": KEEP, "v1": DELIVERED, "page": "事件日历", "reason": "确定性日历事实"},
    {"id": "CNT-035", "source": "前瞻风险", "item": "宏观预测值、来源重要性", "selection": KEEP, "v1": DELIVERED, "page": "事件日历", "reason": "标明为第三方发布预期，非平台预测"},
    {"id": "CNT-036", "source": "前瞻风险", "item": "未来风险曲线、Price In、尾部风险与置信度", "selection": EXCLUDE, "v1": EXCLUDED, "page": "-", "reason": "全部为模型输出与解读，无独立事实部分，不迁入"},
    {"id": "CNT-037", "source": "前瞻风险", "item": "事件影响及 A 股传导路径", "selection": EXCLUDE, "v1": EXCLUDED, "page": "-", "reason": "影响判断、传导路径与方向建议不迁入；事件事实（日期/公布值等）已由 CNT-034 覆盖"},
]

_BY_ID = {c["id"]: c for c in CONTENT_SCOPE}

FORBIDDEN_KEY_RE = re.compile(
    r"action|suggest|guidance|budget|next_state|signal_priority|opportunity|review_group|"
    r"lifecycle_phase|decision|recommend|target_price|risk_badge|pricing_degree|price_in|"
    r"risk_score|transmission|scenario|impact|focus|avoid",
    re.IGNORECASE,
)


class ContentGuardViolation(RuntimeError):
    pass


def validate_registry() -> None:
    ids = [c["id"] for c in CONTENT_SCOPE]
    expected = [f"CNT-{i:03d}" for i in range(1, 38)]
    if ids != expected:
        raise RuntimeError("内容注册表必须恰好覆盖 CNT-001～CNT-037")
    for c in CONTENT_SCOPE:
        if c["v1"] == DELIVERED and c["selection"] != KEEP:
            raise RuntimeError(f"{c['id']} 非保留设计却标记为已交付")
        if c["selection"] == KEEP and c["v1"] not in {DELIVERED, NOT_CONNECTED}:
            raise RuntimeError(f"{c['id']} 保留设计必须是 delivered 或 not_connected")


def assert_delivered(content_ids: List[str]) -> None:
    for cid in content_ids:
        if _BY_ID.get(cid, {}).get("v1") != DELIVERED:
            raise ContentGuardViolation(f"{cid} 未登记为首版交付内容")


def gap(content_id: str, reason: str | None = None) -> Dict[str, str]:
    entry = _BY_ID[content_id]
    return {"content_id": content_id, "item": entry["item"], "reason": reason or entry["reason"]}


def scan_forbidden_keys(value: Any, path: str = "$") -> None:
    """响应发出前的最后一道防线：任何命中禁止模式的键名都让整个响应失败。"""
    if isinstance(value, dict):
        for k, v in value.items():
            if FORBIDDEN_KEY_RE.search(str(k)):
                raise ContentGuardViolation(f"禁止键 {path}.{k}")
            scan_forbidden_keys(v, f"{path}.{k}")
    elif isinstance(value, list):
        for i, v in enumerate(value):
            scan_forbidden_keys(v, f"{path}[{i}]")
