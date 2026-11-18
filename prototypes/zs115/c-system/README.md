# ZS-115 S1 · C 星图设计系统参考实现（知数星耀）

由 `prototypes/zs114/c-constellation` 升级而来，全部 token 取自仓库根的 `design-system/`（本目录不再保存任何 token 值）。只用于设计评审，不接线上、不部署。

## 运行

```bash
npm install
npm run build && npm run preview      # http://localhost:4391（prebuild 会先跑 design-system/build.mjs）
npm run dev                           # http://localhost:5391
BRIEF_LIVE=true npm run build         # 「每日要点」上线后的介绍页文案
SOCIAL_DRAFTS=true npm run build      # 把 ready=false 的自媒体卡片也构建进去（原型预览）
```

## 路由

| 路由 | 内容 |
|---|---|
| `/` | 介绍页：星图首屏（标签碰撞避让、星座悬停、亮星可点到第二屏）、要点样张与追溯连线、六个数据页、关注主理人入口 |
| `/follow` | 关注知数Talk 主理人：公众号 / 抖音 / 小红书三张卡，二维码放在白底容器里（两套主题都是白底） |
| `/pricing` `/docs` `/blog` `/login` `/privacy` `/terms` | 导航占位页（不写任何价格数字） |
| `/app` | 平台首页：近 20 交易日刻度尺（柱高 = 要点条数，可切日期）、主卡（大数字 + 偏离刻度）、要点星图条、卡片网格、口径展开、明日日程、数据状态 |
| `/app/industries` `/app/states` | 行业比较与轮动（示例数据）；五种状态 + 图表加载 / 空态样张 |
| `/mp` `/mp/industries` | 小程序 H5（按 uni-app 写法：scss + rpx + tokens.scss） |

原型开关（只在本原型里有）：任意页 `?theme=light|dark`；`/app?date=2026-11-14`（非交易日 → 所选日期无数据）；`/app?state=loading|error|forbidden|empty`；`/?sky=dense`（星图压力测试，每颗星都挂读数，验证收成编号标记的路径）；`?drafts=1`（显示 ready=false 的自媒体卡片）。

## 关键实现

| 项 | 位置 | 说明 |
|---|---|---|
| 单一开关 | `src/config.js` | `BRIEF_LIVE`（构建环境变量，默认 false）选择 `src/copy.js` 里的两版介绍页文案，index.html 的标题与描述也由它生成。false 时写「即将推出」，要点卡片带「样张」标记并注明不是线上界面 |
| 星图标签避让 | `src/lib/starfield.js` `layoutLabels()` | 标签放在画布上方的 DOM 层，按真实尺寸量；按 y 排序逐个试 12 个位置，避开已放标签（间距 4px）、亮星、暗星、文案区、页头、说明文字和画布边界，并优先选不压星座连线的位置；放不下收成编号标记（button，悬停 / 聚焦展开，读屏读 aria-label），连标记都放不下就只进图例；另有完整的读屏列表 |
| 口径展开 | `src/components/FactCard.vue`、`src/lib/brief.js` `factSpec()` | 卡面不出现字段名；「口径」里列指标字段、数值、参照、数据日期、来源、性质。回放数据还没有 metric / value / reference 字段，原型按字段名、主数值和要点类型推出参照 |
| 自媒体卡片 | `src/content/social.json` | 唯一数据源；`ready=false` 默认不显示；全部隐藏时页脚和首页入口也不出现，`/follow` 显示「账号信息整理中」 |
| 二维码 | `public/social/*.png` | 从协作中心 `15_官网设计参考/自媒体二维码/裁切/` 原样复制，未改动；alt 为「知数Talk 公众号二维码」等。抖音码通用库无法解码，需用抖音 App 实扫确认 |
| 字体 | `public/fonts/zx-serif.woff2` | 思源宋体子集 149 字 21.5 KB，SIL OFL 1.1，见 `public/fonts/README.md` |
