<template>
  <MpFrame title="行业比较" tab="ind">
    <section class="hd">
      <p class="meta mono">数据日期 {{ src.trade_date }} · <span class="chip sample">示例数据</span></p>
      <div class="seg" role="radiogroup" aria-label="排序">
        <button v-for="o in OPTS" :key="o.key" type="button" role="radio" :aria-checked="key === o.key" :class="{ on: key === o.key }" @click="key = o.key">{{ o.label }}</button>
      </div>
    </section>
    <div class="kp">
      <div><p class="l">上涨板块</p><p class="v mono">{{ upN }}<span>/ {{ items.length }}</span></p></div>
      <div><p class="l">净流入合计 · 1 日</p><p class="v mono" :class="fmt.dir(sum)">{{ fmt.signed(sum, 1) }}<span>亿元</span></p></div>
    </div>
    <div class="list-h mono"><span>板块</span><span>1 日 %</span><span>净流入 亿元</span></div>
    <ol class="list">
      <li v-for="(r, i) in rows" :key="r.sector_code">
        <span class="ix mono">{{ String(i + 1).padStart(2, '0') }}</span>
        <span class="nm">{{ r.sector_name }}<small class="mono">{{ r.sector_code }}</small></span>
        <span class="mono pct" :class="fmt.dir(r.sector_return)">{{ fmt.pct(r.sector_return) }}</span>
        <span class="fl mono" :class="fmt.dir(r.net_flow_1d)">{{ fmt.signed(r.net_flow_1d, 1) }}<i :style="{ '--w': `${(Math.abs(r.net_flow_1d) / max) * 100}%` }"></i></span>
      </li>
    </ol>
    <p class="disc">{{ src.disclaimer }}</p>
  </MpFrame>
</template>
<script setup>
import { computed, ref } from 'vue'
import MpFrame from './MpFrame.vue'
import { fmt } from '../../lib/format.js'
import src from '../../../../data/industries-sample.json'

const OPTS = [{ key: 'sector_return', label: '按涨跌幅' }, { key: 'net_flow_1d', label: '按净流入' }, { key: 'amount', label: '按成交额' }]
const items = src.data.items
const key = ref('net_flow_1d')
const rows = computed(() => [...items].sort((a, b) => b[key.value] - a[key.value]))
const max = Math.max(...items.map((r) => Math.abs(r.net_flow_1d)))
const upN = items.filter((r) => r.sector_return > 0).length
const sum = items.reduce((s, r) => s + r.net_flow_1d, 0)
</script>
<style scoped>
.hd { padding: 12px 16px 0; }
.meta { display: flex; align-items: center; gap: 6px; font-size: var(--fs-2xs); color: var(--c-muted); }
.seg { display: flex; margin-top: 12px; padding: 2px; border: 1px solid var(--c-line-strong); border-radius: 6px; background: var(--c-surface); }
.seg button { flex: 1; height: 32px; border: 0; border-radius: 4px; background: transparent; font-size: var(--fs-xs); color: var(--c-ink-2); }
.seg button.on { background: var(--c-ink); color: var(--c-bg); font-weight: 600; }
.kp { display: grid; grid-template-columns: 1fr 1fr; margin: 12px 12px 0; border: 1px solid var(--c-line); border-radius: 8px; background: var(--c-surface); }
.kp > div { padding: 10px 12px; } .kp > div + div { border-left: 1px solid var(--c-line); }
.l { font-size: 10.5px; color: var(--c-muted); }
.v { margin-top: 2px; font-size: 22px; line-height: 28px; font-weight: 500; letter-spacing: -0.02em; }
.v span { margin-left: 4px; font: 400 11px var(--font-sans); color: var(--c-muted); letter-spacing: 0; }
.list-h { display: grid; grid-template-columns: 24px 1fr 64px 84px; gap: 8px; padding: 14px 16px 6px 16px; font-size: 10px; color: var(--c-muted); border-bottom: 1px solid var(--c-line-strong); }
.list-h span:first-child { grid-column: 1 / span 2; }
.list-h span:not(:first-child) { text-align: right; }
.list li { display: grid; grid-template-columns: 24px 1fr 64px 84px; gap: 8px; align-items: center; min-height: 48px; padding: 0 16px; border-bottom: 1px solid var(--c-line); background: var(--c-surface); }
.ix { font-size: 10px; color: var(--c-muted); }
.nm { display: flex; flex-direction: column; font-size: var(--fs-sm); line-height: 18px; } .nm small { font-size: 10px; color: var(--c-muted); }
.pct, .fl { text-align: right; font-size: var(--fs-sm); }
.fl { position: relative; padding-bottom: 4px; } .fl i { position: absolute; right: 0; bottom: 0; height: 2px; width: var(--w); background: currentColor; opacity: .5; }
.disc { padding: 16px; font-size: 10.5px; line-height: 16px; color: var(--c-muted); }
</style>
