<template>
  <div class="page">
    <div class="gridlines" aria-hidden="true"><i v-for="n in 12" :key="n"></i></div>
    <header>
      <p class="eyebrow">{{ sec.no }} · {{ sec.label }}</p>
      <h1>{{ sec.label }}</h1>
    </header>
    <section class="panel pts" aria-labelledby="pts-h" v-if="pagePoints.length">
      <div class="panel-h"><h2 id="pts-h">本页要点</h2><span class="meta">{{ day.date }} · 来自今日要点</span></div>
      <ul>
        <li v-for="f in pagePoints" :key="f.statement" :class="{ hit: f.fields[0] === route.query.field }">
          <KindTag :kind="f.kind" /><span class="s">{{ f.statement }}</span><span class="fields mono">{{ f.fields.join(' · ') }}</span>
        </li>
      </ul>
    </section>
    <div class="panel">
      <StatePanel kind="empty" code="STUB · 阶段 B" title="明细页在阶段 B 按本方向重做" :body="`下钻落点：${route.query.field ? '字段 ' + route.query.field + ' 所在面板' : '本页顶部'}。原型阶段只做了「今日要点」和「行业比较与轮动」两页。`">
        <template #actions><router-link class="btn" to="/app">返回今日要点</router-link><router-link class="btn" to="/app/industries">看行业比较与轮动</router-link></template>
      </StatePanel>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import StatePanel from '../../components/StatePanel.vue'
import KindTag from '../../components/KindTag.vue'
import { sectionByKey, dayByDate, DEFAULT_DAY } from '../../lib/data.js'

const route = useRoute()
const sec = computed(() => sectionByKey(route.params.key) || sectionByKey('overview'))
const day = computed(() => dayByDate(route.query.d) || dayByDate(DEFAULT_DAY))
const pagePoints = computed(() => day.value.facts.filter((f) => f.source.startsWith(sec.value.label)).slice(0, 3))
</script>
<style scoped>
.page { position: relative; isolation: isolate; padding: 32px; max-width: var(--max-w); display: grid; gap: 24px; }
.gridlines { --gm: 32px; }
h1 { margin-top: 8px; font: 700 var(--fs-2xl)/var(--lh-2xl) var(--font-display); }
.pts li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--c-line); font-size: var(--fs-sm); }
.pts li.hit { box-shadow: inset 2px 0 0 var(--c-accent); background: var(--c-accent-soft); }
.fields { font-size: var(--fs-2xs); color: var(--c-muted); }
@media (max-width: 720px) { .page { padding: 20px 16px; } .pts li { grid-template-columns: minmax(0, 1fr); } .gridlines { --cols: 4; --gutter: 16px; --gm: 16px; } .gridlines > i:nth-child(n + 5) { display: none; } }
</style>
