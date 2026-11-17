// 知数星耀 · 星图 ECharts 主题（zx-dark / zx-light）。颜色全部取自 tokens.json，
// 转成 rgba 是因为 zrender 不认 CSS4 的空格分隔 hsl 写法。
import tokens from './tokens.json'

export function toRgba(hsl) {
  const m = hsl.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+))?\s*\)/)
  if (!m) return hsl
  const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100, a = m[4] === undefined ? 1 : +m[4]
  const f = (n) => {
    const k = (n + h * 12) % 12
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255)
  }
  return `rgba(${f(0)},${f(8)},${f(4)},${a})`
}

export function palette(mode) {
  const c = Object.fromEntries(Object.entries(tokens.color[mode]).map(([k, v]) => [k, toRgba(v)]))
  return c
}

function build(mode) {
  const c = palette(mode)
  const font = tokens.font.sans
  const axis = {
    axisLine: { show: true, lineStyle: { color: c['line-strong'], width: 1 } },
    axisTick: { show: false },
    axisLabel: { color: c['ink-3'], fontSize: 11, fontFamily: font, margin: 10 },
    splitLine: { show: true, lineStyle: { color: c.line, width: 1, type: [2, 4] } },
    splitArea: { show: false },
    nameTextStyle: { color: c['ink-3'], fontSize: 11, fontFamily: font },
  }
  return {
    // 系列色：星光白 → 品牌金 → 冷蓝 → 雾紫，饱和度刻意压低，只让金色承担强调
    color: [c.star, c.accent, mode === 'dark' ? 'rgba(122,170,214,1)' : 'rgba(46,92,150,1)', mode === 'dark' ? 'rgba(170,160,214,1)' : 'rgba(96,82,150,1)', c['ink-3']],
    backgroundColor: 'transparent',
    textStyle: { fontFamily: font, color: c['ink-2'], fontSize: 12 },
    title: { textStyle: { color: c.ink, fontSize: 14, fontWeight: 600 }, subtextStyle: { color: c['ink-3'], fontSize: 12 } },
    grid: { left: 48, right: 16, top: 24, bottom: 32, containLabel: true },
    categoryAxis: { ...axis, splitLine: { show: false } },
    valueAxis: { ...axis, axisLine: { show: false } },
    timeAxis: axis,
    legend: { textStyle: { color: c['ink-2'], fontSize: 12 }, itemWidth: 10, itemHeight: 10, icon: 'circle' },
    tooltip: {
      backgroundColor: c['surface-2'],
      borderColor: c['line-strong'],
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: c.ink, fontSize: 12, fontFamily: font },
      extraCssText: `border-radius:8px;box-shadow:${mode === 'dark' ? '0 12px 32px rgba(2,6,16,.55)' : '0 12px 32px rgba(20,30,60,.10)'};font-variant-numeric:tabular-nums;`,
      axisPointer: {
        lineStyle: { color: c.accent, width: 1, type: 'solid' },
        crossStyle: { color: c.accent, width: 1 },
        label: { backgroundColor: c['surface-2'], color: c.ink },
      },
    },
    scatter: { symbolSize: 7, itemStyle: { borderWidth: 0 } },
    line: { symbol: 'circle', symbolSize: 5, smooth: false, lineStyle: { width: 1.25 } },
    bar: { barMaxWidth: 14, itemStyle: { borderRadius: 1 } },
    markLine: { lineStyle: { color: c['line-strong'], type: 'solid', width: 1 }, label: { color: c['ink-3'], fontSize: 11 }, symbol: 'none' },
    dataZoom: { borderColor: c.line, textStyle: { color: c['ink-3'] }, fillerColor: c['accent-soft'], handleStyle: { color: c.accent } },
    // 自定义扩展：图表代码按 A 股习惯取红涨绿跌
    zx: { up: c.up, down: c.down, upSoft: c['up-soft'], downSoft: c['down-soft'], accent: c.accent, star: c.star, starDim: c['star-dim'], ink: c.ink, ink2: c['ink-2'], ink3: c['ink-3'], line: c.line, lineStrong: c['line-strong'], surface: c.surface },
  }
}

export const zxDark = build('dark')
export const zxLight = build('light')

export function registerZxThemes(echarts) {
  echarts.registerTheme('zx-dark', zxDark)
  echarts.registerTheme('zx-light', zxLight)
}
