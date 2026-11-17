<template>
  <div class="page">
    <header class="head">
      <div>
        <p class="eyebrow">明细 · 要点的下钻层</p>
        <h1 class="display">行业比较与轮动</h1>
      </div>
      <dl class="facts-meta tnum">
        <div><dt>数据日期</dt><dd>{{ src.trade_date }}</dd></div>
        <div><dt>快照</dt><dd>{{ src.sources[0].snapshot_time.slice(11, 16) }}</dd></div>
        <div><dt>覆盖</dt><dd>{{ Math.round(src.sources[0].coverage_ratio * 100) }}%</dd></div>
        <div><dt>板块数</dt><dd>{{ items.length }}</dd></div>
      </dl>
    </header>
    <p class="sample-note"><span class="badge sample">示例数据</span>本页使用固定样本（{{ src.trade_date }}），只用于比较视觉方向；字段和单位与线上一致。</p>

    <div class="toolbar">
      <div class="seg" role="tablist" aria-label="板块类型">
        <button v-for="t in src.data.idx_types" :id="'idx-' + t" :key="t" role="tab" type="button" :aria-selected="idxType === t" :class="{ on: idxType === t }" @click="idxType = t">{{ t }}</button>
      </div>
      <label class="preview">
        <span>预览状态（原型）</span>
        <select id="state-preview" v-model="previewState">
          <option value="">正常</option><option value="loading">加载中</option><option value="empty">空</option>
          <option value="error">错误</option><option value="forbidden">无权限</option><option value="nodate">所选日期无数据</option>
        </select>
      </label>
    </div>

    <section v-if="showData" class="page-facts" aria-labelledby="pf-h">
      <h2 id="pf-h" class="cap">本页要点</h2>
      <ul>
        <li v-for="(f, i) in pageFacts" :key="i"><span class="badge stat">统计</span><span>{{ f }}</span></li>
      </ul>
    </section>

    <div class="charts">
      <section class="panel" aria-labelledby="rrg-h">
        <header class="ph">
          <h2 id="rrg-h">轮动位置</h2>
          <span class="unit tnum">横轴 RS 比值 · 纵轴 RS 动量 · 基准 {{ src.data.rrg_reference }} · 点大小为成交额</span>
        </header>
        <StatePanel v-if="!showData" :kind="effState" compact />
        <EChart v-else :option="rrgOption" :height="340" label="行业轮动散点图：横轴相对强弱比值，纵轴相对强弱动量" @click="onPoint" />
        <p v-if="showData" class="foot">轨迹：{{ series.data.sector_name }} 近 {{ series.data.points.length }} 个有数交易日（{{ series.gaps[0]?.reason }}）</p>
      </section>
      <section class="panel" aria-labelledby="flow-h">
        <header class="ph"><h2 id="flow-h">单日资金净流入</h2><span class="unit tnum">单位 亿元 · 前 8 / 后 8 · {{ src.trade_date }}</span></header>
        <StatePanel v-if="!showData" :kind="effState" compact />
        <EChart v-else :option="flowOption" :height="340" label="单日资金净流入前八与后八的横向条形图，流入为红，流出为绿" @click="onPoint" />
      </section>
    </div>

    <section class="panel table-panel" aria-labelledby="tbl-h">
      <header class="ph">
        <h2 id="tbl-h">板块明细</h2>
        <div class="ph-r">
          <label class="search"><span class="sr-only">筛选板块</span>
            <input id="sector-filter" v-model.trim="q" type="search" placeholder="筛选板块名称" autocomplete="off" />
          </label>
          <span class="unit tnum">金额 亿元 · 比例 % · 数据日期 {{ src.trade_date }}</span>
        </div>
      </header>
      <StatePanel v-if="effState" :kind="effState" :rows="8">
        <button v-if="effState === 'empty'" class="btn sm" type="button" @click="q = ''; previewState = ''">清除筛选</button>
        <button v-if="effState === 'error'" class="btn sm" type="button" @click="previewState = ''">重试</button>
        <button v-if="effState === 'nodate'" class="btn sm" type="button" @click="previewState = ''">选最近的交易日 {{ src.trade_date.slice(5) }}</button>
      </StatePanel>
      <div v-else class="tbl-wrap" tabindex="0" aria-label="板块明细表，可横向滚动">
        <table>
          <caption class="sr-only">{{ idxType }}明细，{{ rows.length }} 行，按{{ sortCol.label }}{{ sortDir < 0 ? '降序' : '升序' }}排列</caption>
          <thead>
            <tr>
              <th v-for="c in COLS" :key="c.key" scope="col" :class="[c.align, { first: c.key === 'sector_name' }]" :aria-sort="sortKey === c.key ? (sortDir < 0 ? 'descending' : 'ascending') : 'none'">
                <button :id="'sort-' + c.key" type="button" class="th-btn" @click="sortBy(c.key)">
                  <span>{{ c.label }}<small v-if="c.unit">{{ c.unit }}</small></span>
                  <svg width="8" height="10" viewBox="0 0 8 10" aria-hidden="true" :class="{ on: sortKey === c.key, desc: sortDir < 0 }"><path d="M4 1 L7 4 H1 Z" class="u" /><path d="M4 9 L1 6 H7 Z" class="d" /></svg>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.sector_code" :class="{ sel: sel === r.sector_name }" @click="sel = r.sector_name">
              <th scope="row" class="first"><button type="button" class="name" :aria-pressed="sel === r.sector_name" @click.stop="sel = sel === r.sector_name ? '' : r.sector_name">{{ r.sector_name }}</button></th>
              <td v-for="c in COLS.slice(1)" :key="c.key" class="r tnum" :class="c.tone ? toneOf(r[c.key]) : ''">
                <span v-if="c.key === 'net_flow_1d'" class="flow"><i :style="flowBar(r[c.key])" />{{ c.fmt(r[c.key]) }}</span>
                <template v-else>{{ c.fmt(r[c.key]) }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <footer class="disc">{{ src.disclaimer }}</footer>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import EChart from '../../components/EChart.vue'
import StatePanel from '../../components/StatePanel.vue'
import src from '@data/industries-sample.json'
import series from '@data/industry-series-sample.json'

const route = useRoute()
const idxType = ref(src.data.idx_type)
const previewState = ref(route.query.state || '')
const q = ref('')
const sel = ref(series.data.sector_name)

const pct = (v, d = 2) => (v == null ? '—' : (v > 0 ? '+' : '') + (v * 100).toFixed(d))
const ratio = (v) => (v == null ? '—' : (v * 100).toFixed(1))
const num = (d) => (v) => (v == null ? '—' : v.toFixed(d))
const signed = (v) => (v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(2))
const COLS = [
  { key: 'sector_name', label: '板块', align: 'l' },
  { key: 'sector_return', label: '涨跌幅', unit: '%', fmt: pct, tone: true },
  { key: 'sector_return_5d', label: '5 日', unit: '%', fmt: pct, tone: true },
  { key: 'sector_return_20d', label: '20 日', unit: '%', fmt: pct, tone: true },
  { key: 'amount', label: '成交额', unit: '亿元', fmt: num(1) },
  { key: 'turnover_rate', label: '换手率', unit: '%', fmt: num(2) },
  { key: 'net_flow_1d', label: '净流入', unit: '亿元', fmt: signed, tone: true },
  { key: 'net_flow_5d', label: '5 日净流入', unit: '亿元', fmt: signed, tone: true },
  { key: 'up_stock_ratio', label: '上涨占比', unit: '%', fmt: ratio },
  { key: 'above_ma20_ratio', label: '站上 20 日线', unit: '%', fmt: ratio },
  { key: 'di', label: '扩散度', fmt: num(2) },
  { key: 'rs_ratio', label: 'RS 比值', fmt: num(1) },
  { key: 'rs_momentum', label: 'RS 动量', fmt: num(1) },
]
const toneOf = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : '')

const sortKey = ref('net_flow_1d'), sortDir = ref(-1)
const sortCol = computed(() => COLS.find((c) => c.key === sortKey.value))
function sortBy(k) { if (sortKey.value === k) sortDir.value *= -1; else { sortKey.value = k; sortDir.value = k === 'sector_name' ? 1 : -1 } }

const items = computed(() => src.data.items.filter((r) => r.idx_type === idxType.value))
const rows = computed(() => {
  const k = sortKey.value, d = sortDir.value
  const list = items.value.filter((r) => !q.value || r.sector_name.includes(q.value))
  return [...list].sort((a, b) => (k === 'sector_name' ? a[k].localeCompare(b[k], 'zh') : (a[k] ?? -Infinity) - (b[k] ?? -Infinity)) * d)
})
const effState = computed(() => {
  if (previewState.value) return previewState.value
  if (!items.value.length) return 'nodate'
  if (!rows.value.length) return 'empty'
  return ''
})
const showData = computed(() => !effState.value || effState.value === 'empty')
const maxFlow = computed(() => Math.max(...items.value.map((r) => Math.abs(r.net_flow_1d || 0)), 1))
const flowBar = (v) => ({ width: (Math.abs(v) / maxFlow.value) * 40 + 'px', background: v >= 0 ? 'var(--c-up)' : 'var(--c-down)' })

const pageFacts = computed(() => {
  const s = [...items.value].sort((a, b) => b.net_flow_1d - a.net_flow_1d)
  const fmt = (r) => `${r.sector_name} ${signed(r.net_flow_1d)} 亿`
  const top = s.slice(0, 3).map(fmt).join('、'), bot = s.slice(-3).reverse().map(fmt).join('、')
  const ma = [...items.value].sort((a, b) => b.above_ma20_ratio - a.above_ma20_ratio)[0]
  return [`单日资金净流入前 3：${top}；净流出前 3：${bot}`, `成分股站上 20 日线比例最高的是「${ma.sector_name}」，为 ${ratio(ma.above_ma20_ratio)}%`]
})

function onPoint(p) { const n = p.data?.name || p.name; if (n) sel.value = n }

const rrgOption = computed(() => {
  const s = sel.value
  return (zx) => {
    const xs = items.value.map((r) => r.rs_ratio), ys = items.value.map((r) => r.rs_momentum)
    const pad = (a) => { const lo = Math.min(...a, 100), hi = Math.max(...a, 100), m = Math.ceil(Math.max(100 - lo, hi - 100) * 1.1); return [100 - m, 100 + m] }
    const [x0, x1] = pad(xs), [y0, y1] = pad(ys)
    const maxAmt = Math.max(...items.value.map((r) => r.amount))
    const q = (x, y, t) => ({ name: t, coord: [x, y] })
    return {
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: { trigger: 'item', formatter: (p) => p.seriesType === 'scatter' ? `<b>${p.data.name}</b><br/>RS 比值 ${p.data.value[0].toFixed(2)}<br/>RS 动量 ${p.data.value[1].toFixed(2)}<br/>成交额 ${p.data.amount.toFixed(1)} 亿元` : `${p.data.date}<br/>RS 比值 ${p.data.value[0].toFixed(2)} · 动量 ${p.data.value[1].toFixed(2)}` },
      xAxis: { type: 'value', min: x0, max: x1, interval: (x1 - x0) / 4 },
      yAxis: { type: 'value', min: y0, max: y1, interval: (y1 - y0) / 4 },
      series: [
        {
          type: 'scatter',
          data: items.value.map((r) => ({ name: r.sector_name, value: [r.rs_ratio, r.rs_momentum], amount: r.amount, symbolSize: 5 + Math.sqrt(r.amount / maxAmt) * 14,
            itemStyle: r.sector_name === s ? { color: zx.accent, shadowBlur: 12, shadowColor: zx.accent } : { color: zx.starDim, borderColor: zx.star, borderWidth: 0.6 },
            label: { show: r.sector_name === s, position: 'right', color: zx.ink, fontSize: 12, formatter: '{b}' } })),
          emphasis: { scale: 1.3, label: { show: true, position: 'right', color: zx.ink, formatter: '{b}' } },
          markLine: { silent: true, symbol: 'none', lineStyle: { color: zx.lineStrong, type: 'solid', width: 1 }, label: { show: false }, data: [{ xAxis: 100 }, { yAxis: 100 }] },
          markArea: { silent: true, itemStyle: { color: 'transparent' }, label: { color: zx.ink3, fontSize: 11 },
            data: [
              [{ ...q(100, y1, '比值↑ 动量↑'), label: { position: 'insideTopRight' } }, { coord: [x1, 100] }],
              [{ ...q(x0, y1, '比值↓ 动量↑'), label: { position: 'insideTopLeft' } }, { coord: [100, 100] }],
              [{ ...q(x0, 100, '比值↓ 动量↓'), label: { position: 'insideBottomLeft' } }, { coord: [100, y0] }],
              [{ ...q(100, 100, '比值↑ 动量↓'), label: { position: 'insideBottomRight' } }, { coord: [x1, y0] }],
            ] },
          z: 3,
        },
        // 星图式轨迹：所选板块的近期路径，细线连星，终点最亮
        ...(s === series.data.sector_name ? [{
          type: 'line', silent: false, z: 2,
          data: series.data.points.map((p, i, a) => ({ value: [p.rs_ratio, p.rs_momentum], date: p.trade_date, symbolSize: i === a.length - 1 ? 6 : 3 })),
          lineStyle: { color: zx.accent, width: 1, opacity: 0.7, type: [3, 3] }, itemStyle: { color: zx.accent }, symbol: 'circle',
        }] : []),
      ],
    }
  }
})

const flowOption = computed(() => {
  const s = sel.value
  return (zx) => {
    const sorted = [...items.value].sort((a, b) => b.net_flow_1d - a.net_flow_1d)
    const pick = [...sorted.slice(0, 8), ...sorted.slice(-8)].reverse()
    return {
      grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: zx.line } }, formatter: (ps) => `<b>${ps[0].name}</b><br/>单日净流入 ${signed(ps[0].value)} 亿元` },
      xAxis: { type: 'value', splitNumber: 4, axisLabel: { formatter: (v) => (v > 0 ? '+' : '') + v } },
      yAxis: { type: 'category', data: pick.map((r) => r.sector_name), axisLabel: { color: zx.ink2, fontSize: 12, formatter: (v) => (v === s ? `{sel|${v}}` : v), rich: { sel: { color: zx.accent, fontWeight: 600 } } } },
      series: [{
        type: 'bar', barWidth: 8,
        data: pick.map((r) => ({ name: r.sector_name, value: +r.net_flow_1d.toFixed(2), itemStyle: { color: r.net_flow_1d >= 0 ? zx.up : zx.down, opacity: !s || r.sector_name === s ? 1 : 0.72 } })),
        label: { show: true, position: 'right', color: zx.ink3, fontSize: 11, formatter: (p) => signed(p.value) },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: zx.lineStrong, type: 'solid' }, label: { show: false }, data: [{ xAxis: 0 }] },
      }],
    }
  }
})
</script>

<style scoped>
.page { max-width: 1320px; margin: 0 auto; padding: var(--s-6) var(--s-7) var(--s-7); }
.head { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--s-4); flex-wrap: wrap; }
.eyebrow { font-size: var(--fs-xs); letter-spacing: 0.16em; color: var(--c-accent-ink); margin-bottom: var(--s-2); }
h1 { font-size: var(--fs-2xl); line-height: 1.1; }
.facts-meta { display: flex; gap: var(--s-5); }
.facts-meta div { display: flex; flex-direction: column; gap: 2px; }
.facts-meta dt { font-size: var(--fs-2xs); color: var(--c-ink-3); letter-spacing: 0.08em; }
.facts-meta dd { margin: 0; font-size: var(--fs-md); color: var(--c-ink); font-weight: 500; }
.sample-note { margin-top: var(--s-3); display: flex; align-items: center; gap: var(--s-2); font-size: var(--fs-xs); color: var(--c-ink-3); }
.toolbar { margin-top: var(--s-5); display: flex; justify-content: space-between; align-items: center; gap: var(--s-3); flex-wrap: wrap; }
.seg { display: inline-flex; padding: 3px; border: 1px solid var(--c-line); border-radius: var(--r-2); background: var(--c-surface); }
.seg button { height: 28px; padding: 0 var(--s-3); border-radius: 6px; font-size: var(--fs-sm); color: var(--c-ink-2); transition: background-color var(--dur-2), color var(--dur-2); }
.seg button:hover { color: var(--c-ink); }
.seg button.on { background: var(--c-surface-2); color: var(--c-ink); box-shadow: inset 0 -1px 0 var(--c-accent); }
.preview { display: flex; align-items: center; gap: var(--s-2); font-size: var(--fs-xs); color: var(--c-ink-3); }
.preview select { appearance: none; padding-right: var(--s-6); background: var(--c-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238893a6' stroke-width='1.2'/%3E%3C/svg%3E") no-repeat right 10px center; cursor: pointer; }
.preview select, .search input { height: 32px; padding-left: var(--s-3); border-radius: var(--r-2); border: 1px solid var(--c-line-strong); background-color: var(--c-surface); color: var(--c-ink); font: inherit; font-size: var(--fs-sm); }
.search input { width: 180px; padding-right: var(--s-3); }
.search input::placeholder { color: var(--c-ink-3); }
.page-facts { margin-top: var(--s-4); display: flex; gap: var(--s-4); align-items: baseline; padding: var(--s-3) var(--s-4); border: 1px solid var(--c-line); border-left: 1px solid var(--c-accent); border-radius: var(--r-2); background: var(--c-surface); }
.cap { flex: none; font-size: var(--fs-xs); font-weight: 600; color: var(--c-ink-2); }
.page-facts ul { display: flex; flex-direction: column; gap: var(--s-1); }
.page-facts li { display: flex; gap: var(--s-2); align-items: baseline; font-size: var(--fs-sm); color: var(--c-ink-2); font-variant-numeric: tabular-nums; }
.charts { margin-top: var(--s-4); display: grid; grid-template-columns: 1.15fr 1fr; gap: var(--s-4); }
.panel { border: 1px solid var(--c-line); border-radius: var(--r-3); background: var(--c-surface); padding: var(--s-4); min-width: 0; }
.ph { display: flex; justify-content: space-between; align-items: baseline; gap: var(--s-3); flex-wrap: wrap; margin-bottom: var(--s-3); }
.ph h2 { font-size: var(--fs-base); font-weight: 600; }
.ph-r { display: flex; align-items: center; gap: var(--s-4); flex-wrap: wrap; }
.unit { font-size: var(--fs-2xs); color: var(--c-ink-3); }
.foot { margin-top: var(--s-2); font-size: var(--fs-2xs); color: var(--c-ink-3); }
.table-panel { margin-top: var(--s-4); padding: var(--s-4) 0 0; }
.table-panel .ph { padding: 0 var(--s-4); }
.tbl-wrap { max-height: 560px; overflow: auto; border-top: 1px solid var(--c-line); border-radius: 0 0 var(--r-3) var(--r-3); }
table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: var(--fs-sm); }
thead th { position: sticky; top: 0; z-index: 2; background: var(--c-surface-2); border-bottom: 1px solid var(--c-line-strong); font-weight: 500; white-space: nowrap; padding: 0; }
.th-btn { width: 100%; display: flex; align-items: center; justify-content: flex-end; gap: 4px; height: 40px; padding: 0 10px; color: var(--c-ink-2); font-size: var(--fs-xs); transition: color var(--dur-2); }
.th-btn:hover { color: var(--c-ink); }
th.l .th-btn { justify-content: flex-start; }
.th-btn small { margin-left: 2px; color: var(--c-ink-3); font-size: 10px; }
.th-btn svg path { fill: var(--c-line-strong); }
.th-btn svg.on:not(.desc) .u, .th-btn svg.on.desc .d { fill: var(--c-accent); }
[aria-sort="ascending"] .th-btn, [aria-sort="descending"] .th-btn { color: var(--c-ink); }
tbody tr { transition: background-color var(--dur-1); cursor: pointer; }
tbody td, tbody th { height: 40px; padding: 0 10px; border-bottom: 1px solid var(--c-line); white-space: nowrap; color: var(--c-ink-2); background: var(--c-surface); transition: background-color var(--dur-1); }
tbody tr:hover td, tbody tr:hover th { background: var(--c-surface-hover); }
tbody tr.sel td, tbody tr.sel th { background: var(--c-accent-soft); }
td.r { text-align: right; }
td.up { color: var(--c-up); }
td.down { color: var(--c-down); }
.first { position: sticky; left: 0; z-index: 1; text-align: left; }
thead .first { z-index: 3; }
.name { color: var(--c-ink); font-weight: 500; text-align: left; }
tr.sel .name { color: var(--c-accent-ink); }
.flow { display: inline-flex; align-items: center; gap: var(--s-2); }
.flow i { display: inline-block; height: 3px; border-radius: 1px; opacity: 0.7; }
.disc { margin-top: var(--s-5); font-size: var(--fs-xs); color: var(--c-ink-3); line-height: 1.7; max-width: 880px; }

@media (min-width: 1680px) { .page { max-width: 1560px; } }
@media (max-width: 1180px) { .charts { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 1023px) { .page { padding: var(--s-5); } }
@media (max-width: 640px) {
  .page { padding: var(--s-4) var(--s-4) var(--s-6); }
  h1 { font-size: var(--fs-xl); }
  .facts-meta { gap: var(--s-4); width: 100%; justify-content: space-between; }
  .facts-meta dd { font-size: var(--fs-sm); }
  .page-facts { flex-direction: column; gap: var(--s-2); }
  .search input { width: 100%; }
  .ph-r, .search { width: 100%; }
  .preview { width: 100%; justify-content: space-between; }
}
</style>
