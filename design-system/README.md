# 知数星耀 · C 星图设计系统（v1）

三端（Vue 平台 SPA、Astro 公开站、uni-app 小程序）共用的唯一设计数据源。参考实现：`prototypes/zs115/c-system`。

```
design-system/
├── tokens.json        唯一数据源：颜色（亮 / 暗）、字体、字号、行高、字距、间距、圆角、阴影、动效、层级、断点、图表参数
├── build.mjs          node design-system/build.mjs → dist/tokens.css + dist/tokens.scss（无依赖，Node 18+）
├── color.js           hsl → rgb/rgba（ECharts 与小程序用）
├── echarts-theme.js   zx-light / zx-dark 主题 + zxLoading()（加载态）+ zxEmpty()（空态）
└── dist/              生成物，不入库（.gitignore）
```

## 一、原则

1. **每个数字都能追到口径。** 数字旁边总有数据日期、单位和来源；技术字段名不上卡面，收进「口径」展开区。
2. **星图母题，克制使用。** 每条事实是一颗星，每个数据页是一个星座，要点和口径之间有一条线。母题只出现在：首屏星图、要点星图条、追溯链、导航当前项、数据页星座小图。
3. **一个强调色。** 品牌金只给：当前焦点、主按钮、追溯链终点、选中日期。其余全靠墨色层级。
4. **红涨绿跌，饱和度压低。** 只有带方向的数（涨跌、资金净流入）着色；标准分、分位、占比的正负号不代表好坏，不着色。
5. **亮色是默认，暗色是夜间。** 没有显式选择时跟随系统；`data-theme` 优先。
6. **动效慢而有目的，可关闭。** `prefers-reduced-motion` 下所有时长归零，只画终态；不做阻塞式开屏。
7. **只给事实。** 组件文案不出现买、卖、关注（指标的）、机会、仓位、收益、荐股；状态文案如实说明发生了什么，不拿别的日期代替。

## 二、Token

### 颜色（`--c-*`）

| token | 亮色 | 暗色 | 用途 |
|---|---|---|---|
| bg / bg-deep | hsl(210 28% 97%) / hsl(212 30% 94.5%) | hsl(222 52% 7%) / hsl(224 60% 4.5%) | 页面底 / 侧栏、页脚、星图条底 |
| surface / surface-2 / surface-hover | 40 33% 99.5% / 212 28% 95% / 212 40% 96.5% | 222 40% 10% / 221 34% 13.5% / 221 34% 15% | 卡片三层 |
| line / line-strong / grid | 216 24% 86% / 218 20% 72% / 220 40% 30% /.06 | 218 30% 22% /.7 / 218 26% 32% / 218 40% 60% /.07 | 发丝线、强调线、网格底纹 |
| ink / ink-2 / ink-3 | 222 52% 14% / 220 24% 30% / 220 14% 40% | 40 25% 93% / 218 20% 76% / 218 15% 62% | 三级文字（对 bg 对比度 ≥ 5.4 : 1） |
| accent / accent-ink / accent-soft / on-accent | 36 78% 32% / 34 80% 29% / … / 40 33% 99% | 40 66% 64% / 40 70% 70% / … / 222 52% 9% | 品牌金（亮色压暗到 AA） |
| up / down / up-soft / down-soft / flat | 1 60% 42% / 155 55% 27% / … | 3 64% 67% / 154 38% 57% / … | 红涨绿跌（低饱和） |
| ok / warn / danger / focus / scrim | … | … | 状态色、焦点框、遮罩 |
| star / star-dim | 222 52% 20% / 220 25% 45% /.45 | 214 40% 86% / 216 30% 60% /.55 | 星点 |
| viz-1 … viz-5 | 星光 → 金 → 冷蓝 → 雾紫 → 灰 | 同左（暗色版） | 图表系列色；涨跌不走系列色 |
| qr-surface | 白 | 白 | 二维码底：两套主题都是白底，否则扫不出 |

### 其他

| 类别 | 值 | CSS 变量 |
|---|---|---|
| 字体 | display：ZX Serif（思源宋体子集）→ 系统宋体；sans：系统中文黑体；mono：系统等宽 | `--font-display/sans/mono` |
| 字号 | 11 / 12 / 13 / 14 / 16 / 20 / 28 / 40 / 56；display clamp(48–104) | `--fs-2xs … --fs-3xl, --fs-display` |
| 行高 / 字距 | 1.15 / 1.4 / 1.6 / 1.8；-0.01em / 0 / 0.08em / 0.16em | `--lh-*`、`--tr-*` |
| 间距 | 0 / 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 | `--s-0 … --s-9` |
| 圆角 | 4 / 8 / 12 / 20 / pill | `--r-1 … --r-4, --r-pill` |
| 阴影 | 1（贴面）/ 2（浮层）/ glow（金色描边光） | `--shadow-*`（亮暗各一套） |
| 动效 | 150 / 200 / 250 / 700（描线）/ 1200ms；out = cubic-bezier(.2,.7,.2,1)，std = (.4,0,.2,1) | `--dur-*`、`--ease-*`，减少动效时归零 |
| 层级 | base 0 / raised 1 / sticky 20 / header 30 / drawer 40 / overlay 50 / toast 60 / skip 100 | `--z-*` |
| 断点 | sm 640 / md 900 / lg 1024 / xl 1180 / 2xl 1680 | `--bp-*`（媒体查询里请写字面值，CSS 变量不能用在 @media） |
| 图表 | 轴字号 11，tooltip 12，标题 14；grid 48/16/24/32；柱宽上限 14；散点 7 | 只在 `echarts-theme.js` 里用 |

## 三、组件清单与状态

| 组件 | 变体 | 状态 |
|---|---|---|
| Button `.btn` | 默认 / `primary`（全站唯一金色实底）/ `ghost` / `sm` / `big` | hover、active（下沉 1px）、focus-visible（2px 焦点框）、disabled（45% 透明，禁用指针） |
| Badge `.badge` | `stat`「统计」/ `ai`「AI 整理」（仅样式示意）/ `sample`「示例数据」「样张」「即将推出」（虚线） | — |
| SiteHeader | 叠在首屏上（overlay）/ 普通 | 当前页金色下划线（aria-current）；< 900 收成菜单（aria-expanded） |
| SiteFooter | — | 「关注主理人」一行只在有可公开卡片时出现；隐私、协议、ICP、免责声明 |
| FactCard | `card` / `lead`（当天偏离最大的一条，做成主卡） | hover、active（联动星图条）、「口径」展开（指标字段 / 数值 / 参照 / 数据日期 / 来源 / 性质）、「追溯链与明细页」打开 FactSheet |
| StrengthMeter | 普通 / big | 偏离 0–100 刻度尺，只表示离常态多远 |
| DayRuler | — | 近 20 交易日，柱高 = 要点条数；选中金色；斜纹 = 有数据页缺数；可横向滚动并自动居中 |
| ConstellationStrip | — | 横向来源页、纵向偏离；与卡片双向联动；换日期重画 |
| FactSheet（原生 dialog） | 右侧抽屉 / 窄屏底部抽屉 | 焦点圈定、Esc 关闭 |
| StatePanel | `loading` / `empty` / `error` / `forbidden` / `nodate`，`compact` | 插图用星图语言；文案只说发生了什么、能做什么 |
| EChart | 主题 zx-light / zx-dark | 加载（zxLoading，与骨架同色）、空（zxEmpty，不出空坐标轴）、主题切换重绘、减少动效时关闭动画 |
| 首屏星图（starfield + DOM 标签层） | 宽屏右侧天区 / 窄屏顶部 | 标签碰撞避让 → 引线 → 收成编号标记（悬停 / 聚焦 / 轻触展开）→ 极端密集时只进图例；星座悬停转金；亮星读数可点到第二屏卡片；无 Canvas 时静态海报 + 全部读数列表 |
| ThemeToggle | — | aria-pressed；View Transitions 交叉淡入 |
| KindGlyph / ConstellationGlyph / PlatformMark | — | 纯几何符号；PlatformMark 是中性占位，**不画平台商标** |

## 四、用法

### Vue 平台 SPA（Vite）

```js
// vite.config.js
resolve: { alias: { '@ds': fileURLToPath(new URL('../design-system', import.meta.url)) } }
// package.json："prebuild": "node ../design-system/build.mjs"
// main.js
import '@ds/dist/tokens.css'
// ECharts
import { registerZxThemes, zxLoading, zxEmpty } from '@ds/echarts-theme.js'
registerZxThemes(echarts); echarts.init(el, theme === 'dark' ? 'zx-dark' : 'zx-light')
```

首帧前在 `<head>` 内联一段脚本决定主题（URL `?theme=` > 本地偏好 > 系统），避免闪烁。

### Astro 公开站

```astro
---
import '../../design-system/dist/tokens.css'
---
<html data-theme={undefined}>  <!-- 不写时跟随系统；主题切换脚本与 SPA 相同 -->
```

`dist/tokens.css` 是纯 CSS 变量，静态页直接用；首屏关键样式（tokens + 首屏布局）可以内联进 `<head>`。

### uni-app 小程序

```scss
// App.vue
@use '@/design-system/tokens.scss' as *;   // 复制或软链 dist/tokens.scss
@include zx-page-theme;                      // page 根：亮色默认，系统暗色时切换（manifest 里开 darkmode）
// 组件
.card { padding: $zx-s-4; border-radius: $zx-r-3; background: var(--c-surface); color: var(--c-ink); }
```

尺寸已经按 750 设计稿换算成 rpx（375 宽下 1px = 2rpx），颜色是 rgb/rgba。组件里的颜色、间距、字号与 Web 用同名 CSS 变量（`--c-*`、`--s-*`、`--fs-*`、`--r-*`），三端写法一致。需要 `sass` 依赖。原型里的小程序 H5 页（`/mp`、`/mp/industries`）就是按这套写法写的，构建时把 rpx 换算成 `calc(N * var(--rpx))` 在浏览器里预览。

## 五、字体与授权

| 字体 | 来源 | 授权 | 用法 |
|---|---|---|---|
| ZX Serif（展示字） | 思源宋体 Source Han Serif CN Regular（Adobe） | SIL Open Font License 1.1 | 只做子集（当前 150 字，21.9 KB woff2），自托管，`font-display: swap` + preload；按 OFL 改了内部字体名，不与原名混用 |
| 正文 | 系统字体（苹方、HarmonyOS Sans、微软雅黑） | 系统自带 | 不下载 |
| 等宽 | 系统等宽 | 系统自带 | 数字统一 `tabular-nums` |

子集脚本：`prototypes/zs115/c-system/scripts/subset-fonts.py`（扫描 `.display` 元素、介绍页文案两个版本、页面标题；源字体不入库）。新增展示文字后要重新跑一次。

## 六、改 token 的流程

1. 改 `tokens.json`；
2. `node design-system/build.mjs`；
3. 亮暗两套各看一遍：文字对比度 ≥ 4.5 : 1（正文）、主按钮 on-accent 对 accent ≥ 4.5 : 1；
4. 三端各自构建（SPA / Astro / 小程序）。
