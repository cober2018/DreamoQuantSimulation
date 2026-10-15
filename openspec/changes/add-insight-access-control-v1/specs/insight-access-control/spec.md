## ADDED Requirements

### Requirement: Roles are permission sets
系统 SHALL 提供免费、VIP、SVIP、管理员四种角色，每个角色是权限点集合；权限点 MUST 覆盖页面、数据（历史天数、个股明细）、客户端与管理能力。

#### Scenario: Default seed exists
- **WHEN** 系统首次初始化
- **THEN** 四个角色及其默认权限点存在，免费用户无 `page.history` 与 `data.detail`

### Requirement: Administrator can customize
管理员 SHALL 能在后台增删改角色的权限点与数值型限额；变更 MUST 在受影响用户的下一次请求生效，无需重新登录。

#### Scenario: Permission change takes effect
- **WHEN** 管理员为 VIP 角色移除 `page.themes`
- **THEN** VIP 用户下一次请求题材接口返回 403，已签发的访问令牌因 `role_version` 变化而重新校验

### Requirement: Custom roles
管理员 SHALL 能新建自定义角色并分配权限点；四个内置角色 MUST NOT 可被删除。

#### Scenario: Built-in role protected
- **WHEN** 管理员尝试删除 VIP 角色
- **THEN** 操作被拒绝

### Requirement: Server-side trimming is authoritative
所有数据接口 SHALL 在服务端按调用者权限裁剪：无页面权限返回 403；`days` 超出上限时按上限处理；无 `data.detail` 时省略明细并标注需更高权限。前端隐藏 MUST NOT 作为权限边界。

#### Scenario: History depth clamped
- **WHEN** 免费用户请求 `days=60`，其 `data.history_days=5`
- **THEN** 响应只含最近 5 个交易日并标注已受权限限制

#### Scenario: Detail omitted
- **WHEN** 无 `data.detail` 的用户请求题材模块
- **THEN** 响应含统计部分，明细部分缺省并带"需更高权限"标记

### Requirement: Admin console is restricted
管理后台与管理接口 SHALL 仅 `admin.console` 持有者可访问，所有写操作 MUST 写入审计。

#### Scenario: Non-admin denied
- **WHEN** 非管理员请求管理接口
- **THEN** 返回 403，且不泄露资源是否存在
