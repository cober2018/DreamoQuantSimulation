# 进度

## 2026-10-22

- 后端：`access/store.py` 新增 `plans`、`membership_grants` 两张表；`access/service.py` 新增 `_grant_in_tx`、`grant_membership`、`correct_grant`、`list_grants`、套餐增删改查、开通方式说明、`perm_min_role`，`list_users(expiring_within_days)`；`redeem` 改为走 `_grant_in_tx`（来源 invite、金额 0，低等级码只延长不降级，与第四期行为一致）。`access/routes.py` 新增 `/plans`、`/admin/plans*`、`/admin/plan-contact`、`/admin/users/{id}/grant`、`/admin/grants*`。`projection.envelope` 和 `modules.py` 在 empty 时返回 `latest_available_date`。
- Web：新增 `pageCatalog.js`、`pages/Plans.vue`、`pages/Locked.vue`、`components/DateTag.vue`；改动 `App.vue`、`main.js`、`PageFrame.vue`、`api.js`、`styles.css`，以及 Overview / Participation / Industries / Themes / History / Calendar / About / Account / Admin / Terms 各页。
- 小程序：`utils/StateView.vue` 重写，`useData.js` 新增 empty 和 busy 状态，各页传入 env/perm，"我的"页加入套餐、提醒和刷新 me；`vite.config.js` 的代理目标改为可通过 `INSIGHT_API_TARGET` 配置。
- 文档：`docs/launch-checklist.md`、README。

## 验证结果

| 项 | 结果 |
|---|---|
| `2026-10-14_verify_insight_api.py` | 52/52 通过（新增 3 项缺数据日断言） |
| `2026-10-15_verify_insight_access.py` | 84/84 通过（新增 20 项套餐、开通、冲正、合计、到期断言） |
| `npm run build:prod`（web） | 通过：混淆 18 个文件，产物扫描正常 |
| `npm run build:mp-weixin` / `build:h5` | 通过 |
| Web 截图（免费/VIP/SVIP/管理员，桌面 1360 + 手机 375） | 锁定导航、预告页、套餐页、到期提醒、缺数据日跳转（10-21 → 10-14）、下钻锁定卡、后台三个新页签均正常；375px 宽度下无横向滚动 |
| 小程序 H5 截图（390px） | 锁定预告 → 管理员开通 → 解锁，无需重新登录；同等级续期叠加 5+5=10 天 |
| 真实上游 2026-10-20/21 | **未验证**：本机 8000 端口的服务没有 records 接口，也没有 Key |

截图在会话临时目录，未入库；需要留存时重跑 Playwright 脚本输出到 `docs/evidence/`。

## 未完成

- 3.3：用真实上游实测 2026-10-21 的缺数据显示（需要数据中台地址和 Key）。
