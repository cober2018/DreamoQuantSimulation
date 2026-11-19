<!-- 近 20 个交易日刻度尺：柱高 = 当日入选要点条数（0–8），点击切换日期；斜纹 = 有数据页部分缺数或未取到 -->
<template>
  <div class="ruler">
    <div ref="track" class="track" role="group" aria-label="选择交易日，柱高为当日要点条数">
      <button v-for="d in days" :id="'day-' + d.trade_date" :key="d.trade_date" type="button" class="tick"
              :class="{ on: d.trade_date === modelValue, warn: hasGap(d), wk: isMonday(d.trade_date) }" :aria-pressed="d.trade_date === modelValue"
              :aria-label="`${d.trade_date} ${weekday(d.trade_date)}，${d.facts.length} 条要点${hasGap(d) ? '，有数据页缺数' : ''}`"
              @click="$emit('update:modelValue', d.trade_date)">
        <span class="n tnum" aria-hidden="true" :data-n="d.facts.length"></span>
        <span class="bar" aria-hidden="true"><i :style="{ height: (d.facts.length / 8) * 100 + '%' }" /></span>
        <span class="lab tnum" aria-hidden="true">{{ isMonday(d.trade_date) || d.trade_date === days[0].trade_date ? d.trade_date.slice(5).replace('-', '/') : d.trade_date.slice(8) }}</span>
      </button>
    </div>
    <div class="legend" aria-hidden="true"><span><i class="lg" />要点条数</span><span><i class="lg warn" />有数据页缺数</span></div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { days, weekday } from '../lib/brief.js'
const props = defineProps({ modelValue: String })
defineEmits(['update:modelValue'])
const hasGap = (d) => Object.values(d.module_status).some((s) => s !== 'ok')
const isMonday = (d) => new Date(d + 'T12:00:00Z').getUTCDay() === 1
const track = ref(null)
const center = async () => { await nextTick(); const t = track.value, on = t?.querySelector('.on'); if (on && t.scrollWidth > t.clientWidth) t.scrollLeft = on.offsetLeft - t.clientWidth / 2 + on.offsetWidth / 2 }
onMounted(center)
watch(() => props.modelValue, center)
</script>

<style scoped>
.track { display: grid; grid-template-columns: repeat(20, minmax(30px, 1fr)); overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid var(--c-line-strong); }
.track::-webkit-scrollbar { display: none; }
.tick { position: relative; display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 0 0 6px; color: var(--c-ink-3); border-radius: var(--r-1) var(--r-1) 0 0; transition: background-color var(--dur-2); }
.tick:hover { background: var(--c-surface-hover); }
.tick.wk { box-shadow: inset 1px 0 0 var(--c-line); }
.n { font-size: 10px; line-height: 15px; height: 15px; text-align: center; opacity: 0; transition: opacity var(--dur-2); }
/* 条数用伪元素显示：只是视觉提示，按钮的可读名称里已经写了条数 */
.n::before { content: attr(data-n); }
.tick:hover .n, .tick.on .n { opacity: 1; }
.tick.on .n { color: var(--c-accent-ink); font-weight: 600; }
.bar { position: relative; height: 36px; margin: 0 30%; }
.bar i { position: absolute; left: 0; right: 0; bottom: 0; min-height: 1px; background: var(--c-line-strong); border-radius: 1px 1px 0 0; transform-origin: bottom; animation: up var(--dur-draw) var(--ease-out) both; transition: background-color var(--dur-2); }
.tick:hover .bar i { background: var(--c-ink-3); }
.warn .bar i { background: repeating-linear-gradient(135deg, var(--c-warn) 0 2px, transparent 2px 4px); }
.on .bar i { background: var(--c-accent); }
.on::after { content: ""; position: absolute; left: 20%; right: 20%; bottom: -1px; height: 2px; background: var(--c-accent); }
.lab { font-size: 10.5px; text-align: center; white-space: nowrap; }
.on .lab { color: var(--c-accent-ink); font-weight: 600; }
.legend { display: flex; gap: var(--s-4); margin-top: var(--s-2); font-size: var(--fs-2xs); color: var(--c-ink-3); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.lg { display: inline-block; width: 8px; height: 8px; background: var(--c-line-strong); }
.lg.warn { background: repeating-linear-gradient(135deg, var(--c-warn) 0 2px, transparent 2px 4px); }
@keyframes up { from { transform: scaleY(0); } }
</style>
