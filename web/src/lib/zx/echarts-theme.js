// 来自 web/src/intro/ds/echarts-theme.js（官网同一份），原样复制；改主题请改 design-system 后同步，勿在此手改
// 知数星耀 · C 星图 ECharts 主题（zx-light / zx-dark）。颜色、字号、网格全部取自 tokens.json，
// 不使用 ECharts 默认样式。用法：
//   import { registerZxThemes, zxLoading, zxEmpty } from '<design-system>/echarts-theme.js'
//   registerZxThemes(echarts); echarts.init(el, 'zx-dark')
//   chart.showLoading('default', zxLoading('dark'))      // 加载态
//   chart.setOption({ graphic: zxEmpty('dark', '所选日期没有数据') })  // 空态
import tokens from './tokens.json'
import { hslToRgba } from './color.js'

export const toRgba = hslToRgba

export function palette(mode) {
  return Object.fromEntries(Object.entries(tokens.color[mode]).map(([k, v]) => [k, hslToRgba(v)]))
}

const CH = tokens.chart

function build(mode) {
  const c = palette(mode)
  const font = tokens.font.sans
  const dark = mode === 'dark'
  const axis = {
    axisLine: { show: true, lineStyle: { color: c['line-strong'], width: 1 } },
    axisTick: { show: false },
    axisLabel: { color: c['ink-3'], fontSize: CH.fontSize.axis, fontFamily: font, margin: 10 },
    splitLine: { show: true, lineStyle: { color: c.line, width: 1, type: [2, 4] } },
    splitArea: { show: false },
    nameTextStyle: { color: c['ink-3'], fontSize: CH.fontSize.axis, fontFamily: font },
  }
  return {
    // 系列色：星光 → 品牌金 → 冷蓝 → 雾紫 → 灰；只让金色承担强调。涨跌不走系列色，用 zx.up / zx.down
    color: [c['viz-1'], c['viz-2'], c['viz-3'], c['viz-4'], c['viz-5']],
    backgroundColor: 'transparent',
    textStyle: { fontFamily: font, color: c['ink-2'], fontSize: CH.fontSize.tooltip },
    title: { textStyle: { color: c.ink, fontSize: CH.fontSize.title, fontWeight: 600 }, subtextStyle: { color: c['ink-3'], fontSize: CH.fontSize.tooltip } },
    grid: { ...CH.grid, containLabel: true },
    categoryAxis: { ...axis, splitLine: { show: false } },
    valueAxis: { ...axis, axisLine: { show: false } },
    timeAxis: axis,
    logAxis: { ...axis, axisLine: { show: false } },
    legend: { textStyle: { color: c['ink-2'], fontSize: CH.fontSize.tooltip }, itemWidth: 10, itemHeight: 10, icon: 'circle', inactiveColor: c['line-strong'] },
    tooltip: {
      backgroundColor: c['surface-2'],
      borderColor: c['line-strong'],
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: c.ink, fontSize: CH.fontSize.tooltip, fontFamily: font },
      extraCssText: `border-radius:8px;box-shadow:${dark ? '0 12px 32px rgba(2,6,16,.55)' : '0 12px 32px rgba(20,30,60,.10)'};font-variant-numeric:tabular-nums;`,
      axisPointer: {
        lineStyle: { color: c.accent, width: 1, type: 'solid' },
        crossStyle: { color: c.accent, width: 1 },
        shadowStyle: { color: c['accent-soft'] },
        label: { backgroundColor: c['surface-2'], color: c.ink, fontSize: CH.fontSize.label },
      },
    },
    scatter: { symbolSize: CH.symbolSize, itemStyle: { borderWidth: 0 } },
    line: { symbol: 'circle', symbolSize: 5, smooth: false, lineStyle: { width: 1.25 } },
    bar: { barMaxWidth: CH.barMaxWidth, itemStyle: { borderRadius: 1 } },
    markLine: { lineStyle: { color: c['line-strong'], type: 'solid', width: 1 }, label: { color: c['ink-3'], fontSize: CH.fontSize.label }, symbol: 'none' },
    markArea: { itemStyle: { color: c['accent-soft'] }, label: { color: c['ink-3'], fontSize: CH.fontSize.label } },
    dataZoom: { borderColor: c.line, textStyle: { color: c['ink-3'] }, fillerColor: c['accent-soft'], handleStyle: { color: c.accent }, dataBackground: { lineStyle: { color: c['line-strong'] }, areaStyle: { color: c['surface-2'] } } },
    visualMap: { textStyle: { color: c['ink-3'] }, inRange: { color: [c.down, c['surface-2'], c.up] } },
    // 自定义扩展：图表代码按 A 股习惯取红涨绿跌
    zx: { up: c.up, down: c.down, flat: c.flat, upSoft: c['up-soft'], downSoft: c['down-soft'], accent: c.accent, star: c.star, starDim: c['star-dim'], ink: c.ink, ink2: c['ink-2'], ink3: c['ink-3'], line: c.line, lineStrong: c['line-strong'], surface: c.surface, surface2: c['surface-2'] },
  }
}

export const zxLight = build('light')
export const zxDark = build('dark')
export const zxTheme = (mode) => (mode === 'dark' ? zxDark : zxLight)

// 加载态：和页面骨架屏同色，不用 ECharts 默认的蓝色转圈
export function zxLoading(mode) {
  const c = palette(mode)
  return { text: '加载中', color: c.accent, textColor: c['ink-3'], maskColor: mode === 'dark' ? 'rgba(10,16,30,0.6)' : 'rgba(245,247,250,0.7)', fontSize: CH.fontSize.tooltip, spinnerRadius: 8, lineWidth: 1.5, showSpinner: true }
}

// 空态：图表区中央一行说明 + 一条虚线基线（星图语言），不出现空坐标轴
export function zxEmpty(mode, text = '没有符合条件的数据') {
  const c = palette(mode)
  return [{
    type: 'group', left: 'center', top: 'middle', silent: true,
    children: [
      { type: 'text', x: 0, y: 0, style: { text, fill: c['ink-3'], font: `${CH.fontSize.tooltip + 1}px ${tokens.font.sans}`, align: 'center', verticalAlign: 'middle' } },
      { type: 'line', shape: { x1: -72, y1: 18, x2: 72, y2: 18 }, style: { stroke: c['line-strong'], lineDash: [2, 4] } },
      { type: 'circle', shape: { cx: -72, cy: 18, r: 2 }, style: { fill: c['ink-3'] } },
      { type: 'circle', shape: { cx: 72, cy: 18, r: 2 }, style: { fill: c['ink-3'] } },
    ],
  }]
}

export function registerZxThemes(echarts) {
  echarts.registerTheme('zx-light', zxLight)
  echarts.registerTheme('zx-dark', zxDark)
}
