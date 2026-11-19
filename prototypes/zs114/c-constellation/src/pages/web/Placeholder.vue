<template>
  <div class="page">
    <h1 class="display">{{ mod?.label || '数据页' }}</h1>
    <StatePanel kind="empty" title="原型阶段没有做这一页" desc="方向 C 只做了「今日要点」和「行业比较与轮动」两页，用来比较视觉方向。正式平台里这一页保留现有内容，作为要点的下钻层。">
      <router-link class="btn sm" to="/app">回到今日要点</router-link>
      <router-link class="btn sm" to="/app/industries">看行业比较与轮动</router-link>
    </StatePanel>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import StatePanel from '../../components/StatePanel.vue'
import { moduleByKey } from '../../lib/brief.js'
const route = useRoute()
const mod = computed(() => moduleByKey[route.params.key])
</script>

<style scoped>
.page { max-width: 1320px; margin: 0 auto; padding: var(--s-6) var(--s-7); }
h1 { font-size: var(--fs-2xl); margin-bottom: var(--s-5); }
@media (max-width: 640px) { .page { padding: var(--s-4); } h1 { font-size: var(--fs-xl); } }
</style>
