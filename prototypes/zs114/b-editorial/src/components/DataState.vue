<template>
  <section class="ds" :class="[`ds-${kind}`, { compact }]" :role="kind === 'error' ? 'alert' : 'status'" :aria-busy="kind === 'loading'">
    <template v-if="kind === 'loading'">
      <span class="sr-only">正在加载数据</span>
      <div class="skel" aria-hidden="true">
        <div v-for="i in rows" :key="i" class="skel-row" :style="{ '--w': 50 + ((i * 37) % 45) + '%' }">
          <i class="sk-no" /><i class="sk-line" /><i class="sk-fig" />
        </div>
      </div>
    </template>
    <template v-else>
      <svg class="glyph" width="72" height="56" viewBox="0 0 72 56" aria-hidden="true">
        <path d="M4 14h64M4 28h64M4 42h64" stroke="var(--rule)" stroke-width="1" />
        <template v-if="kind === 'empty'">
          <path d="M14 28h44" stroke="var(--ink-3)" stroke-width="1.5" stroke-dasharray="3 4" />
        </template>
        <template v-else-if="kind === 'error'">
          <path d="M4 28h24M44 28h24" stroke="var(--ink)" stroke-width="1.5" />
          <path d="M32 22l8 12M40 22l-8 12" stroke="var(--up)" stroke-width="1.5" />
        </template>
        <template v-else-if="kind === 'denied'">
          <rect x="26" y="20" width="20" height="16" rx="2" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5" />
          <path d="M30 20v-4a6 6 0 0 1 12 0v4" fill="none" stroke="var(--ink)" stroke-width="1.5" />
        </template>
        <template v-else-if="kind === 'nodate'">
          <rect x="22" y="8" width="28" height="40" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5" />
          <path d="M22 18h28" stroke="var(--ink)" stroke-width="1.5" />
          <path d="M28 30h16M28 38h10" stroke="var(--ink-3)" stroke-width="1.5" stroke-dasharray="2 3" />
        </template>
      </svg>
      <div class="ds-text">
        <p class="ds-kicker eyebrow">{{ meta.kicker }}</p>
        <h2 class="ds-title">{{ title || meta.title }}</h2>
        <p class="ds-detail">{{ detail || meta.detail }}</p>
        <div v-if="$slots.default" class="ds-act"><slot /></div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  kind: { type: String, required: true }, // empty | loading | error | denied | nodate
  title: String,
  detail: String,
  compact: Boolean,
  rows: { type: Number, default: 5 },
})
const COPY = {
  empty: { kicker: '空 · EMPTY', title: '这里还没有记录', detail: '当前筛选条件下没有数据行。换一个板块类型，或清除筛选再看。' },
  error: { kicker: '错误 · ERROR', title: '这一页没有取到数据', detail: '数据服务暂时没有返回结果。页面不会用旧数据或其他日期代替；可以稍后重试。' },
  denied: { kicker: '无权限 · LOCKED', title: '当前账户等级不含此页', detail: '此页的指标名称可以预览，数值需要升级后查看。' },
  nodate: { kicker: '所选日期无数据 · NO DATA', title: '所选日期没有数据', detail: '可能是非交易日，或当日数据尚未生成。不以其他日期的数据代替。' },
  loading: {},
}
const meta = computed(() => COPY[props.kind])
</script>

<style scoped>
.ds { display: flex; gap: var(--sp-5); align-items: flex-start; padding: var(--sp-7) var(--sp-6); border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
.ds.compact { padding: var(--sp-5) var(--sp-4); gap: var(--sp-4); }
.glyph { flex: none; margin-top: 2px; }
.ds-text { display: grid; gap: var(--sp-2); max-width: 34em; }
.ds-title { font-size: var(--fs-xl); }
.compact .ds-title { font-size: var(--fs-lg); }
.ds-detail { color: var(--ink-2); line-height: var(--lh-body); }
.ds-act { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-2); }
.ds-error .ds-kicker { color: var(--up); }
.ds-denied .ds-kicker, .ds-nodate .ds-kicker { color: var(--accent); }

.ds-loading { display: block; padding: var(--sp-4) 0; }
.skel { display: grid; }
.skel-row { display: grid; grid-template-columns: 40px 1fr 96px; gap: var(--sp-4); align-items: center; padding: var(--sp-4) 0; border-bottom: 1px solid var(--rule); }
.skel-row i { display: block; height: 12px; border-radius: var(--r-1); background: var(--paper-3); position: relative; overflow: hidden; }
.sk-no { width: 24px; height: 20px !important; }
.sk-line { width: var(--w); }
.sk-fig { height: 20px !important; }
.skel-row i::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--sheet) 70%, transparent), transparent);
  transform: translateX(-100%); animation: sheen 1.4s var(--ease) infinite;
}
@keyframes sheen { to { transform: translateX(100%); } }
@media (prefers-reduced-motion: reduce) { .skel-row i::after { animation: none; display: none; } }
@media (max-width: 760px) { .ds { flex-direction: column; padding: var(--sp-6) var(--sp-4); } }
</style>
