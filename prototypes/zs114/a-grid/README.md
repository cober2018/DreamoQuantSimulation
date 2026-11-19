# ZS-114 阶段 A · 方向 A「秩序网格」原型

知数星耀视觉方向原型（Vite + Vue 3 + ECharts，独立应用）。说明、截图、自评见回执目录 `AI大脑｜DreamOtech跨会话协作中心/12_执行回执/ZS-114/a-grid/README.md`。

| 路由 | 内容 |
|---|---|
| `/` | 介绍页（首屏 + 内容屏） |
| `/app` | Web 平台「今日要点」（`?d=2026-11-04` 切日，`?theme=dark`） |
| `/app/industries` | 行业比较与轮动 |
| `/app/states` | 五种状态 |
| `/mp`、`/mp/industries` | 小程序 H5 预览（375） |

```sh
npm install
npm run fonts     # 生成标题字子集 + 复制拉丁字体到 public/fonts（需要 pyftsubset 与本机思源黑体）
npm run dev       # 先由 src/design/tokens.js 生成 tokens.css / tokens.json
npm run build && npm run preview   # http://localhost:4174
```

- 设计 token 唯一来源：`src/design/tokens.js` → `scripts/gen-tokens.mjs` 生成 `tokens.css`、`tokens.json`；ECharts 主题 `src/charts/echarts-theme.js` 也从这里取色。
- 数据：只读引用 `../data/*.json`（要点为真实回放；行业、日历为示例数据）。
- 待办：其余 5 个明细页、真实接口、标题字体子集随文案自动生成。
