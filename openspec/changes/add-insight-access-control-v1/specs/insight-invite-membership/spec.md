## ADDED Requirements

### Requirement: Membership only via invite codes
VIP 与 SVIP SHALL 只能通过邀请码获得，系统 MUST NOT 提供支付入口或支付对接。

#### Scenario: Redeem upgrades role
- **WHEN** 免费用户兑换一个有效的 VIP 邀请码（30 天）
- **THEN** 其角色变为 VIP，到期时间为当前时间加 30 天，邀请码已用次数加 1

### Requirement: Invite code constraints
邀请码 SHALL 指定目标角色、有效天数、可用次数与过期时间；已过期、已作废、超次数的邀请码 MUST 被拒绝，明文 MUST 只在创建时展示一次且库内只存哈希。

#### Scenario: Used up or expired
- **WHEN** 用户兑换已达可用次数或已过期的邀请码
- **THEN** 兑换失败且不改变用户角色与邀请码计数

#### Scenario: Concurrent redemption
- **WHEN** 两个用户同时兑换仅剩 1 次的邀请码
- **THEN** 恰好一个成功，另一个被拒

### Requirement: Redemption brute-force protection
兑换接口 SHALL 按用户与 IP 限次；同一用户连续失败达到阈值 MUST 临时冻结其兑换。

#### Scenario: Repeated failures freeze
- **WHEN** 同一用户连续 5 次兑换无效邀请码
- **THEN** 该用户兑换被冻结 30 分钟，期间即使输入有效码也被拒

### Requirement: Expiry downgrades automatically
会员到期后 SHALL 自动视为免费用户；在到期前再次兑换更高或同级邀请码 MUST 延长或升级会员期限。

#### Scenario: Membership expires
- **WHEN** VIP 会员到期时间已过
- **THEN** 用户下一次请求按免费权限处理
