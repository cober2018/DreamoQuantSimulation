<!-- 公开站页脚：关注我们（只列可公开的卡片）、隐私、协议、ICP、免责声明 -->
<template>
  <footer class="ft">
    <div class="wrap">
      <div class="top">
        <router-link to="/" class="brand" aria-label="知数星耀 首页"><BrandMark :size="24" /><span class="display">知数星耀</span></router-link>
        <div v-if="SOCIAL.length" class="follow">
          <router-link id="ft-follow" to="/follow" class="cap">关注主理人 →</router-link>
          <ul class="chips">
            <li v-for="s in SOCIAL" :key="s.platform"><router-link :to="'/follow#' + s.platform" class="chip"><PlatformMark :platform="s.platform" size="sm" />{{ s.platformName }}</router-link></li>
          </ul>
        </div>
      </div>
      <p class="disc">本平台提供市场数据与历史统计，仅供研究和学习参考，不构成任何投资建议、证券推荐或交易指令。数据可能存在延迟、缺失或误差，请以交易所及上市公司的官方披露为准。</p>
      <p class="links">
        <router-link to="/privacy">隐私政策</router-link>
        <router-link to="/terms">用户协议</router-link>
        <a href="https://beian.miit.gov.cn/" rel="noopener" target="_blank">浙ICP备2024135110号<span class="sr-only">（在新窗口打开）</span></a>
        <span>© DreamOTech</span>
      </p>
    </div>
  </footer>
</template>

<script setup>
import BrandMark from './BrandMark.vue'
import PlatformMark from './PlatformMark.vue'
import { SOCIAL } from '../lib/social.js'
</script>

<style scoped>
.ft { border-top: 1px solid var(--c-line); background: var(--c-bg-deep); padding: var(--s-6) 0 var(--s-5); font-size: var(--fs-xs); color: var(--c-ink-3); }
.top { display: flex; align-items: center; justify-content: space-between; gap: var(--s-4); flex-wrap: wrap; padding-bottom: var(--s-4); border-bottom: 1px solid var(--c-line); }
.brand { display: inline-flex; align-items: center; gap: var(--s-2); font-size: 16px; color: var(--c-ink); }
.follow { display: flex; align-items: center; gap: var(--s-3); flex-wrap: wrap; }
.cap { color: var(--c-ink-2); font-weight: 500; }
.cap:hover { color: var(--c-ink); }
.chips { display: flex; gap: var(--s-2); flex-wrap: wrap; }
.chip { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 var(--s-2) 0 4px; border: 1px solid var(--c-line); border-radius: var(--r-pill); color: var(--c-ink-2); transition: border-color var(--dur-2), color var(--dur-2); }
.chip:hover { border-color: var(--c-line-strong); color: var(--c-ink); }
.disc { margin-top: var(--s-4); line-height: 1.8; max-width: 880px; }
.links { margin-top: var(--s-3); display: flex; flex-wrap: wrap; gap: var(--s-2) var(--s-5); }
.links a { color: var(--c-ink-2); }
.links a:hover { color: var(--c-ink); text-decoration: underline; }
</style>
