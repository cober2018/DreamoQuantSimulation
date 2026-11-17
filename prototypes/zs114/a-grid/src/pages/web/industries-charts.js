import { palette } from '../../charts/echarts-theme.js'
import { font } from '../../design/tokens.js'

const f1 = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1)

export function rrgOption(items, selected) {
  return (mode) => {
    const c = palette(mode)
    const amt = items.map((r) => r.amount)
    const max = Math.max(...amt)
    const xs = items.map((r) => r.rs_ratio), ys = items.map((r) => r.rs_momentum)
    const pad = (a) => { const lo = Math.min(...a, 100), hi = Math.max(...a, 100); const d = Math.max(hi - 100, 100 - lo) * 1.15; return [100 - d, 100 + d] }
    const [x0, x1] = pad(xs), [y0, y1] = pad(ys)
    const corner = (text, x, y, align) => ({ type: 'text', [x]: 56, [y]: 30, style: { text, fill: c.muted, font: `11px ${font.sans}`, align } })
    return {
      grid: { left: 64, right: 20, top: 20, bottom: 44 },
      xAxis: { type: 'value', name: 'RS 比率', nameLocation: 'middle', nameGap: 28, min: x0, max: x1, axisLabel: { formatter: (v) => v.toFixed(1), showMinLabel: false, showMaxLabel: false } },
      yAxis: { type: 'value', name: 'RS 动量', nameLocation: 'middle', nameGap: 48, min: y0, max: y1, axisLabel: { formatter: (v) => v.toFixed(1), showMinLabel: false, showMaxLabel: false } },
      tooltip: { trigger: 'item', formatter: (p) => `<b>${p.data.name}</b><br/>RS 比率 ${p.data.value[0].toFixed(2)}<br/>RS 动量 ${p.data.value[1].toFixed(2)}<br/>成交额 ${p.data.amount.toFixed(1)} 亿元` },
      graphic: [
        { type: 'text', right: 28, top: 26, style: { text: '比率 > 100 · 动量 > 100', fill: c.muted, font: `10px ${font.mono}` } },
        { type: 'text', left: 60, bottom: 50, style: { text: '比率 < 100 · 动量 < 100', fill: c.muted, font: `10px ${font.mono}` } },
      ],
      series: [{
        type: 'scatter',
        data: items.map((r) => ({
          name: r.sector_name, value: [r.rs_ratio, r.rs_momentum], amount: r.amount, code: r.sector_code,
          symbolSize: 6 + 14 * Math.sqrt(r.amount / max),
          itemStyle: { color: r.sector_code === selected ? c.accent : c.ink2, opacity: r.sector_code === selected ? 1 : 0.55 },
          label: { show: r.sector_code === selected, formatter: r.sector_name, position: 'right', color: c.accent, fontWeight: 600, fontSize: 11 },
        })),
        emphasis: { scale: 1.3, itemStyle: { color: c.accent, opacity: 1 }, label: { show: true, formatter: '{b}', position: 'right', color: c.ink, fontSize: 11 } },
        markLine: { silent: true, data: [{ xAxis: 100 }, { yAxis: 100 }], label: { show: false }, animationDuration: 600 },
      }],
    }
  }
}

export function flowOption(items) {
  return (mode) => {
    const c = palette(mode)
    const s = [...items].sort((a, b) => b.net_flow_1d - a.net_flow_1d)
    const pick = [...s.slice(0, 8), ...s.slice(-8)].reverse()
    return {
      grid: { left: 88, right: 52, top: 8, bottom: 28 },
      xAxis: { type: 'value', splitNumber: 4, axisLabel: { formatter: (v) => f1(v), hideOverlap: true } },
      yAxis: { type: 'category', data: pick.map((r) => r.sector_name), axisLabel: { fontFamily: font.sans, fontSize: 11, color: c.ink2 }, axisTick: { show: false } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: c.accentSoft } }, formatter: (p) => `${p[0].name}<br/>净流入 1 日 <b>${f1(p[0].value)}</b> 亿元` },
      series: [{
        type: 'bar', barWidth: 8,
        data: pick.map((r) => ({ value: r.net_flow_1d, itemStyle: { color: r.net_flow_1d >= 0 ? c.up : c.down } })),
        label: { show: true, position: 'right', formatter: (p) => f1(p.value), fontFamily: font.mono, fontSize: 10, color: c.muted },
        markLine: { silent: true, data: [{ xAxis: 0 }], label: { show: false }, lineStyle: { type: 'solid', color: c.lineStrong } },
      }],
    }
  }
}

export function seriesOption(points) {
  return (mode) => {
    const c = palette(mode)
    return {
      grid: { left: 52, right: 52, top: 28, bottom: 32 },
      legend: { top: 0, right: 0, data: ['净流入 1 日（亿元）', 'RS 比率'] },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: points.map((p) => p.trade_date.slice(5)), axisPointer: { type: 'line' } },
      yAxis: [
        { type: 'value', axisLabel: { formatter: (v) => f1(v) } },
        { type: 'value', scale: true, splitLine: { show: false }, axisLabel: { formatter: (v) => v.toFixed(0) } },
      ],
      series: [
        { name: '净流入 1 日（亿元）', type: 'bar', barWidth: 10, data: points.map((p) => ({ value: p.net_flow_1d, itemStyle: { color: p.net_flow_1d >= 0 ? c.up : c.down } })) },
        { name: 'RS 比率', type: 'line', yAxisIndex: 1, showSymbol: true, symbolSize: 5, data: points.map((p) => p.rs_ratio), lineStyle: { color: c.accent, width: 1.5 }, itemStyle: { color: c.accent } },
      ],
    }
  }
}
