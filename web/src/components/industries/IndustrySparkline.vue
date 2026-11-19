<template>
  <span ref="el" class="spark-cell">
    <svg v-if="path" class="spark" viewBox="0 0 96 28" preserveAspectRatio="none" role="img"
         :aria-label="`${name} 近 ${count} 日累计涨跌幅`">
      <polyline :points="path" />
    </svg>
    <span v-else class="muted">{{ canDetail ? '—' : '需更高等级' }}</span>
  </span>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { ensureIndustrySeries } from './useIndustrySeries.js'

// 进入视口才取数：全行业表一页 50 行，不在屏内的行不发请求
const props = defineProps({
  code: { type: String, required: true },
  name: { type: String, default: '' },
  endDate: { type: String, default: '' },
  canDetail: { type: Boolean, default: false },
})

const el = ref(null)
const entry = shallowRef(null)
let io

onMounted(() => {
  if (!props.canDetail) return
  if (typeof IntersectionObserver === 'undefined') {
    entry.value = ensureIndustrySeries(props.code, props.endDate)
    return
  }
  io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return
    entry.value = ensureIndustrySeries(props.code, props.endDate)
    io.disconnect()
  }, { rootMargin: '160px' })
  io.observe(el.value)
})
onBeforeUnmount(() => io?.disconnect())

// 累计涨跌幅自窗口首日起算；缺值日不计入累计，不当作 0
const cumulative = computed(() => {
  let cum = 1
  return (entry.value?.points || []).map((p) => {
    if (p.sector_return != null) cum *= 1 + p.sector_return
    return cum - 1
  })
})
const count = computed(() => cumulative.value.length)
const path = computed(() => {
  const vals = cumulative.value
  if (vals.length < 2) return ''
  const lo = Math.min(...vals)
  const span = Math.max(...vals) - lo || 1
  return vals
    .map((v, i) => `${((i / (vals.length - 1)) * 96).toFixed(1)},${(26 - ((v - lo) / span) * 24).toFixed(1)}`)
    .join(' ')
})
</script>

<style scoped>
.spark-cell { display: inline-flex; align-items: center; justify-content: center; width: 96px; height: 28px; }
.spark { width: 96px; height: 28px; overflow: visible; }
.spark polyline { fill: none; stroke: var(--c-viz-3); stroke-width: 1.5; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
.muted { font-size: 12px; }
</style>
