## ADDED Requirements

### Requirement: Credential storage and login protection
密码 SHALL 以 argon2id 哈希存储；同一账号与来源 IP 在 15 分钟内连续失败 5 次后 MUST 锁定 15 分钟；登录失败文案 MUST 不区分账号不存在与密码错误。

#### Scenario: Lockout
- **WHEN** 同一账号在 15 分钟内连续 5 次密码错误
- **THEN** 之后的登录尝试被拒，直到锁定期结束

### Requirement: Short-lived access and rotating refresh tokens
访问令牌 SHALL 为 15 分钟有效；刷新令牌 SHALL 每次使用即轮换，复用已使用的刷新令牌 MUST 吊销该用户全部会话。

#### Scenario: Refresh token reuse
- **WHEN** 已被轮换的旧刷新令牌再次被使用
- **THEN** 请求被拒，该用户全部刷新令牌被吊销

#### Scenario: Logout and password change
- **WHEN** 用户登出或修改密码
- **THEN** 其既有刷新令牌失效，旧访问令牌因会话版本变化而被拒

### Requirement: Token storage and session limit
刷新令牌 SHALL 存放于 HttpOnly、Secure、SameSite=Strict 的 Cookie，前端脚本 MUST 无法读取；单账号同时在线会话数 SHALL 受角色配置限制，超出时吊销最早会话。

#### Scenario: Session limit enforced
- **WHEN** 会话上限为 2 的账号在第三台设备登录
- **THEN** 最早的会话被吊销，其后续刷新请求被拒

### Requirement: Admin password reset and consent
管理员 SHALL 能重置用户密码并强制其下次登录改密；注册 MUST 要求用户同意用户协议与隐私政策。

#### Scenario: Registration without consent
- **WHEN** 注册请求未勾选同意
- **THEN** 注册被拒绝

### Requirement: Bootstrap administrator
首次启动 SHALL 通过环境变量创建初始管理员且要求首次登录改密；生产环境未配置时 MUST 不创建默认弱口令账号。

#### Scenario: No default credentials
- **WHEN** 生产环境启动且未配置引导管理员
- **THEN** 系统不创建任何默认管理员账号

### Requirement: Security audit trail
登录、登出、兑换、角色与权限变更、封禁与管理操作 SHALL 写入审计，包含操作者、对象、时间与来源 IP，且不含密码与令牌明文。

#### Scenario: Audit has no secrets
- **WHEN** 检查任意审计记录
- **THEN** 不含密码、令牌、邀请码明文
