## 1. 后端：套餐与开通

- [x] 1.1 在 store 中新增 `plans`、`membership_grants` 两张表（用 CREATE IF NOT EXISTS）；开通方式说明存在 `meta` 表的 `plan_contact_text` 键里
- [x] 1.2 在 service 中新增套餐的增删改查和上架列表，校验对应角色存在且不是管理员角色，新建时默认不上架
- [x] 1.3 在 service 中新增 `grant_membership`：处理同级顺延、升级从现在算、降级拒绝（409），并在同一个事务里写开通记录和审计日志
- [x] 1.4 让 `redeem` 改为调用 `grant_membership(source=invite, amount=0)`，原 `redemptions` 表照常写入
- [x] 1.5 新增冲正记录、开通记录查询（按日期、来源、用户名筛选，附带金额合计），`list_users` 支持 `expiring_within_days` 参数
- [x] 1.6 新增路由：`GET /api/v1/plans`（需登录），`/api/v1/admin/plans` 增删改，`POST /api/v1/admin/users/{id}/grant`，`/api/v1/admin/grants`（查询和冲正），管理员读写开通方式说明
- [x] 1.7 `/auth/me` 增加 `perm_min_role`，即每个页面权限点对应的最低可开通等级（按角色计算，与套餐是否上架无关）

## 2. 后端：缺数据日期

- [x] 2.1 在 `modules.py` 各模块返回 empty 时，去掉 `trade_date` 再请求一次上游，填入 `latest_available_date`（复用已有缓存）
- [x] 2.2 在 envelope 中加上 `latest_available_date` 字段；确认它不会触发禁用键名检查

## 3. 后端验证

- [x] 3.1 扩展 `scripts/sandbox/2026-10-15_verify_insight_access.py`：覆盖套餐、开通（顺延、升级、降级拒绝）、冲正、合计、兑换写开通记录、即将到期筛选
- [x] 3.2 扩展 `2026-10-14_verify_insight_api.py`：用夹具中缺失的日期验证 empty 时会带 `latest_available_date`
- [ ] 3.3 用实际上游请求 2026-10-21 和 2026-10-20 各页，把实际结果记进 `findings.md`（受阻：本机无可用上游与 Key，见 findings.md）

## 4. Web：会员与预告

- [x] 4.1 新增"会员套餐"页（显示上架套餐和开通方式说明，没有付款控件）
- [x] 4.2 侧边栏显示全部数据页，无权限的带锁和等级标识；在路由守卫里，无权限时跳到锁定预告页（用静态对照表，不请求数据接口）
- [x] 4.3 在页面内需要 `data.detail` 的部分显示锁定卡片（行业序列、封板时间分布）
- [x] 4.4 全局顶部加到期提醒；Account 页显示剩余天数和套餐入口，并改写原来"本站不提供付款入口"的文案
- [x] 4.5 管理后台：新增"套餐"页签，用户行增加"按套餐开通"弹窗（金额、渠道、备注），新增"开通记录"页签（筛选、合计、冲正），用户列表增加"7 天内到期"筛选

## 5. Web：页面优化与缺数据

- [x] 5.1 `PageFrame`：empty 时显示"该日数据暂缺"和"查看 {日期}"按钮（通过事件回传给页面切换日期）；partial 时在顶部用一句话列出缺的内容；数据来源和口径说明改为默认折叠；服务名显示中文
- [x] 5.2 新增通用的分区标题组件，显示该部分的数据日期，日期和页面不同时加"非当日"标识
- [x] 5.3 逐页检查并修正 Overview、Participation、Industries、Themes、History、Calendar、About，每一项写进 `findings.md`
- [x] 5.4 调整 375px 宽度的布局（侧边栏改成顶部菜单，表格放进横向滚动容器）
- [x] 5.5 用浏览器截图验证免费、VIP、SVIP、管理员四种身份，以及缺数据日期的显示

## 6. 小程序

- [x] 6.1 在"我的"页加入套餐列表、开通方式说明、到期提醒
- [x] 6.2 总览、情绪、行业、题材四页统一缺数据、部分缺失、错误三种状态的显示，加上"查看最近有数据日"按钮，无权限时显示锁定预告
- [x] 6.3 运行 `npm run build:mp-weixin` 和 H5 预览，截图验证

## 7. 上线准备与收尾

- [x] 7.1 编写 `docs/launch-checklist.md`
- [x] 7.2 更新 `Terms.vue`（开通方式、到期规则、退款条款标为待确认）
- [x] 7.3 运行 `npm run build:prod`，确认产物扫描通过
- [x] 7.4 更新 README、`task_plan.md`、`progress.md`、`findings.md`
