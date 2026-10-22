## ADDED Requirements

### Requirement: Locked pages visible in navigation
Web 侧边栏和小程序的入口 SHALL 对所有登录用户显示全部数据页。用户没有权限的页面 MUST 带锁标识，并显示所需的最低等级。

#### Scenario: Free user navigation
- **WHEN** 免费用户登录 Web
- **THEN** 侧边栏能看到"参与度与资金环境"等会员页面，每项带锁和"VIP"标识

### Requirement: Preview without data
用户点开没有权限的页面时，SHALL 显示预告：页面能回答什么问题、包含哪些指标（只有名称，没有数值）、所需等级，以及"查看会员套餐"的入口。预告 MUST NOT 请求该页的数据接口。

#### Scenario: Open locked page
- **WHEN** 免费用户点开"行业比较与轮动"
- **THEN** 页面显示指标名称清单和"需要 VIP"，没有发出 `/api/v1/industries` 请求

### Requirement: Detail-level lock inside page
页面里需要 `data.detail` 权限的部分（比如行业序列、封板时间分布），在没有权限时 SHALL 显示一张锁定卡片，并注明所需等级，不显示报错。

#### Scenario: VIP sees detail lock
- **WHEN** VIP 用户在行业页点开某一行
- **THEN** 序列区域显示"近期序列需要 SVIP"，不显示"权限不足"的报错条
