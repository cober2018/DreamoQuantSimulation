<template>
  <section class="panel" aria-labelledby="industries-table-title">
    <h2 id="industries-table-title">全行业表<small>{{ rows.length }} / {{ items.length }} 个，点击列头排序，点击名称查看近期序列</small></h2>
    <div class="table-wrap" tabindex="0" role="region" aria-label="全行业表，可横向滚动">
      <table id="industries-table">
        <thead>
          <tr>
            <th class="left" scope="col">板块</th>
            <th v-for="c in COLS" :key="c.key" scope="col" :aria-sort="ariaSort(c.key)">
              <button type="button" class="sort-btn" :id="`industries-sort-${c.key}`" @click="sortBy(c.key)">{{ c.label }}{{ sortIcon(c.key) }}</button>
            </th>
            <th scope="col">近 20 日累计涨跌</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in pageRows" :key="r.sector_code" :class="{ selected: r.sector_code === selected }">
            <td class="left">
              <button type="button" class="name-btn" :id="`industries-row-${r.sector_code}`"
                      :aria-pressed="r.sector_code === selected" @click="$emit('select', r.sector_code)">{{ r.sector_name }}</button>
              <span class="muted">{{ r.sector_code }}</span>
            </td>
            <td v-for="c in COLS" :key="c.key" :class="cellClass(c, r)">{{ cellText(c, r) }}</td>
            <td class="spark-td">
              <IndustrySparkline :key="`${endDate}|${r.sector_code}`" :code="r.sector_code" :name="r.sector_name"
                                 :end-date="endDate" :can-detail="canDetail" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="toolbar pager" v-if="pages > 1">
      <button class="btn" type="button" :disabled="page === 1" @click="page--">上一页</button>
      <span class="muted">第 {{ page }} / {{ pages }} 页</span>
      <button class="btn" type="button" :disabled="page === pages" @click="page++">下一页</button>
    </div>
    <p class="note">涨跌幅为小数口径换算的百分比；资金净流入单位为亿元。扩散度、成交额占比等指标的精确公式以数据中台定义为准。
      <span v-if="!canDetail">迷你折线和近期序列需要 {{ lockText }} 等级。</span>
    </p>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import IndustrySparkline from './IndustrySparkline.vue'
import { fmt } from '../../api'
import { cellPending } from '../../lib/industryPending.js'

const props = defineProps({
  items: { type: Array, default: () => [] },
  keyword: { type: String, default: '' },
  day: { type: String, default: '' },
  endDate: { type: String, default: '' },
  canDetail: { type: Boolean, default: false },
  lockText: { type: String, default: '更高' },
  selected: { type: String, default: '' },
})
defineEmits(['select'])

const COLS = [
  { key: 'sector_return', label: '涨跌幅', f: (v) => fmt.pct(v), signed: true },
  { key: 'sector_return_5d', label: '5日', f: (v) => fmt.pct(v), signed: true },
  { key: 'sector_return_20d', label: '20日', f: (v) => fmt.pct(v), signed: true },
  { key: 'amount', label: '成交额', f: (v) => fmt.num(v, 1) },
  { key: 'turnover_rate', label: '换手率%', f: (v) => fmt.num(v) },
  { key: 'up_stock_ratio', label: '上涨成分占比', f: (v) => fmt.ratio(v) },
  { key: 'above_ma20_ratio', label: '站上MA20占比', f: (v) => fmt.ratio(v) },
  { key: 'new_high_20d_ratio', label: '20日新高占比', f: (v) => fmt.ratio(v) },
  { key: 'di', label: '扩散度', f: (v) => fmt.num(v, 3) },
  { key: 'amount_ratio_ma20', label: '量比MA20', f: (v) => fmt.num(v) },
  { key: 'net_flow_1d', label: '净流入1日', f: (v) => fmt.num(v), signed: true },
  { key: 'net_flow_5d', label: '净流入5日', f: (v) => fmt.num(v), signed: true },
  { key: 'net_flow_20d', label: '净流入20日', f: (v) => fmt.num(v), signed: true },
]
const PAGE_SIZE = 50

const sortKey = ref('sector_return')
const sortDesc = ref(true)
const page = ref(1)

const valueOf = (r, k) => (cellPending(k, r, props.day) ? null : r[k])
const rows = computed(() => {
  const kw = props.keyword.trim()
  const list = kw ? props.items.filter((r) => r.sector_name?.includes(kw) || r.sector_code?.includes(kw)) : [...props.items]
  const k = sortKey.value
  return list.sort((a, b) => {
    const av = valueOf(a, k)
    const bv = valueOf(b, k)
    if (av == null) return 1
    if (bv == null) return -1
    return sortDesc.value ? bv - av : av - bv
  })
})
const pages = computed(() => Math.max(1, Math.ceil(rows.value.length / PAGE_SIZE)))
const pageRows = computed(() => rows.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch(() => [props.items, props.keyword], () => { page.value = 1 })

function sortBy(k) {
  if (sortKey.value === k) sortDesc.value = !sortDesc.value
  else { sortKey.value = k; sortDesc.value = true }
}
const sortIcon = (k) => (sortKey.value === k ? (sortDesc.value ? ' ↓' : ' ↑') : '')
const ariaSort = (k) => (sortKey.value === k ? (sortDesc.value ? 'descending' : 'ascending') : 'none')

// 待更新与 null 统一显示「数据待更新」，不显示 0 或 -0
// 上游 field_status：更正中（06-01 前成交额、接缝期的量比与拥挤分位）；真缺数「数据待更新」；说明不可用单独标注
const CORRECTING = ['amount_pre_correction', 'insufficient_lookback']
const statusText = (c, r) => {
  const st = r.field_status?.[c.key]
  if (st && CORRECTING.includes(st)) return '更正中'
  if (st === 'explanation_unavailable') return '说明暂不可用'
  if (st === 'unavailable') return '数据待更新'
  return null
}
const cellText = (c, r) => statusText(c, r) || (cellPending(c.key, r, props.day) ? '数据待更新' : c.f(r[c.key] + 0))
const cellClass = (c, r) => (cellText(c, r) !== c.f(r[c.key] + 0) ? 'muted' : c.signed ? fmt.dir(r[c.key]) : '')
</script>

<style scoped>
.sort-btn, .name-btn { all: unset; cursor: pointer; font: inherit; color: inherit; }
.sort-btn:focus-visible, .name-btn:focus-visible { outline: 2px solid var(--c-focus); outline-offset: 2px; border-radius: 2px; }
.name-btn:hover { text-decoration: underline; }
.spark-td { text-align: center; }
.pager { margin-top: 10px; }
tr.selected td { background: var(--c-surface-2); }
</style>
