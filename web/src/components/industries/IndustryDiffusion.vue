<template>
  <section class="panel" aria-labelledby="industries-diffusion-title">
    <h2 id="industries-diffusion-title">扩散度<small>按扩散度 di 从高到低排列</small></h2>
    <div v-if="!rows.length" class="empty-state" role="status">没有可用的扩散度数据</div>
    <EChart v-else :option="option" :height="`${Math.max(240, rows.length * 22 + 60)}px`" />
    <p class="note">两点之间的连线为两个占比的差。站上 20 日线占比、20 日新高占比为空的行业不画点。行业较多时显示 di 最高 20 个与最低 20 个。</p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import EChart from '../EChart.vue'
import { fmt } from '../../api'
import { GRID_LINE, INK_MUTED } from './palette.js'

const props = defineProps({ items: { type: Array, default: () => [] } })

const ABOVE = 'hsl(213, 53%, 38%)'
const NEW_HIGH = 'hsl(36, 78%, 32%)'
const CAP = 20

const rows = computed(() => {
  const sorted = props.items.filter((r) => r.di != null).sort((a, b) => b.di - a.di)
  return sorted.length > CAP * 2 ? [...sorted.slice(0, CAP), ...sorted.slice(-CAP)] : sorted
})

const option = computed(() => {
  const names = rows.value.map((r) => r.sector_name)
  const idx = rows.value.map((_, i) => i)
  const lo = rows.value.map((r) => (r.above_ma20_ratio == null || r.new_high_20d_ratio == null ? null : Math.min(r.above_ma20_ratio, r.new_high_20d_ratio)))
  const span = rows.value.map((r) => (r.above_ma20_ratio == null || r.new_high_20d_ratio == null ? null : Math.abs(r.above_ma20_ratio - r.new_high_20d_ratio)))
  const point = (key) => rows.value.map((r, i) => (r[key] == null ? null : [r[key], idx[i]]))
  return {
    animation: false,
    grid: { left: 96, right: 24, top: 34, bottom: 28 },
    legend: { top: 0, data: ['站上 MA20 占比', '20 日新高占比'] },
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        const r = rows.value[p.dataIndex]
        return `${r.sector_name}<br/>站上 MA20 ${fmt.ratio(r.above_ma20_ratio)}<br/>20 日新高 ${fmt.ratio(r.new_high_20d_ratio)}<br/>扩散度 ${fmt.num(r.di, 3)}`
      },
    },
    xAxis: { type: 'value', min: 0, max: 1, splitLine: { lineStyle: { color: GRID_LINE } }, axisLabel: { formatter: (v) => `${Math.round(v * 100)}%` } },
    yAxis: { type: 'category', inverse: true, data: names, axisLabel: { width: 84, overflow: 'truncate', color: INK_MUTED } },
    series: [
      { name: 'span-base', type: 'bar', stack: 'span', silent: true, data: lo, itemStyle: { color: 'transparent' }, tooltip: { show: false } },
      { name: 'span', type: 'bar', stack: 'span', silent: true, barWidth: 3, data: span, itemStyle: { color: GRID_LINE }, tooltip: { show: false } },
      { name: '站上 MA20 占比', type: 'scatter', symbolSize: 9, data: point('above_ma20_ratio'), itemStyle: { color: ABOVE } },
      { name: '20 日新高占比', type: 'scatter', symbolSize: 9, data: point('new_high_20d_ratio'), itemStyle: { color: NEW_HIGH } },
    ],
  }
})
</script>
