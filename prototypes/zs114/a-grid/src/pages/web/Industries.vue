<template>
  <div class="page">
    <div class="gridlines" aria-hidden="true"><i v-for="n in 12" :key="n"></i></div>

    <header class="ph">
      <div>
        <p class="eyebrow">03 · 行业比较与轮动</p>
        <h1>行业比较与轮动</h1>
        <p class="q">不同板块已发生的表现有什么差异？</p>
      </div>
      <dl class="stamp mono">
        <div><dt>数据日期</dt><dd>{{ src.trade_date }}</dd></div>
        <div><dt>快照</dt><dd>{{ src.sources[0].snapshot_time.slice(11, 16) }}</dd></div>
        <div><dt>覆盖</dt><dd>{{ Math.round(src.sources[0].coverage_ratio * 100) }}%</dd></div>
        <div><dt>数据</dt><dd><span class="chip sample">示例数据</span></dd></div>
      </dl>
    </header>

    <p class="from" v-if="route.query.from === 'brief'" role="note">
      <span class="chip stat">来自今日要点</span>
      已按「{{ colLabel(sortKey) }}」排序并高亮该列。本页是示例数据（{{ src.trade_date }}），与要点日期 {{ route.query.d }} 不同，原型阶段只演示落点。
    </p>

    <div class="tools" role="toolbar" aria-label="筛选">
      <div class="seg" role="radiogroup" aria-label="板块类型">
        <button v-for="t in IDX_TYPES" :key="t" type="button" role="radio" :aria-checked="idxType === t" :id="`idx-${t}`" :class="{ on: idxType === t }" @click="idxType = t">{{ t }}</button>
      </div>
      <label class="search"><span class="sr-only">搜索板块名称或代码</span>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" /><path d="m9.5 9.5 3 3" stroke="currentColor" /></svg>
        <input id="ind-search" v-model="kwInput" type="search" placeholder="搜索名称或代码" autocomplete="off" />
      </label>
      <span class="count mono">{{ rows.length }} / {{ all.length }}</span>
    </div>

    <section class="kpis" aria-label="当日汇总">
      <div v-for="k in kpis" :key="k.label" class="kpi">
        <p class="k-l">{{ k.label }}</p>
        <p class="k-v"><TickNum :text="k.value" :class="k.dir" /><span class="k-u">{{ k.unit }}</span></p>
      </div>
    </section>

    <div class="charts">
      <section class="panel c-rrg" aria-labelledby="rrg-h">
        <div class="panel-h"><h2 id="rrg-h">相对强度 — 动量</h2><span class="meta">参考线 100 · 点大小 = 成交额 · {{ src.trade_date }}</span></div>
        <EChart v-if="rows.length" :option="rrg" height="340px" label="行业板块相对强度与动量散点图" @click="(p) => (selected = p.data.code)" />
        <StatePanel v-else kind="empty" title="没有可画的板块" body="当前筛选下没有板块。" />
        <p class="note">横轴 RS 比率，纵轴 RS 动量，只呈现历史相对位置。</p>
      </section>
      <section class="panel c-flow" aria-labelledby="flow-h">
        <div class="panel-h"><h2 id="flow-h">资金净流入 · 1 日</h2><span class="meta">前 8 / 后 8 · 亿元</span></div>
        <EChart v-if="rows.length" :option="flow" height="340px" label="行业板块单日资金净流入前后各 8 名条形图" />
        <StatePanel v-else kind="empty" title="没有可画的板块" body="当前筛选下没有板块。" />
        <p class="note">红为净流入，绿为净流出。</p>
      </section>
    </div>

    <section class="panel tbl" aria-labelledby="tbl-h">
      <div class="panel-h"><h2 id="tbl-h">板块数据</h2><span class="meta">点击列头排序 · 点击行看近期序列 · {{ src.trade_date }}</span></div>
      <div class="scroll" v-if="rows.length" @mouseleave="hc = -1">
        <table>
          <caption class="sr-only">{{ idxType }}数据表，数据日期 {{ src.trade_date }}</caption>
          <thead>
            <tr>
              <th scope="col" class="name" :aria-sort="ariaSort('sector_name')"><button type="button" @click="sortBy('sector_name')">板块</button></th>
              <th v-for="(c, ci) in COLS" :key="c.key" scope="col" :class="{ hc: hc === ci, focus: focusCol === c.key }" :aria-sort="ariaSort(c.key)">
                <button type="button" :id="`sort-${c.key}`" @click="sortBy(c.key)">
                  <span class="th-l">{{ c.label }}</span><span class="th-u mono">{{ c.unit }}</span>
                  <svg class="arr" :class="{ on: sortKey === c.key, desc: sortDesc }" width="8" height="10" viewBox="0 0 8 10" aria-hidden="true"><path d="M4 1v8M1 6l3 3 3-3" fill="none" stroke="currentColor" /></svg>
                </button>
              </th>
            </tr>
          </thead>
          <tbody @mouseover="onOver">
            <tr v-for="r in rows" :key="r.sector_code" :class="{ sel: r.sector_code === selected }" tabindex="0"
                :aria-selected="r.sector_code === selected" @click="selected = r.sector_code" @keydown.enter="selected = r.sector_code">
              <th scope="row" class="name"><span class="nm"><span>{{ r.sector_name }}</span><span class="code mono">{{ r.sector_code }}</span></span></th>
              <td v-for="(c, ci) in COLS" :key="c.key" :data-c="ci" :class="[c.signed ? fmt.dir(r[c.key]) : '', { hc: hc === ci, focus: focusCol === c.key }]">
                <span v-if="c.key === 'net_flow_1d'" class="flowcell"><i :class="fmt.dir(r[c.key])" :style="{ '--w': `${Math.min(100, (Math.abs(r[c.key]) / maxFlow) * 100)}%` }"></i>{{ c.f(r[c.key]) }}</span>
                <template v-else>{{ c.f(r[c.key]) }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <StatePanel v-else kind="empty" code="EMPTY · 筛选" :title="idxType !== '行业板块' ? `示例数据未包含${idxType}` : `没有匹配「${kw}」的板块`" :body="idxType !== '行业板块' ? '原型只带了行业板块的示例数据；正式页按板块类型分别取数。' : '换个关键词，或清空搜索。'">
        <template #actions><button class="btn" type="button" @click="reset">清空筛选</button></template>
      </StatePanel>
      <p class="note">涨跌幅为小数口径换算的百分比；成交额、资金净流入单位为亿元；扩散度、站上 MA20 比例的精确公式以数据中台定义为准。</p>
    </section>

    <section class="panel ser" aria-labelledby="ser-h" v-if="selRow">
      <div class="panel-h"><h2 id="ser-h">{{ selRow.sector_name }} · 近期序列</h2>
        <span class="meta" v-if="hasSeries">{{ seriesData.points.length }} / {{ seriesData.requested_days }} 个交易日有数 · 未插值</span></div>
      <template v-if="hasSeries">
        <p class="gap" role="note"><span class="chip warn">部分</span>{{ series.gaps[0].reason }}</p>
        <EChart :option="ser" height="260px" :label="`${selRow.sector_name}近期资金净流入与 RS 比率`" />
      </template>
      <StatePanel v-else kind="nodate" code="NO_DATA · 序列" :title="`示例数据只含「${seriesData.sector_name}」的序列`" :body="`「${selRow.sector_name}」的近期序列在正式页按需加载；原型不伪造数据。`">
        <template #actions><button class="btn" type="button" @click="selected = seriesData.sector_code">查看{{ seriesData.sector_name }}</button></template>
      </StatePanel>
    </section>

    <footer class="disc">{{ src.disclaimer }}</footer>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import EChart from '../../components/EChart.vue'
import StatePanel from '../../components/StatePanel.vue'
import TickNum from '../../components/TickNum.vue'
import { fmt } from '../../lib/format.js'
import { rrgOption, flowOption, seriesOption } from './industries-charts.js'
import src from '../../../../data/industries-sample.json'
import series from '../../../../data/industry-series-sample.json'

const route = useRoute()
const IDX_TYPES = ['行业板块', '概念板块', '地域板块']
const COLS = [
  { key: 'sector_return', label: '1 日', unit: '%', f: (v) => fmt.pct(v), signed: true },
  { key: 'sector_return_5d', label: '5 日', unit: '%', f: (v) => fmt.pct(v), signed: true },
  { key: 'sector_return_20d', label: '20 日', unit: '%', f: (v) => fmt.pct(v), signed: true },
  { key: 'amount', label: '成交额', unit: '亿元', f: (v) => fmt.num(v, 1) },
  { key: 'turnover_rate', label: '换手率', unit: '%', f: (v) => fmt.num(v, 2) },
  { key: 'net_flow_1d', label: '净流入 1 日', unit: '亿元', f: (v) => fmt.signed(v, 2), signed: true },
  { key: 'net_flow_5d', label: '净流入 5 日', unit: '亿元', f: (v) => fmt.signed(v, 2), signed: true },
  { key: 'di', label: '扩散度', unit: '', f: (v) => fmt.num(v, 3) },
  { key: 'above_ma20_ratio', label: '站上 MA20', unit: '%', f: (v) => fmt.pctRaw(v, 1) },
  { key: 'rs_ratio', label: 'RS 比率', unit: '', f: (v) => fmt.num(v, 2) },
  { key: 'rs_momentum', label: 'RS 动量', unit: '', f: (v) => fmt.num(v, 2) },
]
const colLabel = (k) => COLS.find((c) => c.key === k)?.label || '板块'

const all = src.data.items
const idxType = ref('行业板块')
const kwInput = ref('')
const kw = ref('')
let t
watch(kwInput, (v) => { clearTimeout(t); t = setTimeout(() => (kw.value = v.trim()), 150) })

const focusCol = COLS.some((c) => c.key === route.query.field) ? route.query.field : null
const sortKey = ref(focusCol || 'sector_return')
const sortDesc = ref(true)
const selected = ref(series.data.sector_code)
const hc = ref(-1)

const rows = computed(() => {
  const k = kw.value
  const list = all.filter((r) => r.idx_type === idxType.value && (!k || r.sector_name.includes(k) || r.sector_code.toLowerCase().includes(k.toLowerCase())))
  const dir = sortDesc.value ? -1 : 1
  return [...list].sort((a, b) => (typeof a[sortKey.value] === 'string' ? a[sortKey.value].localeCompare(b[sortKey.value], 'zh') : a[sortKey.value] - b[sortKey.value]) * dir)
})
const maxFlow = computed(() => Math.max(...all.map((r) => Math.abs(r.net_flow_1d))))
const sortBy = (k) => { if (sortKey.value === k) sortDesc.value = !sortDesc.value; else { sortKey.value = k; sortDesc.value = k !== 'sector_name' } }
const ariaSort = (k) => (sortKey.value === k ? (sortDesc.value ? 'descending' : 'ascending') : 'none')
const onOver = (e) => { const td = e.target.closest('td'); hc.value = td ? Number(td.dataset.c) : -1 }
const reset = () => { idxType.value = '行业板块'; kwInput.value = ''; kw.value = '' }

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const kpis = computed(() => {
  const r = all.filter((x) => x.idx_type === '行业板块')
  const flow = r.reduce((s, x) => s + x.net_flow_1d, 0)
  const med = median(r.map((x) => x.sector_return))
  return [
    { label: '上涨板块', value: `${r.filter((x) => x.sector_return > 0).length}`, unit: `/ ${r.length}` },
    { label: '中位涨跌幅', value: fmt.pct(med), unit: '%', dir: fmt.dir(med) },
    { label: '净流入合计 · 1 日', value: fmt.signed(flow, 1), unit: '亿元', dir: fmt.dir(flow) },
    { label: '成交额合计', value: fmt.num(r.reduce((s, x) => s + x.amount, 0), 1), unit: '亿元' },
  ]
})

const selRow = computed(() => all.find((r) => r.sector_code === selected.value))
const seriesData = series.data
const hasSeries = computed(() => selected.value === seriesData.sector_code)
const rrg = computed(() => rrgOption(rows.value, selected.value))
const flow = computed(() => flowOption(rows.value))
const ser = seriesOption(seriesData.points)
</script>

<style scoped>
.page { position: relative; isolation: isolate; padding: 32px 32px 48px; max-width: var(--max-w); }
.gridlines { --gm: 32px; }
.ph { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
h1 { margin-top: 8px; font: 700 var(--fs-2xl)/var(--lh-2xl) var(--font-display); letter-spacing: -0.01em; }
.q { margin-top: 10px; color: var(--c-muted); font-size: var(--fs-sm); }
.stamp { display: flex; border: 1px solid var(--c-line); border-radius: var(--r-md); background: var(--c-surface); }
.stamp div { padding: 8px 14px; border-left: 1px solid var(--c-line); }
.stamp div:first-child { border-left: 0; }
.stamp dt { font-size: 10px; color: var(--c-muted); letter-spacing: .04em; }
.stamp dd { margin-top: 2px; font-size: var(--fs-xs); color: var(--c-ink); font-weight: 500; }
.from { display: flex; gap: 12px; align-items: baseline; margin-top: 20px; padding: 10px 14px; border: 1px solid var(--c-accent-line); border-radius: var(--r-md); background: var(--c-surface); font-size: var(--fs-xs); color: var(--c-ink-2); }

.tools { display: flex; align-items: center; gap: 12px; margin-top: 24px; }
.seg { display: inline-flex; padding: 2px; border: 1px solid var(--c-line-strong); border-radius: var(--r-sm); background: var(--c-surface); }
.seg button { height: 30px; padding: 0 12px; border: 0; border-radius: 3px; background: transparent; font-size: var(--fs-xs); color: var(--c-ink-2); transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease); }
.seg button:hover { color: var(--c-ink); }
.seg button.on { background: var(--c-ink); color: var(--c-bg); font-weight: 600; }
.search { display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 10px; border: 1px solid var(--c-line-strong); border-radius: var(--r-sm); background: var(--c-surface); color: var(--c-muted); }
.search:focus-within { border-color: var(--c-accent); }
.search input { border: 0; outline: 0; background: transparent; width: 180px; font-size: var(--fs-sm); color: var(--c-ink); }
.count { margin-left: auto; font-size: var(--fs-2xs); color: var(--c-muted); }

.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 16px; border: 1px solid var(--c-line); border-radius: var(--r-md); background: var(--c-surface); }
.kpi { padding: 14px 16px; border-left: 1px solid var(--c-line); }
.kpi:first-child { border-left: 0; }
.k-l { font-size: var(--fs-2xs); color: var(--c-muted); }
.k-v { display: flex; align-items: baseline; gap: 6px; margin-top: 4px; font: 500 var(--fs-xl)/var(--lh-xl) var(--font-mono); letter-spacing: -0.02em; }
.k-u { font: 400 var(--fs-xs)/1 var(--font-sans); color: var(--c-muted); letter-spacing: 0; }

.charts { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 24px; margin-top: 16px; }
.c-rrg { grid-column: span 7; } .c-flow { grid-column: span 5; }
.note { padding: 10px 16px 12px; border-top: 1px solid var(--c-line); font-size: var(--fs-2xs); line-height: var(--lh-2xs); color: var(--c-muted); }

.tbl { margin-top: 16px; }
.scroll { overflow: auto; max-height: 560px; }
table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: var(--fs-xs); }
thead th { position: sticky; top: 0; z-index: 2; background: var(--c-surface-2); border-bottom: 1px solid var(--c-line-strong); text-align: right; font-weight: 500; padding: 0; white-space: nowrap; }
thead th button { display: inline-flex; align-items: center; justify-content: flex-end; gap: 4px; width: 100%; height: 40px; padding: 0 12px; border: 0; background: transparent; color: var(--c-ink-2); font-size: var(--fs-2xs); }
thead th button:hover { color: var(--c-ink); }
.th-u { color: var(--c-muted); font-size: 10px; }
.arr { opacity: 0; color: var(--c-accent); transition: opacity var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease); transform: rotate(180deg); }
.arr.on { opacity: 1; } .arr.on.desc { transform: none; }
th.name { text-align: left; position: sticky; left: 0; z-index: 1; background: var(--c-surface); }
thead th.name { z-index: 3; background: var(--c-surface-2); }
thead th.name button { justify-content: flex-start; }
tbody th.name { padding: 0 12px; height: 36px; font-weight: 500; font-size: var(--fs-xs); white-space: nowrap; border-bottom: 1px solid var(--c-line); }
.nm { display: inline-flex; align-items: baseline; gap: 8px; }
.code { font-size: 10px; color: var(--c-muted); }
td { height: 36px; padding: 0 12px; text-align: right; font-family: var(--font-mono); font-variant-numeric: tabular-nums; border-bottom: 1px solid var(--c-line); white-space: nowrap; color: var(--c-ink); }
td.up { color: var(--c-up); } td.down { color: var(--c-down); }
tbody tr { cursor: pointer; transition: background-color var(--dur-fast) var(--ease); }
tbody tr:hover td, tbody tr:hover th { background-color: var(--c-surface-2); }
tbody tr:focus-visible { outline-offset: -2px; }
/* 十字准线：行 + 列同时高亮 */
td.hc, th.hc { background-image: linear-gradient(var(--c-accent-soft), var(--c-accent-soft)); }
tbody tr:hover td.hc { box-shadow: inset 0 0 0 1px var(--c-accent-line); }
td.focus, th.focus { background-image: linear-gradient(var(--c-accent-soft), var(--c-accent-soft)); }
th.focus button { color: var(--c-accent); }
tr.sel th.name { box-shadow: inset 2px 0 0 var(--c-accent); color: var(--c-accent); }
tr.sel td, tr.sel th { background-color: var(--c-accent-soft); }
.flowcell { position: relative; display: inline-block; min-width: 92px; padding-bottom: 4px; }
.flowcell i { position: absolute; right: 0; bottom: 0; height: 2px; width: var(--w); background: currentColor; opacity: .35; }

.ser { margin-top: 16px; }
.gap { display: flex; gap: 10px; align-items: baseline; padding: 12px 16px 0; font-size: var(--fs-xs); color: var(--c-ink-2); }
.disc { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--c-line); font-size: var(--fs-xs); line-height: var(--lh-xs); color: var(--c-muted); max-width: 920px; }

@media (max-width: 1279px) { .c-rrg, .c-flow { grid-column: span 12; } }
@media (max-width: 720px) {
  .page { padding: 20px 16px 32px; }
  .gridlines { --cols: 4; --gutter: 16px; --gm: 16px; }
  .gridlines > i:nth-child(n + 5) { display: none; }
  .ph { flex-direction: column; align-items: stretch; }
  h1 { font-size: var(--fs-xl); line-height: var(--lh-xl); }
  .stamp { overflow-x: auto; } .stamp div { padding: 6px 10px; flex: none; }
  .tools { flex-wrap: wrap; } .seg { width: 100%; } .seg button { flex: 1; }
  .search { flex: 1; } .search input { width: 100%; }
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .kpi:nth-child(3) { border-left: 0; } .kpi:nth-child(n + 3) { border-top: 1px solid var(--c-line); }
  .k-v { font-size: var(--fs-lg); line-height: var(--lh-lg); }
  .scroll { max-height: 480px; }
}
</style>
