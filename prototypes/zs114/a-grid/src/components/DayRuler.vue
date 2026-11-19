<template>
  <!-- 交易日刻度尺：柱高 = 当日入选要点数（0–8），斜纹 = 有页面取数失败 -->
  <div class="ruler" :class="{ compact }" role="group" aria-label="选择交易日（柱高为当日要点条数）">
    <div class="track" ref="track">
      <button v-for="d in DAYS" :key="d.date" type="button" class="tick" :id="`day-${d.date}`"
              :class="{ on: d.date === modelValue, bad: hasError(d), none: !d.data_date }" :aria-pressed="d.date === modelValue"
              :aria-label="`${d.date}，${d.data_date ? d.facts.length + ' 条要点' : '无数据'}${hasError(d) ? '，部分页面取数失败' : ''}`"
              @click="$emit('update:modelValue', d.date)">
        <span class="bar" :style="{ '--h': (d.facts.length / 8) }"><i></i></span>
        <span class="lab mono"><span class="mo">{{ d.date.slice(5, 8) }}</span>{{ d.date.slice(8) }}</span>
      </button>
    </div>
    <div class="legend" v-if="!compact">
      <span><i class="lg-bar"></i>要点条数 0–8</span><span><i class="lg-bad"></i>有页面取数失败</span>
    </div>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue'
import { DAYS } from '../lib/data.js'
const props = defineProps({ modelValue: String, compact: Boolean })
defineEmits(['update:modelValue'])
const hasError = (d) => Object.values(d.module_status).includes('error')
const track = ref(null)
onMounted(() => {
  const on = track.value?.querySelector('.on')
  if (on && track.value.scrollWidth > track.value.clientWidth) track.value.scrollLeft = on.offsetLeft - track.value.clientWidth / 2
})
</script>
<style scoped>
.track { display: grid; grid-template-columns: repeat(20, minmax(36px, 1fr)); border-bottom: 1px solid var(--c-line-strong); overflow-x: auto; scrollbar-width: none; }
.tick { position: relative; display: flex; flex-direction: column; align-items: stretch; gap: 6px; padding: 0 0 6px; border: 0; background: transparent; color: var(--c-muted); }
.bar { position: relative; height: 40px; margin: 0 22%; border-left: 1px solid var(--c-grid); }
.bar i { position: absolute; left: 0; right: 0; bottom: 0; height: calc(var(--h) * 100%); min-height: 1px; background: var(--c-line-strong); transition: background-color var(--dur-fast) var(--ease); transform-origin: bottom; animation: up var(--dur-draw) var(--ease) both; }
.bad .bar i { background: repeating-linear-gradient(135deg, var(--c-warn) 0 2px, transparent 2px 4px); opacity: .8; }
.none .bar i { height: 1px; }
.tick:hover .bar i { background: var(--c-ink-2); }
.on .bar i { background: var(--c-accent); opacity: 1; }
.on::after { content: ''; position: absolute; left: 50%; bottom: -1px; width: 100%; transform: translateX(-50%); height: 2px; background: var(--c-accent); }
.lab { font-size: 10.5px; text-align: center; }
.on .lab { color: var(--c-accent); font-weight: 500; }
.legend { display: flex; gap: 16px; margin-top: 8px; font-size: var(--fs-2xs); color: var(--c-muted); }
.legend i { display: inline-block; width: 8px; height: 8px; margin-right: 6px; vertical-align: -1px; }
.lg-bar { background: var(--c-line-strong); }
.lg-bad { background: repeating-linear-gradient(135deg, var(--c-warn) 0 2px, transparent 2px 4px); }
.compact .bar { height: 24px; }
.compact .mo { display: none; }
@media (max-width: 720px) { .mo { display: none; } .track { grid-template-columns: repeat(20, minmax(28px, 1fr)); } }
.compact .track { grid-template-columns: repeat(20, 30px); }
@keyframes up { from { transform: scaleY(0); } to { transform: scaleY(1); } }
</style>
