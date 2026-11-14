## Why

用户要求（2026-11-15）：小程序和网页一样，所有合规数据都能访问，不设入口层面的页面限制。现在小程序只有总览、情绪资金、行业、题材、我的 5 页。后端 `gate.py` 用 `MP_PAGES` 拦掉了历史复盘和事件日历；`main.py` 对 `client == "mp"` 另有两处限制：拦截板块序列（返回 403）、去掉题材封板时间分布。

## What Changes

- 后端：删除 `gate.MP_PAGES` 和按 `client == "mp"` 的页面、明细拦截（`gate.require`、`main.py` 的板块序列与题材封板时间两处）。小程序与网页使用同一份角色权限（现在是权限点，D9 上线后是角色策略），入口只用于审计和角色的"可用入口"设置。
- 小程序新增两页：
  - **历史复盘**：板块结构统计、Open5、板块资金净流入全量排行。
  - **事件日历**：宏观事件列表。

  两页调用网页同一组接口（`/api/v1/history`、`/api/v1/calendar`），口径、数据和合规过滤与网页一致。
- 小程序题材页补上封板时间分布，行业页补上板块序列下钻；按角色权限显示，无权限时显示锁定提示。理由是"所有合规数据都能访问"。
- 管理后台仍只在网页端提供（这是管理功能，不是数据页面）。

## Capabilities

### New Capabilities
- `miniprogram-full-access`：小程序与网页同权限、补齐历史复盘与事件日历两页

## Impact

- 后端：`access/gate.py`、`main.py`（删除小程序专属拦截）。
- 小程序：`pages.json`、新增 `pages/history`、`pages/calendar`，修改 `pages/theme`、`pages/industry`、`pages/index`（入口卡片）、`pages/mine`（页面列表）。
- 测试：`scripts/sandbox/2026-10-15_verify_insight_access.py` 中"小程序拦截历史/日历"的用例改为"小程序可访问"。
- 与上游切换（`govern-upstream-via-public-services-v1`）互不依赖，见 tasks 第 4 节。
