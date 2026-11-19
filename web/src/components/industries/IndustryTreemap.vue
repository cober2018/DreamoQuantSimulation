<template>
  <section class="panel" aria-labelledby="industries-treemap-title">
    <h2 id="industries-treemap-title">涨跌与成交地图<small>面积为成交额，颜色为涨跌（红涨绿跌）</small></h2>
    <div v-if="!nodes.length" class="empty-state" role="status">数据待更新</div>
    <EChart v-else :option="option" height="380px" />
    <p class="note">成交额早于 2026-09-18 或为空的行业不计入面积，显示「数据待更新」，不以 0 计。已计入 {{ nodes.length }} 个行业，待更新 {{ pendingCount }} 个。</p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import EChart from '../EChart.vue'
import { fmt } from '../../api'
import { isPending } from '../../lib/industryPending.js'
import { retColor, GRID_LINE } from './palette.js'

const props = defineProps({
  items: { type: Array, default: () => [] },
  day: { type: String, default: '' },
})

const nodes = computed(() => props.items
  .filter((r) => r.amount > 0 && !isPending('amount', r, props.day))
  .map((r) => ({
    name: r.sector_name,
    value: r.amount,
    ret: r.sector_return,
    itemStyle: { color: retColor(r.sector_return) },
  })))
const pendingCount = computed(() => props.items.length - nodes.value.length)

const option = computed(() => ({
  animation: false,
  tooltip: {
    formatter: (p) => `${p.name}<br/>成交额 ${fmt.num(p.value, 1)} 亿元<br/>涨跌幅 ${fmt.pct(p.data.ret)}`,
  },
  series: [{
    type: 'treemap',
    roam: false,
    nodeClick: false,
    breadcrumb: { show: false },
    width: '100%',
    height: '100%',
    data: nodes.value,
    label: {
      show: true,
      color: '#fff',
      fontSize: 12,
      formatter: (p) => `${p.name}\n${fmt.pct(p.data.ret)}`,
    },
    itemStyle: { borderColor: GRID_LINE, borderWidth: 2, gapWidth: 2 },
    levels: [],
  }],
}))
</script>
