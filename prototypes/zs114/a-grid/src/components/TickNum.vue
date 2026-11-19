<template>
  <!-- 终值占位锁定宽度，滚动中的数字叠在同一格里，避免布局偏移；读屏只读终值 -->
  <span class="num tick"><span class="sr-only">{{ text }}</span><span class="ghost" aria-hidden="true">{{ text }}</span><span class="live" aria-hidden="true">{{ shown }}</span></span>
</template>
<script setup>
// 数字滚入：只动数值位，保留原文的符号、千分位与小数位，结束态与原文逐字相同
import { onMounted, ref, watch, onBeforeUnmount } from 'vue'
import { reducedMotion } from '../lib/env.js'

const props = defineProps({ text: { type: String, required: true }, delay: { type: Number, default: 0 } })
const shown = ref(props.text)
let raf = 0

function run() {
  cancelAnimationFrame(raf)
  const m = props.text.match(/^([^\d]*)([\d,]*\.?\d*)(.*)$/)
  if (!m || reducedMotion()) { shown.value = props.text; return }
  const [, pre, body, post] = m
  const target = parseFloat(body.replace(/,/g, ''))
  const dec = (body.split('.')[1] || '').length
  const comma = body.includes(',')
  const dur = 640
  const t0 = performance.now() + props.delay
  const fmt = (v) => pre + (comma ? v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec)) + post
  shown.value = fmt(0)
  const step = (now) => {
    const p = Math.min(1, Math.max(0, (now - t0) / dur))
    const e = 1 - Math.pow(1 - p, 3)
    shown.value = p >= 1 ? props.text : fmt(target * e)
    if (p < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}
onMounted(run)
watch(() => props.text, run)
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>
<style scoped>
.tick { display: inline-grid; justify-items: end; }
.ghost, .live { grid-area: 1 / 1; }
.ghost { visibility: hidden; }
</style>
