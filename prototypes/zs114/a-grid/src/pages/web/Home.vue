<template>
  <div class="page">
    <div class="gridlines" aria-hidden="true"><i v-for="n in 12" :key="n"></i></div>

    <header class="ph">
      <div class="ph-l">
        <p class="eyebrow">00 · 今日要点 · 盘后</p>
        <h1>今日要点</h1>
        <p class="meta">
          <span>数据日期 <b class="mono">{{ day.date }}</b> {{ weekday(day.date) }}</span>
          <span v-if="day.data_date"><b class="mono">{{ day.facts.length }}</b> 条 · 候选 <b class="mono">{{ day.candidates }}</b> 条 · 按偏离强度排序</span>
          <span class="chip stat">均为统计</span>
        </p>
        <p class="mix" v-if="day.facts.length">
          <span v-for="k in mix" :key="k.kind" :style="{ flexGrow: k.n }" class="mix-seg"><i></i><span>{{ k.kind }} <b class="mono">{{ k.n }}</b></span></span>
        </p>
      </div>
      <div class="ph-r">
        <p class="big mono" aria-hidden="true"><span class="y">{{ day.date.slice(0, 4) }}</span>{{ day.date.slice(5).replace('-', '.') }}</p>
        <div class="stepper">
        <button class="btn step" type="button" id="day-prev" :disabled="idx === 0" aria-label="前一个交易日" @click="go(-1)">←</button>
        <label class="sr-only" for="day-select">交易日</label>
        <select id="day-select" class="sel mono" :value="day.date" @change="setDay($event.target.value)">
          <option v-for="d in DAYS" :key="d.date" :value="d.date">{{ d.date }}</option>
        </select>
        <button class="btn step" type="button" id="day-next" :disabled="idx === DAYS.length - 1" aria-label="后一个交易日" @click="go(1)">→</button>
        </div>
      </div>
    </header>

    <DayRuler class="ruler" :model-value="day.date" @update:model-value="setDay" />

    <div class="cols">
      <section class="facts" aria-labelledby="facts-h">
        <h2 id="facts-h" class="sr-only">事实要点</h2>
        <p class="notice" v-if="day.data_date && failed.length" role="note">
          <span class="chip warn">部分取数失败</span>
          {{ failed.join('、') }} 当日取数失败，以下要点只来自其余页面；条数偏少是因为数据没取到，不是规则没触发。
        </p>
        <div v-if="!day.data_date" class="panel">
          <StatePanel kind="nodate" code="NO_DATA · 所选日期" :title="`所选日期 ${day.date} 暂无数据`" body="当日各页面都没有取到数据，可能是当晚数据尚未就绪。不会用其他日期的数据代替。">
            <template #actions><button class="btn" type="button" @click="go(-1)">查看前一交易日 {{ DAYS[idx - 1].date }}</button></template>
          </StatePanel>
        </div>
        <div v-else-if="!day.facts.length" class="panel">
          <StatePanel kind="empty" code="EMPTY · 0 条" title="本日没有入选的要点" body="能取到的页面里，没有指标超过规则阈值。明日日程仍可查看。" />
        </div>
        <ol v-else class="list" :key="day.date">
          <li v-for="(f, i) in day.facts" :key="f.statement"><FactCard :fact="f" :rank="i + 1" /></li>
        </ol>
      </section>

      <aside class="rail" aria-label="日程与数据状态">
        <section class="panel" aria-labelledby="sch-h">
          <div class="panel-h"><h2 id="sch-h">明日日程</h2><span class="meta">≥ 4 星 · 3 日内</span></div>
          <ul v-if="schedule.length" class="sch">
            <li v-for="(s, i) in schedule" :key="s.date + s.time + s.title">
              <p class="when mono"><span>{{ s.date.slice(5) }}</span><span>{{ s.time || '--:--' }}</span></p>
              <div class="what">
                <p class="ttl">{{ s.title }}</p>
                <p class="tags">
                  <span class="stars" role="img" :aria-label="`重要性 ${s.stars} 星`"><i v-for="n in 5" :key="n" :class="{ f: n <= s.stars }"></i></span>
                  <span class="chip ai" v-if="i === 0" title="示意：标注由 AI 整理的条目，接入后按 ai_curated 字段显示">AI 整理 · 示意</span>
                </p>
              </div>
            </li>
          </ul>
          <p v-else class="none">3 日内没有 4 星以上的事件。</p>
          <router-link class="more" to="/app/s/calendar">查看事件日历 →</router-link>
        </section>

        <section class="panel" aria-labelledby="mod-h">
          <div class="panel-h"><h2 id="mod-h">数据就绪</h2><span class="meta">{{ day.date }}</span></div>
          <ul class="mods">
            <li v-for="m in MODULES" :key="m.key">
              <span class="st-dot" :class="day.module_status[m.key]" aria-hidden="true"></span>
              <span class="m-l">{{ m.label }}</span>
              <span class="m-s" :class="day.module_status[m.key]">{{ STATUS[day.module_status[m.key]] }}</span>
            </li>
          </ul>
        </section>

        <section class="panel about" aria-labelledby="ab-h">
          <div class="panel-h"><h2 id="ab-h">这些要点怎么来</h2><span class="meta">规则 v1</span></div>
          <dl>
            <div><dt class="mono">01</dt><dd>用固定模板从当日数据生成，不用大模型自由写。</dd></div>
            <div><dt class="mono">02</dt><dd>每条带指标、数值、参照、数据日期和口径，点开落到明细页。</dd></div>
            <div><dt class="mono">03</dt><dd>按偏离常态的强度排序，最多 8 条，同类最多 2 条。</dd></div>
          </dl>
        </section>
      </aside>
    </div>

    <footer class="disc">
      <p>{{ day.disclaimer || '以上为按固定规则计算的市场统计事实，不构成投资建议。' }} 本平台提供市场数据与历史统计，仅供研究和学习参考，不构成任何投资建议、证券推荐或交易指令。数据可能存在延迟、缺失或误差，请以交易所及上市公司的官方披露为准。</p>
      <p class="mono gen">规则回放生成于 {{ GENERATED_AT }}</p>
    </footer>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FactCard from '../../components/FactCard.vue'
import StatePanel from '../../components/StatePanel.vue'
import DayRuler from '../../components/DayRuler.vue'
import { DAYS, DEFAULT_DAY, MODULES, GENERATED_AT, dayByDate } from '../../lib/data.js'
import { weekday } from '../../lib/format.js'

const STATUS = { ok: '就绪', partial: '部分', error: '取数失败' }
const route = useRoute()
const router = useRouter()
const day = computed(() => dayByDate(route.query.d) || dayByDate(DEFAULT_DAY))
const idx = computed(() => DAYS.indexOf(day.value))
const failed = computed(() => MODULES.filter((m) => day.value.module_status[m.key] === 'error').map((m) => m.label))
const schedule = computed(() => day.value.schedule)
const mix = computed(() => {
  const m = {}
  for (const f of day.value.facts) m[f.kind] = (m[f.kind] || 0) + 1
  return Object.entries(m).map(([kind, n]) => ({ kind, n }))
})
const setDay = (d) => router.replace({ query: { ...route.query, d } })
const go = (k) => setDay(DAYS[idx.value + k].date)
</script>

<style scoped>
.page { position: relative; isolation: isolate; padding: 32px 32px 48px; max-width: var(--max-w); }
.gridlines { --gm: 32px; }
.ph { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
h1 { margin-top: 8px; font: 700 var(--fs-2xl)/var(--lh-2xl) var(--font-display); letter-spacing: -0.01em; }
.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-top: 12px; font-size: var(--fs-sm); color: var(--c-muted); }
.meta b { color: var(--c-ink); font-weight: 500; }
.ph-r { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
.stepper { display: flex; gap: 8px; }
.big { font-size: 72px; line-height: 64px; font-weight: 500; letter-spacing: -0.04em; color: var(--c-ink); display: flex; align-items: flex-start; gap: 10px; }
.big .y { font-size: var(--fs-xs); line-height: 16px; letter-spacing: .04em; color: var(--c-muted); writing-mode: vertical-rl; transform: rotate(180deg); padding-bottom: 2px; }
.mix { display: flex; gap: 2px; margin-top: 16px; max-width: 560px; }
.mix-seg { flex-basis: 0; min-width: 72px; }
.mix-seg i { display: block; height: 3px; background: var(--c-ink-2); }
.mix-seg:first-child i { background: var(--c-accent); }
.mix-seg span { display: block; margin-top: 6px; font-size: var(--fs-2xs); color: var(--c-muted); }
.mix-seg b { color: var(--c-ink); font-weight: 500; }
.step { width: 36px; padding: 0; font-family: var(--font-mono); }
.sel { height: 36px; padding: 0 12px; border: 1px solid var(--c-line-strong); border-radius: var(--r-sm); background: var(--c-surface); font-size: var(--fs-sm); }
.ruler { margin-top: 24px; }

.cols { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); column-gap: 24px; margin-top: 24px; align-items: start; }
.facts { grid-column: span 8; }
.rail { grid-column: span 4; display: grid; gap: 16px; position: sticky; top: 64px; }
.list { display: grid; gap: 12px; }
.notice { display: flex; gap: 12px; align-items: baseline; padding: 10px 14px; margin-bottom: 12px; border: 1px solid var(--c-line); border-radius: var(--r-md); background: var(--c-surface); font-size: var(--fs-xs); color: var(--c-ink-2); }

.sch li { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--c-line); }
.when { display: flex; flex-direction: column; font-size: var(--fs-2xs); line-height: 16px; color: var(--c-muted); }
.when span:last-child { color: var(--c-ink); font-size: var(--fs-xs); font-weight: 500; }
.ttl { font-size: var(--fs-sm); line-height: var(--lh-sm); }
.tags { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.stars { display: inline-flex; gap: 2px; }
.stars i { display: block; width: 7px; height: 7px; border: 1px solid var(--c-line-strong); }
.stars i.f { background: var(--c-ink-2); border-color: var(--c-ink-2); }
.none { padding: 16px; font-size: var(--fs-sm); color: var(--c-muted); }
.more { display: block; padding: 10px 16px; font-size: var(--fs-xs); font-weight: 600; color: var(--c-accent); }
.more:hover { text-decoration: underline; text-underline-offset: 3px; }

.mods { padding: 6px 0; }
.mods li { display: flex; align-items: center; gap: 10px; padding: 6px 16px; font-size: var(--fs-xs); }
.st-dot { display: inline-block; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--c-ink-2); }
.st-dot.partial { background: transparent; border: 1px solid var(--c-warn); }
.st-dot.error { background: var(--c-warn); }
.m-l { color: var(--c-ink-2); }
.m-s { margin-left: auto; font-family: var(--font-mono); font-size: var(--fs-2xs); color: var(--c-muted); }
.m-s.error, .m-s.partial { color: var(--c-warn); }
.about dl { padding: 8px 16px 14px; display: grid; gap: 8px; }
.about dl div { display: grid; grid-template-columns: 24px 1fr; gap: 8px; font-size: var(--fs-xs); line-height: var(--lh-xs); color: var(--c-ink-2); }
.about dt { color: var(--c-muted); font-size: var(--fs-2xs); }

.disc { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--c-line); font-size: var(--fs-xs); line-height: var(--lh-xs); color: var(--c-muted); max-width: 920px; }
.gen { margin-top: 6px; font-size: var(--fs-2xs); }

@media (max-width: 1279px) { .facts { grid-column: span 12; } .rail { grid-column: span 12; position: static; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 24px; } .about { grid-column: span 2; } }
@media (max-width: 720px) {
  .page { padding: 20px 16px 32px; }
  .gridlines { --cols: 4; --gutter: 16px; --gm: 16px; }
  .gridlines > i:nth-child(n + 5) { display: none; }
  .ph { flex-direction: column; align-items: stretch; }
  h1 { font-size: var(--fs-xl); line-height: var(--lh-xl); }
  .ph-r { align-items: stretch; } .stepper .sel { flex: 1; } .big { display: none; } .mix { max-width: none; }
  .rail { grid-template-columns: minmax(0, 1fr); } .about { grid-column: auto; }
}
</style>
