<template>
  <div class="page">
    <PageHead
      title="行业比较与轮动"
      lede="一级行业相对大盘的强度和动量、成交与涨跌的分布、资金净流入、成分股扩散度，以及全行业明细。只做统计，不分组、不打分。"
      :meta="[{ k: '数据日期', v: F.trade_date }, { k: '一级行业', v: String(items.length) }, { k: '全部板块', v: String(F.total_rows_all_levels) }]"
    />

    <div class="levelbar">
      <div class="seg" role="group" aria-label="行业层级">
        <button v-for="l in LEVELS" :id="'level-' + l.v" :key="l.v" type="button" :aria-pressed="level === l.v" :class="{ on: level === l.v }" @click="setLevel(l.v)">{{ l.label }}</button>
      </div>
      <p class="caliber"><span class="badge sample">示例口径说明</span>该日对外数据的「行业层级」字段全部为空。本页按东方财富一级行业名称对照，识别出 31 个一级行业；层级字段上线后改为按字段筛选。二级、三级暂时无法可靠区分。</p>
    </div>

    <div class="grid">
      <!-- 1 相对旋转图 -->
      <Module id="m-rrg" wide title="各行业相对大盘的强度和动量在哪个象限，近 5 日往哪边转？" :unit="`横轴 相对强度 · 纵轴 相对动能（×10⁻³，0 为基准）· ${F.trade_date}`" :state="st" v-bind="levelCopy"
        spec="相对强度、相对动能（RRG 坐标，按返回值以 0 为分界）· 轨迹：成交额前 8 个行业近 5 个交易日（11-11 至 11-17）· 数据日期 2026-11-17 · 来源：行业复盘（东方财富行业板块）">
        <template #kpi>
          <ul class="quad-legend" aria-label="象限计数">
            <li v-for="q in QUADS" :key="q.k"><i class="qdot" :style="{ background: `var(--c-${q.token})` }" />{{ q.label }}<small>{{ q.hint }}</small><b class="tnum">{{ quadCount[q.k] }}</b></li>
          </ul>
        </template>
        <EChart :option="rrgOption" :height="narrow ? 380 : 480" label="一级行业相对旋转图：横轴相对强度，纵轴相对动能，四个象限为领先、转弱、落后、改善；成交额前八的行业带近五日轨迹" />
        <template #note>象限名只描述坐标位置：领先 = 强度和动能都在基准之上；转弱 = 强度在上、动能在下；落后 = 都在下；改善 = 强度在下、动能在上。颜色只按象限区分，不代表好坏。点越大成交额占比越高；只标注成交额前 {{ narrow ? 5 : 8 }} 的行业名称，其余悬停可看。</template>
      </Module>

      <!-- 2 涨跌与成交地图 -->
      <Module id="m-map" wide title="成交集中在哪些行业，这些行业今天涨还是跌？" :unit="`面积 成交额占比 · 颜色 当日涨跌幅 · ${F.trade_date}`" :state="st" v-bind="levelCopy"
        spec="成交额（面积，按 31 个一级行业合计换算成占比）、当日涨跌幅（颜色，红涨绿跌，±4% 封顶）· 数据日期 2026-11-17 · 来源：行业复盘（东方财富行业板块）">
        <EChart :option="mapOption" :height="narrow ? 420 : 400" label="一级行业成交与涨跌地图：方块面积为成交额占比，颜色为当日涨跌幅，红为上涨、绿为下跌" />
        <template #note>
          <span class="ramp" aria-hidden="true"><i class="r-down" /><i class="r-mid" /><i class="r-up" /></span><span class="tnum">−4% · 0 · +4%</span>
          　成交额字段标称「亿元」，但 31 个一级行业合计约 14.7 万，接近当日全市场成交额 1.47 万亿元的 10 倍，单位待数据方核实，所以这里只用占比，不写绝对金额。
        </template>
      </Module>

      <!-- 3 资金净流入 -->
      <Module id="m-flow" title="哪些行业资金净流入，哪些净流出？" :unit="`单位 亿元 · 净流入前 10 / 后 10 · ${F.trade_date}`" :state="st" v-bind="levelCopy"
        :spec="`${FLOWS.find((f) => f.k === flowKey).name}（亿元，正为净流入、负为净流出；订单流覆盖样本代理，不代表机构账户）· 数据日期 2026-11-17 · 来源：行业复盘（东方财富行业板块）`">
        <template #tools>
          <div class="seg sm" role="group" aria-label="资金净流入窗口">
            <button v-for="f in FLOWS" :id="'flow-' + f.k" :key="f.k" type="button" :aria-pressed="flowKey === f.k" :class="{ on: flowKey === f.k }" @click="flowKey = f.k">{{ f.label }}</button>
          </div>
        </template>
        <EChart :option="flowOption" :height="600" :label="`一级行业${FLOWS.find((f) => f.k === flowKey).name}前十与后十的发散条形图，流入为红，流出为绿`" />
        <template #note>{{ flowNote }}</template>
      </Module>

      <!-- 4 扩散度 -->
      <Module id="m-diff" title="行业里有多少成分股站上 20 日线、创 20 日新高？" :unit="`单位 % 成分股占比 · 按站上 20 日线排序 · ${F.trade_date}`" :state="st" v-bind="levelCopy"
        spec="站上二十日均线占比、二十日新高占比（成分股只数占比）；方向指标见悬停 · 数据日期 2026-11-17 · 来源：行业复盘（东方财富行业板块）">
        <template #kpi>
          <ul class="dot-legend"><li><i class="d d-ma" />站上 20 日线</li><li><i class="d d-nh" />创 20 日新高</li></ul>
        </template>
        <EChart :option="diffOption" :height="600" label="一级行业扩散度点图：每行两个点，分别为站上二十日均线占比和二十日新高占比，按站上二十日均线占比从高到低排列" />
      </Module>

      <!-- 5 全行业表 -->
      <Module id="m-table" wide title="查任意一个一级行业" :unit="`金额 亿元 · 比例 % · 数据日期 ${F.trade_date}`" :state="st" v-bind="levelCopy"
        spec="行业复盘的当日事实字段；「近 10 日」为当日涨跌幅连乘的累计走势（11-04 至 11-17），只取了成交额前 8 个行业的序列 · 数据日期 2026-11-17 · 来源：行业复盘（东方财富行业板块）">
        <template #tools>
          <label class="search"><span class="sr-only">筛选行业名称</span><input id="industry-filter" v-model.trim="q" type="search" placeholder="筛选行业名称" autocomplete="off" /></label>
        </template>
        <StatePanel v-if="!rows.length" kind="empty" compact title="没有匹配的行业" desc="换一个关键词，或清空筛选。"><button class="btn sm" type="button" @click="q = ''">清除筛选</button></StatePanel>
        <div v-else class="tbl-wrap" tabindex="0" role="region" aria-label="一级行业明细表，可在框内滚动">
          <table>
            <caption class="sr-only">一级行业明细，{{ rows.length }} 行，按{{ sortCol.label }}{{ sortDir < 0 ? '降序' : '升序' }}排列</caption>
            <thead>
              <tr>
                <th v-for="c in COLS" :key="c.key" scope="col" :class="[c.align || 'r', { first: c.key === 'industry_name' }]" :aria-sort="c.sortable === false ? undefined : sortKey === c.key ? (sortDir < 0 ? 'descending' : 'ascending') : 'none'">
                  <span v-if="c.sortable === false" class="th-plain">{{ c.label }}</span>
                  <button v-else :id="'sort-' + c.key" type="button" class="th-btn" @click="sortBy(c.key)">
                    <span>{{ c.label }}<small v-if="c.unit">{{ c.unit }}</small></span>
                    <svg width="8" height="10" viewBox="0 0 8 10" aria-hidden="true" :class="{ on: sortKey === c.key, desc: sortDir < 0 }"><path d="M4 1 L7 4 H1 Z" class="u" /><path d="M4 9 L1 6 H7 Z" class="d" /></svg>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.industry_code">
                <th scope="row" class="first name">{{ r.industry_name }}</th>
                <td class="spark-td">
                  <template v-if="sparks[r.industry_code]">
                    <svg width="76" height="22" viewBox="0 0 76 22" aria-hidden="true" class="spark"><polyline :points="sparks[r.industry_code].pts" /><circle :cx="sparks[r.industry_code].ex" :cy="sparks[r.industry_code].ey" r="2.2" :class="sparks[r.industry_code].cum >= 0 ? 'up-f' : 'down-f'" /></svg>
                    <span class="sr-only">近 10 日累计 {{ pct(sparks[r.industry_code].cum) }}</span>
                  </template>
                  <span v-else class="na" title="样张只取了成交额前 8 个行业的序列">—<span class="sr-only">未取序列</span></span>
                </td>
                <td v-for="c in COLS.slice(2)" :key="c.key" class="r tnum" :class="c.tone ? toneOf(r[c.key]) : ''">{{ c.fmt(r[c.key]) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Module>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import Module from '../components/Module.vue'
import EChart from '../components/EChart.vue'
import StatePanel from '../components/StatePanel.vue'
import { usePreviewState } from '../lib/state.js'
import { narrow, num, signed, pct, ratioPct, alpha, mix } from '../lib/fmt.js'
import F from '@data/industry-facts-l1.json'
import SER from '@data/industry-series-top8.json'

const route = useRoute(), router = useRouter()
const previewState = usePreviewState()
const LEVELS = [{ v: '1', label: '一级' }, { v: '2', label: '二级' }, { v: '3', label: '三级' }, { v: 'all', label: '全部' }]
const level = computed(() => (LEVELS.some((l) => l.v === route.query.level) ? route.query.level : '1'))
function setLevel(v) { const qy = { ...route.query }; if (v === '1') delete qy.level; else qy.level = v; router.replace({ query: qy }) }
// 层级字段为空时，二级、三级、全部都不能可靠给出：整页模块换成空态并说明原因，不拿一级冒充
const st = computed(() => previewState.value || (level.value === '1' ? '' : 'empty'))
const levelCopy = computed(() => (!previewState.value && level.value !== '1'
  ? { stateTitle: level.value === 'all' ? '「全部」暂不提供' : `${LEVELS.find((l) => l.v === level.value).label}行业暂时分不出来`, stateDesc: '该日对外数据的行业层级字段为空，二级、三级行业无法可靠区分；混在一起展示会把同一批成分股重复计算。层级字段上线后这里自动有数。' }
  : {}))

const items = F.rows
const totalAmt = items.reduce((s, r) => s + r.amount, 0)
const share = (r) => r.amount / totalAmt
const byAmt = [...items].sort((a, b) => b.amount - a.amount)

// —— 相对旋转图 ——
const QUADS = [
  { k: 'lead', label: '领先', hint: '强度↑ 动能↑', token: 'viz-3' },
  { k: 'weak', label: '转弱', hint: '强度↑ 动能↓', token: 'viz-4' },
  { k: 'lag', label: '落后', hint: '强度↓ 动能↓', token: 'viz-5' },
  { k: 'impr', label: '改善', hint: '强度↓ 动能↑', token: 'viz-1' },
]
const quadOf = (x, y) => (x >= 0 ? (y >= 0 ? 'lead' : 'weak') : y >= 0 ? 'impr' : 'lag')
const quadCount = computed(() => Object.fromEntries(QUADS.map((q) => [q.k, items.filter((r) => quadOf(r.rs_ratio, r.rs_momentum) === q.k).length])))
const K = 1000
const rrgOption = computed(() => {
  const n = narrow.value, topN = new Set(byAmt.slice(0, n ? 5 : 8).map((r) => r.industry_code))
  return (zx) => {
    const qc = { lead: zx.viz3, weak: zx.viz4, lag: zx.viz5, impr: zx.viz1 }
    const trails = Object.entries(SER.series).map(([code, s]) => ({ code, name: s.industry_name, pts: s.points.slice(-5).map((p) => [p.rs_ratio * K, p.rs_momentum * K, p.trade_date]) }))
    const all = [...items.map((r) => [r.rs_ratio * K, r.rs_momentum * K]), ...trails.flatMap((t) => t.pts)]
    // 轴范围取对称且为偶数，刻度落在整数上
    const even = (v) => Math.ceil(v / 2) * 2
    const mx = even(Math.max(...all.map((p) => Math.abs(p[0]))) * 1.1), my = even(Math.max(...all.map((p) => Math.abs(p[1]))) * 1.15)
    const corner = (x0, y0, x1, y1, q, pos) => [{ coord: [x0, y0], name: QUADS.find((v) => v.k === q).label, itemStyle: { color: alpha(qc[q], 0.1) }, label: { position: pos, color: qc[q], fontSize: 12, fontWeight: 600 } }, { coord: [x1, y1] }]
    return {
      grid: { left: 4, right: n ? 8 : 16, top: 12, bottom: 4, containLabel: true },
      tooltip: { trigger: 'item', formatter: (p) => p.seriesType === 'scatter'
        ? `<b>${p.data.name}</b> · ${QUADS.find((v) => v.k === p.data.q).label}<br/>相对强度 ${signed(p.value[0], 2)} ×10⁻³<br/>相对动能 ${signed(p.value[1], 2)} ×10⁻³<br/>成交额占比 ${ratioPct(p.data.share)}`
        : `<b>${p.seriesName}</b> · ${p.data[2]}<br/>相对强度 ${signed(p.data[0], 2)} · 相对动能 ${signed(p.data[1], 2)}` },
      xAxis: { type: 'value', min: -mx, max: mx, interval: mx / 2, axisLabel: { formatter: (v) => signed(v, 0) }, splitLine: { show: false } },
      yAxis: { type: 'value', min: -my, max: my, interval: my / 2, axisLabel: { formatter: (v) => signed(v, 0) }, splitLine: { show: false } },
      series: [
        ...trails.map((t) => {
          const last = t.pts[t.pts.length - 1], col = qc[quadOf(last[0], last[1])]
          return { name: t.name, type: 'line', z: 2, data: t.pts, symbol: 'circle', symbolSize: (v, p) => (p.dataIndex === t.pts.length - 1 ? 0 : 3), lineStyle: { color: col, width: 1, opacity: 0.75 }, itemStyle: { color: col, opacity: 0.75 }, emphasis: { focus: 'series' } }
        }),
        {
          type: 'scatter', z: 4,
          data: items.map((r) => {
            const x = r.rs_ratio * K, y = r.rs_momentum * K, qq = quadOf(x, y)
            return { name: r.industry_name, value: [x, y], q: qq, share: share(r), symbolSize: 6 + Math.sqrt(share(r)) * 30, itemStyle: { color: qc[qq], borderColor: zx.surface, borderWidth: 1 }, label: { show: topN.has(r.industry_code) } }
          }),
          label: { position: 'right', color: zx.ink, fontSize: 12, formatter: '{b}', distance: 4 },
          labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
          emphasis: { scale: 1.25, label: { show: true } },
          markLine: { silent: true, symbol: 'none', lineStyle: { color: zx.lineStrong, type: 'solid', width: 1 }, label: { show: false }, data: [{ xAxis: 0 }, { yAxis: 0 }] },
          markArea: { silent: true, data: [corner(0, my, mx, 0, 'lead', 'insideTopRight'), corner(0, 0, mx, -my, 'weak', 'insideBottomRight'), corner(-mx, 0, 0, -my, 'lag', 'insideBottomLeft'), corner(-mx, my, 0, 0, 'impr', 'insideTopLeft')] },
        },
      ],
    }
  }
})

// —— 成交与涨跌地图 ——
const CAP = 0.04
const mapOption = computed(() => {
  const n = narrow.value
  return (zx) => ({
    tooltip: { formatter: (p) => `<b>${p.name}</b><br/>当日涨跌幅 ${pct(p.data.ret)}<br/>成交额占比 ${ratioPct(p.data.share)}` },
    series: [{
      type: 'treemap', roam: false, nodeClick: false, breadcrumb: { show: false }, left: 0, right: 0, top: 0, bottom: 0, squareRatio: n ? 0.9 : 1.4,
      itemStyle: { borderColor: zx.surface, borderWidth: 2, gapWidth: 2, borderRadius: 3 },
      label: { show: true, formatter: (p) => `${p.name}\n${pct(p.data.ret)}`, fontSize: 12, lineHeight: 16, overflow: 'truncate' },
      upperLabel: { show: false },
      data: byAmt.map((r) => {
        const t = Math.min(Math.abs(r.sector_return) / CAP, 1) * 0.9
        const col = mix(zx.surface2, r.sector_return >= 0 ? zx.up : zx.down, t)
        return { name: r.industry_name, value: r.amount, ret: r.sector_return, share: share(r), itemStyle: { color: col }, label: { color: t > 0.5 ? zx.surface : zx.ink } }
      }),
    }],
  })
})

// —— 资金净流入 ——
const FLOWS = [{ k: 'net_flow_1d', label: '1 日', name: '一日资金净流入' }, { k: 'net_flow_5d', label: '5 日', name: '五日资金净流入' }, { k: 'net_flow_20d', label: '20 日', name: '二十日资金净流入' }]
const flowKey = ref('net_flow_1d')
const flowSorted = computed(() => [...items].sort((a, b) => b[flowKey.value] - a[flowKey.value]))
const flowNote = computed(() => {
  const k = flowKey.value, pos = items.filter((r) => r[k] > 0).length
  return `31 个一级行业中，${FLOWS.find((f) => f.k === k).name}为正的有 ${pos} 个，为负的有 ${items.length - pos} 个。前 10 / 后 10 按数值排序，中间 11 个在明细表里查。`
})
const flowOption = computed(() => {
  const k = flowKey.value, s = flowSorted.value, pick = [...s.slice(0, 10), ...s.slice(-10)]
  return (zx) => ({
    grid: { left: 4, right: 12, top: 4, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: alpha(zx.ink, 0.05) } }, formatter: (ps) => `<b>${ps[0].name}</b><br/>${FLOWS.find((f) => f.k === k).name} ${signed(ps[0].value, 2)} 亿元` },
    xAxis: { type: 'value', splitNumber: 3, axisLabel: { formatter: (v) => signed(v, 0) } },
    yAxis: { type: 'category', inverse: true, data: pick.map((r) => r.industry_name), axisLabel: { color: zx.ink2, fontSize: 12 }, axisLine: { show: false } },
    series: [{
      type: 'bar', barWidth: 10,
      data: pick.map((r) => ({ value: +r[k].toFixed(2), itemStyle: { color: r[k] >= 0 ? zx.up : zx.down }, label: { position: r[k] >= 0 ? 'right' : 'left' } })),
      label: { show: true, color: zx.ink3, fontSize: 11, formatter: (p) => signed(p.value, 1) },
      markLine: { silent: true, symbol: 'none', lineStyle: { color: zx.lineStrong, type: 'solid' }, label: { show: false }, data: [{ xAxis: 0 }] },
    }],
  })
})

// —— 扩散度（点图） ——
const diffRows = [...items].sort((a, b) => b.above_ma20_ratio - a.above_ma20_ratio)
const diffOption = computed(() => (zx) => ({
  grid: { left: 4, right: 16, top: 4, bottom: 4, containLabel: true },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: alpha(zx.ink, 0.05) } }, formatter: (ps) => { const r = diffRows[ps[0].dataIndex]; return `<b>${r.industry_name}</b>（成分股 ${r.member_count} 只）<br/>站上 20 日线 ${ratioPct(r.above_ma20_ratio)}<br/>创 20 日新高 ${ratioPct(r.new_high_20d_ratio)}<br/>方向指标 ${num(r.di, 2)}` } },
  xAxis: { type: 'value', min: 0, max: 100, interval: 25, axisLabel: { formatter: '{value}%' } },
  yAxis: { type: 'category', inverse: true, data: diffRows.map((r) => r.industry_name), axisLabel: { color: zx.ink2, fontSize: 12 }, axisLine: { show: false } },
  series: [
    {
      type: 'custom', silent: true, z: 1,
      renderItem: (params, api) => {
        const a = api.coord([api.value(0), api.value(2)]), b = api.coord([api.value(1), api.value(2)])
        return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: zx.lineStrong, lineWidth: 2 } }
      },
      encode: { x: [0, 1], y: 2 },
      data: diffRows.map((r, i) => [r.new_high_20d_ratio * 100, r.above_ma20_ratio * 100, i]),
    },
    { name: '站上 20 日线', type: 'scatter', z: 3, symbolSize: 9, itemStyle: { color: zx.viz3 }, data: diffRows.map((r, i) => [r.above_ma20_ratio * 100, i]) },
    { name: '创 20 日新高', type: 'scatter', z: 3, symbolSize: 9, itemStyle: { color: zx.surface, borderColor: zx.viz4, borderWidth: 2 }, data: diffRows.map((r, i) => [r.new_high_20d_ratio * 100, i]) },
  ],
}))

// —— 明细表 ——
const sparks = Object.fromEntries(Object.entries(SER.series).map(([code, s]) => {
  let c = 1
  const cum = s.points.map((p) => (c *= 1 + p.sector_return) - 1)
  const lo = Math.min(...cum, 0), hi = Math.max(...cum, 0), sx = 72 / (cum.length - 1), sy = (v) => 19 - ((v - lo) / (hi - lo || 1)) * 16
  const pts = cum.map((v, i) => `${(2 + i * sx).toFixed(1)},${sy(v).toFixed(1)}`).join(' ')
  return [code, { pts, ex: 2 + (cum.length - 1) * sx, ey: sy(cum[cum.length - 1]), cum: cum[cum.length - 1] }]
}))
const amtShare = (v) => (v == null ? '—' : ((v / totalAmt) * 100).toFixed(1))
const COLS = [
  { key: 'industry_name', label: '行业', align: 'l' },
  { key: 'spark', label: '近 10 日', sortable: false, align: 'l' },
  { key: 'sector_return', label: '涨跌幅', unit: '%', fmt: (v) => pct(v).replace('%', ''), tone: true },
  { key: 'sector_return_5d', label: '5 日涨跌幅', unit: '%', fmt: (v) => pct(v).replace('%', ''), tone: true },
  { key: 'amount', label: '成交额占比', unit: '%', fmt: amtShare },
  { key: 'net_flow_1d', label: '1 日净流入', unit: '亿元', fmt: (v) => signed(v, 2), tone: true },
  { key: 'net_flow_5d', label: '5 日净流入', unit: '亿元', fmt: (v) => signed(v, 1), tone: true },
  { key: 'net_flow_20d', label: '20 日净流入', unit: '亿元', fmt: (v) => signed(v, 1), tone: true },
  { key: 'above_ma20_ratio', label: '站上 20 日线', unit: '%', fmt: (v) => ratioPct(v).replace('%', '') },
  { key: 'new_high_20d_ratio', label: '20 日新高', unit: '%', fmt: (v) => ratioPct(v).replace('%', '') },
  { key: 'di', label: '方向指标', fmt: (v) => num(v, 2) },
  { key: 'member_count', label: '成分股', unit: '只', fmt: (v) => String(v) },
]
const toneOf = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : '')
const q = ref('')
const sortKey = ref('amount'), sortDir = ref(-1)
const sortCol = computed(() => COLS.find((c) => c.key === sortKey.value))
function sortBy(k) { if (sortKey.value === k) sortDir.value *= -1; else { sortKey.value = k; sortDir.value = k === 'industry_name' ? 1 : -1 } }
const rows = computed(() => {
  const k = sortKey.value, d = sortDir.value
  const list = items.filter((r) => !q.value || r.industry_name.includes(q.value))
  return [...list].sort((a, b) => (k === 'industry_name' ? a[k].localeCompare(b[k], 'zh') : (a[k] ?? -Infinity) - (b[k] ?? -Infinity)) * d)
})
</script>

<style scoped>
.page { max-width: 1320px; margin: 0 auto; padding: var(--s-6) var(--s-7) var(--s-6); }
.levelbar { margin-top: var(--s-4); display: flex; align-items: flex-start; gap: var(--s-4); flex-wrap: wrap; }
.caliber { flex: 1; min-width: 260px; display: flex; gap: var(--s-2); align-items: baseline; flex-wrap: wrap; font-size: var(--fs-xs); color: var(--c-ink-2); line-height: 1.7; }
.seg { display: inline-flex; padding: 3px; border: 1px solid var(--c-line); border-radius: var(--r-2); background: var(--c-surface); flex: none; }
.seg button { min-width: 44px; height: 30px; padding: 0 var(--s-3); border-radius: 6px; font-size: var(--fs-sm); color: var(--c-ink-2); transition: background-color var(--dur-2), color var(--dur-2); }
.seg button:hover { color: var(--c-ink); }
.seg button.on { background: var(--c-surface-2); color: var(--c-ink); box-shadow: inset 0 -1px 0 var(--c-accent); font-weight: 500; }
.seg.sm button { height: 26px; min-width: 40px; font-size: var(--fs-xs); }
.grid { margin-top: var(--s-4); display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-4); }
.grid > :deep(.wide) { grid-column: 1 / -1; }
.quad-legend, .dot-legend { display: flex; flex-wrap: wrap; gap: var(--s-2) var(--s-5); font-size: var(--fs-xs); color: var(--c-ink-2); }
.quad-legend li, .dot-legend li { display: inline-flex; align-items: center; gap: 6px; }
.quad-legend small { color: var(--c-ink-3); font-size: var(--fs-2xs); }
.quad-legend b { font-weight: 600; color: var(--c-ink); font-size: var(--fs-sm); }
.qdot { width: 9px; height: 9px; border-radius: 50%; }
.d { width: 9px; height: 9px; border-radius: 50%; }
.d-ma { background: var(--c-viz-3); }
.d-nh { border: 2px solid var(--c-viz-4); background: var(--c-surface); }
.ramp { display: inline-flex; vertical-align: middle; margin-right: var(--s-2); }
.ramp i { width: 28px; height: 8px; }
.r-down { background: linear-gradient(90deg, var(--c-down), var(--c-surface-2)); border-radius: 2px 0 0 2px; }
.r-mid { background: var(--c-surface-2); width: 6px !important; }
.r-up { background: linear-gradient(90deg, var(--c-surface-2), var(--c-up)); border-radius: 0 2px 2px 0; }
.search input { height: 32px; width: 180px; padding: 0 var(--s-3); border-radius: var(--r-2); border: 1px solid var(--c-line-strong); background: var(--c-surface); color: var(--c-ink); font: inherit; font-size: var(--fs-sm); }
.search input::placeholder { color: var(--c-ink-3); }
.tbl-wrap { position: relative; max-height: 520px; overflow: auto; border: 1px solid var(--c-line); border-radius: var(--r-2); overscroll-behavior: contain; }
table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: var(--fs-sm); }
thead th { position: sticky; top: 0; z-index: 2; background: var(--c-surface-2); border-bottom: 1px solid var(--c-line-strong); font-weight: 500; white-space: nowrap; padding: 0; }
.th-btn, .th-plain { width: 100%; display: flex; align-items: center; justify-content: flex-end; gap: 4px; height: 40px; padding: 0 10px; color: var(--c-ink-2); font-size: var(--fs-xs); }
.th-btn:hover { color: var(--c-ink); }
th.l .th-btn, th.l .th-plain { justify-content: flex-start; }
.th-btn small { margin-left: 2px; color: var(--c-ink-3); font-size: 10px; }
.th-btn svg path { fill: var(--c-line-strong); }
.th-btn svg.on:not(.desc) .u, .th-btn svg.on.desc .d { fill: var(--c-accent); }
[aria-sort="ascending"] .th-btn, [aria-sort="descending"] .th-btn { color: var(--c-ink); }
tbody td, tbody th { height: 38px; padding: 0 10px; border-bottom: 1px solid var(--c-line); white-space: nowrap; color: var(--c-ink-2); background: var(--c-surface); }
tbody tr:hover td, tbody tr:hover th { background: var(--c-surface-hover); }
td.r { text-align: right; }
td.up { color: var(--c-up); }
td.down { color: var(--c-down); }
.first { position: sticky; left: 0; z-index: 1; text-align: left; }
thead .first { z-index: 3; }
.name { color: var(--c-ink); font-weight: 500; }
.spark polyline { fill: none; stroke: var(--c-ink-2); stroke-width: 1.2; stroke-linejoin: round; }
.up-f { fill: var(--c-up); }
.down-f { fill: var(--c-down); }
.na { color: var(--c-ink-3); }
@media (min-width: 1680px) { .page { max-width: 1560px; } }
@media (max-width: 1180px) { .grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 1023px) { .page { padding: var(--s-5); } }
@media (max-width: 640px) {
  .page { padding: var(--s-4) var(--s-4) var(--s-5); }
  .search, .search input { width: 100%; }
  .seg { width: 100%; } .seg button { flex: 1; }
}
</style>
