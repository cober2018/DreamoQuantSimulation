## ADDED Requirements

### Requirement: Launch checklist
仓库 SHALL 提供 `docs/launch-checklist.md`，逐项列出上线必须完成的事项，每项写明怎么检查。至少包括：主体与资质确认、HTTPS 证书和备案域名、生产环境变量（`INSIGHT_ENV=production`、JWT 密钥长度、数据中台 Key 只放在服务端）、管理员初始化和首次登录改密码、SQLite 定期备份、构建产物扫描通过、协议文本由法务确认、套餐上架。

#### Scenario: Checklist complete
- **WHEN** 运维照着清单逐项执行
- **THEN** 每一项都有明确的检查命令或检查方法，结果是"通过"或"不通过"

### Requirement: Terms reflect offline activation
用户协议 SHALL 说明会员通过线下付款后由管理员开通，或者通过邀请码获得，并写明到期规则。退款条款 MUST 标为"待主体确认"，系统不预设退款规则。

#### Scenario: Terms page
- **WHEN** 用户打开用户协议
- **THEN** 能看到会员开通方式、到期规则，以及标为"待主体确认"的退款条款
