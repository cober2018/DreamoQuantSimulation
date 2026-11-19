<!-- 导航占位页：价格 / 文档 / 博客 / 登录 / 隐私 / 协议。只说明状态，不写任何价格数字。 -->
<template>
  <div class="site">
    <a class="skip-link" href="#main">跳到正文</a>
    <SiteHeader />
    <main id="main" class="wrap pg">
      <h1 class="display">{{ title }}</h1>
      <StatePanel kind="empty" :title="stubKey === '404' ? '没有这个页面' : '这一页还在准备'" :desc="desc">
        <router-link class="btn sm" to="/">回到首页</router-link>
        <router-link v-if="stubKey === 'login'" class="btn sm primary" to="/app">查看平台原型</router-link>
      </StatePanel>
    </main>
    <SiteFooter />
  </div>
</template>

<script setup>
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import StatePanel from '../components/StatePanel.vue'
defineProps({ stubKey: String, title: String, desc: String })
</script>

<style scoped>
.site { min-height: 100vh; display: flex; flex-direction: column; background: var(--c-bg); }
.pg { flex: 1; width: 100%; padding-top: var(--s-8); padding-bottom: var(--s-8); }
h1 { font-size: clamp(32px, 4vw, 48px); line-height: 1.15; }
</style>
