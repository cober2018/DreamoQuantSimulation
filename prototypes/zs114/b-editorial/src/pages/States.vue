<template>
  <article class="states">
    <header class="head">
      <p class="eyebrow">设计系统 · 状态样张</p>
      <h1 class="title">五种数据状态</h1>
      <p class="deck">所有数据页共用一套状态：同一种线框插图、同一种语气，只说发生了什么、不拿其他日期代替。下方每一格都是真实组件，不是截图。</p>
    </header>

    <div class="grid">
      <section v-for="(s, i) in LIST" :key="s.kind" class="frame reveal" :style="{ '--i': i }" :aria-labelledby="`st-${s.kind}`">
        <header class="fh">
          <span class="fh-no serif num">{{ String(i + 1).padStart(2, '0') }}</span>
          <h2 :id="`st-${s.kind}`">{{ s.name }}</h2>
          <span class="fh-use">{{ s.use }}</span>
        </header>
        <DataState :kind="s.kind" :title="s.title" :detail="s.detail" compact :rows="4">
          <template v-if="s.kind === 'error'"><button class="btn sm" type="button">重试</button></template>
          <template v-else-if="s.kind === 'denied'"><span class="tag muted">成交额及历史分位</span><span class="tag muted">主动卖出占比与变化</span><button class="btn sm primary" type="button">查看等级说明</button></template>
          <template v-else-if="s.kind === 'nodate'"><button class="btn sm" type="button">看前一交易日 2026-11-13</button></template>
          <template v-else-if="s.kind === 'empty'"><button class="btn sm" type="button">清除筛选</button></template>
        </DataState>
      </section>

      <section class="frame" aria-labelledby="st-chart">
        <header class="fh">
          <span class="fh-no serif num">06</span>
          <h2 id="st-chart">图表加载</h2>
          <span class="fh-use">ECharts 主题自带的加载遮罩（纸色遮罩 + 墨蓝细线）</span>
        </header>
        <EChart :build="emptyAxes" height="220px" loading label="图表加载中" />
      </section>
    </div>
  </article>
</template>

<script setup>
import DataState from '../components/DataState.vue'
import EChart from '../components/EChart.vue'

const LIST = [
  { kind: 'empty', name: '空', use: '筛选后没有数据行', title: '当前筛选下没有板块', detail: '「地域板块 · 换手率 > 20%」没有匹配的行。' },
  { kind: 'loading', name: '加载', use: '骨架与真实行高一致，避免布局抖动' },
  { kind: 'error', name: '错误', use: '取数失败，如实说明', title: '行业、题材、历史复盘没有取到数据', detail: '这三页取数失败时，当天要点会偏少，原因是数据没取到，不是规则没触发。页面不会用旧数据代替。' },
  { kind: 'denied', name: '无权限', use: '可预览指标名称，不给数值' },
  { kind: 'nodate', name: '所选日期无数据', use: '非交易日或当晚数据未就绪', title: '2026-11-15 没有数据', detail: '所选日期是周日，不是交易日。不以其他日期的数据代替。' },
]
const emptyAxes = () => ({
  grid: { left: 44, right: 16, top: 16, bottom: 28 },
  xAxis: { type: 'category', data: ['09-03', '09-04', '09-07', '09-08', '09-09'] },
  yAxis: { type: 'value', min: 0, max: 100 },
  series: [],
})
</script>

<style scoped>
.head { display: grid; gap: var(--sp-3); padding-bottom: var(--sp-6); border-bottom: 2px solid var(--rule-strong); }
.title { font-size: var(--fs-5xl); font-weight: 900; letter-spacing: .04em; }
.deck { font: 400 var(--fs-lg)/1.6 var(--font-serif); color: var(--ink-2); max-width: var(--measure); }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-6) var(--sp-7); padding-top: var(--sp-6); }
.frame { min-width: 0; }
.wide { grid-column: 1 / -1; }
.fh { display: flex; align-items: baseline; gap: var(--sp-3); padding-bottom: var(--sp-2); }
.fh-no { font-size: var(--fs-xl); color: var(--ink-3); font-weight: 600; }
.fh h2 { font-size: var(--fs-lg); }
.fh-use { margin-left: auto; font-size: var(--fs-xs); color: var(--ink-3); }
@media (max-width: 1080px) { .grid { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .title { font-size: var(--fs-3xl); } .fh { flex-wrap: wrap; } .fh-use { margin-left: 0; width: 100%; } }
</style>
