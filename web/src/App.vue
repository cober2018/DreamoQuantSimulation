<template>
  <router-view v-if="bare" />
  <div v-else class="layout">
    <nav class="sidebar">
      <div class="brand">量化数据洞察<small>信息汇总 · 历史统计</small></div>
      <router-link v-for="r in visibleNav" :key="r.path" :to="r.path">{{ r.title }}</router-link>
      <div class="side-foot">
        <router-link to="/account">我的账号 · {{ session.user?.role_label }}</router-link>
        <router-link v-if="can('admin.console')" to="/admin">管理后台</router-link>
      </div>
    </nav>
    <main class="main"><router-view /></main>
    <Watermark />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Watermark from './components/Watermark.vue'
import { can, session } from './auth'

const route = useRoute()
const bare = computed(() => route.meta.bare)
const nav = [
  { path: '/overview', title: '市场总览', perm: 'page.overview' },
  { path: '/participation', title: '参与度与资金环境', perm: 'page.participation' },
  { path: '/industries', title: '行业比较与轮动', perm: 'page.industries' },
  { path: '/themes', title: '题材与涨跌结构', perm: 'page.themes' },
  { path: '/history', title: '历史复盘', perm: 'page.history' },
  { path: '/calendar', title: '事件日历', perm: 'page.calendar' },
  { path: '/about', title: '数据与内容说明', perm: null },
]
// 隐藏无权限入口只是体验; 真正的权限边界在服务端
const visibleNav = computed(() => nav.filter((n) => !n.perm || can(n.perm)))
</script>

<style>
.side-foot { margin-top: 24px; border-top: 1px solid #2a3750; padding-top: 12px; }
</style>
