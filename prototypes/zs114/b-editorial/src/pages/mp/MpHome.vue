<template>
  <MpShell title="知数星耀" tab="brief">
    <div class="dl">
      <p class="dl-d serif">{{ longDate(day.date).replace(/^\d+ 年 /, '') }}</p>
      <p class="dl-m num">数据日 {{ day.date }} · 入选 {{ day.facts.length }} 条</p>
    </div>
    <h2 class="h serif">今日要点</h2>
    <ol class="cards">
      <li v-for="(f, i) in day.facts" :key="i" class="reveal" :style="{ '--i': i }">
        <RouterLink :to="f.source.startsWith('行业') ? '/mp/industries' : '/mp'" class="card" :class="{ lead: i === 0 }">
          <span class="c-top">
            <span class="c-no serif num">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="c-k">{{ KINDS[f.kind].glyph }} {{ f.kind }}</span>
            <span class="tag solid c-tag">统计</span>
          </span>
          <span class="c-v serif num">{{ figureOf(f).v }}<small class="c-vc">{{ figureOf(f).c }}</small></span>
          <span class="c-s serif"><template v-for="(s, j) in segments(f.statement)" :key="j"><em v-if="s.num" class="v num" :class="{ hl: s.lead }">{{ s.t }}</em><template v-else>{{ s.t }}</template></template></span>
          <span class="c-src"><sup>{{ i + 1 }}</sup>{{ f.source }}<span class="c-go" aria-hidden="true">›</span></span>
        </RouterLink>
      </li>
    </ol>

    <h2 class="h serif">明日日程</h2>
    <ul class="sched">
      <li v-for="s in day.schedule" :key="s.date + s.title">
        <span class="s-w num"><b>{{ s.date.slice(5).replace('-', '/') }}</b>{{ s.time }}</span>
        <span class="s-b">
          <span class="s-t">{{ s.title }}</span>
          <span class="s-tags">
            <span class="stars" :aria-label="`重要性 ${s.stars} 星`">{{ '★'.repeat(s.stars) }}</span>
            <template v-if="s.title === AI_DEMO_TITLE"><span class="tag ai">AI 整理</span><span class="tag muted">示意</span></template>
          </span>
        </span>
      </li>
    </ul>
    <p class="note">「AI 整理」标识为样式示意；此条实际来源为事件日历。</p>
    <p class="disc">{{ day.disclaimer }}</p>
  </MpShell>
</template>

<script setup>
import MpShell from './MpShell.vue'
import { dayOf, DEFAULT_DATE, KINDS, segments, figureOf, longDate, AI_DEMO_TITLE } from '../../lib/brief.js'
const day = dayOf(DEFAULT_DATE)
</script>

<style scoped>
.dl { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 8px; border-bottom: 2px solid var(--rule-strong); }
.dl-d { font-size: 15px; font-weight: 600; }
.dl-m { font-size: 11px; color: var(--ink-3); }
.h { font-size: 22px; font-weight: 900; margin: 20px 0 12px; letter-spacing: .04em; }
.cards { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.card { display: grid; gap: 8px; padding: 14px 16px 12px; background: var(--sheet); border: 1px solid var(--rule); border-radius: var(--r-2); box-shadow: var(--shadow-1); color: var(--ink); text-decoration: none; transition: transform var(--dur-1) var(--ease); }
.card:active { transform: scale(.99); background: var(--paper-2); }
.c-top { display: flex; align-items: center; gap: 8px; }
.c-no { font-size: 15px; color: var(--ink-3); font-weight: 600; }
.c-k { font-size: 12px; color: var(--accent); font-weight: 600; letter-spacing: .04em; }
.c-tag { margin-left: auto; }
.c-v { font-size: 28px; font-weight: 600; line-height: 1.1; color: var(--ink); }
.c-vc { font: 400 11px var(--font-sans); color: var(--ink-3); margin-left: 8px; }
.lead { border-top: 3px solid var(--accent); }
.lead .c-v { font-size: 40px; color: var(--accent); }
.c-s { font-size: 15px; line-height: 1.6; font-weight: 600; }
.v { font-style: normal; color: var(--accent); }
.v.hl { background: linear-gradient(var(--mark), var(--mark)) 0 88% / 100% 36% no-repeat; }
.c-src { display: flex; align-items: center; gap: 2px; font-size: 11px; color: var(--ink-3); padding-top: 8px; border-top: 1px dashed var(--rule); }
.c-src sup { color: var(--accent); font-weight: 700; }
.c-go { margin-left: auto; font-size: 18px; line-height: 1; }
.sched { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--rule-strong); }
.sched li { display: grid; grid-template-columns: 52px 1fr; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--rule); }
.s-w { display: grid; font-size: 12px; color: var(--ink-3); }
.s-w b { font: 600 16px/1.3 var(--font-serif); color: var(--ink); }
.s-b { display: grid; gap: 4px; }
.s-t { font-size: 14px; line-height: 1.5; }
.s-tags { display: flex; gap: 6px; align-items: center; }
.stars { color: var(--accent); font-size: 11px; letter-spacing: 1px; }
.note, .disc { font-size: 11px; color: var(--ink-3); margin-top: 8px; line-height: 1.6; }
.disc { margin-top: 16px; padding-top: 8px; border-top: 1px solid var(--rule); }
</style>
