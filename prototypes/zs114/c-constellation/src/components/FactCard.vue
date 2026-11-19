<template>
  <article class="fact" :class="{ on: active }" :aria-labelledby="'fact-' + rank + '-t'"
           @mouseenter="$emit('hover', true)" @mouseleave="$emit('hover', false)">
    <span class="rank display tnum" aria-hidden="true">{{ String(rank).padStart(2, '0') }}</span>
    <div class="tags">
      <span class="rank-m display tnum" aria-hidden="true">{{ String(rank).padStart(2, '0') }}</span>
      <span class="kind"><KindGlyph :kind="fact.kind" />{{ fact.kind }}</span>
      <span class="badge stat" title="按固定规则计算的统计事实，不是判断">统计</span>
    </div>
    <p :id="'fact-' + rank + '-t'" class="text"><Statement :fact="fact" /></p>
    <div v-if="lead" class="lead" aria-hidden="true">
      <span class="num display tnum" :class="tone">{{ lead.num }}</span><span class="unit">{{ lead.unit }}</span>
    </div>
    <dl class="meta">
      <div><dt class="sr-only">口径</dt><dd class="src">{{ fact.source }}</dd></div>
      <div><dt>数据日期</dt><dd class="tnum">{{ fact.data_date }}</dd></div>
      <div class="meter-wrap"><dt>偏离</dt><dd class="meter"><span class="bar"><i :style="{ left: fact.strength + '%' }" /></span><span class="tnum">{{ Math.round(fact.strength) }}</span></dd></div>
    </dl>
    <button :id="'fact-open-' + rank" class="open" type="button" @click="$emit('open')" @focus="$emit('hover', true)" @blur="$emit('hover', false)">
      <span class="sr-only">查看第 {{ rank }} 条要点的口径与原始数据</span>
    </button>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import KindGlyph from './KindGlyph.vue'
import Statement from './Statement.vue'
import { leadValue, colorsBySign } from '../lib/brief.js'
const props = defineProps({ fact: Object, rank: Number, active: Boolean })
defineEmits(['open', 'hover'])
const lead = computed(() => leadValue(props.fact))
const tone = computed(() => (lead.value && colorsBySign(props.fact) && lead.value.sign ? (lead.value.sign > 0 ? 'up' : 'down') : ''))
</script>

<style scoped>
.fact {
  position: relative; display: grid; grid-template-columns: 52px minmax(0, 1fr) auto;
  grid-template-areas: "rank tags lead" "rank text lead" "rank meta lead";
  column-gap: var(--s-4); row-gap: var(--s-2);
  padding: var(--s-5) var(--s-5) var(--s-4) var(--s-4);
  border-bottom: 1px solid var(--c-line);
  transition: background-color var(--dur-2) var(--ease-std);
}
.fact::before { content: ""; position: absolute; left: 0; top: var(--s-5); bottom: var(--s-5); width: 1px; background: var(--c-accent); transform: scaleY(0); transform-origin: top; transition: transform var(--dur-3) var(--ease-out); }
.fact:hover, .fact.on { background: var(--c-surface-hover); }
.fact.on::before { transform: none; }
.rank { grid-area: rank; font-size: 28px; line-height: 1; color: var(--c-ink-3); padding-top: 2px; transition: color var(--dur-2); }
.fact.on .rank { color: var(--c-accent-ink); }
.tags { grid-area: tags; display: flex; align-items: center; gap: var(--s-2); }
.kind { display: inline-flex; align-items: center; gap: 6px; height: 20px; padding: 0 var(--s-2); border-radius: var(--r-1); background: var(--c-surface-2); color: var(--c-ink-2); font-size: var(--fs-xs); font-weight: 500; }
.text { grid-area: text; font-size: var(--fs-md); line-height: 1.65; color: var(--c-ink-2); max-width: 64ch; }
.lead { grid-area: lead; align-self: center; text-align: right; min-width: 120px; white-space: nowrap; }
.lead .num { font-size: 34px; line-height: 1; color: var(--c-ink); letter-spacing: -0.01em; }
.lead .num.up { color: var(--c-up); }
.lead .num.down { color: var(--c-down); }
.lead .unit { margin-left: 4px; font-size: var(--fs-sm); color: var(--c-ink-3); }
.meta { grid-area: meta; display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-1) var(--s-4); font-size: var(--fs-xs); color: var(--c-ink-3); }
.meta > div { display: flex; gap: 6px; align-items: center; }
.meta dd { margin: 0; color: var(--c-ink-2); }
.meta .src { color: var(--c-ink-2); }
.meter { display: inline-flex; align-items: center; gap: 6px; }
.bar { position: relative; width: 56px; height: 1px; background: var(--c-line-strong); }
.bar i { position: absolute; top: -2px; width: 5px; height: 5px; margin-left: -2.5px; border-radius: 50%; background: var(--c-star); }
.fact.on .bar i { background: var(--c-accent); }
.rank-m { display: none; font-size: 18px; line-height: 1; color: var(--c-ink-3); margin-right: 2px; }
.open { position: absolute; inset: 0; border-radius: 0; }
.open:focus-visible { outline-offset: -2px; }

@media (max-width: 640px) {
  .fact { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "tags lead" "text text" "meta meta"; padding: var(--s-4); column-gap: var(--s-3); }
  .rank { display: none; }
  .rank-m { display: inline; }
  .lead { align-self: start; min-width: 0; }
  .lead .num { font-size: 24px; }
  .text { font-size: 15px; }
  .meter-wrap { display: none !important; }
}
</style>
