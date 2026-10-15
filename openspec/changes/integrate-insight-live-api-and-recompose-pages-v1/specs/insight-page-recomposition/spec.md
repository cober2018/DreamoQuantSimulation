## ADDED Requirements

### Requirement: Theme parity matrix
系统 SHALL 提供主题对照表，逐项列出现有复盘平台各看板与模块在新平台的落点；每个"保留"主题 MUST 在新平台有对应页面或模块，每个"隐藏"项 MUST 引用不合规依据。

#### Scenario: Every kept theme has a landing page
- **WHEN** 检查主题对照表中状态为"保留"的每一项
- **THEN** 新平台存在对应页面或模块，且接口可返回该模块数据

#### Scenario: Hidden item cites its basis
- **WHEN** 检查状态为"隐藏"的每一项
- **THEN** 对照表引用内容注册表条目或合规文档章节作为依据

### Requirement: Pending items reviewed, not silently dropped
内容注册表中的待定项 SHALL 逐条拆分为事实统计与结论；事实统计在用户确认后迁入对应主题页，结论 MUST 保持排除。未经确认前保持待定，不得以待定为由使整个主题在新平台缺失而不说明。

#### Scenario: Theme kept by its facts
- **WHEN** 某主题的全部条目均为待定
- **THEN** 主题对照表给出该主题的事实迁入建议或明确的隐藏依据

### Requirement: Analysis-chain page order
页面 SHALL 按"市场状态 → 情绪与资金 → 结构（行业/题材）→ 回看 → 前瞻"的顺序组织导航，主题名称保持与现有平台一致。

#### Scenario: Navigation order
- **WHEN** 打开新平台首页
- **THEN** 导航顺序为市场总览、参与度与资金环境、行业比较与轮动、题材与涨跌结构、历史复盘、事件日历

### Requirement: Data identity on every page
每个页面 SHALL 在顶部展示各模块的数据日期、来源服务与覆盖情况；不同模块日期不同时 MUST 分别标注，不得合并为同一日期。

#### Scenario: Module dates differ
- **WHEN** 同一页面两个模块的最新数据日不同
- **THEN** 页面分别显示各自的数据日期
