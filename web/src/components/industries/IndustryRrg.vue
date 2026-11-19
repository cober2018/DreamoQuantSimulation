<template>
  <section class="panel" aria-labelledby="industries-rrg-title">
    <h2 id="industries-rrg-title">相对旋转图（RRG）<small>散点为当日位置，线为近 5 个交易日轨迹</small></h2>
    <div v-if="inWindow" class="empty-state" role="status">数据待更新</div>
    <template v-else>
      <EChart :option="option" height="380px" />
      <ul class="legend" aria-label="象限图例">
        <li v-for="q in QUADRANTS" :key="q.key"><i :style="{ background: q.color }" />{{ q.label }}</li>
      </ul>
    </template>
    <p class="note">横轴为相对强度 RS-Ratio，纵轴为相对动量 RS-Momentum，参考线为 {{ rrgRef }}。颜色只表示象限位置，图形仅呈现历史相对位置。</p>
    <p v-if="inWindow" class="note">该日期的 RS 指标窗口跨到 2026-09-18 之前，数据待更新，图中留空。</p>
    <p v-else-if="!canDetail" class="note">5 日轨迹需要 {{ lockText }} 等级，当前只显示当日位置。</p>
    <p v-else class="note">轨迹为成交额前 10 个行业的近 5 个交易日。</p>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import EChart from '../EChart.vue'
import { isPending, rollingMask } from '../../lib/industryPending.js'
import { ensureIndustrySeries } from './useIndustrySeries.js'
import { QUADRANTS, quadrantOf, GRID_LINE, INK_MUTED } from './palette.js'

const props = defineProps({
  items: { type: Array, default: () => [] },
  day: { type: String, default: '' },
  endDate: { type: String, default: '' },
  inWindow: { type: Boolean, default: false },
  rrgRef: { type: Number, default: 100 },
  canDetail: { type: Boolean, default: false },
  lockText: { type: String, default: '更高' },
})

const TRAIL_N = 10
const TRAIL_DAYS = 5

const points = computed(() => (props.inWindow ? [] : props.items
  .filter((r) => r.rs_ratio != null && r.rs_momentum != null)
  .map((r) => ({ name: r.sector_name, x: r.rs_ratio, y: r.rs_momentum, q: quadrantOf(r.rs_ratio, r.rs_momentum, props.rrgRef) }))))

// 轨迹只取成交额前 10 个行业，成交额待更新的行业不参与排序
const trailCodes = computed(() => (props.inWindow || !props.canDetail ? [] : props.items
  .filter((r) => r.amount > 0 && !isPending('amount', r, props.day) && r.rs_ratio != null && r.rs_momentum != null)
  .sort((a, b) => b.amount - a.amount)
  .slice(0, TRAIL_N)
  .map((r) => r.sector_code)))

const trailEntries = ref({})
watch(() => [trailCodes.value, props.endDate], ([codes, endDate]) => {
  trailEntries.value = Object.fromEntries(codes.map((c) => [c, ensureIndustrySeries(c, endDate)]))
}, { immediate: true })

const trails = computed(() => trailCodes.value.map((code) => {
  const pts = (trailEntries.value[code]?.points || [])
    .filter((p) => p.rs_ratio != null && p.rs_momentum != null && !rollingMask(p.trade_date).rs)
    .slice(-TRAIL_DAYS)
  const name = props.items.find((r) => r.sector_code === code)?.sector_name || code
  const last = pts[pts.length - 1]
  const color = last ? quadrantOf(last.rs_ratio, last.rs_momentum, props.rrgRef).color : INK_MUTED
  return { name, color, pts: pts.map((p) => ({ value: [p.rs_ratio, p.rs_momentum], name })) }
}).filter((t) => t.pts.length >= 2))

const refLines = computed(() => [{ xAxis: props.rrgRef }, { yAxis: props.rrgRef }])
const option = computed(() => ({
  animation: false,
  tooltip: {
    formatter: (p) => `${p.data.name}<br/>RS ${p.data.value[0].toFixed(2)}<br/>动量 ${p.data.value[1].toFixed(2)}`,
  },
  grid: { left: 52, right: 24, top: 28, bottom: 44 },
  xAxis: { type: 'value', scale: true, name: 'RS-Ratio', nameLocation: 'middle', nameGap: 28, splitLine: { lineStyle: { color: GRID_LINE } } },
  yAxis: { type: 'value', scale: true, name: 'RS-Momentum', splitLine: { lineStyle: { color: GRID_LINE } } },
  series: [
    ...trails.value.map((t) => ({
      type: 'line', name: t.name, symbol: 'circle', symbolSize: 4, z: 2, data: t.pts,
      lineStyle: { width: 1.2, opacity: 0.5, color: t.color }, itemStyle: { color: t.color },
    })),
    {
      type: 'scatter', symbolSize: 9, z: 3,
      data: points.value.map((p) => ({ value: [p.x, p.y], name: p.name, itemStyle: { color: p.q.color, opacity: 0.85 } })),
      markLine: { silent: true, symbol: 'none', lineStyle: { color: INK_MUTED, type: 'dashed' }, data: refLines.value },
    },
  ],
}))
</script>

<style scoped>
.legend { display: flex; flex-wrap: wrap; gap: 8px 16px; list-style: none; padding: 0; margin: 8px 0 0; font-size: 12px; color: var(--c-ink-3); }
.legend li { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
</style>
