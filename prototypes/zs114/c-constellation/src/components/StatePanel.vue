<!-- 五种状态统一组件：空、加载、错误、无权限、所选日期无数据。插图沿用星图语言（星点 + 细线），不用卡通图。 -->
<template>
  <section class="state" :class="['k-' + kind, { compact }]" :aria-busy="kind === 'loading'" :role="kind === 'error' ? 'alert' : 'status'">
    <template v-if="kind === 'loading'">
      <span class="sr-only">{{ title || '正在加载数据' }}</span>
      <div class="sk" aria-hidden="true">
        <div class="sk-row head"><i style="width: 18%" /><i style="width: 10%" /><i style="width: 12%" /><i style="width: 9%" /></div>
        <div v-for="n in rows" :key="n" class="sk-row"><i :style="{ width: 14 + ((n * 7) % 10) + '%' }" /><i style="width: 8%" /><i style="width: 11%" /><i style="width: 7%" /></div>
      </div>
    </template>
    <template v-else>
      <svg class="ill" width="96" height="75" viewBox="0 0 72 56" aria-hidden="true">
        <g v-if="kind === 'empty'">
          <circle cx="14" cy="38" r="1.6" class="s dim" /><circle cx="30" cy="18" r="1.6" class="s dim" /><circle cx="48" cy="34" r="1.6" class="s dim" /><circle cx="60" cy="14" r="1.6" class="s dim" />
          <path d="M14 38 L30 18 L48 34 L60 14" class="l dash" />
        </g>
        <g v-else-if="kind === 'error'">
          <circle cx="12" cy="36" r="2.4" class="s" /><circle cx="60" cy="20" r="2.4" class="s" />
          <path d="M12 36 L31 29.5 M41 26.5 L60 20" class="l" /><path d="M33 24 L39 32 M39 24 L33 32" class="l warn" />
        </g>
        <g v-else-if="kind === 'forbidden'">
          <circle cx="36" cy="30" r="16" class="l" /><circle cx="36" cy="30" r="2.6" class="s acc" />
          <path d="M20 30 H8 M52 30 H64" class="l dash" /><circle cx="8" cy="30" r="1.6" class="s dim" /><circle cx="64" cy="30" r="1.6" class="s dim" />
        </g>
        <g v-else>
          <g class="cal"><rect v-for="c in 15" :key="c" :x="6 + ((c - 1) % 5) * 12.5" :y="8 + Math.floor((c - 1) / 5) * 14" width="9" height="9" rx="1.5" /></g>
          <rect x="31" y="22" width="9" height="9" rx="1.5" class="hole" /><circle cx="35.5" cy="26.5" r="9" class="l acc-l" />
        </g>
      </svg>
      <p class="t">{{ title || DEFAULTS[kind].title }}</p>
      <p class="d">{{ desc || DEFAULTS[kind].desc }}</p>
      <div v-if="$slots.default" class="act"><slot /></div>
    </template>
  </section>
</template>

<script setup>
defineProps({
  kind: { type: String, default: 'empty' },
  title: String,
  desc: String,
  compact: Boolean,
  rows: { type: Number, default: 6 },
})
const DEFAULTS = {
  empty: { title: '没有符合条件的数据', desc: '当前筛选下没有记录。调整筛选条件，或清除筛选后再看。' },
  error: { title: '这部分数据没有取到', desc: '数据服务暂时没有响应，其他部分不受影响。稍后重试；多次失败请联系我们。' },
  forbidden: { title: '当前账号还不能查看这一页', desc: '这一页属于更高的服务等级。账号等级和可见范围在「账号」页查看。' },
  nodate: { title: '所选日期没有数据', desc: '这一天不是交易日，或当天数据还没有发布。我们不会拿其他日期的数据代替。' },
}
</script>

<style scoped>
.state { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: var(--s-2); padding: var(--s-7) var(--s-5); min-height: 280px; }
.state.compact { min-height: 200px; padding: var(--s-6) var(--s-4); }
.ill { margin-bottom: var(--s-3); }
.s { fill: var(--c-star); }
.s.dim { fill: var(--c-ink-3); }
.s.acc { fill: var(--c-accent); }
.l { fill: none; stroke: var(--c-line-strong); stroke-width: 1; }
.l.dash { stroke-dasharray: 2 3; }
.l.warn { stroke: var(--c-danger); stroke-width: 1.4; stroke-linecap: round; }
.l.acc-l { stroke: var(--c-accent); }
.cal rect { fill: none; stroke: var(--c-line-strong); stroke-width: 1; }
.hole { fill: var(--c-accent-soft); stroke: var(--c-accent); stroke-dasharray: 2 2; }
.t { font-size: var(--fs-md); font-weight: 600; color: var(--c-ink); }
.d { max-width: 400px; font-size: var(--fs-sm); color: var(--c-ink-2); line-height: var(--lh-base); }
.act { display: flex; gap: var(--s-2); margin-top: var(--s-3); }

.state.k-loading { align-items: stretch; justify-content: flex-start; padding: var(--s-4); }
.sk { display: flex; flex-direction: column; gap: 0; }
.sk-row { display: flex; gap: 6%; align-items: center; height: 40px; border-bottom: 1px solid var(--c-line); padding: 0 var(--s-3); }
.sk-row.head { height: 36px; }
.sk-row i { display: block; height: 8px; border-radius: var(--r-1); background: linear-gradient(90deg, var(--c-surface-2) 0%, var(--c-surface-hover) 40%, var(--c-surface-2) 80%); background-size: 300% 100%; animation: sh 1.6s var(--ease-std) infinite; }
.sk-row.head i { height: 6px; opacity: 0.7; }
@keyframes sh { from { background-position: 100% 0; } to { background-position: -50% 0; } }
</style>
