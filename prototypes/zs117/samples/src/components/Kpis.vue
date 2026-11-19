<!-- 模块顶部的读数条：只列最新值和它的单位，不做评价 -->
<template>
  <dl class="kpis tnum">
    <div v-for="k in items" :key="k.label" class="k">
      <dt>{{ k.label }}</dt>
      <dd><span :class="k.tone">{{ k.value }}</span><small v-if="k.unit">{{ k.unit }}</small></dd>
    </div>
  </dl>
</template>
<script setup>
defineProps({ items: Array })
</script>
<style scoped>
.kpis { display: flex; flex-wrap: wrap; gap: var(--s-2) var(--s-5); }
.k { display: flex; flex-direction: column; gap: 2px; }
dt { font-size: var(--fs-2xs); color: var(--c-ink-3); }
dd { margin: 0; font-size: var(--fs-lg); font-weight: 500; color: var(--c-ink); }
dd small { margin-left: 3px; font-size: var(--fs-2xs); color: var(--c-ink-3); font-weight: 400; }
@media (max-width: 640px) { dd { font-size: var(--fs-md); } .kpis { gap: var(--s-2) var(--s-4); } }
</style>
