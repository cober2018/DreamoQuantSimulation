## ADDED Requirements

### Requirement: Signed requests with replay protection
数据接口 SHALL 要求带时间戳、随机数与签名；时间戳超出 ±60 秒、签名不匹配或随机数重复的请求 MUST 被拒绝。

#### Scenario: Replay rejected
- **WHEN** 同一已签名请求在窗口内被重复发送
- **THEN** 第二次请求被拒绝

#### Scenario: Missing signature
- **WHEN** 请求不带签名头访问数据接口
- **THEN** 返回 401

### Requirement: Rate limiting and anomaly blocking
系统 SHALL 按用户、IP 与路径限流，超限返回 429；检测到短时高频、顺序遍历日期或代码、多 IP 共用同一令牌等异常时 MUST 临时封禁并记录告警。

#### Scenario: Burst blocked
- **WHEN** 单用户在短时间内请求数超过阈值
- **THEN** 后续请求返回 429，持续异常触发临时封禁并写入审计

### Requirement: Frontend hardening and no secrets
生产前端构建 SHALL 混淆代码、关闭 sourcemap 并去除调试输出；构建产物与仓库 MUST NOT 含上游 Key 或会话签名密钥常量。

#### Scenario: Build scan
- **WHEN** 对生产构建产物执行扫描
- **THEN** 不存在 sourcemap 文件，不含 Key 与密钥常量

### Requirement: Traceable watermark
页面 SHALL 叠加用户标识水印，接口响应 SHALL 携带可溯源的会话标记；系统 MUST NOT 提供批量导出接口。

#### Scenario: Watermark present
- **WHEN** 登录用户打开任一数据页面
- **THEN** 页面显示含用户标识的水印
