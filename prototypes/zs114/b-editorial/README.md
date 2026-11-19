# ZS-114 方向 B · 研报纸本（原型）

知数星耀阶段 A 视觉方向原型：每日事实要点排成研报版式（暖白纸、墨黑字、墨蓝强调、脚注式口径）。完整说明、截图、自评、Lighthouse 见执行回执 `12_执行回执/ZS-114/b-editorial/README.md`。

| 路由 | 内容 |
|---|---|
| `/` | Web 今日要点（R1 回放真实数据，`?d=YYYY-MM-DD` 切日期） |
| `/industries` | 行业比较与轮动（示例数据，`?state=loading/error/denied/nodate`） |
| `/states` | 五种数据状态样张 |
| `/landing` | 介绍页 |
| `/mp`、`/mp/industries` | 小程序 H5 样张（375） |

| 文件 | 说明 |
|---|---|
| `src/styles/tokens.css`、`tokens.json` | 设计 token（亮 / 暗） |
| `src/echarts-theme.js` | ECharts 主题 zs-paper / zs-ink |
| `scripts/subset-fonts.py` | Noto Serif SC（OFL）子集化 |
| `scripts/prerender.py` | 介绍页首屏预渲染 |

启动：`npm install && npm run dev`（127.0.0.1:4791）。构建：`npm run build && npm run preview`，再 `python3 scripts/prerender.py http://127.0.0.1:4792`。数据只读引用 `../data/`。
