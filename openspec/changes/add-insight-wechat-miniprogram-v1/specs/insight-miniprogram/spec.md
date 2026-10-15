## ADDED Requirements

### Requirement: Partial data scope
小程序 SHALL 只展示注册表中标记为小程序可见的部分内容；个股明细、历史复盘全量与事件日历全量 MUST NOT 在小程序中提供。

#### Scenario: Detail not exposed
- **WHEN** 任意角色通过小程序令牌请求题材模块
- **THEN** 响应只含统计摘要，不含个股明细

### Requirement: Client-aware trimming
服务端 SHALL 对小程序令牌取"角色权限与小程序白名单的交集"裁剪数据；网页令牌与小程序令牌 MUST 互不越权。

#### Scenario: Intersection applied
- **WHEN** SVIP 用户使用小程序令牌请求行业摘要
- **THEN** 返回内容不超出小程序白名单，即使其角色在网页端可见更多

### Requirement: WeChat login integration point
后端 SHALL 提供微信登录接入点，用 code 换取 openid 并绑定账号，`session_key` MUST NOT 下发到客户端；未配置 AppID/AppSecret 时生产环境 MUST 返回 503。

#### Scenario: No credentials in production
- **WHEN** 生产环境未配置 AppID 与 AppSecret，客户端调用微信登录
- **THEN** 返回 503 且不签发任何令牌

### Requirement: Account binding
小程序账号 SHALL 能绑定网页账号，绑定后共用角色与会员期限；一个网页账号 MUST 只能绑定一个微信身份。

#### Scenario: Bind merges membership
- **WHEN** 微信免费账号绑定一个 SVIP 网页账号
- **THEN** 小程序端按 SVIP 权限与小程序白名单的交集展示

### Requirement: Mock login is development-only
模拟登录 SHALL 仅在开发环境并显式开启时可用，响应 MUST 标注 `mock=true`；生产环境 MUST 拒绝。

#### Scenario: Mock rejected in production
- **WHEN** 生产环境收到模拟登录请求
- **THEN** 请求被拒绝

### Requirement: Build contains no secrets
小程序编译产物 SHALL NOT 含上游数据中台 Key、微信 AppSecret 或会话签名密钥常量。

#### Scenario: Artifact scan
- **WHEN** 扫描 mp-weixin 编译产物
- **THEN** 不存在上述密钥常量
