<template>
  <article class="fact" :class="{ lead: rank === 1 }" :style="{ '--i': rank }" :aria-labelledby="`fact-${rank}-s`">
    <div class="rank mono" aria-hidden="true">{{ String(rank).padStart(2, '0') }}</div>
    <div class="read" v-if="hl">
      <p class="val"><TickNum :text="hl.value" :delay="rank * 60" :class="hl.flow ? fmtDir(hl.value) : ''" /><span class="unit">{{ hl.unit }}</span></p>
      <p class="lbl">{{ hl.label }}</p>
      <p class="sub mono" v-if="hl.sub">{{ hl.sub }}</p>
      <p class="fields mono" :title="'数据字段：' + fact.fields.join('、')">{{ fact.fields.join(' · ') }}</p>
    </div>
    <div class="main">
      <div class="row1">
        <KindTag :kind="fact.kind" />
        <span class="chip stat" title="按固定规则计算的统计事实，不是判断">统计</span>
        <span class="date mono"><span class="sr-only">数据日期</span>{{ fact.data_date }}</span>
      </div>
      <p class="stmt" :id="`fact-${rank}-s`">
        <template v-for="(p, i) in parts" :key="i"><span v-if="p.n" class="n" :class="p.dir">{{ p.t }}</span><template v-else>{{ p.t }}</template></template>
      </p>
      <p class="def" v-if="fact.definition"><span class="k">口径</span>{{ fact.definition }}</p>
      <div class="foot">
        <StrengthMeter :value="fact.strength" class="meter" />
        <p class="src"><span class="k">来源</span>{{ fact.source }}</p>
        <router-link class="go" :to="drillTarget(fact)" :id="`fact-${rank}-go`" :aria-label="`查看明细：${fact.source}`">明细<span aria-hidden="true">→</span></router-link>
      </div>
    </div>
  </article>
</template>
<script setup>
import { computed } from 'vue'
import KindTag from './KindTag.vue'
import StrengthMeter from './StrengthMeter.vue'
import TickNum from './TickNum.vue'
import { headline, splitStatement, drillTarget } from '../lib/facts.js'

const props = defineProps({ fact: { type: Object, required: true }, rank: { type: Number, required: true } })
const hl = computed(() => headline(props.fact))
const parts = computed(() => splitStatement(props.fact.statement))
const fmtDir = (v) => (/^\+/.test(v) ? 'up' : /^−/.test(v) ? 'down' : '')
</script>
<style scoped>
.fact {
  position: relative; display: grid; grid-template-columns: 40px 176px minmax(0, 1fr); gap: 0 24px; padding: 20px 20px 16px;
  background: var(--c-surface); border: 1px solid var(--c-line); border-radius: var(--r-md);
  transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-base) var(--ease), transform var(--dur-base) var(--ease);
  animation: rise var(--dur-slow) var(--ease) both; animation-delay: calc(var(--i) * 40ms);
}
.fact::before { content: ''; position: absolute; left: -1px; top: 16px; bottom: 16px; width: 2px; background: var(--c-accent); transform: scaleY(0); transform-origin: top; transition: transform var(--dur-slow) var(--ease); }
.fact:hover { border-color: var(--c-line-strong); box-shadow: var(--shadow-2); }
.fact:hover::before, .fact:focus-within::before, .fact.lead::before { transform: scaleY(1); }
.rank { font-size: var(--fs-xs); color: var(--c-muted); padding-top: 4px; }
.lead .rank { color: var(--c-accent); }
.read { border-right: 1px solid var(--c-line); padding-right: 16px; }
.val { display: flex; align-items: baseline; gap: 6px; font: 500 var(--fs-xl)/var(--lh-xl) var(--font-mono); letter-spacing: -0.02em; color: var(--c-ink); }
.lead .val { font-size: 34px; line-height: 40px; }
.unit { font: 500 var(--fs-xs)/1 var(--font-sans); color: var(--c-muted); letter-spacing: 0; }
.lbl { margin-top: 6px; font-size: var(--fs-2xs); line-height: var(--lh-2xs); color: var(--c-muted); }
.sub { margin-top: 2px; font-size: var(--fs-2xs); color: var(--c-ink-2); }
.row1 { display: flex; align-items: center; gap: 8px; }
.date { margin-left: auto; font-size: var(--fs-2xs); color: var(--c-muted); }
.stmt { margin-top: 10px; font-size: 15px; line-height: 24px; color: var(--c-ink); text-wrap: pretty; }
.n { font-family: var(--font-mono); font-weight: 500; font-size: 14px; letter-spacing: -0.01em; }
.def { margin-top: 6px; font-size: var(--fs-xs); line-height: var(--lh-xs); color: var(--c-muted); }
.k { display: inline-block; margin-right: 6px; font-size: var(--fs-2xs); color: var(--c-muted); border: 1px solid var(--c-line); border-radius: var(--r-xs); padding: 0 4px; line-height: 16px; }
.foot { display: grid; grid-template-columns: 148px minmax(0, 1fr) auto; align-items: center; gap: 16px; margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--c-line); }
.src { font-size: var(--fs-xs); color: var(--c-ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fields { margin-top: 12px; padding-top: 8px; border-top: 1px dashed var(--c-line); font-size: 10px; line-height: 14px; color: var(--c-muted); overflow-wrap: anywhere; }
.go { display: inline-flex; gap: 6px; align-items: center; font-size: var(--fs-xs); font-weight: 600; color: var(--c-accent); }
.go span { transition: transform var(--dur-fast) var(--ease); }
.go::after { content: ''; position: absolute; inset: 0; border-radius: var(--r-md); }
.fact:hover .go span { transform: translateX(3px); }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

@media (max-width: 1279px) { .foot { grid-template-columns: 132px minmax(0, 1fr) auto; } }
@media (max-width: 720px) {
  .fact { grid-template-columns: minmax(0, 1fr); padding: 16px; }
  .rank { position: absolute; right: 16px; top: 18px; padding: 0; }
  .read { order: 2; border-right: 0; padding: 12px 0 0; display: grid; grid-template-columns: auto 1fr; column-gap: 12px; align-items: baseline; }
  .read .lbl { margin: 0; } .read .sub { grid-column: 2; }
  .val, .lead .val { font-size: 26px; line-height: 32px; grid-row: span 2; }
  .main { display: contents; }
  .row1 { order: 1; padding-right: 32px; } .date { margin-left: 0; }
  .stmt { order: 3; font-size: 14px; line-height: 22px; }
  .def { order: 4; } .fields { display: none; } .foot { order: 5; grid-template-columns: 96px minmax(0, 1fr) auto; gap: 12px; }
}
</style>
