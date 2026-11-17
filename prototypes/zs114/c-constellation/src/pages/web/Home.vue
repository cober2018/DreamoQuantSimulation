<template>
  <div class="page">
    <header class="head">
      <div class="title-block">
        <p class="eyebrow">每日 · 盘后</p>
        <h1 class="display">今日要点</h1>
      </div>
      <div class="date-nav" role="group" aria-label="选择交易日">
        <button id="date-prev" class="btn sm" type="button" :disabled="idx <= 0" @click="step(-1)"><span aria-hidden="true">‹</span><span class="sr-only">前一交易日</span></button>
        <label class="date-sel">
          <span class="sr-only">交易日</span>
          <select id="date-select" v-model="date" class="tnum">
            <option v-for="d in days" :key="d.trade_date" :value="d.trade_date">{{ d.trade_date }} {{ weekday(d.trade_date) }}</option>
          </select>
        </label>
        <button id="date-next" class="btn sm" type="button" :disabled="idx >= days.length - 1" @click="step(1)"><span aria-hidden="true">›</span><span class="sr-only">后一交易日</span></button>
      </div>
    </header>
    <p class="sub">
      按固定规则从 6 个数据页算出，按偏离程度排序，同类最多 2 条。
      <span class="tnum">数据日期 <b>{{ day.trade_date }}</b> · 入选 <b>{{ day.facts.length }}</b> / 候选 {{ day.candidates }}</span>
    </p>

    <ConstellationStrip v-if="day.facts.length" class="strip" :facts="day.facts" :active="active" :date="date" @hover="active = $event" @open="open" />
    <hr v-else class="rule" />

    <div class="grid">
      <section class="facts" aria-labelledby="facts-h">
        <h2 id="facts-h" class="sr-only">事实要点</h2>
        <StatePanel v-if="!day.facts.length" :kind="allError ? 'error' : 'nodate'"
          :title="allError ? '这一天的数据没有取到' : '这一天没有生成要点'"
          :desc="allError ? '6 个数据页全部未取到，所以没有要点。这是取数问题，不代表市场没有变化；我们不会拿其他日期代替。' : `部分数据页未取到（见右侧「数据状态」），可计算的规则都没有触发。不拿其他日期代替。`">
          <button class="btn sm" type="button" @click="date = DEFAULT_DATE">回到 {{ DEFAULT_DATE }}</button>
        </StatePanel>
        <FactCard v-for="(f, i) in day.facts" :key="date + i" :fact="f" :rank="i + 1" :active="active === i"
          @hover="(on) => (active = on ? i : active === i ? -1 : active)" @open="open(i)" />
      </section>

      <aside class="side" aria-label="明日日程与数据状态">
        <section class="panel" aria-labelledby="sched-h">
          <header class="ph"><h2 id="sched-h">明日日程</h2><span class="hint">未来 3 个自然日 · ★4 以上</span></header>
          <ol v-if="day.schedule.length" class="sched">
            <li v-for="(s, i) in day.schedule" :key="i">
              <span class="when tnum"><b>{{ s.date.slice(5).replace('-', '/') }}</b>{{ s.time }}</span>
              <span class="what">{{ s.title }}
                <span class="row2"><span class="stars" :aria-label="s.stars + ' 星重要性'">{{ '★'.repeat(s.stars) }}<i>{{ '★'.repeat(5 - s.stars) }}</i></span>
                  <span v-if="s.aiDemo" class="badge ai" title="由 AI 从公开日程整理（本条为样式示意）">AI 整理<span class="demo">示意</span></span></span>
              </span>
            </li>
          </ol>
          <StatePanel v-else kind="empty" compact title="近 3 日没有 ★4 以上的事件" desc="完整日程在「事件日历」页。" />
          <router-link to="/app/p/calendar" class="more">完整事件日历 →</router-link>
        </section>

        <section class="panel" aria-labelledby="status-h">
          <header class="ph"><h2 id="status-h">数据状态</h2><span class="hint">取数结果，如实列出</span></header>
          <ul class="status">
            <li v-for="m in MODULES" :key="m.key">
              <span class="led" :class="day.module_status[m.key]" aria-hidden="true"></span>
              <router-link :to="m.to">{{ m.label }}</router-link>
              <span class="st" :class="day.module_status[m.key]">{{ STATUS_LABEL[day.module_status[m.key]] }}</span>
              <span class="dt tnum">{{ day.module_dates?.[m.key]?.slice(5) || '—' }}</span>
            </li>
          </ul>
        </section>
      </aside>
    </div>

    <footer class="disc">
      <p>{{ day.disclaimer }} 「统计」表示按固定规则计算的事实；以后若有「判断」类内容，会单独标注并写明依据。</p>
    </footer>

    <FactSheet :fact="sheetIdx >= 0 ? day.facts[sheetIdx] : null" :rank="sheetIdx + 1" @close="sheetIdx = -1" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ConstellationStrip from '../../components/ConstellationStrip.vue'
import FactCard from '../../components/FactCard.vue'
import FactSheet from '../../components/FactSheet.vue'
import StatePanel from '../../components/StatePanel.vue'
import { DEFAULT_DATE, MODULES, STATUS_LABEL, days, getDay, weekday } from '../../lib/brief.js'

const route = useRoute(), router = useRouter()
const date = computed({
  get: () => route.query.date || DEFAULT_DATE,
  set: (v) => router.replace({ query: { ...route.query, date: v === DEFAULT_DATE ? undefined : v } }),
})
const day = computed(() => getDay(date.value))
const idx = computed(() => days.findIndex((d) => d.trade_date === day.value.trade_date))
const step = (n) => { date.value = days[idx.value + n].trade_date }
const allError = computed(() => Object.values(day.value.module_status).every((s) => s === 'error'))
const active = ref(-1)
const sheetIdx = ref(-1)
const open = (i) => { sheetIdx.value = i }
</script>

<style scoped>
.page { max-width: 1320px; margin: 0 auto; padding: var(--s-6) var(--s-7) var(--s-7); }
.head { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--s-4); flex-wrap: wrap; }
.eyebrow { font-size: var(--fs-xs); letter-spacing: 0.16em; color: var(--c-accent-ink); margin-bottom: var(--s-2); }
h1 { font-size: var(--fs-2xl); line-height: 1.1; }
.date-nav { display: flex; align-items: center; gap: var(--s-2); }
.date-nav .btn { width: 32px; padding: 0; font-size: 18px; }
.date-sel select {
  height: 32px; padding: 0 var(--s-6) 0 var(--s-3); border-radius: var(--r-2); border: 1px solid var(--c-line-strong);
  background: var(--c-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238893a6' stroke-width='1.2'/%3E%3C/svg%3E") no-repeat right 10px center;
  color: var(--c-ink); font: inherit; font-size: var(--fs-sm); appearance: none; cursor: pointer;
}
.sub { margin-top: var(--s-3); color: var(--c-ink-3); font-size: var(--fs-sm); display: flex; flex-wrap: wrap; gap: var(--s-1) var(--s-4); }
.sub b { color: var(--c-ink); font-weight: 600; }
.strip { margin: var(--s-5) 0 var(--s-3); }
.rule { border: 0; border-top: 1px solid var(--c-line); margin: var(--s-5) 0; }
.grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: var(--s-6); align-items: start; }
.facts { border-top: 1px solid var(--c-line-strong); }
.side { display: flex; flex-direction: column; gap: var(--s-4); position: sticky; top: var(--s-5); }
.panel { border: 1px solid var(--c-line); border-radius: var(--r-3); background: var(--c-surface); padding: var(--s-4); }
.ph { display: flex; align-items: baseline; justify-content: space-between; gap: var(--s-2); margin-bottom: var(--s-3); }
.ph h2 { font-size: var(--fs-base); font-weight: 600; }
.hint { font-size: var(--fs-2xs); color: var(--c-ink-3); }
.sched li { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: var(--s-3); padding: var(--s-3) 0; border-top: 1px solid var(--c-line); }
.sched li:first-child { border-top: 0; padding-top: 0; }
.when { display: flex; flex-direction: column; font-size: var(--fs-xs); color: var(--c-ink-3); line-height: 1.5; }
.when b { color: var(--c-ink); font-weight: 600; font-size: var(--fs-sm); }
.what { font-size: var(--fs-sm); color: var(--c-ink); line-height: 1.55; }
.row2 { display: flex; align-items: center; gap: var(--s-2); margin-top: var(--s-1); }
.stars { color: var(--c-accent); font-size: 10px; letter-spacing: 1px; }
.stars i { font-style: normal; color: var(--c-line-strong); }
.demo { margin-left: 4px; padding-left: 4px; border-left: 1px solid currentColor; }
.more { display: inline-block; margin-top: var(--s-3); font-size: var(--fs-xs); color: var(--c-accent-ink); }
.more:hover { text-decoration: underline; }
.status li { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto 40px; gap: var(--s-2); align-items: center; height: 32px; font-size: var(--fs-sm); }
.status a { color: var(--c-ink-2); }
.status a:hover { color: var(--c-ink); }
.led { width: 6px; height: 6px; border-radius: 50%; background: var(--c-ok); }
.led.partial { background: var(--c-warn); }
.led.error { background: transparent; border: 1px solid var(--c-danger); }
.st { font-size: var(--fs-xs); color: var(--c-ink-3); }
.st.partial { color: var(--c-warn); }
.st.error { color: var(--c-danger); }
.dt { font-size: var(--fs-xs); color: var(--c-ink-3); text-align: right; }
.disc { margin-top: var(--s-6); padding-top: var(--s-4); border-top: 1px solid var(--c-line); font-size: var(--fs-xs); color: var(--c-ink-3); line-height: 1.7; max-width: 880px; }

@media (min-width: 1680px) { .page { max-width: 1560px; } .grid { grid-template-columns: minmax(0, 1fr) 420px; } }
@media (max-width: 1180px) { .grid { grid-template-columns: minmax(0, 1fr); } .side { position: static; display: grid; grid-template-columns: 1fr 1fr; } }
@media (max-width: 1023px) { .page { padding: var(--s-5) var(--s-5) var(--s-6); } }
@media (max-width: 640px) {
  .page { padding: var(--s-4) var(--s-4) var(--s-6); }
  h1 { font-size: var(--fs-xl); }
  .side { grid-template-columns: minmax(0, 1fr); }
  .date-nav { width: 100%; }
  .date-sel { flex: 1; }
  .date-sel select { width: 100%; }
}
</style>
