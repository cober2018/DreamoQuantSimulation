<!-- 一个数据模块：标题写成它回答的问题；单位与数据日期常显；底部一行口径（字段 · 窗口 · 数据日期 · 来源）。
     state 非空时整块换成状态组件，不画空坐标轴。 -->
<template>
  <section class="mod" :class="{ wide }" :aria-labelledby="id + '-h'">
    <header class="mh">
      <div class="mt">
        <span class="badge stat">统计</span>
        <h2 :id="id + '-h'">{{ title }}</h2>
      </div>
      <div class="mr">
        <slot name="tools" />
        <span class="unit tnum">{{ unit }}</span>
      </div>
    </header>
    <slot v-if="!state" name="kpi" />
    <StatePanel v-if="state" :kind="state" compact :rows="5" :title="stateTitle" :desc="stateDesc">
      <slot name="state-action" />
    </StatePanel>
    <slot v-else />
    <p class="spec"><span class="spec-k">口径</span>{{ spec }}</p>
    <p v-if="$slots.note && !state" class="note"><slot name="note" /></p>
  </section>
</template>

<script setup>
import StatePanel from './StatePanel.vue'
defineProps({ id: String, title: String, unit: String, spec: String, state: String, stateTitle: String, stateDesc: String, wide: Boolean })
</script>

<style scoped>
.mod { border: 1px solid var(--c-line); border-radius: var(--r-3); background: var(--c-surface); padding: var(--s-4); min-width: 0; display: flex; flex-direction: column; gap: var(--s-3); }
.mh { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--s-3); flex-wrap: wrap; }
.mt { display: flex; align-items: center; gap: var(--s-2); min-width: 0; }
.mt h2 { font-size: var(--fs-md); font-weight: 600; line-height: var(--lh-snug, 1.4); color: var(--c-ink); }
.mr { display: flex; align-items: center; gap: var(--s-3); flex-wrap: wrap; }
.unit { font-size: var(--fs-2xs); color: var(--c-ink-3); }
.spec { font-size: var(--fs-2xs); color: var(--c-ink-3); line-height: 1.6; border-top: 1px dashed var(--c-line); padding-top: var(--s-2); }
.spec-k { display: inline-block; margin-right: var(--s-2); color: var(--c-ink-2); font-weight: 600; letter-spacing: 0.08em; }
.note { font-size: var(--fs-xs); color: var(--c-ink-2); line-height: 1.7; }
@media (max-width: 640px) { .mod { padding: var(--s-3); } .mt { align-items: flex-start; } .mt .badge { margin-top: 2px; } }
</style>
