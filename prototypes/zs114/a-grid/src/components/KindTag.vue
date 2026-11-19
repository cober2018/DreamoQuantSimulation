<template>
  <span class="kind" :title="`要点类型：${kind}`">
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path v-if="kind === '极值'" d="M1 10.5h10M2.5 10.5V7M5 10.5V5M7.5 10.5V1.5M10 10.5V6" />
      <path v-else-if="kind === '变化'" d="M1.5 9.5 6 2.5l4.5 7z" />
      <path v-else-if="kind === '连续'" d="M1 9h2M5 9h2M9 9h2M1 6h2M5 6h2M9 6h2M1 3h2M5 3h2M9 3h2" />
      <path v-else-if="kind === '背离'" d="M1 6h3l7-4.5M4 6l7 4.5" />
      <path v-else-if="kind === '排名'" d="M1.5 2.5h9M1.5 6h6M1.5 9.5h3.5" />
      <path v-else d="M2 2.5h8v8H2zM2 5h8M4.5 1v3M7.5 1v3" />
    </svg>
    <span>{{ kind }}</span><span class="code mono" aria-hidden="true">{{ KIND_CODE[kind] }}</span>
  </span>
</template>
<script setup>
import { KIND_CODE } from '../lib/facts.js'
defineProps({ kind: { type: String, required: true } })
</script>
<style scoped>
.kind { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px 0 6px; border: 1px solid var(--c-line-strong); border-radius: var(--r-xs); font-size: var(--fs-2xs); font-weight: 600; color: var(--c-ink); white-space: nowrap; }
.kind svg { fill: none; stroke: currentColor; stroke-width: 1.2; stroke-linecap: square; color: var(--c-ink-2); }
.code { font-size: 10px; color: var(--c-muted); font-weight: 400; letter-spacing: .04em; }
</style>
