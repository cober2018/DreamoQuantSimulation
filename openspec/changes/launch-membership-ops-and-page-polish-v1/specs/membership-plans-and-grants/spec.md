## ADDED Requirements

### Requirement: Admin-managed plans
管理员 SHALL 能增删改套餐，字段包括名称、对应角色、天数、标价、是否上架和排序。新建套餐 MUST 默认不上架。套餐对应的角色 MUST 存在，并且不能是管理员角色。

#### Scenario: Create plan defaults to unlisted
- **WHEN** 管理员新建"VIP 月卡"套餐：角色 vip，30 天，标价 99 元
- **THEN** 套餐保存成功，状态是"未上架"，用户端看不到

#### Scenario: Reject admin role plan
- **WHEN** 管理员新建一个对应 admin 角色的套餐
- **THEN** 请求被拒绝，返回 422

### Requirement: Public plan listing without payment entry
已登录用户 SHALL 能查看已上架的套餐：名称、等级、天数、标价，以及管理员配置的开通方式说明。页面 MUST NOT 出现付款按钮、收款码或任何支付接口调用。

#### Scenario: Free user sees listed plans
- **WHEN** 免费用户打开"会员套餐"页
- **THEN** 页面按排序显示所有已上架套餐，并显示"联系客服开通"的说明，不显示任何付款控件

### Requirement: Unified membership grant
后台开通、邀请码兑换，以及将来的在线支付回调，SHALL 都通过同一个开通函数改变会员状态，并写一条开通记录：用户、角色、天数、开通前到期时间、开通后到期时间、来源、套餐、实收金额、收款渠道、备注、操作人、时间。开通记录 MUST 只能追加，不能修改或删除。

#### Scenario: Renew same role extends from current expiry
- **WHEN** 某 VIP 用户还剩 10 天到期，管理员给他开通"VIP 月卡"（30 天）
- **THEN** 新到期时间等于原到期时间加 30 天，并写一条来源为 admin 的开通记录，里面有实收金额

#### Scenario: Upgrade starts from now
- **WHEN** 某 VIP 用户还剩 10 天到期，管理员给他开通"SVIP 月卡"（30 天）
- **THEN** 会员角色变成 svip，到期时间等于现在加 30 天

#### Scenario: Downgrade is rejected
- **WHEN** 某 SVIP 用户还没到期，管理员给他开通 VIP 套餐
- **THEN** 请求被拒绝，返回 409，提示先清除会员再开通，用户的会员状态不变

#### Scenario: Invite redemption writes grant record
- **WHEN** 用户成功兑换一个 VIP 30 天邀请码
- **THEN** 写一条来源为 invite、金额为 0 的开通记录，到期时间的算法和后台开通一样

### Requirement: Correction instead of edit
记错的开通记录 SHALL 通过追加一条冲正记录来更正（渠道是 correction，金额可以是负数）。原记录 MUST 保持不变。

#### Scenario: Correct wrong amount
- **WHEN** 管理员发现某条记录把 99 元误记成了 999 元，于是追加一条 -900 元的冲正记录
- **THEN** 这段时间的实收合计减少 900 元，原记录还在

### Requirement: Grant records and revenue summary
管理后台 SHALL 提供"开通记录"列表，可以按起止日期、来源、用户名筛选，并显示筛选范围内的实收合计（单位：元，保留两位小数）。

#### Scenario: Revenue in range
- **WHEN** 管理员筛选 2026-11-01 到 2026-11-30
- **THEN** 列表只显示这段时间的记录，合计等于这些记录的金额相加（包括冲正记录）

### Requirement: Expiry reminder
会员到期前 7 天及以内，Web 和小程序 SHALL 在页面顶部和"我的"页显示剩余天数和续期方式。管理后台用户列表 SHALL 能筛选"7 天内到期"的用户。

#### Scenario: Reminder shown
- **WHEN** 一位 VIP 用户还剩 5 天到期，登录 Web
- **THEN** 页面顶部显示"VIP 将于 5 天后到期，续期请查看会员套餐"

#### Scenario: Not shown when far from expiry
- **WHEN** 一位会员还剩 20 天到期
- **THEN** 不显示到期提醒
