<template>
  <div class="page">
    <PageHead
      title="参与度与资金环境"
      lede="市场参与的冷热、抛售压力、股债收益差、衍生品偏离和风格强弱。五块都是按固定规则算出的统计，不给结论。"
      :meta="[{ k: '数据日期', v: P.trade_date }, { k: '快照取数', v: '2026-11-18' }, { k: '模块', v: '5' }]"
    />

    <div class="grid">
      <!-- 1 参与热度与成交 -->
      <Module id="m-heat" wide title="市场参与在升温还是降温，低参与持续了几天？" :unit="`单位 分 / 亿元 · 近 60 个交易日 · 截至 ${P.trade_date}`" :state="st"
        spec="市场参与热度（0–100 分，越高越活跃）、市场总成交额（亿元）、低参与持续交易日数 · 窗口：近 60 个交易日（08-18 至 11-17）· 数据日期 2026-11-17 · 来源：市场参与与压力">
        <template #kpi><Kpis :items="heatKpis" /></template>
        <EChart :option="heatOption" :height="narrow ? 260 : 300" label="近 60 个交易日市场参与热度折线与市场总成交额柱图，浅色柱为低参与持续中的交易日" />
        <template #note>浅色柱：当天处于低参与持续期（持续交易日数 ≥ 1）。阴影段 08-18 至 09-30 的可用状态为「部分可用」，原样标出，不剔除。</template>
      </Module>

      <!-- 2 卖压相对强度 -->
      <Module id="m-press" title="抛售压力在高位还是低位？" :unit="`单位 %（相对强度，非卖出占比）· 近 60 个交易日`" :state="st"
        spec="卖压相对强度（0–100，越高压力越强，不是真实卖出成交占比）、卖压状态（高 / 中 / 低）· 窗口：近 60 个交易日 · 数据日期 2026-11-17 · 来源：市场参与与压力">
        <template #kpi><Kpis :items="pressKpis" /></template>
        <EChart :option="pressOption" :height="narrow ? 240 : 280" label="近 60 个交易日卖压相对强度折线，背景按当日卖压状态分高中低三档深浅" />
        <template #note>
          <span class="legend-sw"><i class="sw s-high" />高</span><span class="legend-sw"><i class="sw s-mid" />中</span><span class="legend-sw"><i class="sw s-low" />低</span>
          分档沿用数据服务返回的卖压状态，本页不另行判断。按这 60 天的返回值看：低档 ≤ 27.5、中档 32.5–67.5、高档 ≥ 72.5，边界在 30 与 70 附近（虚线）；正式分档规则待数据方确认后替换这句。
        </template>
      </Module>

      <!-- 3 股债收益差 -->
      <Module id="m-erp" title="股票相对债券的收益补偿，处在自身历史什么位置？" :unit="`单位 % · ${C.returned_range.start} 至 ${C.returned_range.end}`" :state="st"
        spec="股权风险补偿（% ，盈利收益率减国债收益率）、补偿历史位置（0–100%）· 窗口：已返回 155 个交易日（03-30 至 11-17）· 数据日期 2026-11-17 · 来源：股权风险补偿表">
        <template #kpi><Kpis :items="erpKpis" /></template>
        <EChart :option="erpOption" :height="narrow ? 240 : 280" label="股权风险补偿折线（左轴，百分数）与补偿历史位置面积（右轴，0 到 100）" />
        <template #note>「历史位置」的回看窗口在对外字段里没有写明，方案稿写的 5 年分位暂不能确认；声明覆盖从 2025-11-17 起，实际返回从 2026-03-30 起。</template>
      </Module>

      <!-- 4 衍生品标准分矩阵 -->
      <Module id="m-deriv" title="期指基差、期权认沽认购比、成交持仓比，哪个品种偏离常态？" :unit="`单位 60 日标准分 · ${D.trade_date}`" :state="st"
        spec="基差、认沽认购比、成交持仓比各自的 60 日标准分（0 为 60 日均值，±1 约为一个标准差）· 数据日期 2026-11-17 · 来源：衍生品观察">
        <EChart :option="derivOption" :height="narrow ? 300 : 300" label="衍生品标准分矩阵：行为五个指数品种，列为基差、认沽认购比、成交持仓比，颜色以 0 为中心，蓝为低于均值，橙为高于均值" />
        <template #note>
          颜色只表示偏离方向和幅度，不代表好坏，所以不用红绿。标 * 的格子是代理值：科创50 的基差与中证1000 相同（数据方注明同批代理）。中证1000 没有挂牌 ETF 期权，认沽认购比无数据；科创50 的成交持仓比无数据。上证50 的 ETF 期权一行与上证50 数值相同，不重复列出。只有当日一个截面，标准分的历史走势还没有对外提供。
        </template>
      </Module>

      <!-- 5 风格强弱 -->
      <Module id="m-style" title="成长、红利、大盘三类风格谁强谁弱，近 60 个观测怎么变？" :unit="`单位 分（0–100）· 60 个观测 · 截至 ${S.trade_date}`" :state="st"
        spec="风格强弱分（0–100，越高相对越强，不是收益率）、强弱标准分 · 窗口：60 个观测序号，0 = 2026-11-17 · 数据日期 2026-11-17 · 来源：风格轮动监控">
        <template #kpi><Kpis :items="styleKpis" /></template>
        <EChart :option="styleOption" :height="narrow ? 260 : 300" label="三类风格近 60 个观测的强弱分折线：科技成长（创业板指）、红利（中证红利）、大盘蓝筹（上证50）" />
        <template #note>数据方只给观测序号、不给逐点日期；序号 −9 标注为 11-04、0 标注为 11-17，和交易日历对得上，但横轴仍按序号画，不自行补日期。</template>
      </Module>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import PageHead from '../components/PageHead.vue'
import Module from '../components/Module.vue'
import Kpis from '../components/Kpis.vue'
import EChart from '../components/EChart.vue'
import { usePreviewState } from '../lib/state.js'
import { narrow, num, signed, md, alpha } from '../lib/fmt.js'
import P from '@data/participation-history.json'
import C from '@data/compensation-history.json'
import D from '@data/derivatives-raw-stats.json'
import S from '@data/style-history.json'

const st = usePreviewState()
const rows = P.rows.map(([date, heat, turnover, low, sp, ps, status]) => ({ date, heat, turnover, low, sp, ps, status }))
const last = rows[rows.length - 1]
const STATE_ZH = { high: '高', mid: '中', low: '低' }

const heatKpis = [
  { label: '参与热度', value: num(last.heat, 2), unit: '分' },
  { label: '市场总成交额', value: last.turnover.toLocaleString('en-US'), unit: '亿元' },
  { label: '低参与持续', value: String(last.low), unit: '交易日' },
  { label: '60 日热度最高', value: num(Math.max(...rows.map((r) => r.heat)), 2), unit: '分 · ' + md(rows.reduce((a, b) => (b.heat > a.heat ? b : a)).date) },
]
const highDays5 = rows.slice(-5).filter((r) => r.ps === 'high').length
const pressKpis = [
  { label: '卖压相对强度', value: num(last.sp, 1), unit: '%' },
  { label: '卖压状态', value: STATE_ZH[last.ps] },
  { label: '近 5 日处于高档', value: String(highDays5), unit: '天' },
  { label: '近 60 日处于高档', value: String(rows.filter((r) => r.ps === 'high').length), unit: '天' },
]

const tipBox = (title, lines) => `<b>${title}</b><br/>` + lines.join('<br/>')
const xAxisDates = (data, zx) => ({ type: 'category', data, axisLabel: { formatter: md, hideOverlap: true }, axisPointer: { type: 'line' } })

const heatOption = computed(() => {
  const n = narrow.value
  return (zx) => ({
    grid: { left: 4, right: 4, top: 36, bottom: 4, containLabel: true },
    legend: { top: 0, left: 0, data: ['市场总成交额', '参与热度'] },
    tooltip: { trigger: 'axis', formatter: (ps) => { const r = rows[ps[0].dataIndex]; return tipBox(r.date, [`参与热度 ${num(r.heat, 2)} 分`, `市场总成交额 ${r.turnover.toLocaleString('en-US')} 亿元`, `低参与持续 ${r.low} 交易日`, `可用状态 ${r.status === 'ok' ? '就绪' : '部分可用'}`]) } },
    xAxis: xAxisDates(rows.map((r) => r.date), zx),
    yAxis: [
      { type: 'value', name: n ? '' : '亿元', min: 10000, splitNumber: 4, axisLabel: { formatter: (v) => (v / 10000).toFixed(1) + '万' } },
      { type: 'value', name: n ? '' : '分', min: 0, max: 100, splitNumber: 4, splitLine: { show: false } },
    ],
    series: [
      {
        name: '市场总成交额', type: 'bar', barMaxWidth: 8, yAxisIndex: 0, z: 1,
        itemStyle: { color: alpha(zx.ink3, 0.6) },
        data: rows.map((r) => ({ value: r.turnover, itemStyle: r.low > 0 ? { color: alpha(zx.ink3, 0.25) } : undefined })),
        markArea: { silent: true, itemStyle: { color: alpha(zx.ink, 0.035) }, label: { show: !n, position: 'insideTopLeft', color: zx.ink3, fontSize: 11, formatter: '部分可用' }, data: [[{ xAxis: '2026-08-18' }, { xAxis: '2026-09-30' }]] },
      },
      { name: '参与热度', type: 'line', yAxisIndex: 1, z: 3, symbol: 'none', lineStyle: { width: 1.6, color: zx.star }, itemStyle: { color: zx.star }, data: rows.map((r) => r.heat) },
    ],
  })
})

const pressOption = computed(() => {
  const n = narrow.value
  return (zx) => {
    const band = { high: alpha(zx.ink, 0.14), mid: alpha(zx.ink, 0.06), low: 'transparent' }
    return {
      grid: { left: 4, right: 8, top: 12, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis', formatter: (ps) => { const r = rows[ps[0].dataIndex]; return tipBox(r.date, [`卖压相对强度 ${num(r.sp, 1)}%`, `卖压状态 ${STATE_ZH[r.ps] ?? '未知'}`]) } },
      xAxis: xAxisDates(rows.map((r) => r.date), zx),
      yAxis: { type: 'value', min: 0, max: 100, interval: n ? 50 : 25, axisLabel: { formatter: '{value}' } },
      series: [
        { type: 'bar', silent: true, barWidth: '100%', barGap: '-100%', z: 0, data: rows.map((r) => ({ value: 100, itemStyle: { color: band[r.ps] } })), tooltip: { show: false } },
        {
          type: 'line', z: 3, symbol: 'circle', symbolSize: 3, lineStyle: { width: 1.4, color: zx.star }, itemStyle: { color: zx.star }, data: rows.map((r) => r.sp),
          markLine: { silent: true, symbol: 'none', lineStyle: { color: zx.lineStrong, type: [3, 3] }, label: { color: zx.ink3, fontSize: 11, position: 'insideEndTop', formatter: '{c}' }, data: [{ yAxis: 30 }, { yAxis: 70 }] },
        },
      ],
    }
  }
})

const C_rows = C.rows.map(([date, comp, pos, ey, by]) => ({ date, comp, pos, ey, by }))
const cl = C_rows[C_rows.length - 1]
const erpKpis = [
  { label: '股权风险补偿', value: num(cl.comp, 2), unit: '%' },
  { label: '补偿历史位置', value: String(cl.pos), unit: '%' },
  { label: '盈利收益率', value: num(cl.ey, 2), unit: '%' },
  { label: '国债收益率', value: num(cl.by, 3), unit: '%' },
]
const erpOption = computed(() => {
  const n = narrow.value
  return (zx) => ({
    grid: { left: 4, right: 4, top: 36, bottom: 4, containLabel: true },
    legend: { top: 0, left: 0, data: ['股权风险补偿', '补偿历史位置'] },
    tooltip: { trigger: 'axis', formatter: (ps) => { const r = C_rows[ps[0].dataIndex]; return tipBox(r.date, [`股权风险补偿 ${num(r.comp, 2)}%`, `补偿历史位置 ${r.pos}%`, `盈利收益率 ${num(r.ey, 2)}%`, `国债收益率 ${num(r.by, 3)}%`]) } },
    xAxis: xAxisDates(C_rows.map((r) => r.date), zx),
    yAxis: [
      { type: 'value', name: n ? '' : '%', min: 4.8, max: 6.4, interval: 0.4, axisLabel: { formatter: (v) => v.toFixed(1) } },
      { type: 'value', name: n ? '' : '位置 %', min: 0, max: 100, interval: 25, splitLine: { show: false } },
    ],
    series: [
      { name: '补偿历史位置', type: 'line', yAxisIndex: 1, symbol: 'none', z: 1, lineStyle: { width: 1, color: alpha(zx.ink3, 0.8) }, itemStyle: { color: zx.ink3 }, areaStyle: { color: alpha(zx.ink3, 0.12) }, data: C_rows.map((r) => r.pos) },
      { name: '股权风险补偿', type: 'line', yAxisIndex: 0, symbol: 'none', z: 3, lineStyle: { width: 1.6, color: zx.star }, itemStyle: { color: zx.star }, data: C_rows.map((r) => r.comp) },
    ],
  })
})

const INST = { HS300: '沪深300', SSE50: '上证50', CSI500: '中证500', CSI1000: '中证1000', STAR50: '科创50' }
const COLS = [['basis_zscore_60d', '基差'], ['pcr_zscore_60d', '认沽认购比'], ['oi_volume_ratio_zscore_60d', '成交持仓比']]
const derivOption = computed(() => {
  const n = narrow.value
  return (zx) => {
    const ys = [...D.rows].reverse()
    const data = [], nulls = []
    ys.forEach((r, yi) => COLS.forEach(([k], xi) => {
      const v = r[k]
      const proxy = r.instrument === 'STAR50' && k === 'basis_zscore_60d'
      if (v == null) nulls.push([xi, yi, 0])
      else data.push({ value: [xi, yi, +v.toFixed(2)], proxy, label: { color: Math.abs(v) >= 2 ? zx.surface : zx.ink } })
    }))
    return {
      grid: { left: 4, right: 4, top: 8, bottom: 52, containLabel: true },
      tooltip: { formatter: (p) => p.seriesIndex === 1 ? `<b>${INST[ys[p.value[1]].instrument]} · ${COLS[p.value[0]][1]}</b><br/>无数据` : `<b>${INST[ys[p.value[1]].instrument]} · ${COLS[p.value[0]][1]}</b><br/>60 日标准分 ${signed(p.value[2], 2)}${p.data.proxy ? '（代理值）' : ''}` },
      xAxis: { type: 'category', data: COLS.map((c) => c[1]), position: 'top', axisLine: { show: false }, axisLabel: { color: zx.ink2, fontSize: 12 }, splitArea: { show: false } },
      yAxis: { type: 'category', data: ys.map((r) => INST[r.instrument]), axisLine: { show: false }, axisLabel: { color: zx.ink2, fontSize: 12 } },
      visualMap: { type: 'continuous', seriesIndex: 0, min: -3.5, max: 3.5, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 10, itemHeight: n ? 140 : 200, text: ['+3.5', '−3.5'], textGap: 8, inRange: { color: [zx.viz3, zx.surface2, zx.warn] } },
      series: [
        {
          type: 'heatmap', data, itemStyle: { borderColor: zx.surface, borderWidth: 3, borderRadius: 4 },
          label: { show: true, fontSize: n ? 12 : 13, formatter: (p) => signed(p.value[2], 2) + (p.data.proxy ? '*' : ''), color: zx.ink, rich: {} },
          emphasis: { itemStyle: { borderColor: zx.ink, borderWidth: 1 } },
        },
        { type: 'heatmap', data: nulls, itemStyle: { color: zx.surface, borderColor: zx.lineStrong, borderWidth: 1, borderType: 'dashed', borderRadius: 4 }, label: { show: true, formatter: '无数据', color: zx.ink3, fontSize: 12 } },
      ],
    }
  }
})

const STYLE_ZH = { chinext: '科技成长 · 创业板指', dividend: '红利 · 中证红利', sse50: '大盘蓝筹 · 上证50' }
const styleKpis = S.rows.map((r) => ({ label: STYLE_ZH[r.key], value: String(r.strength), unit: `分 · 标准分 ${signed(r.z_score, 2)}` }))
const seq = Array.from({ length: 60 }, (_, i) => String(i - 59))
const styleOption = computed(() => {
  const n = narrow.value
  return (zx) => {
    const colors = [zx.star, zx.viz3, zx.viz4]
    return {
      color: colors,
      grid: { left: 4, right: n ? 8 : 16, top: 36, bottom: 4, containLabel: true },
      legend: { top: 0, left: 0, data: S.rows.map((r) => STYLE_ZH[r.key]) },
      tooltip: { trigger: 'axis', formatter: (ps) => tipBox(`观测序号 ${ps[0].name}${ps[0].name === '0' ? '（11-17）' : ps[0].name === '-9' ? '（11-04）' : ''}`, ps.map((p) => `${p.marker}${p.seriesName} ${num(p.value, 1)} 分`)) },
      xAxis: { type: 'category', data: seq, name: n ? '' : '观测序号', nameLocation: 'end', axisLabel: { interval: n ? 19 : 9, formatter: (v) => (v === '0' ? '0' : v.replace('-', '−')) } },
      yAxis: { type: 'value', min: 0, max: 100, interval: 25 },
      series: S.rows.map((r, i) => ({ name: STYLE_ZH[r.key], type: 'line', symbol: 'none', lineStyle: { width: i === 0 ? 1.6 : 1.3, color: colors[i] }, data: r.series })),
    }
  }
})
</script>

<style scoped>
.page { max-width: 1320px; margin: 0 auto; padding: var(--s-6) var(--s-7) var(--s-6); }
.grid { margin-top: var(--s-5); display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-4); }
.grid > :deep(.wide) { grid-column: 1 / -1; }
.legend-sw { display: inline-flex; align-items: center; gap: 4px; margin-right: var(--s-3); color: var(--c-ink-2); }
.sw { display: inline-block; width: 12px; height: 10px; border-radius: 2px; border: 1px solid var(--c-line); }
.s-high { background: color-mix(in srgb, var(--c-ink) 14%, transparent); }
.s-mid { background: color-mix(in srgb, var(--c-ink) 6%, transparent); }
.s-low { background: transparent; }
@media (min-width: 1680px) { .page, :global(.foot) { max-width: 1560px; } }
@media (max-width: 1180px) { .grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 1023px) { .page { padding: var(--s-5); } }
@media (max-width: 640px) { .page { padding: var(--s-4) var(--s-4) var(--s-5); } }
</style>
