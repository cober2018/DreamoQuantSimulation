<template>
  <MpFrame title="知数星耀" tab="brief">
    <section class="hero">
      <p class="date tnum">{{ md }} {{ weekday(day.trade_date) }} · 盘后</p>
      <h2 class="display">今日要点</h2>
      <p class="sum tnum">{{ day.facts.length }} 条统计事实 · 按偏离程度排序 · 数据日期 {{ day.trade_date }}</p>
      <ConstellationStrip class="strip" :facts="day.facts" :active="active" :date="day.trade_date" @open="open" @hover="active = $event" />
    </section>

    <ol class="list">
      <li v-for="(f, i) in day.facts" :key="i">
        <button :id="'mp-fact-' + (i + 1)" type="button" class="fact" @click="open(i)">
          <span class="row1"><span class="rk display tnum">{{ String(i + 1).padStart(2, '0') }}</span><span class="kind"><KindGlyph :kind="f.kind" />{{ f.kind }}</span><span class="badge stat">统计</span>
            <svg class="chev" width="7" height="12" viewBox="0 0 7 12" aria-hidden="true"><path d="M1 1 L6 6 L1 11" /></svg></span>
          <span class="text"><Statement :fact="f" /></span>
          <span class="src">{{ f.source }}</span>
        </button>
      </li>
    </ol>

    <section class="sched" aria-labelledby="mp-sched">
      <h2 id="mp-sched" class="sh">明日日程</h2>
      <ul>
        <li v-for="(s, i) in day.schedule" :key="i">
          <span class="when tnum"><b>{{ s.date.slice(5).replace('-', '/') }}</b>{{ s.time }}</span>
          <span class="what">{{ s.title }}<span class="r2"><span class="stars">{{ '★'.repeat(s.stars) }}</span><span v-if="s.aiDemo" class="badge ai">AI 整理 · 示意</span></span></span>
        </li>
      </ul>
    </section>
    <p class="disc">{{ day.disclaimer }}</p>
    <FactSheet :fact="sheet >= 0 ? day.facts[sheet] : null" :rank="sheet + 1" @close="sheet = -1" />
  </MpFrame>
</template>

<script setup>
import { ref } from 'vue'
import MpFrame from './MpFrame.vue'
import ConstellationStrip from '../../components/ConstellationStrip.vue'
import KindGlyph from '../../components/KindGlyph.vue'
import Statement from '../../components/Statement.vue'
import FactSheet from '../../components/FactSheet.vue'
import { DEFAULT_DATE, getDay, weekday } from '../../lib/brief.js'
const day = getDay(DEFAULT_DATE)
const md = `${+day.trade_date.slice(5, 7)}月${+day.trade_date.slice(8)}日`
const active = ref(-1)
const sheet = ref(-1)
const open = (i) => { sheet.value = i }
</script>

<style scoped>
.hero { padding: var(--s-4) var(--s-4) 0; }
.date { font-size: var(--fs-xs); color: var(--c-accent-ink); letter-spacing: 0.08em; }
h2.display { font-size: 28px; margin-top: var(--s-1); }
.sum { margin-top: var(--s-1); font-size: var(--fs-xs); color: var(--c-ink-3); }
.strip { margin-top: var(--s-3); }
.list { padding: var(--s-2) var(--s-3) 0; display: flex; flex-direction: column; gap: var(--s-2); }
.fact { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 6px; padding: var(--s-3) var(--s-4); border-radius: var(--r-3); background: var(--c-surface); border: 1px solid var(--c-line); transition: background-color var(--dur-1); }
.fact:active { background: var(--c-surface-hover); }
.row1 { display: flex; align-items: center; gap: var(--s-2); }
.rk { font-size: 18px; color: var(--c-ink-3); width: 24px; }
.kind { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 6px; border-radius: var(--r-1); background: var(--c-surface-2); font-size: var(--fs-2xs); color: var(--c-ink-2); }
.chev { margin-left: auto; } .chev path { fill: none; stroke: var(--c-ink-3); stroke-width: 1.4; }
.text { font-size: 15px; line-height: 1.6; color: var(--c-ink-2); }
.src { font-size: var(--fs-2xs); color: var(--c-ink-3); }
.sched { margin: var(--s-5) var(--s-3) 0; padding: var(--s-4); border-radius: var(--r-3); background: var(--c-surface); border: 1px solid var(--c-line); }
.sh { font-size: var(--fs-md); font-weight: 600; margin-bottom: var(--s-2); }
.sched li { display: grid; grid-template-columns: 52px 1fr; gap: var(--s-3); padding: var(--s-3) 0; border-top: 1px solid var(--c-line); }
.sched li:first-child { border-top: 0; }
.when { display: flex; flex-direction: column; font-size: var(--fs-2xs); color: var(--c-ink-3); }
.when b { font-size: var(--fs-sm); color: var(--c-ink); }
.what { font-size: var(--fs-sm); line-height: 1.5; }
.r2 { display: flex; gap: var(--s-2); align-items: center; margin-top: 4px; }
.stars { color: var(--c-accent); font-size: 10px; letter-spacing: 1px; }
.disc { margin: var(--s-4) var(--s-4) 0; font-size: var(--fs-2xs); color: var(--c-ink-3); line-height: 1.6; }
</style>
