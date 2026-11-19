// 知数星耀 · A 秩序网格 ECharts 主题（亮 / 暗）。颜色全部取自 design/tokens.js
import { color, font, motion } from '../design/tokens.js'

function build(c) {
  const axis = {
    axisLine: { show: true, lineStyle: { color: c.lineStrong, width: 1 } },
    axisTick: { show: true, length: 4, lineStyle: { color: c.lineStrong } },
    axisLabel: { color: c.muted, fontFamily: font.mono, fontSize: 11, margin: 10 },
    splitLine: { show: true, lineStyle: { color: c.line, width: 1, type: 'solid' } },
    splitArea: { show: false },
    nameTextStyle: { color: c.muted, fontFamily: font.mono, fontSize: 11 },
    axisPointer: { lineStyle: { color: c.accent, width: 1, type: 'solid' }, label: { backgroundColor: c.accent, color: c.accentInk, fontFamily: font.mono, fontSize: 11, padding: [3, 6], borderRadius: 2 } },
  }
  return {
    // 系列色：一个强调色 + 石墨灰阶；红绿另由 up/down 显式指定，不进调色板
    color: [c.accent, c.ink2, c.faint, c.lineStrong, c.muted],
    backgroundColor: 'transparent',
    textStyle: { fontFamily: font.sans, color: c.ink2, fontSize: 12 },
    title: { textStyle: { color: c.ink, fontSize: 13, fontWeight: 600 }, subtextStyle: { color: c.muted, fontFamily: font.mono, fontSize: 11 } },
    grid: { left: 48, right: 16, top: 24, bottom: 32, containLabel: false },
    categoryAxis: { ...axis, splitLine: { show: false } },
    valueAxis: { ...axis, axisLine: { show: false }, axisTick: { show: false } },
    timeAxis: axis,
    logAxis: axis,
    legend: { textStyle: { color: c.muted, fontSize: 11 }, itemWidth: 10, itemHeight: 2, icon: 'rect' },
    tooltip: {
      backgroundColor: c.surface, borderColor: c.lineStrong, borderWidth: 1, padding: [8, 10],
      textStyle: { color: c.ink, fontFamily: font.mono, fontSize: 12 },
      extraCssText: 'border-radius:4px;box-shadow:none;',
      axisPointer: { type: 'cross', crossStyle: { color: c.accent, width: 1 }, lineStyle: { color: c.accent, width: 1 } },
    },
    line: { symbol: 'circle', symbolSize: 4, showSymbol: false, lineStyle: { width: 1.5 }, emphasis: { lineStyle: { width: 1.5 } } },
    bar: { barMaxWidth: 14, itemStyle: { borderRadius: 0 } },
    scatter: { symbolSize: 7, itemStyle: { borderColor: c.surface, borderWidth: 1 } },
    markLine: { symbol: 'none', lineStyle: { color: c.lineStrong, type: [3, 3], width: 1 }, label: { color: c.muted, fontFamily: font.mono, fontSize: 10 } },
    animationDuration: motion.draw,
    animationEasing: 'cubicOut',
    animationDurationUpdate: motion.slow,
  }
}

export const THEMES = { 'zs-a-light': build(color.light), 'zs-a-dark': build(color.dark) }
export const themeName = (mode) => (mode === 'dark' ? 'zs-a-dark' : 'zs-a-light')
export const palette = (mode) => color[mode === 'dark' ? 'dark' : 'light']

export function registerThemes(echarts) {
  for (const [k, v] of Object.entries(THEMES)) echarts.registerTheme(k, v)
}
