<template>
  <!-- 强度 0–100 的刻度尺：只表示偏离常态的程度，用于排序 -->
  <div class="sm" role="meter" :aria-valuenow="Math.round(value)" aria-valuemin="0" aria-valuemax="100" :aria-label="`偏离强度 ${Math.round(value)}，满分 100`">
    <div class="scale" :class="{ compact }">
      <i v-for="n in 11" :key="n" :style="{ left: `${(n - 1) * 10}%` }" :class="{ major: (n - 1) % 5 === 0 }"></i>
      <b :style="{ '--w': `${value}%` }"></b>
    </div>
    <span class="v mono">{{ Math.round(value).toString().padStart(3, ' ') }}</span>
  </div>
</template>
<script setup>
defineProps({ value: { type: Number, required: true }, compact: Boolean })
</script>
<style scoped>
.sm { display: flex; align-items: center; gap: 8px; }
.scale { position: relative; flex: 1; height: 12px; min-width: 64px; }
.scale i { position: absolute; bottom: 0; width: 1px; height: 4px; background: var(--c-line-strong); }
.scale i.major { height: 7px; }
.scale b { position: absolute; left: 0; bottom: 0; height: 2px; width: var(--w); background: var(--c-accent); transform-origin: left; animation: grow var(--dur-draw) var(--ease) both; }
.scale b::after { content: ''; position: absolute; right: -1px; bottom: 0; width: 2px; height: 10px; background: var(--c-accent); }
.v { font-size: var(--fs-2xs); color: var(--c-ink-2); min-width: 3ch; text-align: right; }
@keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
</style>
