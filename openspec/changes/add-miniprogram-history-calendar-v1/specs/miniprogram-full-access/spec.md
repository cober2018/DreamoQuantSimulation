## ADDED Requirements

### Requirement: Same permissions on every entry
小程序 SHALL 与网页使用同一份角色权限；后端 MUST NOT 按入口（`client`）限制可访问的数据页面或明细。入口只用于审计、路由记录和角色"可用入口"的登录判断。

#### Scenario: Mini program reaches history and calendar
- **WHEN** 一个有 `page.history` 和 `page.calendar` 权限的用户从小程序请求 `/api/v1/history` 和 `/api/v1/calendar`
- **THEN** 两个接口返回 200，数据与同一用户从网页请求时一致

#### Scenario: Detail follows role, not entry
- **WHEN** 一个有下钻明细权限的用户从小程序请求板块序列和题材页
- **THEN** 板块序列返回 200，题材页包含封板时间分布

#### Scenario: Missing permission is the same on both entries
- **WHEN** 一个免费用户分别从网页和小程序请求历史复盘
- **THEN** 两边都返回 403 与相同的所需等级提示

### Requirement: Mini program history and calendar pages
小程序 SHALL 提供历史复盘与事件日历两页，内容、口径和合规过滤与网页一致：历史复盘包含板块结构统计、Open5 和全量资金排行；事件日历只含宏观事件，预期值标注为第三方发布的市场预期。

#### Scenario: Full ranking is not truncated
- **WHEN** 在小程序历史复盘页滚动到底
- **THEN** 继续加载，直到显示与网页相同数量的板块

#### Scenario: Missing-data day
- **WHEN** 选择上游缺数据的交易日（如 2026-10-21）
- **THEN** 页面显示"该日数据暂缺"和"查看最近有数据的交易日"，不显示任何假数值

### Requirement: Navigation without exceeding tab limit
小程序 tabBar SHALL 保持 5 项；新增页面 MUST 能从总览页的入口卡片和"我的"页的页面列表进入，无权限时入口显示锁和所需等级。

#### Scenario: Entry cards
- **WHEN** 打开小程序总览页
- **THEN** 底部可见历史复盘与事件日历两张入口卡片，点击进入对应页面
