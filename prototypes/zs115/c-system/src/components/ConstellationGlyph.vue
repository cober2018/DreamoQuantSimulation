<!-- 数据页的「星座」小图：同一个指标名永远落在同一位置，和首屏星图同一套哈希，作为每个数据页的识别符号 -->
<template>
  <svg class="cg" width="72" height="36" viewBox="0 0 72 36" aria-hidden="true">
    <polyline :points="pts.map((p) => p.join(',')).join(' ')" />
    <circle v-for="(p, i) in pts" :key="i" :cx="p[0]" :cy="p[1]" :r="i === lead ? 2.6 : 1.5" :class="{ lead: i === lead }" />
  </svg>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ names: Array })
const hash = (s, k = 0) => { let h = 2166136261 ^ k; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000 }
const pts = computed(() => props.names.map((n, i, a) => [Math.round(6 + (60 * (i + hash(n) * 0.6)) / a.length), Math.round(6 + 24 * hash(n, 7))]))
const lead = computed(() => pts.value.reduce((b, p, i, a) => (p[1] < a[b][1] ? i : b), 0))
</script>

<style scoped>
.cg { overflow: visible; }
polyline { fill: none; stroke: var(--c-line-strong); stroke-width: 1; }
circle { fill: var(--c-star-dim); }
circle.lead { fill: var(--c-accent); }
</style>
