<template>
  <router-view v-if="bare" />
  <div v-else class="layout">
    <nav class="sidebar">
      <div class="brand">量化数据洞察<small>信息汇总 · 历史统计</small></div>
      <router-link v-for="p in PAGES" :key="p.path" :to="p.path" :class="{ 'router-link-active': isActive(p) }">
        {{ p.title }}<span v-if="!can(p.perm)" class="lock">🔒 {{ minRole(p.perm) }}</span>
      </router-link>
      <router-link to="/about">数据与内容说明</router-link>
      <div class="side-foot">
        <router-link to="/plans">会员套餐</router-link>
        <router-link to="/account">我的账号 · {{ session.user?.role_label }}</router-link>
        <router-link v-if="can('admin.console')" to="/admin">管理后台</router-link>
      </div>
    </nav>
    <main class="main">
      <div v-if="expireDays !== null" class="banner fixture expiry">
        {{ session.user.role_label }} 将于 {{ expireDays }} 天后到期（{{ expireDate }}），续期请查看<router-link to="/plans">会员套餐</router-link>。
      </div>
      <router-view />
    </main>
    <Watermark />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Watermark from './components/Watermark.vue'
import { can, session } from './auth'
import { PAGES } from './pageCatalog'

const route = useRoute()
const bare = computed(() => route.meta.bare)
// 入口对所有登录用户可见并标锁, 用作会员内容预告; 真正的权限边界在服务端
const minRole = (perm) => session.user?.perm_min_role?.[perm] || '会员'
const isActive = (p) => route.path === `/locked/${p.key}`
const expireDays = computed(() => {
  const t = session.user?.member_expires_at
  if (!t) return null
  const d = Math.ceil((t * 1000 - Date.now()) / 86400000)
  return d >= 0 && d <= 7 ? d : null
})
const expireDate = computed(() => new Date(session.user.member_expires_at * 1000).toLocaleDateString('zh-CN'))
</script>

<style>
.side-foot { margin-top: 24px; border-top: 1px solid #2a3750; padding-top: 12px; }
.sidebar .lock { float: right; font-size: 11px; color: #8a95a8; }
.expiry a { margin: 0 2px; }
</style>
