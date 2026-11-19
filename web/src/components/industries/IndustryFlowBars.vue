<template>
  <section class="panel" aria-labelledby="industries-flow-title">
    <h2 id="industries-flow-title">资金净流入<small>前后各 10 个行业，单位亿元</small></h2>
    <div class="toolbar">
      <div class="seg" role="group" aria-label="资金净流入周期">
        <button v-for="p in PERIODS" :key="p.key" type="button" :id="`industries-flow-${p.key}`"
                :class="{ on: period === p.key }" :aria-pressed="period === p.key" @click="period = p.key">{{ p.label }}</button>
      </div>
    </div>
    <div v-if="!bars.length" class="empty-state" role="status">没有可用的净流入数据</div>
    <EChart v-else :option="option" :height="`${Math.max(240, bars.length * 24 + 40)}px`" />
    <p class="note">红色为净流入，绿色为净流出。净流入为空的行业不计入，不以 0 计。</p>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import EChart from '../EChart.vue'
import { fmt } from '../../api'
import { retColor, GRID_LINE } from './palette.js'

const props = defineProps({ items: { type: Array, default: () => [] } })

const PERIODS = [{ key: '1d', label: '1 日' }, { key: '5d', label: '5 日' }, { key: '20d', label: '20 日' }]
const period = ref('1d')
const TOP_N = 10

// 前 10 个净流入在上，前 10 个净流出在下；按周期取值，空值跳过
const bars = computed(() => {
  const k = `net_flow_${period.value}`
  const ranked = props.items
    .filter((r) => r[k] != null)
    .map((r) => ({ name: r.sector_name, value: r[k] + 0 }))
    .sort((a, b) => b.value - a.value)
  const inflow = ranked.filter((r) => r.value > 0).slice(0, TOP_N)
  const outflow = ranked.filter((r) => r.value < 0).slice(-TOP_N)
  return [...inflow, ...outflow]
})

const option = computed(() => ({
  animation: false,
  grid: { left: 96, right: 56, top: 8, bottom: 24 },
  tooltip: { formatter: (p) => `${p.name}<br/>净流入 ${fmt.num(p.value, 2)} 亿元` },
  xAxis: { type: 'value', splitLine: { lineStyle: { color: GRID_LINE } }, axisLabel: { formatter: (v) => fmt.num(v, 0) } },
  yAxis: { type: 'category', inverse: true, data: bars.value.map((r) => r.name), axisLabel: { width: 84, overflow: 'truncate' } },
  series: [{
    type: 'bar',
    barMaxWidth: 14,
    data: bars.value.map((r) => ({ value: r.value, itemStyle: { color: retColor(r.value) } })),
    label: { show: true, position: 'right', formatter: (p) => fmt.num(p.value, 1), fontSize: 11 },
  }],
}))
</script>
