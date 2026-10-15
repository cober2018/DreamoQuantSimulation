## Context

新平台后端为 FastAPI，当前仅 `INSIGHT_ACCESS_TOKEN` 一个可选共享令牌。前端为 Vite + Vue 3。上游 Key 已在服务端。本变更为首个需要持久化用户数据的部分。

## Decisions

### D1 权限模型：角色 → 权限点集合
权限点命名：
- 页面：`page.overview`、`page.participation`、`page.industries`、`page.themes`、`page.history`、`page.calendar`
- 数据：`data.history_days`（数值）、`data.detail`（个股明细）
- 客户端：`client.web`、`client.mp`
- 管理：`admin.console`

默认种子（管理员后台可改，改后下一次请求生效）：

| 权限点 | 免费 | VIP | SVIP | 管理员 |
|---|---|---|---|---|
| page.overview / page.calendar | ✓ | ✓ | ✓ | ✓ |
| page.participation / industries / themes | — | ✓ | ✓ | ✓ |
| page.history | — | — | ✓ | ✓ |
| data.history_days | 5 | 30 | 250 | 250 |
| data.detail | — | — | ✓ | ✓ |
| admin.console | — | — | — | ✓ |

内置四角色不可删除，管理员可新建自定义角色（复制已有角色后修改）。数值点 `data.history_days`、`max_sessions` 取值范围在后台校验。

理由：权限点粒度只到"页面/历史深度/明细"，足以覆盖需求且便于管理员理解；不引入按字段的自定义以免后台复杂化。字段级裁剪由内容注册表为每个模块标注所需权限点实现。

### D2 服务端裁剪
每个模块声明 `requires`（权限点）与历史天数上限使用点。请求时：无页面权限 → 403；`days` 参数 clamp 到 `data.history_days`；无 `data.detail` → 明细部分整体省略并标注"需更高权限"。前端据权限响应隐藏入口，但不依赖它。

### D3 邀请码
表：`invite_codes(code_hash, role, duration_days, max_uses, used_count, expires_at, created_by, status)`。明文只在创建时展示一次，库内存 SHA-256；格式 12 位去歧义字符集，带校验位。兑换事务内原子递增 `used_count`。会员期限：兑换时若已是同等或更高会员，则延长到期时间；若是更低，则升级并按新到期时间。`memberships(user_id, role, expires_at)`，读取时过期即视为免费，另有定时清理。

### D4 认证与会话
- 密码：argon2id（库内参数可配），不存明文。
- 访问令牌：JWT，15 分钟，含 `sub`、`role_version`、`client`；`role_version` 在权限或角色变更时递增，使旧令牌下次校验即失效。
- 刷新令牌：不透明随机串，库内存哈希，14 天，每次使用轮换；复用已用刷新令牌视为被盗，吊销该用户全部会话。
- 登录保护：同一账号+IP 15 分钟内失败 5 次锁定 15 分钟；统一错误文案防账号枚举。
- 初始管理员：首次启动由环境变量 `INSIGHT_BOOTSTRAP_ADMIN_*` 创建，要求首次登录改密。

### D4b 令牌存放与跨站防护
访问令牌只放内存；刷新令牌放 `HttpOnly; Secure; SameSite=Strict` Cookie，路径限定为刷新接口，前端脚本读不到；刷新接口校验 `Origin`。生产强制 HTTPS 与 HSTS。JWT 签名密钥来自环境变量，支持新旧两个密钥并存以便轮换。理由：令牌放 localStorage 一旦出现 XSS 即被整体窃取。

### D4c 会话数与邀请码防爆破
`max_sessions` 作为数值权限点（默认免费 2、VIP 2、SVIP 3、管理员 5）；签发新刷新令牌时超出即吊销最早会话。兑换接口每用户每小时 10 次、每 IP 每小时 30 次，连续 5 次失败冻结该用户兑换 30 分钟；邀请码 12 位 + 校验位，空间足以使在线爆破不可行。

### D5 防逆向与防爬（诚实边界）
网页前端代码本身无法保密，因此安全边界在服务端；前端措施只用于抬高成本：
1. 服务端：权限裁剪、按用户/IP/路径限流（令牌桶）、异常检测（短时高频、顺序遍历日期/代码、多 IP 共用令牌）→ 自动临时封禁与告警；
2. 请求签名：登录时下发会话级签名密钥；每个 API 请求带 `X-Ts`、`X-Nonce`、`X-Sign = HMAC(key, method|path|query|ts|nonce)`；服务端校验时间窗（±60 秒）与 nonce 唯一，防重放与随手脚本；承认密钥在前端可被提取，其作用是抬高成本与支撑审计，不作为唯一防线；
3. 前端：生产构建混淆、关闭 sourcemap、去除调试信息与 `console`；
4. 水印：页面叠加用户标识水印；接口响应带会话标记字段（只在元数据中，不改动任何数值）以便泄露溯源；
5. 不提供批量导出接口；不在包内存放上游 Key。

### D6 存储
仓储接口 + SQLite 实现（单节点足够）；表：users、roles、role_permissions、memberships、invite_codes、redemptions、sessions(refresh)、audit_log、login_attempts、blocked。迁移脚本版本化；备份由部署负责（文档说明）。

### D7 管理后台
仅 `admin.console` 可访问，独立路由前缀与二次确认的破坏性操作；所有写操作写审计。

## Risks / Trade-offs

- [签名密钥可被提取] 不可避免 → 如 D5 所述，承认并以服务端限流/异常检测为主。
- [SQLite 单节点] 多实例部署需换库 → 仓储接口已隔离；本阶段单节点。
- [无邮件/短信验证] 注册可被滥用 → 注册限流 + 可开启"仅邀请码注册"开关。
- [权限变更即时生效带来令牌校验开销] 每次校验读 role_version → 内存缓存 + 变更时失效。

## Migration Plan

1. 本地 SQLite 初始化与种子角色/权限点；创建测试用户（四角色各一）。
2. 模块接入权限裁剪，逐页验证。
3. 前端登录/兑换/管理页与签名；生产构建混淆验证。
4. 回滚：去除鉴权依赖即退回公开模式（仅开发环境允许，生产必须启用）。

## Open Questions

- 默认权限种子矩阵（D1）是否按此确认。
- 是否开启"仅邀请码注册"作为默认。
