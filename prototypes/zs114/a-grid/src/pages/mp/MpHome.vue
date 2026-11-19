<template>
  <MpFrame title="知数星耀" tab="brief">
    <section class="hd">
      <p class="eyebrow">今日要点 · 盘后</p>
      <div class="dl"><p class="date mono">{{ day.date }}</p><p class="wd">{{ weekday(day.date) }} · {{ day.facts.length }} 条 · 均为统计</p></div>
      <DayRuler compact class="ru" :model-value="day.date" @update:model-value="(d) => (date = d)" />
    </section>
    <p class="warn" v-if="day.data_date && failed.length"><span class="chip warn">部分取数失败</span>{{ failed.join('、') }}</p>
    <div v-if="!day.data_date" class="card"><StatePanel kind="nodate" :title="`${day.date} 暂无数据`" body="当晚数据可能尚未就绪，不用其他日期代替。" /></div>
    <ol class="stream" v-else :key="day.date">
      <li v-for="(f, i) in day.facts" :key="f.statement" class="card fc" :style="{ '--i': i }">
        <p class="r1"><KindTag :kind="f.kind" /><span class="chip stat">统计</span><span class="no mono">{{ String(i + 1).padStart(2, '0') }}</span></p>
        <p class="v" v-if="hl(f)"><TickNum :text="hl(f).value" :delay="i * 60" class="vn" :class="hl(f).flow ? dir(hl(f).value) : ''" /><span class="u">{{ hl(f).unit }}</span><span class="lb">{{ hl(f).label }}</span></p>
        <p class="s">{{ f.statement }}</p>
        <p class="src"><span>{{ f.source }}</span><span class="mono">{{ f.data_date }}</span></p>
        <StrengthMeter :value="f.strength" class="sm" />
      </li>
    </ol>
    <section class="card sch" aria-labelledby="mp-sch">
      <h2 id="mp-sch">明日日程<span class="mono">≥ 4 星</span></h2>
      <ul>
        <li v-for="(s, i) in day.schedule" :key="s.title + s.time">
          <span class="t mono">{{ s.date.slice(5) }}<br />{{ s.time }}</span>
          <span class="x">{{ s.title }}<span class="chip ai" v-if="i === 0">AI 整理 · 示意</span></span>
        </li>
        <li v-if="!day.schedule.length" class="none">3 日内没有 4 星以上事件</li>
      </ul>
    </section>
    <p class="disc">以上为按固定规则计算的市场统计事实，不构成投资建议。</p>
  </MpFrame>
</template>
<script setup>
import { computed, ref } from 'vue'
import MpFrame from './MpFrame.vue'
import KindTag from '../../components/KindTag.vue'
import TickNum from '../../components/TickNum.vue'
import StatePanel from '../../components/StatePanel.vue'
import StrengthMeter from '../../components/StrengthMeter.vue'
import DayRuler from '../../components/DayRuler.vue'
import { DEFAULT_DAY, MODULES, dayByDate } from '../../lib/data.js'
import { headline } from '../../lib/facts.js'
import { weekday } from '../../lib/format.js'

const date = ref(DEFAULT_DAY)
const day = computed(() => dayByDate(date.value))
const failed = computed(() => MODULES.filter((m) => day.value.module_status[m.key] === 'error').map((m) => m.label))
const hl = headline
const dir = (v) => (/^\+/.test(v) ? 'up' : /^−/.test(v) ? 'down' : '')
</script>
<style scoped>
.hd { padding: 16px 16px 4px; }
.dl { display: flex; align-items: baseline; gap: 10px; margin-top: 6px; }
.date { font-size: 24px; line-height: 30px; font-weight: 500; letter-spacing: -0.02em; }
.wd { font-size: var(--fs-xs); color: var(--c-muted); }
.ru { margin-top: 12px; }
.warn { display: flex; gap: 8px; align-items: center; margin: 8px 16px 0; font-size: var(--fs-2xs); color: var(--c-ink-2); }
.card { margin: 12px 12px 0; background: var(--c-surface); border: 1px solid var(--c-line); border-radius: 8px; }
.stream { display: block; }
.fc { position: relative; padding: 14px 14px 12px; animation: rise var(--dur-slow) var(--ease) both; animation-delay: calc(var(--i) * 40ms); }
.fc:first-child::before { content: ''; position: absolute; left: -1px; top: 14px; bottom: 14px; width: 2px; background: var(--c-accent); }
.r1 { display: flex; align-items: center; gap: 6px; }
.no { margin-left: auto; font-size: var(--fs-2xs); color: var(--c-muted); }
.v { display: flex; align-items: baseline; gap: 4px; margin-top: 10px; }
.vn { font-size: 26px; line-height: 30px; font-weight: 500; letter-spacing: -0.02em; }
.u { font-size: var(--fs-xs); color: var(--c-muted); }
.lb { margin-left: auto; font-size: var(--fs-2xs); color: var(--c-muted); }
.s { margin-top: 6px; font-size: var(--fs-sm); line-height: 21px; }
.src { display: flex; justify-content: space-between; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--c-line); font-size: 10.5px; color: var(--c-muted); }
.sm { margin-top: 6px; }
.sch { padding: 12px 14px 4px; }
.sch h2 { display: flex; justify-content: space-between; align-items: baseline; font-size: var(--fs-md); font-weight: 600; }
.sch h2 span { font-size: var(--fs-2xs); color: var(--c-muted); font-weight: 400; }
.sch li { display: grid; grid-template-columns: 48px 1fr; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--c-line); font-size: var(--fs-xs); line-height: var(--lh-xs); }
.sch li:last-child { border-bottom: 0; }
.t { font-size: 10.5px; color: var(--c-muted); line-height: 15px; }
.x .chip { margin-left: 6px; height: 18px; vertical-align: 1px; }
.none { display: block !important; color: var(--c-muted); }
.disc { padding: 16px 16px 24px; font-size: 10.5px; line-height: 16px; color: var(--c-muted); }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
</style>
