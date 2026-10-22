<template>
  <PageFrame title="行业比较与轮动" question="不同板块已发生的表现有什么差异？" :env="env" :loading="loading" @retry="load" @jump="tradeDate = $event">
    <template #tools>
      <div class="seg">
        <button v-for="t in IDX_TYPES" :key="t" :class="{ on: idxType === t }" @click="idxType = t">{{ t }}</button>
      </div>
      <input type="text" v-model="keyword" placeholder="搜索名称或代码" />
      <input type="date" v-model="tradeDate" aria-label="交易日" />
    </template>

    <div class="two-col">
      <div class="panel">
        <h2>板块数据<small>{{ rows.length }} / {{ items.length }} 个，点击列头排序，点击行查看近期序列</small></h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="left">板块</th>
                <th v-for="c in COLS" :key="c.key" class="sortable" @click="sortBy(c.key)">
                  {{ c.label }}{{ sortKey === c.key ? (sortDesc ? ' ↓' : ' ↑') : '' }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in pageRows" :key="r.sector_code" :class="['clickable', { selected: r.sector_code === selected }]"
                  @click="selected = r.sector_code">
                <td class="left">{{ r.sector_name }} <span class="muted">{{ r.sector_code }}</span></td>
                <td v-for="c in COLS" :key="c.key" :class="c.signed ? fmt.dir(r[c.key]) : ''">{{ c.f(r[c.key]) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="toolbar" style="margin-top:10px" v-if="pages > 1">
          <button class="btn" :disabled="page === 1" @click="page--">上一页</button>
          <span class="muted">第 {{ page }} / {{ pages }} 页</span>
          <button class="btn" :disabled="page === pages" @click="page++">下一页</button>
        </div>
        <p class="note">涨跌幅为小数口径换算的百分比；成交额、资金净流入单位为亿元。扩散度、成交额占比等指标的精确公式以数据中台定义为准。</p>
      </div>

      <div class="panel">
        <h2>相对强度—动量（RRG 原始坐标）</h2>
        <EChart :option="rrgOption" height="420px" />
        <p class="note">横轴为相对强度（RS-Ratio），纵轴为相对动量（RS-Momentum），参考线为 100。图形仅呈现历史相对位置。</p>
      </div>
    </div>

    <div class="panel" v-if="selected">
      <h2>{{ series.data?.sector_name || items.find((r) => r.sector_code === selected)?.sector_name || selected }} 近期序列
        <small v-if="canDetail">{{ series.data?.points?.length || 0 }} / {{ series.data?.requested_days || 5 }} 个交易日
          <span v-if="series.status === 'partial'">（不足，未插值）</span></small></h2>
      <div v-if="!canDetail" class="lock-card">近期序列属于下钻明细，需要 {{ session.user?.perm_min_role?.['data.detail'] || '更高等级' }}。<router-link to="/plans">查看会员套餐</router-link></div>
      <div v-else-if="seriesLoading" class="empty-state">加载中…</div>
      <div v-else-if="series.status && !['ok', 'partial', 'empty'].includes(series.status)" class="empty-state">序列暂时无法加载，请稍后重试。</div>
      <div v-else-if="!series.data?.points?.length" class="empty-state">没有可用序列。</div>
      <div v-else class="two-col">
        <EChart :option="seriesOption" height="280px" />
        <EChart :option="trailOption" height="280px" />
      </div>
    </div>
  </PageFrame>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import PageFrame from '../components/PageFrame.vue'
import EChart from '../components/EChart.vue'
import { fmt, getModule } from '../api'
import { useModule } from '../useModule'
import { can, session } from '../auth'

const canDetail = computed(() => can('data.detail'))

const IDX_TYPES = ['行业板块', '概念板块', '地域板块']
const COLS = [
  { key: 'sector_return', label: '涨跌幅', f: (v) => fmt.pct(v), signed: true },
  { key: 'sector_return_5d', label: '5日', f: (v) => fmt.pct(v), signed: true },
  { key: 'sector_return_20d', label: '20日', f: (v) => fmt.pct(v), signed: true },
  { key: 'amount', label: '成交额', f: (v) => fmt.num(v, 1) },
  { key: 'turnover_rate', label: '换手率%', f: (v) => fmt.num(v) },
  { key: 'up_stock_ratio', label: '上涨成分占比', f: (v) => fmt.ratio(v) },
  { key: 'above_ma20_ratio', label: '站上MA20占比', f: (v) => fmt.ratio(v) },
  { key: 'di', label: '扩散度', f: (v) => fmt.num(v, 3) },
  { key: 'amount_ratio_ma20', label: '量比MA20', f: (v) => fmt.num(v) },
  { key: 'net_flow_1d', label: '净流入1日', f: (v) => fmt.num(v), signed: true },
  { key: 'net_flow_5d', label: '净流入5日', f: (v) => fmt.num(v), signed: true },
]
const PAGE_SIZE = 50

const idxType = ref('行业板块')
const tradeDate = ref('')
const keyword = ref('')
const sortKey = ref('sector_return')
const sortDesc = ref(true)
const page = ref(1)
const selected = ref('')

const { env, loading, load } = useModule('industries', () => ({ idx_type: idxType.value, trade_date: tradeDate.value }))
const items = computed(() => env.value.data?.items || [])
const rows = computed(() => {
  const kw = keyword.value.trim()
  const list = kw ? items.value.filter((r) => r.sector_name?.includes(kw) || r.sector_code?.includes(kw)) : [...items.value]
  const k = sortKey.value
  return list.sort((a, b) => {
    if (a[k] == null) return 1
    if (b[k] == null) return -1
    return sortDesc.value ? b[k] - a[k] : a[k] - b[k]
  })
})
const pages = computed(() => Math.max(1, Math.ceil(rows.value.length / PAGE_SIZE)))
const pageRows = computed(() => rows.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch([idxType, keyword, tradeDate], () => { page.value = 1; selected.value = '' })

function sortBy(k) {
  if (sortKey.value === k) sortDesc.value = !sortDesc.value
  else { sortKey.value = k; sortDesc.value = true }
}

const rrgOption = computed(() => ({
  tooltip: { formatter: (p) => `${p.data[2]}<br/>RS ${p.data[0]}<br/>Mom ${p.data[1]}` },
  grid: { left: 50, right: 30, top: 40, bottom: 40 },
  xAxis: { type: 'value', scale: true, name: 'RS-Ratio', nameLocation: 'middle', nameGap: 26 },
  yAxis: { type: 'value', scale: true, name: 'RS-Momentum' },
  series: [{
    type: 'scatter', symbolSize: 9, itemStyle: { color: '#2f5d9b', opacity: 0.75 },
    data: rows.value.filter((r) => r.rs_ratio != null && r.rs_momentum != null)
      .map((r) => [r.rs_ratio, r.rs_momentum, r.sector_name]),
    markLine: { silent: true, symbol: 'none', lineStyle: { color: '#9aa3b2', type: 'dashed' },
      data: [{ xAxis: 100 }, { yAxis: 100 }] },
  }],
}))

const series = ref({})
const seriesLoading = ref(false)
watch(selected, async (code) => {
  if (!code || !canDetail.value) return
  seriesLoading.value = true
  series.value = await getModule(`industries/${encodeURIComponent(code)}/series`, { end_date: env.value.trade_date })
  seriesLoading.value = false
})
const pts = computed(() => series.value.data?.points || [])
const seriesOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['涨跌幅%', '净流入(亿元)'] },
  grid: { left: 50, right: 50, top: 36, bottom: 30 },
  xAxis: { type: 'category', data: pts.value.map((p) => p.trade_date) },
  yAxis: [{ type: 'value', name: '%' }, { type: 'value', name: '亿元' }],
  series: [
    { name: '涨跌幅%', type: 'bar', data: pts.value.map((p) => (p.sector_return == null ? null : +(p.sector_return * 100).toFixed(2))),
      itemStyle: { color: (p) => (p.value >= 0 ? '#d0342c' : '#1a8f4c') } },
    { name: '净流入(亿元)', type: 'line', yAxisIndex: 1, data: pts.value.map((p) => p.net_flow_1d), itemStyle: { color: '#2f5d9b' } },
  ],
}))
const trailOption = computed(() => ({
  tooltip: { formatter: (p) => `${p.data[2]}<br/>RS ${p.data[0]}<br/>Mom ${p.data[1]}` },
  grid: { left: 50, right: 30, top: 40, bottom: 40 },
  xAxis: { type: 'value', scale: true, name: 'RS-Ratio', nameLocation: 'middle', nameGap: 26 },
  yAxis: { type: 'value', scale: true },
  series: [{
    type: 'line', symbolSize: 8, itemStyle: { color: '#2f5d9b' },
    data: pts.value.filter((p) => p.rs_ratio != null).map((p) => [p.rs_ratio, p.rs_momentum, p.trade_date]),
    markLine: { silent: true, symbol: 'none', lineStyle: { color: '#9aa3b2', type: 'dashed' }, data: [{ xAxis: 100 }, { yAxis: 100 }] },
  }],
}))
</script>
