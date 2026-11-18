<!-- 页头：标题、数据日期常显、原型状态切换（写进 URL ?state=） -->
<template>
  <header class="head">
    <div>
      <p class="eyebrow">明细 · 精简版样张</p>
      <h1 class="display">{{ title }}</h1>
      <p class="lede">{{ lede }}</p>
    </div>
    <dl class="meta tnum">
      <div v-for="m in meta" :key="m.k"><dt>{{ m.k }}</dt><dd>{{ m.v }}</dd></div>
    </dl>
  </header>
  <div class="bar">
    <p class="sample"><span class="badge sample">样张</span>真实数据只读快照，未接线上；状态与层级切换只为评审。</p>
    <label class="preview">
      <span>预览状态</span>
      <select id="state-preview" :value="state" @change="setState($event.target.value)">
        <option v-for="s in STATES" :key="s.v" :value="s.v">{{ s.label }}</option>
      </select>
    </label>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { STATES, usePreviewState } from '../lib/state.js'
defineProps({ title: String, lede: String, meta: Array })
const state = usePreviewState()
const route = useRoute(), router = useRouter()
function setState(v) { const q = { ...route.query }; if (v) q.state = v; else delete q.state; router.replace({ query: q }) }
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--s-4); flex-wrap: wrap; }
.eyebrow { font-size: var(--fs-xs); letter-spacing: 0.16em; color: var(--c-accent-ink); margin-bottom: var(--s-2); }
h1 { font-size: var(--fs-2xl); line-height: 1.15; }
.lede { margin-top: var(--s-2); max-width: 640px; font-size: var(--fs-sm); color: var(--c-ink-2); line-height: 1.7; }
.meta { display: flex; gap: var(--s-5); flex-wrap: wrap; }
.meta div { display: flex; flex-direction: column; gap: 2px; }
.meta dt { font-size: var(--fs-2xs); color: var(--c-ink-3); letter-spacing: 0.08em; }
.meta dd { margin: 0; font-size: var(--fs-md); color: var(--c-ink); font-weight: 500; }
.bar { margin-top: var(--s-4); display: flex; justify-content: space-between; align-items: center; gap: var(--s-3); flex-wrap: wrap; }
.sample { display: flex; align-items: center; gap: var(--s-2); font-size: var(--fs-xs); color: var(--c-ink-3); flex-wrap: wrap; }
.preview { display: flex; align-items: center; gap: var(--s-2); font-size: var(--fs-xs); color: var(--c-ink-2); }
.preview select { appearance: none; height: 32px; padding: 0 var(--s-6) 0 var(--s-3); border-radius: var(--r-2); border: 1px solid var(--c-line-strong); color: var(--c-ink); font: inherit; font-size: var(--fs-sm); cursor: pointer; background: var(--c-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238893a6' stroke-width='1.2'/%3E%3C/svg%3E") no-repeat right 10px center; }
@media (max-width: 640px) {
  h1 { font-size: var(--fs-xl); }
  .meta { gap: var(--s-4); width: 100%; }
  .meta dd { font-size: var(--fs-sm); }
  .preview { width: 100%; justify-content: space-between; }
}
</style>
