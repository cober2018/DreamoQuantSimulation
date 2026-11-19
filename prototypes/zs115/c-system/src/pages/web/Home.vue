<template>
  <div class="page">
    <header class="head">
      <div class="title-block">
        <p class="eyebrow">每日 · 盘后</p>
        <h1 class="display">今日要点</h1>
      </div>
      <div class="when">
        <p class="d-big display tnum">{{ date.slice(5).replace('-', '.') }}<small>{{ weekday(date) }}</small></p>
        <label class="jump"><span>跳到日期</span>
          <input id="date-jump" type="date" :value="date" :min="days[0].trade_date" :max="days[days.length - 1].trade_date" @change="(e) => e.target.value && (date = e.target.value)" />
        </label>
      </div>
    </header>

    <DayRuler v-model="date" class="ruler" />

    <p class="sub">
      按固定规则从 6 个数据页算出，按偏离程度排序，同类最多 2 条。
      <span v-if="day" class="tnum">数据日期 <b>{{ day.trade_date }}</b> · 入选 <b>{{ day.facts.length }}</b> / 候选 {{ day.candidates }}</span>
    </p>

    <div class="grid">
      <section class="facts" aria-labelledby="facts-h" :aria-busy="state === 'loading'">
        <h2 id="facts-h" class="sr-only">事实要点</h2>
        <template v-if="state === 'loading'">
          <div class="sk-lead" aria-hidden="true"><i class="a" /><i class="b" /><i class="c" /></div>
          <StatePanel kind="loading" :rows="4" title="正在加载当天要点" />
        </template>
        <StatePanel v-else-if="state === 'error'" kind="error" title="这一天的要点没有取到" desc="数据服务暂时没有响应。这是取数问题，不代表市场没有变化；我们不会拿其他日期代替。">
          <button id="retry" class="btn sm" type="button" @click="clearPreview">重试</button>
        </StatePanel>
        <StatePanel v-else-if="state === 'forbidden'" kind="forbidden" title="当前账号还不能查看每日要点" desc="你的账号等级还不包含这部分内容。各等级能看的范围见价格与权益页。">
          <router-link class="btn sm primary" to="/pricing">查看价格与权益</router-link>
        </StatePanel>
        <StatePanel v-else-if="state === 'nodate'" kind="nodate" :title="`${date} ${weekday(date)} 没有数据`" desc="这一天不是交易日，或当天数据还没有发布。我们不会拿其他日期的数据代替。">
          <button id="to-nearest" class="btn sm" type="button" @click="date = nearestTradeDay(date)">选最近的交易日 {{ nearestTradeDay(date).slice(5) }}</button>
        </StatePanel>
        <StatePanel v-else-if="state === 'empty'" kind="empty" title="这一天没有生成要点" desc="可计算的规则都没有触发。数据状态见右侧；不拿其他日期代替。" />
        <template v-else>
          <FactCard :fact="day.facts[0]" :rank="1" variant="lead" :active="active === 0" @hover="(on) => hover(0, on)" @open="open(0)" />
          <div class="strip-wrap">
            <p class="strip-cap"><span>要点星图</span><span>横向：来源数据页 · 纵向：偏离程度</span></p>
            <ConstellationStrip :facts="day.facts" :active="active" :date="date" @hover="active = $event" @open="open" />
          </div>
          <div class="cards">
            <FactCard v-for="(f, i) in day.facts.slice(1)" :key="date + i" :fact="f" :rank="i + 2" :active="active === i + 1"
              @hover="(on) => hover(i + 1, on)" @open="open(i + 1)" />
          </div>
        </template>
      </section>

      <aside class="side" aria-label="明日日程与数据状态">
        <section class="panel" aria-labelledby="sched-h">
          <header class="ph"><h2 id="sched-h">明日日程</h2><span class="hint">未来 3 个自然日 · ★4 以上</span></header>
          <ol v-if="day?.schedule.length" class="sched">
            <li v-for="(s, i) in day.schedule" :key="i">
              <span class="when-s tnum"><b>{{ s.date.slice(5).replace('-', '/') }}</b>{{ s.time }}</span>
              <span class="what">{{ s.title }}
                <span class="row2"><span class="stars" :aria-label="s.stars + ' 星重要性'">{{ '★'.repeat(s.stars) }}<i>{{ '★'.repeat(5 - s.stars) }}</i></span>
                  <span v-if="s.aiDemo" class="badge ai" title="由 AI 从公开日程整理（本条为样式示意）">AI 整理<span class="demo">示意</span></span></span>
              </span>
            </li>
          </ol>
          <StatePanel v-else :kind="day ? 'empty' : 'nodate'" compact :title="day ? '近 3 日没有 ★4 以上的事件' : '所选日期没有日程数据'" desc="完整日程在「事件日历」页。" />
          <router-link to="/app/p/calendar" class="more">完整事件日历 →</router-link>
        </section>

        <section class="panel" aria-labelledby="status-h">
          <header class="ph"><h2 id="status-h">数据状态</h2><span class="hint">取数结果，如实列出</span></header>
          <ul class="status">
            <li v-for="m in MODULES" :key="m.key">
              <span class="led" :class="st(m.key)" aria-hidden="true"></span>
              <router-link :to="m.to">{{ m.label }}</router-link>
              <span class="st" :class="st(m.key)">{{ STATUS_LABEL[st(m.key)] || '—' }}</span>
              <span class="dt tnum">{{ day?.module_dates?.[m.key]?.slice(5) || '—' }}</span>
            </li>
          </ul>
        </section>
      </aside>
    </div>

    <footer class="disc">
      <p>{{ day?.disclaimer || '以上为按固定规则计算的市场统计事实，不构成投资建议。' }} 「统计」表示按固定规则计算的事实；以后若有「判断」类内容，会单独标注并写明依据。</p>
    </footer>

    <FactSheet :fact="sheetIdx >= 0 && day ? day.facts[sheetIdx] : null" :rank="sheetIdx + 1" @close="sheetIdx = -1" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ConstellationStrip from '../../components/ConstellationStrip.vue'
import DayRuler from '../../components/DayRuler.vue'
import FactCard from '../../components/FactCard.vue'
import FactSheet from '../../components/FactSheet.vue'
import StatePanel from '../../components/StatePanel.vue'
import { DEFAULT_DATE, MODULES, STATUS_LABEL, days, findDay, nearestTradeDay, weekday } from '../../lib/brief.js'

const route = useRoute(), router = useRouter()
const date = computed({
  get: () => route.query.date || DEFAULT_DATE,
  set: (v) => router.replace({ query: { ...route.query, date: v === DEFAULT_DATE ? undefined : v, state: undefined } }),
})
const day = computed(() => findDay(date.value))
// 原型：?state=loading|error|forbidden|empty 在真实页面里预览各状态
const state = computed(() => {
  const p = route.query.state
  if (['loading', 'error', 'forbidden', 'empty'].includes(p)) return p
  if (!day.value) return 'nodate'
  if (!day.value.facts.length) return Object.values(day.value.module_status).every((s) => s === 'error') ? 'error' : 'empty'
  return 'ok'
})
const clearPreview = () => router.replace({ query: { ...route.query, state: undefined } })
const st = (k) => (day.value ? day.value.module_status[k] : '')
const active = ref(-1)
const hover = (i, on) => { active.value = on ? i : active.value === i ? -1 : active.value }
const sheetIdx = ref(-1)
const open = (i) => { sheetIdx.value = i }
</script>

<style scoped>
.page { max-width: 1320px; margin: 0 auto; padding: var(--s-6) var(--s-7) var(--s-7); }
.head { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--s-4); flex-wrap: wrap; }
.eyebrow { font-size: var(--fs-xs); letter-spacing: var(--tr-caps); color: var(--c-accent-ink); margin-bottom: var(--s-2); }
h1 { font-size: var(--fs-2xl); line-height: 1.1; }
.when { display: flex; align-items: flex-end; gap: var(--s-4); }
.d-big { font-size: var(--fs-xl); line-height: 1; color: var(--c-ink); }
.d-big small { margin-left: var(--s-2); font-family: var(--font-sans); font-size: var(--fs-sm); color: var(--c-ink-3); }
.jump { display: flex; flex-direction: column; gap: 2px; font-size: var(--fs-2xs); color: var(--c-ink-3); }
.jump input:focus { outline: 2px solid var(--c-focus); outline-offset: 2px; }
.jump input { height: 32px; padding: 0 var(--s-2); border-radius: var(--r-2); border: 1px solid var(--c-line-strong); background: var(--c-surface); color: var(--c-ink); font: inherit; font-size: var(--fs-sm); color-scheme: inherit; }
.ruler { margin-top: var(--s-5); }
.sub { margin-top: var(--s-4); color: var(--c-ink-3); font-size: var(--fs-sm); display: flex; flex-wrap: wrap; gap: var(--s-1) var(--s-4); }
.sub b { color: var(--c-ink); font-weight: 600; }
.grid { margin-top: var(--s-5); display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: var(--s-6); align-items: start; }
.facts { display: flex; flex-direction: column; gap: var(--s-4); min-width: 0; }
.strip-wrap { padding: var(--s-3) var(--s-4) var(--s-2); border: 1px solid var(--c-line); border-radius: var(--r-3); background: var(--c-bg-deep); }
.strip-cap { display: flex; justify-content: space-between; gap: var(--s-3); flex-wrap: wrap; font-size: var(--fs-2xs); color: var(--c-ink-3); margin-bottom: var(--s-1); }
.strip-cap span:first-child { color: var(--c-ink-2); font-weight: 600; letter-spacing: var(--tr-wide); }
.cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-4); }
.cards > :last-child:nth-child(odd) { grid-column: 1 / -1; }
.sk-lead { display: grid; gap: var(--s-3); padding: var(--s-5); border: 1px solid var(--c-line); border-radius: var(--r-3); background: var(--c-surface); }
.sk-lead i { display: block; height: 12px; border-radius: var(--r-1); background: linear-gradient(90deg, var(--c-surface-2) 0%, var(--c-surface-hover) 40%, var(--c-surface-2) 80%); background-size: 300% 100%; animation: sh 1.6s var(--ease-std) infinite; }
.sk-lead .a { width: 24%; } .sk-lead .b { width: 40%; height: 56px; } .sk-lead .c { width: 72%; }
@keyframes sh { from { background-position: 100% 0; } to { background-position: -50% 0; } }
.side { display: flex; flex-direction: column; gap: var(--s-4); position: sticky; top: var(--s-5); }
.panel { border: 1px solid var(--c-line); border-radius: var(--r-3); background: var(--c-surface); padding: var(--s-4); }
.ph { display: flex; align-items: baseline; justify-content: space-between; gap: var(--s-2); margin-bottom: var(--s-3); }
.ph h2 { font-size: var(--fs-base); font-weight: 600; }
.hint { font-size: var(--fs-2xs); color: var(--c-ink-3); }
.sched li { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: var(--s-3); padding: var(--s-3) 0; border-top: 1px solid var(--c-line); }
.sched li:first-child { border-top: 0; padding-top: 0; }
.when-s { display: flex; flex-direction: column; font-size: var(--fs-xs); color: var(--c-ink-3); line-height: 1.5; }
.when-s b { color: var(--c-ink); font-weight: 600; font-size: var(--fs-sm); }
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
.led.partial, .led.empty { background: var(--c-warn); }
.led.error, .led:not(.ok):not(.partial):not(.empty) { background: transparent; border: 1px solid var(--c-danger); }
.st { font-size: var(--fs-xs); color: var(--c-ink-3); }
.st.partial, .st.empty { color: var(--c-warn); }
.st.error { color: var(--c-danger); }
.dt { font-size: var(--fs-xs); color: var(--c-ink-3); text-align: right; }
.disc { margin-top: var(--s-6); padding-top: var(--s-4); border-top: 1px solid var(--c-line); font-size: var(--fs-xs); color: var(--c-ink-3); line-height: 1.7; max-width: 880px; }

@media (min-width: 1680px) { .page { max-width: 1560px; } .grid { grid-template-columns: minmax(0, 1fr) 400px; } }
@media (max-width: 1180px) { .grid { grid-template-columns: minmax(0, 1fr); } .side { position: static; display: grid; grid-template-columns: 1fr 1fr; } }
@media (max-width: 1023px) { .page { padding: var(--s-5) var(--s-5) var(--s-6); } }
@media (max-width: 760px) { .cards { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 640px) {
  .page { padding: var(--s-4) var(--s-4) var(--s-6); }
  h1 { font-size: var(--fs-xl); }
  .side { grid-template-columns: minmax(0, 1fr); }
  .d-big { font-size: var(--fs-lg); }
}
</style>
