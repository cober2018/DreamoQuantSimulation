<!-- 偏离程度 0–100 的刻度尺：只表示离常态多远，用于当天排序，不代表方向 -->
<template>
  <span class="sm" :class="{ big }" role="img" :aria-label="`偏离程度 ${Math.round(value)}，满分 100`">
    <span class="cap" aria-hidden="true">偏离</span>
    <span class="scale" aria-hidden="true">
      <i v-for="n in 11" :key="n" :style="{ left: (n - 1) * 10 + '%' }" :class="{ major: (n - 1) % 5 === 0 }" />
      <b :style="{ width: value + '%' }" />
    </span>
    <span class="v tnum" aria-hidden="true">{{ Math.round(value) }}</span>
  </span>
</template>

<script setup>
defineProps({ value: { type: Number, required: true }, big: Boolean })
</script>

<style scoped>
.sm { display: inline-flex; align-items: center; gap: var(--s-2); font-size: var(--fs-2xs); color: var(--c-ink-3); }
.scale { position: relative; width: 88px; height: 10px; }
.big .scale { width: 200px; height: 12px; }
.scale i { position: absolute; bottom: 0; width: 1px; height: 3px; background: var(--c-line-strong); }
.scale i.major { height: 6px; }
.scale b { position: absolute; left: 0; bottom: 0; height: 2px; background: var(--c-star); transform-origin: left; animation: grow var(--dur-slow) var(--ease-out) both; }
.scale b::after { content: ""; position: absolute; right: -3px; bottom: -2px; width: 6px; height: 6px; border-radius: 50%; background: inherit; }
:global(.fact.on) .scale b, .big .scale b { background: var(--c-accent); }
.v { min-width: 3ch; color: var(--c-ink-2); font-size: var(--fs-xs); }
.big .v { font-size: var(--fs-sm); color: var(--c-ink); }
@keyframes grow { from { transform: scaleX(0); } }
</style>
