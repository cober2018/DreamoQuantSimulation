<template>
  <div class="home">
    <section class="col-main" aria-labelledby="h-brief">
      <div class="dateline">
        <p class="dl-date serif num">{{ longDate(date) }}</p>
        <div class="dl-nav" role="group" aria-label="切换交易日">
          <button id="day-prev" class="btn sm" type="button" :disabled="idx === 0" aria-label="前一交易日" @click="go(-1)">‹</button>
          <label class="sr-only" for="day-select">选择交易日</label>
          <select id="day-select" class="dl-select num" :value="date" @change="pick($event.target.value)">
            <option v-if="idx < 0" :value="date">{{ date }}</option>
            <option v-for="d in DAYS" :key="d.date" :value="d.date">{{ d.date }}</option>
          </select>
          <button id="day-next" class="btn sm" type="button" :disabled="idx >= DAYS.length - 1" aria-label="后一交易日" @click="go(1)">›</button>
        </div>
      </div>
      <hr class="rule-double" />

      <header class="head">
        <h1 id="h-brief" class="title">今日要点</h1>
        <p class="deck">按偏离常态的程度排序。每条都是按固定规则算出的统计事实，标明数据日期和口径；点开可落到明细页核对原始数据。</p>
        <p v-if="day" class="count num">
          <span>入选 <b>{{ facts.length }}</b> 条</span><span aria-hidden="true">／</span><span>候选 {{ day.candidates }} 条</span>
          <span aria-hidden="true">／</span><span>同类最多 2 条</span>
        </p>
      </header>

      <DataState v-if="!day || nodata" kind="nodate" :title="`${date} 没有数据`"
        detail="可能是非交易日，或当晚数据尚未就绪。不以其他日期的数据代替。">
        <button class="btn sm" type="button" @click="pick(DEFAULT_DATE)">回到 {{ DEFAULT_DATE }}</button>
      </DataState>
      <DataState v-else-if="!facts.length" kind="error" :title="`${date} 没有入选的要点`"
        :detail="`当天${failed.join('、')}取数失败，要点为 0 是因为数据没取到，不是没有触发规则。`" />

      <ol v-else class="facts" aria-label="要点列表">
        <li v-for="(f, i) in facts" :key="f.statement">
          <FactItem :fact="f" :n="i + 1" :note="fn.index[i]" :lead="i === 0" />
        </li>
      </ol>

      <section v-if="facts.length" class="notes" aria-labelledby="h-notes">
        <h2 id="h-notes" class="notes-h">口径与注释</h2>
        <ol class="notes-list">
          <li v-for="(n, i) in fn.notes" :id="`fn-${i + 1}`" :key="n.key">
            <span class="fn-no serif num">{{ i + 1 }}</span>
            <div>
              <p class="fn-src">{{ n.source }} <span class="fn-date num">· 数据日 {{ n.date }}</span></p>
              <p v-if="n.definition" class="fn-def">{{ n.definition }}</p>
              <p class="fn-fields"><span>字段</span> <code v-for="x in n.fields" :key="x">{{ x }}</code></p>
            </div>
            <a class="fn-back ink-link" :href="`#ref-${fn.index.indexOf(i + 1) + 1}`">↩ 回正文</a>
          </li>
        </ol>
      </section>

      <p class="disclaimer">{{ day?.disclaimer || DISCLAIMER }}</p>
    </section>

    <aside class="col-rail" aria-label="日程与数据覆盖">
      <section class="panel" aria-labelledby="h-sched">
        <header class="panel-h">
          <h2 id="h-sched">明日日程</h2>
          <span class="panel-m">数据日后 3 个自然日 · 重要性 ≥ 4 星</span>
        </header>
        <p v-if="!schedule.length" class="empty-line">这几天没有 4 星及以上的事件。</p>
        <ul v-else class="sched">
          <li v-for="s in schedule" :key="s.date + s.time + s.title" class="ev">
            <span class="ev-when num"><b>{{ s.date.slice(5).replace('-', '/') }}</b>{{ s.time || '全天' }}</span>
            <span class="ev-body">
              <span class="ev-title">{{ s.title }}</span>
              <span class="ev-tags">
                <span class="stars" :aria-label="`重要性 ${s.stars} 星`">{{ '★'.repeat(s.stars) }}<span class="star-off">{{ '★'.repeat(5 - s.stars) }}</span></span>
                <span v-if="s.title === AI_DEMO_TITLE" class="tag ai" title="内容经 AI 整理，非规则计算">AI 整理</span>
                <span v-if="s.title === AI_DEMO_TITLE" class="tag muted">示意</span>
              </span>
            </span>
          </li>
        </ul>
        <p v-if="hasDemo" class="panel-note">「AI 整理」标识为样式示意；此条实际来源为事件日历。来源：事件日历。</p>
        <p v-else class="panel-note">来源：事件日历。</p>
      </section>

      <section v-if="day" class="panel" aria-labelledby="h-cover">
        <header class="panel-h"><h2 id="h-cover">数据来源与覆盖</h2><span class="panel-m num">{{ date }}</span></header>
        <table class="cover">
          <caption class="sr-only">各页面当日取数状态</caption>
          <thead><tr><th scope="col">页面</th><th scope="col">状态</th><th scope="col" class="r">数据日</th></tr></thead>
          <tbody>
            <tr v-for="m in modules" :key="m.key">
              <th scope="row">{{ m.label }}</th>
              <td><span class="st" :class="`st-${m.status}`">{{ m.statusLabel }}</span></td>
              <td class="r num">{{ m.date.slice(5) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="panel" aria-labelledby="h-ledger">
        <header class="panel-h"><h2 id="h-ledger">近 20 个交易日</h2><span class="panel-m">柱高 = 入选条数</span></header>
        <ul class="ledger">
          <li v-for="d in DAYS" :key="d.date"><button type="button" class="lg" :class="{ on: d.date === date, miss: !d.facts.length }"
            :aria-label="`${d.date}，${d.facts.length} 条要点`" :aria-current="d.date === date ? 'date' : undefined" @click="pick(d.date)">
            <i :style="{ height: 6 + d.facts.length * 6 + 'px' }" />
            <span class="num">{{ d.date.slice(5).replace('-', '/') }}</span>
          </button></li>
        </ul>
        <p class="panel-note">空心 = 当日要点为 0（取数失败或无数据）。区间 {{ DAYS[0].date }} 至 {{ DAYS[DAYS.length - 1].date }}。</p>
      </section>
    </aside>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FactItem from '../components/FactItem.vue'
import DataState from '../components/DataState.vue'
import { DAYS, DEFAULT_DATE, dayOf, footnotesOf, longDate, moduleRows, DISCLAIMER, AI_DEMO_TITLE } from '../lib/brief.js'

const route = useRoute()
const router = useRouter()
// 指定了回放里没有的日期（如非交易日）就如实显示「所选日期无数据」，不回退到别的日期
const date = computed(() => route.query.d || DEFAULT_DATE)
const idx = computed(() => DAYS.findIndex((d) => d.date === date.value))
const day = computed(() => dayOf(date.value))
const facts = computed(() => day.value?.facts || [])
const schedule = computed(() => day.value?.schedule || [])
const modules = computed(() => moduleRows(day.value))
const nodata = computed(() => modules.value.length && modules.value.every((m) => m.status === 'error'))
const failed = computed(() => modules.value.filter((m) => m.status === 'error').map((m) => m.label))
const fn = computed(() => footnotesOf(facts.value))
const hasDemo = computed(() => schedule.value.some((s) => s.title === AI_DEMO_TITLE))

const pick = (d) => router.replace({ query: { ...route.query, d } })
const go = (step) => pick(idx.value < 0 ? DEFAULT_DATE : DAYS[idx.value + step].date)
</script>

<style scoped>
.home { display: grid; grid-template-columns: minmax(0, 1fr) 352px; gap: var(--sp-8); align-items: start; }

.dateline { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-4); padding-bottom: var(--sp-3); }
.dl-date { font-size: var(--fs-md); color: var(--ink-2); letter-spacing: .04em; }
.dl-nav { display: flex; gap: 4px; }
.dl-select {
  height: 32px; padding: 0 var(--sp-2); border: 1px solid var(--rule-strong); border-radius: var(--r-1);
  background: var(--paper); color: var(--ink); font: 500 var(--fs-sm) var(--font-sans);
}

.head { padding: var(--sp-6) 0 var(--sp-5); display: grid; gap: var(--sp-3); border-bottom: 1px solid var(--rule-strong); }
.title { font-size: var(--fs-5xl); font-weight: 900; letter-spacing: .04em; line-height: 1.05; }
.deck { font: 400 var(--fs-lg)/1.6 var(--font-serif); color: var(--ink-2); max-width: var(--measure); }
.count { display: flex; flex-wrap: wrap; gap: var(--sp-2); font-size: var(--fs-xs); color: var(--ink-3); }
.count b { color: var(--ink); font-weight: 600; }

.facts { list-style: none; margin: 0; padding: 0; }

.notes { margin-top: var(--sp-7); }
.notes-h { font-size: var(--fs-md); font-family: var(--font-sans); font-weight: 600; letter-spacing: .12em; padding-bottom: var(--sp-2); border-bottom: 1px solid var(--rule-strong); }
.notes-list { list-style: none; margin: 0; padding: 0; }
.notes-list li { display: grid; grid-template-columns: 32px 1fr auto; gap: var(--sp-3); padding: var(--sp-3) 0; border-bottom: 1px solid var(--rule); font-size: var(--fs-sm); scroll-margin-top: 96px; }
.notes-list li:target { background: var(--accent-wash); }
.fn-no { color: var(--accent); font-weight: 600; font-size: var(--fs-base); }
.fn-src { color: var(--ink); font-weight: 500; }
.fn-date { color: var(--ink-3); font-weight: 400; }
.fn-def { color: var(--ink-2); margin-top: 2px; }
.fn-fields { color: var(--ink-3); margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font-size: var(--fs-xs); }
.fn-fields code { font: var(--fs-2xs)/1.6 var(--font-mono); padding: 0 4px; border: 1px solid var(--rule); border-radius: var(--r-1); color: var(--ink-2); }
.fn-back { font-size: var(--fs-xs); align-self: start; white-space: nowrap; }

.disclaimer { margin-top: var(--sp-5); font-size: var(--fs-xs); color: var(--ink-3); padding-top: var(--sp-3); border-top: 1px solid var(--rule); }

.col-rail { position: sticky; top: 72px; display: grid; gap: var(--sp-6); }
.panel { border-top: 2px solid var(--rule-strong); }
.panel-h { display: flex; justify-content: space-between; align-items: baseline; gap: var(--sp-2); padding: var(--sp-3) 0 var(--sp-2); border-bottom: 1px solid var(--rule); }
.panel-h h2 { font-size: var(--fs-lg); }
.panel-m { font-size: var(--fs-2xs); color: var(--ink-3); text-align: right; }
.panel-note { font-size: var(--fs-2xs); color: var(--ink-3); margin-top: var(--sp-2); line-height: 1.6; }
.empty-line { padding: var(--sp-4) 0; color: var(--ink-3); font-size: var(--fs-sm); }

.sched { list-style: none; margin: 0; padding: 0; }
.ev { display: grid; grid-template-columns: 56px 1fr; gap: var(--sp-3); padding: var(--sp-3) 0; border-bottom: 1px solid var(--rule); }
.ev-when { display: grid; font-size: var(--fs-xs); color: var(--ink-3); line-height: 1.5; }
.ev-when b { font: 600 var(--fs-base)/1.3 var(--font-serif); color: var(--ink); }
.ev-body { display: grid; gap: 4px; }
.ev-title { font-size: var(--fs-sm); line-height: 1.5; color: var(--ink); }
.ev-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.stars { color: var(--accent); font-size: var(--fs-2xs); letter-spacing: 1px; }
.star-off { color: var(--rule); }

.cover { width: 100%; border-collapse: collapse; font-size: var(--fs-xs); }
.cover th, .cover td { text-align: left; padding: 6px 0; border-bottom: 1px solid var(--rule); font-weight: 400; }
.cover thead th { color: var(--ink-3); font-size: var(--fs-2xs); }
.cover tbody th { color: var(--ink); }
.cover .r { text-align: right; color: var(--ink-3); }
.st::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; background: currentColor; }
.st-ok { color: var(--ink-2); }
.st-partial { color: var(--warn); }
.st-error { color: var(--up); }

.ledger { list-style: none; margin: 0; padding-left: 0; display: grid; grid-template-columns: repeat(10, 1fr); gap: var(--sp-3) 4px; align-items: end; padding-top: var(--sp-3); }
.ledger li { display: grid; align-items: end; }
.lg { width: 100%; min-height: 44px; align-content: end; display: grid; justify-items: center; gap: 4px; padding: 0; border: 0; background: none; cursor: pointer; color: var(--ink-3); }
.lg i { display: block; width: 100%; max-width: 14px; background: var(--ink-2); transition: background-color var(--dur-1) var(--ease); }
.lg span { font-size: 10px; line-height: 1; }
.lg.miss i { background: transparent; box-shadow: inset 0 0 0 1px var(--ink-3); }
.lg:hover i { background: var(--accent-2); }
.lg.on i { background: var(--accent); }
.lg.on span { color: var(--accent); font-weight: 700; }

@media (max-width: 1080px) {
  .home { grid-template-columns: 1fr; gap: var(--sp-7); }
  .col-rail { position: static; }
}
@media (max-width: 760px) {
  .dateline { flex-direction: column; align-items: flex-start; gap: var(--sp-2); }
  .title { font-size: var(--fs-3xl); }
  .deck { font-size: var(--fs-base); }
  .head { padding: var(--sp-5) 0 var(--sp-4); }
  .notes-list li { grid-template-columns: 24px 1fr; }
  .fn-back { grid-column: 2; }
}
</style>
