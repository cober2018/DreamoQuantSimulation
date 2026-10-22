## ADDED Requirements

### Requirement: Latest available date on empty
所选日期上游没有数据时，数据接口 SHALL 返回 `status=empty`，并带上 `latest_available_date`（上游最新一行的日期；取不到时为 null）。接口 MUST NOT 用其他日期的数据冒充所选日期。

#### Scenario: Selected date missing
- **WHEN** 用户选择 2026-10-21，情绪服务在这一天没有数据，最新一行是 2026-10-20
- **THEN** 参与度接口返回 `status=empty`、`latest_available_date=2026-10-20`，`data` 为空

### Requirement: Gap message and jump
页面收到 `empty` 后 SHALL 显示"该日数据暂缺（上游数据维护中）"。有 `latest_available_date` 时 SHALL 提供"查看 {日期}"按钮，点击后把日期切换过去并重新加载。

#### Scenario: Jump to latest
- **WHEN** 用户在空数据页点击"查看 2026-10-20"
- **THEN** 日期选择框变成 2026-10-20，页面显示这一天的数据

### Requirement: Per-section data date
同一页面里各部分的数据日期不一样时，各部分标题 SHALL 标出自己的实际数据日期；和页面数据日期不同的部分 MUST 加醒目标识。

#### Scenario: Mixed dates
- **WHEN** 总览页的行业数据日期是 2026-10-21，而参与度某部分的数据日期是 2026-10-20
- **THEN** 那一部分的标题显示"数据日 2026-10-20"，并带"非当日"标识

### Requirement: Partial status remains explicit
部分缺失时（`status=partial`），页面 SHALL 正常显示已有数据，并在顶部用一句白话说明缺了哪些内容，原有的明细清单保留在页尾。

#### Scenario: Partial page
- **WHEN** 题材页的股票池计数缺失，其他部分正常
- **THEN** 顶部提示"部分内容暂缺：股票池当日计数"，其他部分正常显示
