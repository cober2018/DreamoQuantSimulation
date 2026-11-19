// 知数星耀 · 方向 B「研报纸本」ECharts 主题（亮：zs-paper，暗：zs-ink）
// 取值与 tokens.css 一一对应（画布不能读 CSS 变量，这里写成 hex）。
// 原则：坐标轴像报刊图表——只留底轴实线和水平细网格，不画竖网格；数字用等宽数字；
// 系列色只有墨、墨蓝两种，红绿只用于 A 股正负（红正绿负）。

export const PALETTE = {
  light: {
    paper: '#f8f6f1', sheet: '#fdfcfa', ink: '#1d1a16', ink2: '#534c46', ink3: '#6c6660', rule: '#cfc8bf',
    accent: '#204779', accent2: '#3664a1', wash: '#e1e9f4', up: '#a33933', down: '#2c634f',
  },
  dark: {
    paper: '#11151c', sheet: '#161a22', ink: '#e9e5dd', ink2: '#c3bfb6', ink3: '#aaa59d', rule: '#363a45',
    accent: '#8bb5e4', accent2: '#699bd3', wash: '#213145', up: '#de7a73', down: '#66b791',
  },
}

const SANS = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'

function build(c) {
  const axisCommon = {
    axisLine: { show: true, lineStyle: { color: c.ink, width: 1 } },
    axisTick: { show: true, length: 4, lineStyle: { color: c.ink } },
    axisLabel: { color: c.ink3, fontSize: 11, fontFamily: SANS },
    splitLine: { show: true, lineStyle: { color: c.rule, width: 1, type: [2, 3] } },
    nameTextStyle: { color: c.ink3, fontSize: 11, fontFamily: SANS },
  }
  return {
    color: [c.accent, c.ink, c.accent2, c.ink3, c.up, c.down],
    backgroundColor: 'transparent',
    textStyle: { fontFamily: SANS, color: c.ink, fontSize: 12 },
    title: { textStyle: { color: c.ink, fontSize: 14, fontWeight: 600 }, subtextStyle: { color: c.ink3, fontSize: 11 } },
    grid: { left: 48, right: 16, top: 24, bottom: 32, containLabel: false },
    categoryAxis: { ...axisCommon, splitLine: { show: false } },
    valueAxis: { ...axisCommon, axisLine: { show: false }, axisTick: { show: false } },
    legend: { textStyle: { color: c.ink2, fontSize: 11 }, itemWidth: 12, itemHeight: 2, icon: 'rect' },
    tooltip: {
      backgroundColor: c.sheet,
      borderColor: c.ink,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: c.ink, fontSize: 12, fontFamily: SANS },
      extraCssText: 'border-radius:2px;box-shadow:0 8px 24px -12px rgba(0,0,0,.35);font-variant-numeric:tabular-nums;',
      axisPointer: { lineStyle: { color: c.ink3, type: 'dashed' }, crossStyle: { color: c.ink3 } },
    },
    scatter: { symbolSize: 7, itemStyle: { color: c.accent, borderColor: c.paper, borderWidth: 1 } },
    bar: { barMaxWidth: 14, itemStyle: { borderRadius: 0 } },
    line: { symbol: 'none', lineStyle: { width: 1.5 }, smooth: false },
    markLine: { symbol: 'none', lineStyle: { color: c.ink3, type: 'solid', width: 1 }, label: { color: c.ink3, fontSize: 10 } },
  }
}

// 加载态也统一：遮罩用纸色，转圈改成墨蓝细线（chart.showLoading('default', loadingStyle(mode))）
export const loadingStyle = (mode) => {
  const c = PALETTE[mode]
  return { text: '加载中', color: c.accent, textColor: c.ink3, maskColor: c.paper + 'cc', fontSize: 12, lineWidth: 1.5, spinnerRadius: 8 }
}

export const zsPaper = build(PALETTE.light)
export const zsInk = build(PALETTE.dark)
export const THEME_NAME = { light: 'zs-paper', dark: 'zs-ink' }

export function registerThemes(echarts) {
  echarts.registerTheme('zs-paper', zsPaper)
  echarts.registerTheme('zs-ink', zsInk)
}
