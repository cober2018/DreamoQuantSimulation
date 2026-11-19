<!-- 事实要点卡片：卡面只放读者需要的（大数字、句子、口径名、日期、偏离程度）；字段名等技术口径收进「口径」展开区 -->
<template>
  <article class="fact" :class="[variant, { on: active }]" :aria-labelledby="'fact-' + rank + '-t'"
           @mouseenter="$emit('hover', true)" @mouseleave="$emit('hover', false)" @focusin="$emit('hover', true)" @focusout="$emit('hover', false)">
    <header class="top">
      <span class="rank display tnum" aria-hidden="true">{{ String(rank).padStart(2, '0') }}</span>
      <span class="kind"><KindGlyph :kind="fact.kind" />{{ fact.kind }}</span>
      <span class="badge stat" title="按固定规则计算的统计事实，不是判断">统计</span>
      <span class="date tnum"><span class="sr-only">数据日期</span>{{ fact.data_date }}</span>
    </header>
    <div class="mid">
      <p v-if="lead" class="num" aria-hidden="true"><span class="display tnum" :class="tone">{{ lead.num }}</span><small>{{ lead.unit }}</small></p>
      <p :id="'fact-' + rank + '-t'" class="text"><span class="sr-only">第 {{ rank }} 条：</span><Statement :fact="fact" /></p>
    </div>
    <div class="foot">
      <span class="src">{{ fact.source }}</span>
      <StrengthMeter :value="fact.strength" :big="variant === 'lead'" />
    </div>
    <div class="acts">
    <details class="spec" @toggle="specOpen = $event.target.open">
      <summary :id="'fact-spec-' + rank"><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path :d="specOpen ? 'M2 6.5 L5 3.5 L8 6.5' : 'M2 3.5 L5 6.5 L8 3.5'" /></svg>口径</summary>
      <dl>
        <div v-for="r in spec" :key="r.k"><dt>{{ r.k }}</dt><dd :class="{ tnum: r.k === '数值' || r.k === '数据日期' }"><code v-if="r.code">{{ r.v }}</code><template v-else>{{ r.v }}</template></dd></div>
      </dl>
    </details>
    <button :id="'fact-open-' + rank" class="trace" type="button" @click="$emit('open')">追溯链与明细页<span aria-hidden="true"> →</span><span class="sr-only">（第 {{ rank }} 条）</span></button>
    </div>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue'
import KindGlyph from './KindGlyph.vue'
import Statement from './Statement.vue'
import StrengthMeter from './StrengthMeter.vue'
import { leadValue, colorsBySign, factSpec } from '../lib/brief.js'
const props = defineProps({ fact: Object, rank: Number, active: Boolean, variant: { type: String, default: 'card' } })
defineEmits(['open', 'hover'])
const lead = computed(() => leadValue(props.fact))
const tone = computed(() => (lead.value && colorsBySign(props.fact) && lead.value.sign ? (lead.value.sign > 0 ? 'up' : 'down') : ''))
const spec = computed(() => factSpec(props.fact))
const specOpen = ref(false)
</script>

<style scoped>
.fact { position: relative; display: flex; flex-direction: column; gap: var(--s-3); padding: var(--s-4) var(--s-5) var(--s-3); border: 1px solid var(--c-line); border-radius: var(--r-3); background: var(--c-surface); transition: border-color var(--dur-2) var(--ease-std), box-shadow var(--dur-3) var(--ease-std); }
.fact::before { content: ""; position: absolute; left: -1px; top: var(--s-4); bottom: var(--s-4); width: 2px; border-radius: 2px; background: var(--c-accent); transform: scaleY(0); transform-origin: top; transition: transform var(--dur-3) var(--ease-out); }
.fact:hover { border-color: var(--c-line-strong); }
.fact.on { border-color: var(--c-line-strong); box-shadow: var(--shadow-1); }
.fact.on::before { transform: none; }
.top { display: flex; align-items: center; gap: var(--s-2); }
.rank { font-size: 20px; line-height: 1; color: var(--c-ink-3); min-width: 28px; transition: color var(--dur-2); }
.fact.on .rank { color: var(--c-accent-ink); }
.kind { display: inline-flex; align-items: center; gap: 6px; height: 20px; padding: 0 var(--s-2); border-radius: var(--r-1); background: var(--c-surface-2); color: var(--c-ink-2); font-size: var(--fs-xs); font-weight: 500; }
.date { margin-left: auto; font-size: var(--fs-xs); color: var(--c-ink-3); }
.mid { display: flex; flex-direction: column; gap: var(--s-2); }
.num { white-space: nowrap; line-height: 1; }
.num span { font-size: 36px; letter-spacing: var(--tr-tight); color: var(--c-ink); }
.num span.up { color: var(--c-up); }
.num span.down { color: var(--c-down); }
.num small { margin-left: 6px; font-size: var(--fs-sm); color: var(--c-ink-3); }
.text { font-size: var(--fs-base); line-height: 1.65; color: var(--c-ink-2); }
.foot { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); flex-wrap: wrap; margin-top: auto; padding-top: var(--s-2); border-top: 1px solid var(--c-line); font-size: var(--fs-xs); }
.src { color: var(--c-ink-2); }
.spec summary { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 var(--s-2); margin-left: calc(-1 * var(--s-2)); border-radius: var(--r-1); font-size: var(--fs-xs); color: var(--c-ink-2); cursor: pointer; list-style: none; }
.spec summary::-webkit-details-marker { display: none; }
.spec summary:hover { color: var(--c-ink); background: var(--c-surface-hover); }
.spec summary svg { fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
.spec dl { margin-top: var(--s-2); display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 6px var(--s-4); padding: var(--s-3); border-radius: var(--r-2); background: var(--c-surface-2); font-size: var(--fs-xs); }
.spec dl > div { display: contents; }
.spec dt { color: var(--c-ink-3); }
.spec dd { margin: 0; color: var(--c-ink); line-height: 1.6; overflow-wrap: anywhere; }
code { font-family: var(--font-mono); font-size: var(--fs-2xs); color: var(--c-ink-2); }
/* 「追溯链」按钮压在「口径」那一行的右侧，展开的口径表占满整张卡的宽度 */
.acts { position: relative; }
.trace { position: absolute; right: 0; top: 0; height: 28px; padding: 0 var(--s-2); border-radius: var(--r-1); font-size: var(--fs-xs); color: var(--c-accent-ink); font-weight: 500; }
.trace:hover { background: var(--c-accent-soft); }

/* 主卡：当天偏离最大的一条 */
.fact.lead { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr); grid-template-areas: "top top" "num text" "foot foot" "acts acts"; column-gap: var(--s-7); row-gap: var(--s-4); padding: var(--s-5) var(--s-6) var(--s-4); background: linear-gradient(120deg, var(--c-surface) 40%, color-mix(in srgb, var(--c-accent) 6%, var(--c-surface))); border-color: var(--c-line-strong); }
.fact.lead::before { transform: none; top: var(--s-5); bottom: var(--s-5); }
.lead .top { grid-area: top; }
.lead .mid { display: contents; }
.lead .num { grid-area: num; align-self: center; }
.lead .num span { font-size: clamp(56px, 6vw, 88px); }
.lead .num small { font-size: var(--fs-md); }
.lead .text { grid-area: text; align-self: center; font-size: var(--fs-lg); line-height: 1.6; color: var(--c-ink); }
.lead .foot { grid-area: foot; }
.lead .acts { grid-area: acts; }
.lead .rank { font-size: 24px; color: var(--c-accent-ink); }

@media (max-width: 760px) {
  .fact.lead { grid-template-columns: minmax(0, 1fr); grid-template-areas: "top" "num" "text" "foot" "acts"; padding: var(--s-4); row-gap: var(--s-3); }
  .lead .num span { font-size: 48px; }
  .lead .text { font-size: var(--fs-md); }
  .fact { padding: var(--s-4) var(--s-4) var(--s-3); }
  .num span { font-size: 30px; }
}
</style>
