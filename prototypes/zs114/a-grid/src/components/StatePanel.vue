<template>
  <div class="st" :class="kind" :role="kind === 'error' ? 'alert' : 'status'" :aria-busy="kind === 'loading' || undefined">
    <template v-if="kind === 'loading'">
      <span class="sr-only">{{ title || '正在加载' }}</span>
      <div class="sk-rows" aria-hidden="true">
        <div v-for="n in rows" :key="n" class="sk-row">
          <i class="skel" style="width: 18%"></i><i class="skel" style="width: 9%"></i><i class="skel" style="width: 9%"></i><i class="skel" style="width: 12%"></i><i class="skel" style="flex: 1"></i>
        </div>
      </div>
    </template>
    <template v-else>
      <svg class="glyph" width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
        <g class="g-grid"><path d="M0 24h72M0 48h72M24 0v72M48 0v72" /></g>
        <rect x="0.5" y="0.5" width="71" height="71" class="g-frame" />
        <g v-if="kind === 'empty'" class="g-mark"><path d="M10 54h52" stroke-dasharray="3 3" /><path d="M10 14v40" /></g>
        <g v-else-if="kind === 'error'" class="g-mark"><path d="M8 50 20 40 28 44" /><path d="M44 30 52 22 64 26" /><path d="M33 33l6 6M39 33l-6 6" class="w" /></g>
        <g v-else-if="kind === 'locked'" class="g-mark"><rect x="24" y="32" width="24" height="20" /><path d="M29 32v-6a7 7 0 0 1 14 0v6" /><path d="M36 40v5" class="a" /></g>
        <g v-else-if="kind === 'nodate'" class="g-mark"><path d="M8 52h56" /><path d="M14 52v-8M24 52v-8M34 52v-8M54 52v-8M64 52v-8" /><path d="M44 52V30" class="a" stroke-dasharray="2 3" /><circle cx="44" cy="24" r="3" class="a" /></g>
      </svg>
      <div class="txt">
        <p class="code mono" v-if="code">{{ code }}</p>
        <h3>{{ title }}</h3>
        <p class="body"><slot>{{ body }}</slot></p>
        <div class="act" v-if="$slots.actions"><slot name="actions" /></div>
      </div>
    </template>
  </div>
</template>
<script setup>
defineProps({ kind: { type: String, required: true }, title: String, body: String, code: String, rows: { type: Number, default: 6 } })
</script>
<style scoped>
.st { display: flex; align-items: center; gap: 24px; padding: 32px 24px; min-height: 180px; }
.glyph { flex: none; }
.g-grid path { stroke: var(--c-line); stroke-width: 1; fill: none; }
.g-frame { fill: none; stroke: var(--c-line-strong); stroke-width: 1; }
.g-mark path, .g-mark rect, .g-mark circle { fill: none; stroke: var(--c-ink-2); stroke-width: 1.4; stroke-linecap: square; }
.g-mark .a { stroke: var(--c-accent); }
.g-mark .w { stroke: var(--c-warn); }
.txt { max-width: 52ch; }
.code { font-size: var(--fs-2xs); color: var(--c-muted); margin-bottom: 4px; letter-spacing: .04em; }
.error .code { color: var(--c-warn); }
h3 { font-size: var(--fs-md); line-height: var(--lh-md); font-weight: 600; }
.body { margin-top: 4px; font-size: var(--fs-sm); line-height: var(--lh-sm); color: var(--c-muted); }
.act { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.loading { display: block; padding: 0; min-height: 0; }
.sk-row { display: flex; gap: 16px; align-items: center; height: 40px; padding: 0 16px; border-bottom: 1px solid var(--c-line); }
.sk-row:last-child { border-bottom: 0; }
.sk-row i { display: block; height: 8px; }
@media (max-width: 600px) { .st { flex-direction: column; align-items: flex-start; gap: 16px; padding: 24px 16px; } }
</style>
