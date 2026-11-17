<template>
  <article class="ind">
    <header class="head">
      <p class="eyebrow">明细页 · 03</p>
      <h1 class="title">行业比较与轮动</h1>
      <p class="deck">不同板块已发生的表现有什么差异？涨跌、成交、资金净流入、扩散度和相对强度，按同一交易日对照。</p>
    </header>

    <dl class="strip">
      <div class="cell">
        <dt>数据日</dt>
        <dd class="date-ctl">
          <button id="ind-prev" class="btn sm" type="button" aria-label="前一交易日" @click="shift(-1)">‹</button>
          <span class="num serif big">{{ date }}</span>
          <button id="ind-next" class="btn sm" type="button" aria-label="后一交易日" @click="shift(1)">›</button>
        </dd>
      </div>
      <div class="cell"><dt>板块类型</dt>
        <dd>
          <div class="seg" role="tablist" aria-label="板块类型">
            <button v-for="t in TYPES" :id="`type-${t}`" :key="t" role="tab" type="button" :aria-selected="type === t"
              :class="{ on: type === t }" @click="type = t">{{ t }}</button>
          </div>
        </dd>
      </div>
      <div class="cell"><dt>单位</dt><dd>金额 亿元 · 涨跌幅、占比 %</dd></div>
      <div class="cell"><dt>覆盖</dt><dd class="num">{{ rows.length }} 个板块 · 100%</dd></div>
      <div class="cell"><dt>数据</dt><dd><span class="tag accent">示例数据</span></dd></div>
    </dl>

    <DataState v-if="state === 'nodate'" kind="nodate" :title="`${date} 没有数据`"
      detail="示例数据只包含 2026-09-09 一个交易日。不以其他日期的数据代替。">
      <button class="btn sm" type="button" @click="offset = 0">回到 {{ BASE_DATE }}</button>
    </DataState>
    <DataState v-else-if="state === 'denied'" kind="denied">
      <span class="tag muted">行业/概念/地域板块全量数据表</span><span class="tag muted">RRG 相对强度—动量坐标</span>
      <button class="btn sm primary" type="button">查看等级说明</button>
    </DataState>
    <DataState v-else-if="state === 'error'" kind="error"><button class="btn sm" type="button">重试</button></DataState>

    <template v-else>
      <section class="brief" aria-labelledby="h-page-brief">
        <h2 id="h-page-brief" class="sub-h">本页要点 <span class="tag solid">统计</span></h2>
        <ol class="pb">
          <li v-for="(p, i) in pageBrief" :key="i" class="reveal" :style="{ '--i': i }">
            <span class="pb-k">{{ p.kind }}</span><span class="serif">{{ p.text }}</span>
          </li>
        </ol>
      </section>

      <div class="figs">
        <figure class="fig">
          <figcaption><span class="fig-no">图 1</span>相对强度—动量（RRG）<span class="fig-m num">数据日 {{ date }} · 参照线 100</span></figcaption>
          <DataState v-if="state === 'loading'" kind="loading" :rows="4" />
          <DataState v-else-if="!rows.length" kind="empty" compact detail="示例数据只包含行业板块。" />
          <EChart v-else :build="rrgOption" height="420px" label="相对强度比值与动量的散点图，30 个行业板块" @ready="(c) => (rrg = c)" />
          <p class="fig-note">横轴 RS 比值、纵轴 RS 动量，均以 100 为基准。实线为「化肥」近 7 个有数交易日的轨迹（窗口 20 日，未插值）。</p>
        </figure>
        <figure class="fig">
          <figcaption><span class="fig-no">图 2</span>单日资金净流入 · 前 8 与后 8<span class="fig-m num">亿元 · 数据日 {{ date }}</span></figcaption>
          <DataState v-if="state === 'loading'" kind="loading" :rows="4" />
          <DataState v-else-if="!rows.length" kind="empty" compact detail="示例数据只包含行业板块。" />
          <EChart v-else :build="flowOption" height="420px" label="单日资金净流入前 8 与后 8 个行业板块条形图" @ready="(c) => (flow = c)" />
          <p class="fig-note">红为净流入，绿为净流出（A 股习惯）。中间 14 个板块见表 1。</p>
        </figure>
      </div>

      <section class="tbl-sec" aria-labelledby="h-table">
        <div class="tbl-cap">
          <h2 id="h-table" class="sub-h"><span class="fig-no">表 1</span>{{ type }}全量</h2>
          <span class="fig-m num">{{ rows.length }} 行 · 数据日 {{ date }} · 点列头排序</span>
        </div>
        <DataState v-if="state === 'loading'" kind="loading" :rows="8" />
        <DataState v-else-if="!rows.length" kind="empty" :detail="`示例数据只包含行业板块，「${type}」暂无数据行。`">
          <button class="btn sm" type="button" @click="type = '行业板块'">看行业板块</button>
        </DataState>
        <div v-else class="tbl-wrap" tabindex="0" aria-label="行业板块数据表，可横向滚动">
          <table class="tbl">
            <caption class="sr-only">{{ type }}数据表，数据日 {{ date }}</caption>
            <thead>
              <tr>
                <th v-for="c in COLS" :key="c.key" scope="col" :class="{ l: c.key === 'sector_name' }"
                  :aria-sort="sortKey === c.key ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'">
                  <button :id="`sort-${c.key}`" type="button" class="th-btn" :class="{ on: sortKey === c.key }" @click="sortBy(c.key)">
                    <span class="th-t">{{ c.label }}</span>
                    <span class="th-u">{{ c.unit }}<i class="arrow" aria-hidden="true">{{ sortKey === c.key ? (sortDir > 0 ? '↑' : '↓') : '↕' }}</i></span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in sorted" :key="r.sector_code" @mouseenter="hover(r)" @mouseleave="unhover">
                <th scope="row" class="l name">{{ r.sector_name }}<span class="code num">{{ r.sector_code }}</span></th>
                <td class="num" :class="tone(r.sector_return)">{{ pct(r.sector_return) }}</td>
                <td class="num" :class="tone(r.sector_return_5d)">{{ pct(r.sector_return_5d) }}</td>
                <td class="num" :class="tone(r.sector_return_20d)">{{ pct(r.sector_return_20d) }}</td>
                <td class="num">{{ fixed(r.amount) }}</td>
                <td class="num">{{ fixed(r.turnover_rate, 2) }}</td>
                <td class="num"><span class="flow">
                  <span class="bar" aria-hidden="true"><i :class="tone(r.net_flow_1d)" :style="barStyle(r.net_flow_1d)" /></span>
                  <span :class="tone(r.net_flow_1d)">{{ signed(r.net_flow_1d) }}</span>
                </span></td>
                <td class="num" :class="tone(r.net_flow_5d)">{{ signed(r.net_flow_5d) }}</td>
                <td class="num">{{ ratio(r.up_stock_ratio) }}</td>
                <td class="num">{{ ratio(r.above_ma20_ratio) }}</td>
                <td class="num">{{ signed(r.di, 2) }}</td>
                <td class="num">{{ fixed(r.rs_ratio, 2) }}</td>
                <td class="num">{{ fixed(r.rs_momentum, 2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="src-line">来源：行业比较与轮动 · 板块日度统计　<span class="tag accent">示例数据</span>　{{ LEGAL }}</p>
      </section>
    </template>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import EChart from '../components/EChart.vue'
import DataState from '../components/DataState.vue'
import ind from '@data/industries-sample.json'
import series from '@data/industry-series-sample.json'
import { pct, ratio, signed, fixed, tone } from '../lib/format.js'
import { LEGAL } from '../lib/brief.js'

const BASE_DATE = ind.trade_date
const TYPES = ind.data.idx_types
const COLS = [
  { key: 'sector_name', label: '板块', unit: '' },
  { key: 'sector_return', label: '涨跌幅 1 日', unit: '%' },
  { key: 'sector_return_5d', label: '5 日', unit: '%' },
  { key: 'sector_return_20d', label: '20 日', unit: '%' },
  { key: 'amount', label: '成交额', unit: '亿元' },
  { key: 'turnover_rate', label: '换手率', unit: '%' },
  { key: 'net_flow_1d', label: '净流入 1 日', unit: '亿元' },
  { key: 'net_flow_5d', label: '净流入 5 日', unit: '亿元' },
  { key: 'up_stock_ratio', label: '上涨占比', unit: '%' },
  { key: 'above_ma20_ratio', label: '站上 MA20', unit: '%' },
  { key: 'di', label: '扩散度', unit: '−1~1' },
  { key: 'rs_ratio', label: 'RS 比值', unit: '基准 100' },
  { key: 'rs_momentum', label: 'RS 动量', unit: '基准 100' },
]

const route = useRoute()
const type = ref('行业板块')
const offset = ref(0)
const date = computed(() => {
  const d = new Date(BASE_DATE + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + offset.value)
  return d.toISOString().slice(0, 10)
})
const shift = (n) => { offset.value += n }
// ?state= 用于状态样张；日期偏离示例日即为「所选日期无数据」
const state = computed(() => (offset.value ? 'nodate' : route.query.state || 'ok'))

const rows = computed(() => (type.value === '行业板块' ? ind.data.items : []))
const sortKey = ref('net_flow_1d')
const sortDir = ref(-1)
function sortBy(k) {
  if (sortKey.value === k) sortDir.value = -sortDir.value
  else { sortKey.value = k; sortDir.value = k === 'sector_name' ? 1 : -1 }
}
const sorted = computed(() => [...rows.value].sort((a, b) => {
  const x = a[sortKey.value]; const y = b[sortKey.value]
  return (typeof x === 'string' ? x.localeCompare(y, 'zh-CN') : x - y) * sortDir.value
}))
const maxFlow = Math.max(...ind.data.items.map((r) => Math.abs(r.net_flow_1d)))
const barStyle = (v) => ({ width: (Math.abs(v) / maxFlow) * 50 + '%', [v >= 0 ? 'left' : 'right']: '50%' })

const byFlow = [...ind.data.items].sort((a, b) => b.net_flow_1d - a.net_flow_1d)
const byMa = [...ind.data.items].sort((a, b) => b.above_ma20_ratio - a.above_ma20_ratio)
const pageBrief = [
  { kind: '排名', text: `单日资金净流入前 3：${byFlow.slice(0, 3).map((r) => `${r.sector_name} ${signed(r.net_flow_1d)} 亿`).join('、')}；净流出最多：${byFlow.at(-1).sector_name} ${signed(byFlow.at(-1).net_flow_1d)} 亿` },
  { kind: '极值', text: `成分股站上 20 日均线比例最高：${byMa[0].sector_name} ${ratio(byMa[0].above_ma20_ratio)}；最低：${byMa.at(-1).sector_name} ${ratio(byMa.at(-1).above_ma20_ratio)}` },
  { kind: '计数', text: `RS 比值与动量同时 ≥ 100 的板块 ${ind.data.items.filter((r) => r.rs_ratio >= 100 && r.rs_momentum >= 100).length} 个，共 ${ind.data.items.length} 个` },
]

// 图表：页边标注只给离中心最远的 6 个，其余悬停可见
const far = new Set([...ind.data.items].sort((a, b) => Math.hypot(b.rs_ratio - 100, b.rs_momentum - 100) - Math.hypot(a.rs_ratio - 100, a.rs_momentum - 100)).slice(0, 6).map((r) => r.sector_name))
const tipRow = (r) => `<b>${r.sector_name}</b><br/>RS 比值 ${fixed(r.rs_ratio, 2)}　动量 ${fixed(r.rs_momentum, 2)}<br/>净流入 ${signed(r.net_flow_1d)} 亿元`

function rrgOption(c) {
  const trail = series.data.points.map((p) => [p.rs_ratio, p.rs_momentum])
  const corner = (text, pos) => ({ type: 'text', ...pos, style: { text, fill: c.ink3, font: '11px sans-serif' }, silent: true })
  return {
    grid: { left: 44, right: 20, top: 20, bottom: 40 },
    tooltip: { trigger: 'item', formatter: (p) => (p.seriesIndex === 0 ? tipRow(ind.data.items[p.dataIndex]) : `化肥 ${series.data.points[p.dataIndex].trade_date}`) },
    xAxis: { type: 'value', name: 'RS 比值', nameLocation: 'middle', nameGap: 26, min: 95, max: 105, interval: 2.5 },
    yAxis: { type: 'value', name: 'RS 动量', nameLocation: 'middle', nameGap: 30, min: 97, max: 105, interval: 2 },
    graphic: [
      corner('比值≥100 · 动量≥100', { right: 28, top: 26 }),
      corner('比值<100 · 动量≥100', { left: 52, top: 26 }),
      corner('比值<100 · 动量<100', { left: 52, bottom: 48 }),
      corner('比值≥100 · 动量<100', { right: 28, bottom: 48 }),
    ],
    series: [
      {
        type: 'scatter',
        data: ind.data.items.map((r) => ({ value: [r.rs_ratio, r.rs_momentum], name: r.sector_name })),
        symbolSize: (v, p) => 5 + Math.sqrt(ind.data.items[p.dataIndex].amount) / 4,
        itemStyle: { color: c.accent, opacity: 0.85, borderColor: c.paper, borderWidth: 1 },
        label: { show: true, formatter: (p) => (far.has(p.name) ? p.name : ''), position: 'right', color: c.ink2, fontSize: 11 },
        emphasis: { scale: 1.6, label: { show: true, formatter: '{b}', color: c.ink, fontWeight: 600 }, itemStyle: { color: c.up, opacity: 1 } },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: c.ink, width: 1 }, label: { show: false }, data: [{ xAxis: 100 }, { yAxis: 100 }] },
      },
      {
        type: 'line', data: trail, symbol: 'circle', symbolSize: (v, p) => (p.dataIndex === trail.length - 1 ? 6 : 3),
        lineStyle: { color: c.ink3, width: 1, type: [3, 3] }, itemStyle: { color: c.ink2 }, z: 3,
        endLabel: { show: true, formatter: '化肥 · 轨迹', color: c.ink2, fontSize: 11, offset: [4, 10] },
      },
    ],
  }
}

const flowList = [...byFlow.slice(0, 8), ...byFlow.slice(-8)].reverse()
function flowOption(c) {
  const list = flowList
  return {
    grid: { left: 76, right: 48, top: 8, bottom: 28 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: c.wash, opacity: 0.6 } }, formatter: (p) => tipRow(list[p[0].dataIndex]) },
    xAxis: { type: 'value', axisLabel: { formatter: (v) => (v > 0 ? '+' + v : v) } },
    yAxis: { type: 'category', data: list.map((r) => r.sector_name), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: c.ink2, fontSize: 11, interval: 0 } },
    series: [{
      type: 'bar', barWidth: 10,
      data: list.map((r) => ({ value: r.net_flow_1d, itemStyle: { color: r.net_flow_1d >= 0 ? c.up : c.down } })),
      label: { show: true, position: 'right', fontSize: 10, color: c.ink3, formatter: (p) => signed(p.value) },
      markLine: { silent: true, symbol: 'none', lineStyle: { color: c.ink, width: 1 }, label: { show: false }, data: [{ xAxis: 0 }] },
    }],
  }
}

let rrg = null
let flow = null
function hover(r) {
  rrg?.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: ind.data.items.indexOf(r) })
  const j = flowList.indexOf(r)
  if (j >= 0) flow?.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: j })
}
function unhover() {
  rrg?.dispatchAction({ type: 'downplay', seriesIndex: 0 })
  flow?.dispatchAction({ type: 'downplay', seriesIndex: 0 })
}
</script>

<style scoped>
.head { display: grid; gap: var(--sp-3); padding-bottom: var(--sp-5); }
.title { font-size: var(--fs-5xl); font-weight: 900; letter-spacing: .04em; line-height: 1.05; }
.deck { font: 400 var(--fs-lg)/1.6 var(--font-serif); color: var(--ink-2); max-width: var(--measure); }

.strip { display: grid; grid-template-columns: auto auto 1fr auto auto; margin: 0; border-top: 2px solid var(--rule-strong); border-bottom: 1px solid var(--rule-strong); }
.cell { padding: var(--sp-3) var(--sp-5) var(--sp-3) 0; display: grid; gap: 4px; align-content: start; }
.cell + .cell { padding-left: var(--sp-5); border-left: 1px solid var(--rule); }
.cell dt { font-size: var(--fs-2xs); color: var(--ink-3); letter-spacing: .1em; }
.cell dd { margin: 0; font-size: var(--fs-sm); color: var(--ink); display: flex; align-items: center; gap: var(--sp-2); min-height: 32px; }
.big { font-size: var(--fs-lg); font-weight: 600; }
.seg { display: inline-flex; border: 1px solid var(--rule-strong); border-radius: var(--r-1); }
.seg button { height: 30px; padding: 0 var(--sp-3); border: 0; background: none; cursor: pointer; font-size: var(--fs-sm); color: var(--ink-2); transition: background-color var(--dur-1) var(--ease); }
.seg button + button { border-left: 1px solid var(--rule-strong); }
.seg button:hover { background: var(--paper-3); }
.seg button.on { background: var(--ink); color: var(--paper); }

.sub-h { font-size: var(--fs-lg); display: flex; align-items: center; gap: var(--sp-2); }
.brief { padding: var(--sp-5) 0; border-bottom: 1px solid var(--rule); }
.pb { list-style: none; margin: var(--sp-3) 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-5); counter-reset: pb; }
.pb li { display: grid; gap: 4px; font-size: var(--fs-base); line-height: 1.6; padding-top: var(--sp-2); border-top: 1px solid var(--rule-strong); }
.pb-k { font-size: var(--fs-xs); color: var(--accent); font-weight: 600; letter-spacing: .06em; }

.figs { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-6); padding: var(--sp-6) 0; }
.fig { margin: 0; min-width: 0; }
figcaption, .tbl-cap { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--sp-2); padding-bottom: var(--sp-2); border-bottom: 1px solid var(--rule-strong); font: 600 var(--fs-base)/1.4 var(--font-serif); margin-bottom: var(--sp-3); }
.fig-no { font: 700 var(--fs-xs)/1 var(--font-sans); letter-spacing: .1em; color: var(--accent); margin-right: var(--sp-1); }
.fig-m { margin-left: auto; font: 400 var(--fs-xs)/1.4 var(--font-sans); color: var(--ink-3); }
.fig-note { font-size: var(--fs-xs); color: var(--ink-3); margin-top: var(--sp-2); line-height: 1.6; }

.tbl-sec { padding-top: var(--sp-2); }
.tbl-wrap { max-height: min(640px, 76vh); overflow: auto; border-bottom: 1px solid var(--rule-strong); outline-offset: 2px; }
.tbl { width: 100%; border-collapse: separate; border-spacing: 0; font-size: var(--fs-sm); }
.tbl th, .tbl td { padding: 0 var(--sp-3); height: 40px; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--rule); }
.tbl thead th { position: sticky; top: 0; z-index: 2; background: var(--paper-2); padding: 0; border-bottom: 1px solid var(--rule-strong); height: auto; font-weight: 400; }
.tbl .l { text-align: left; }
.th-btn { width: 100%; display: grid; justify-items: end; gap: 2px; padding: var(--sp-2) var(--sp-3); border: 0; background: none; cursor: pointer; color: var(--ink-2); font-size: var(--fs-xs); font-weight: 600; transition: color var(--dur-1) var(--ease); }
.l .th-btn { justify-items: start; }
.th-btn:hover, .th-btn.on { color: var(--ink); }
.th-u { font-size: var(--fs-2xs); font-weight: 400; color: var(--ink-3); display: inline-flex; gap: 4px; }
.arrow { font-style: normal; color: var(--ink-3); }
.th-btn.on .arrow { color: var(--accent); }
.tbl tbody tr { transition: background-color var(--dur-1) var(--ease); }
.tbl tbody tr:hover { background: var(--accent-wash); }
.tbl tbody th { font-weight: 600; color: var(--ink); font-family: var(--font-serif); }
.name { position: sticky; left: 0; z-index: 1; background: var(--paper); }
.tbl tbody tr:hover .name { background: var(--accent-wash); }
.tbl thead th:first-child { left: 0; z-index: 3; }
.code { margin-left: var(--sp-2); font: 400 var(--fs-2xs) var(--font-sans); color: var(--ink-3); }
.flow { display: flex; align-items: center; justify-content: flex-end; gap: var(--sp-2); }
.bar { position: relative; width: 64px; height: 8px; flex: none; }
.bar::before { content: ''; position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: var(--ink-3); }
.bar i { position: absolute; top: 0; bottom: 0; background: currentColor; opacity: .85; }
.src-line { margin-top: var(--sp-3); font-size: var(--fs-2xs); color: var(--ink-3); line-height: 1.7; }

@media (max-width: 1080px) {
  .figs { grid-template-columns: 1fr; }
  .strip { grid-template-columns: 1fr 1fr; }
  .cell + .cell { padding-left: 0; border-left: 0; }
  .cell { border-bottom: 1px solid var(--rule); padding-right: var(--sp-3); }
  .cell:nth-child(even) { padding-left: var(--sp-3); border-left: 1px solid var(--rule); }
}
@media (max-width: 760px) {
  .title { font-size: var(--fs-3xl); }
  .deck { font-size: var(--fs-base); }
  .pb { grid-template-columns: 1fr; gap: var(--sp-3); }
  .fig-m { margin-left: 0; width: 100%; }
  .tbl-wrap { margin: 0 calc(-1 * var(--sp-4)); max-height: 70vh; }
}
</style>
