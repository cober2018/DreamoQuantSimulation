<template>
  <article :id="`fact-${n}`" class="fact reveal" :class="{ lead }" :style="{ '--i': n }"
    :aria-labelledby="`fact-${n}-s`">
    <div class="no">
      <span class="no-n serif num" aria-hidden="true">{{ String(n).padStart(2, '0') }}</span>
      <span class="kind" :title="`类型：${fact.kind}`"><span aria-hidden="true">{{ KINDS[fact.kind]?.glyph }}</span>{{ fact.kind }}</span>
    </div>

    <div class="body">
      <p :id="`fact-${n}-s`" class="statement serif">
        <RouterLink :to="drillPath(fact.source)" class="stretch" :aria-label="`第 ${n} 条，${fact.statement}。查看明细：${fact.source}`">
          <template v-for="(s, i) in segs" :key="i"><em v-if="s.num" class="v num" :class="{ hl: s.lead }">{{ s.t }}</em><template v-else>{{ s.t }}</template></template>
        </RouterLink><sup class="fn"><a :id="`ref-${n}`" :href="`#fn-${note}`" :aria-label="`口径注释 ${note}`">{{ note }}</a></sup>
      </p>
      <p class="meta">
        <span class="tag solid" title="按固定规则计算的统计事实">统计</span>
        <span class="src">{{ fact.source }}</span>
        <span class="sep" aria-hidden="true">·</span>
        <span class="num">数据日 {{ fact.data_date }}</span>
      </p>
    </div>

    <div class="fig" aria-hidden="true">
      <span class="fig-v serif num">{{ fig.v }}</span>
      <span class="fig-c">{{ fig.c }}</span>
      <span class="meter"><i class="draw" :style="{ width: Math.min(100, fact.strength) + '%', '--i': n }" /></span>
      <span class="fig-s num">偏离强度 {{ Math.round(fact.strength) }}<span class="go">查看明细 →</span></span>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { KINDS, segments, figureOf, drillPath } from '../lib/brief.js'

const props = defineProps({ fact: Object, n: Number, note: Number, lead: Boolean })
const segs = computed(() => segments(props.fact.statement))
const fig = computed(() => figureOf(props.fact))
</script>

<style scoped>
.fact {
  position: relative;
  display: grid; grid-template-columns: 72px minmax(0, 1fr) 176px; gap: var(--sp-5);
  padding: var(--sp-5) var(--sp-4) var(--sp-5) var(--sp-3);
  border-bottom: 1px solid var(--rule);
  transition: background-color var(--dur-2) var(--ease);
}
.fact::before {
  content: ''; position: absolute; left: 0; top: -1px; bottom: -1px; width: 2px; background: var(--accent);
  transform: scaleY(0); transform-origin: top; transition: transform var(--dur-3) var(--ease);
}
.fact:hover, .fact:focus-within { background: var(--paper-2); }
.fact:hover::before, .fact:focus-within::before { transform: scaleY(1); }

.no { display: grid; align-content: start; gap: var(--sp-2); }
.no-n { font-size: var(--fs-2xl); line-height: 1; color: var(--ink-3); font-weight: 600; }
.kind { display: inline-flex; gap: 4px; font-size: var(--fs-xs); color: var(--accent); font-weight: 600; letter-spacing: .06em; }

.statement { font-size: var(--fs-lg); line-height: 1.6; font-weight: 600; color: var(--ink); text-wrap: pretty; }
.stretch { color: inherit; text-decoration: none; }
.stretch::after { content: ''; position: absolute; inset: 0; z-index: 1; }
.stretch:focus-visible { outline: none; }
.stretch:focus-visible::after { outline: 2px solid var(--focus); outline-offset: -2px; }
.v { font-style: normal; color: var(--accent); }
.v.hl {
  padding: 0 1px;
  background-image: linear-gradient(var(--mark), var(--mark));
  background-size: 100% 36%; background-position: 0 88%; background-repeat: no-repeat;
}
.fn { position: relative; z-index: 2; margin-left: 2px; font: 600 var(--fs-2xs)/0 var(--font-sans); }
.fn a { color: var(--accent); text-decoration: none; display: inline-block; min-width: 24px; line-height: 16px; padding: 4px 6px; margin: -4px -4px; text-align: center; border-radius: var(--r-1); }
.fn a:hover { background: var(--accent-wash); }

.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px var(--sp-2); margin-top: var(--sp-3); font-size: var(--fs-xs); color: var(--ink-3); }
.src { color: var(--ink-2); }

.fig { display: grid; align-content: start; gap: 4px; text-align: right; border-left: 1px solid var(--rule); padding-left: var(--sp-4); }
.fig-v { font-size: var(--fs-2xl); line-height: 1.1; font-weight: 600; color: var(--ink); white-space: nowrap; }
.fig-c { font-size: var(--fs-xs); color: var(--ink-3); }
.meter { display: block; height: 3px; background: var(--rule); margin-top: var(--sp-2); }
.meter i { display: block; height: 100%; background: var(--accent); }
.fig-s { font-size: var(--fs-2xs); color: var(--ink-3); display: flex; justify-content: space-between; gap: 8px; }
.go { color: var(--accent); opacity: 0; transform: translateX(-4px); transition: opacity var(--dur-2) var(--ease), transform var(--dur-2) var(--ease); }
.fact:hover .go, .fact:focus-within .go { opacity: 1; transform: none; }

/* 头条：第一条加大，像研报首段 */
.lead { padding-top: var(--sp-6); padding-bottom: var(--sp-6); }
.lead .statement { font-size: var(--fs-2xl); line-height: 1.45; }
.lead .no-n { font-size: var(--fs-4xl); color: var(--ink); }
.lead .fig-v { font-size: var(--fs-4xl); color: var(--accent); }

@media (max-width: 760px) {
  .fact { grid-template-columns: 1fr; gap: var(--sp-3); padding: var(--sp-4) 0; }
  .fact::before { left: -16px; }
  .no { grid-auto-flow: column; justify-content: start; align-items: baseline; gap: var(--sp-3); }
  .no-n, .lead .no-n { font-size: var(--fs-xl); }
  .statement { font-size: var(--fs-base); }
  .lead .statement { font-size: var(--fs-xl); }
  .fig { border-left: 0; padding-left: 0; text-align: left; grid-template-columns: auto 1fr; align-items: baseline; column-gap: var(--sp-3); border-top: 1px dashed var(--rule); padding-top: var(--sp-3); }
  .fig { display: grid; grid-template-columns: 1fr; padding-top: var(--sp-2); }
  .fig-v, .fig-c { display: none; }
  .meter { margin-top: 0; }
  .go { opacity: 1; transform: none; }
}
</style>
