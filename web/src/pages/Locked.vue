<template>
  <section>
    <header class="page-head">
      <h1>{{ page?.title || '会员内容' }}</h1>
      <span class="badge lock">需要 {{ need }}</span>
      <div class="question">{{ page?.question }}</div>
    </header>
    <div class="panel">
      <h2>开通后可查看</h2>
      <ul class="metrics"><li v-for="m in page?.metrics || []" :key="m">{{ m }}</li></ul>
      <p class="muted">当前等级：{{ session.user?.role_label }}。该页面需要 {{ need }} 及以上等级。</p>
      <router-link class="btn primary" to="/plans">查看会员套餐</router-link>
    </div>
    <footer class="footer">本平台仅提供证券信息汇总与历史数据统计，不构成任何证券投资建议。</footer>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { session } from '../auth'
import { pageByKey } from '../pageCatalog'

const route = useRoute()
const page = computed(() => pageByKey(route.params.key))
const need = computed(() => session.user?.perm_min_role?.[page.value?.perm] || '会员')
</script>

<style scoped>
.muted { font-size: 13px; }
.metrics { margin: 0 0 14px; padding-left: 20px; line-height: 1.9; font-size: 14px; }
</style>
