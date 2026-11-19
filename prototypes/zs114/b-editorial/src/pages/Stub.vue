<template>
  <article class="stub">
    <p class="eyebrow">明细页</p>
    <h1 class="title">{{ section?.title || '明细页' }}</h1>
    <p class="deck">{{ QUESTIONS[key] }}</p>
    <DataState kind="empty" title="原型未实现此页"
      detail="方向原型只做「今日要点」和「行业比较与轮动」两页。线上版本此处为现有明细页，要点点开会落到对应指标的位置。">
      <RouterLink class="btn sm" to="/">回到今日要点</RouterLink>
      <RouterLink class="btn sm" to="/industries">看行业比较与轮动</RouterLink>
    </DataState>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DataState from '../components/DataState.vue'
import { SECTIONS } from '../lib/brief.js'

const QUESTIONS = {
  overview: '今天市场发生了什么？', participation: '参与和资金结构相对历史怎样变化？',
  themes: '当日涨停、炸板、跌停如何分布？', history: '某一天的数据和历史对比是什么？',
  calendar: '哪些事件已公布、将公布，事实是什么？',
}
const route = useRoute()
const key = computed(() => route.params.key)
const section = computed(() => SECTIONS.find((s) => s.key === key.value))
</script>

<style scoped>
.stub { display: grid; gap: var(--sp-4); }
.title { font-size: var(--fs-5xl); font-weight: 900; letter-spacing: .04em; }
.deck { font: 400 var(--fs-lg)/1.6 var(--font-serif); color: var(--ink-2); margin-bottom: var(--sp-4); }
@media (max-width: 760px) { .title { font-size: var(--fs-3xl); } }
</style>
