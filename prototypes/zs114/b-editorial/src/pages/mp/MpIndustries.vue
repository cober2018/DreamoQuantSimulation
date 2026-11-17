<template>
  <MpShell title="行业比较与轮动" tab="ind" back>
    <div class="meta">
      <span class="num">数据日 {{ ind.trade_date }}</span><span>单位 亿元</span><span class="tag accent">示例数据</span>
    </div>
    <div class="seg" role="tablist" aria-label="净流入窗口">
      <button v-for="w in WIN" :id="`mp-win-${w.k}`" :key="w.k" type="button" role="tab" :aria-selected="win === w.k" :class="{ on: win === w.k }" @click="win = w.k">{{ w.t }}</button>
    </div>
    <p class="pb serif"><span class="tag solid">统计</span> 净流入最多：{{ top.sector_name }} <em class="v num">{{ signed(top[win]) }} 亿</em>；最少：{{ bottom.sector_name }} <em class="v num">{{ signed(bottom[win]) }} 亿</em></p>
    <ol class="list">
      <li v-for="(r, i) in list" :key="r.sector_code">
        <span class="rk num">{{ i + 1 }}</span>
        <span class="nm serif">{{ r.sector_name }}<small class="num" :class="tone(r.sector_return)">{{ pct(r.sector_return) }}</small></span>
        <span class="br" aria-hidden="true"><i :class="tone(r[win])" :style="bar(r[win])" /></span>
        <span class="vl num" :class="tone(r[win])">{{ signed(r[win]) }}</span>
      </li>
    </ol>
    <p class="note">红为净流入，绿为净流出。右侧小字为当日板块涨跌幅。来源：行业比较与轮动 · 板块日度统计。</p>
  </MpShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import MpShell from './MpShell.vue'
import ind from '@data/industries-sample.json'
import { signed, pct, tone } from '../../lib/format.js'

const WIN = [{ k: 'net_flow_1d', t: '1 日净流入' }, { k: 'net_flow_5d', t: '5 日净流入' }, { k: 'net_flow_20d', t: '20 日净流入' }]
const win = ref('net_flow_1d')
const list = computed(() => [...ind.data.items].sort((a, b) => b[win.value] - a[win.value]))
const top = computed(() => list.value[0])
const bottom = computed(() => list.value.at(-1))
const max = computed(() => Math.max(...list.value.map((r) => Math.abs(r[win.value]))))
const bar = (v) => ({ width: (Math.abs(v) / max.value) * 50 + '%', [v >= 0 ? 'left' : 'right']: '50%' })
</script>

<style scoped>
.meta { display: flex; gap: 10px; align-items: center; font-size: 11px; color: var(--ink-3); padding-bottom: 10px; border-bottom: 2px solid var(--rule-strong); }
.meta .tag { margin-left: auto; }
.seg { display: grid; grid-template-columns: repeat(3, 1fr); margin: 12px 0; border: 1px solid var(--rule-strong); border-radius: var(--r-2); overflow: hidden; }
.seg button { height: 32px; border: 0; background: none; font-size: 13px; color: var(--ink-2); cursor: pointer; }
.seg button + button { border-left: 1px solid var(--rule-strong); }
.seg button.on { background: var(--ink); color: var(--paper); font-weight: 600; }
.pb { font-size: 14px; line-height: 1.7; font-weight: 600; padding: 4px 0 12px; }
.v { font-style: normal; color: var(--accent); }
.list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--rule-strong); }
.list li { display: grid; grid-template-columns: 22px 1fr 72px 52px; gap: 8px; align-items: center; height: 48px; border-bottom: 1px solid var(--rule); }
.rk { font-size: 11px; color: var(--ink-3); }
.nm { font-size: 15px; font-weight: 600; display: flex; flex-direction: column; line-height: 1.25; }
.nm small { font: 400 11px var(--font-sans); }
.br { position: relative; height: 8px; }
.br::before { content: ''; position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1px; background: var(--ink-3); }
.br i { position: absolute; top: 0; bottom: 0; background: currentColor; }
.vl { text-align: right; font-size: 14px; font-weight: 600; }
.note { font-size: 11px; color: var(--ink-3); margin-top: 12px; line-height: 1.6; }
</style>
