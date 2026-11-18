<!-- 关注知数Talk 主理人：卡片数据只来自 content/social.json。ready=false 的卡片默认不显示（原型可用 ?drafts=1 预览占位）。 -->
<template>
  <div class="site">
    <a class="skip-link" href="#main">跳到正文</a>
    <SiteHeader />
    <main id="main" class="wrap pg">
      <p class="eyebrow">公众号 · 抖音 · 小红书</p>
      <h1 class="display">关注知数Talk 主理人</h1>
      <p class="sub">在公众号、抖音、小红书上分享市场数据的口径和读法。用对应 App 扫码即可关注；内容仅作数据与方法交流，不构成投资建议。</p>

      <ul v-if="SOCIAL.length" class="cards">
        <li v-for="s in SOCIAL" :id="s.platform" :key="s.platform" class="card" :class="{ draft: !s.ready }">
          <div class="hd">
            <PlatformMark :platform="s.platform" />
            <div class="who">
              <h2 class="nm">{{ s.name }}</h2>
              <p class="pf">{{ s.platformName }}</p>
            </div>
            <span v-if="!s.ready" class="badge sample">占位</span>
          </div>
          <figure class="qr">
            <!-- 码图放在白底容器里（暗色主题也是白底），不加滤镜、不做圆角裁切，否则可能扫不出 -->
            <div v-if="s.qr" class="qr-box"><img :src="s.qr" :alt="s.qrAlt || `${s.name} ${s.platformName}二维码`" width="276" height="276" loading="lazy" decoding="async" /></div>
            <div v-else class="qr-ph" role="img" :aria-label="`${s.platformName}二维码待补充`">
              <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="36" y="4" width="16" height="16" rx="2" /><rect x="4" y="36" width="16" height="16" rx="2" /><path d="M36 36h6v6h-6zM46 46h6v6h-6zM46 36h6M36 46v6" /></svg>
              <span>二维码待补充</span>
            </div>
            <figcaption>{{ s.qr ? `用${s.platformName === '公众号' ? '微信' : s.platformName} App 扫码` : '账号信息确认后放入' }}</figcaption>
          </figure>
          <a v-if="s.url" class="btn sm" :href="s.url" rel="noopener" target="_blank">打开{{ s.platformName }}<span class="sr-only">（在新窗口打开）</span></a>
        </li>
      </ul>
      <StatePanel v-else kind="empty" title="账号信息整理中" desc="公众号、抖音、小红书的账号确认后会放在这里。" />
    </main>
    <SiteFooter />
  </div>
</template>

<script setup>
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import PlatformMark from '../components/PlatformMark.vue'
import StatePanel from '../components/StatePanel.vue'
import { SOCIAL } from '../lib/social.js'
</script>

<style scoped>
.site { min-height: 100vh; display: flex; flex-direction: column; background: var(--c-bg); }
.pg { flex: 1; width: 100%; padding-top: var(--s-8); padding-bottom: var(--s-8); }
.eyebrow { font-size: var(--fs-xs); letter-spacing: var(--tr-caps); color: var(--c-accent-ink); margin-bottom: var(--s-3); }
h1 { font-size: clamp(32px, 4vw, 48px); line-height: 1.15; }
.sub { margin-top: var(--s-3); max-width: 40em; color: var(--c-ink-2); font-size: var(--fs-md); line-height: var(--lh-loose); }
.cards { margin-top: var(--s-7); display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s-5); }
.card { display: flex; flex-direction: column; gap: var(--s-4); padding: var(--s-5); border: 1px solid var(--c-line); border-radius: var(--r-3); background: var(--c-surface); }
.card.draft { border-style: dashed; }
.hd { display: flex; align-items: center; gap: var(--s-3); }
.who { min-width: 0; }
.pf { font-size: var(--fs-xs); color: var(--c-ink-3); }
.nm { font-size: var(--fs-lg); font-weight: 600; line-height: 1.3; }
.hd .badge { margin-left: auto; }
.qr { margin: 0; display: flex; flex-direction: column; align-items: center; gap: var(--s-2); padding: var(--s-5) 0 var(--s-3); border-top: 1px solid var(--c-line); }
.qr-box { width: min(300px, 100%); aspect-ratio: 1; padding: 12px; background: var(--c-qr-surface); border: 1px solid var(--c-line); border-radius: var(--r-2); }
.qr-box img { display: block; width: 100%; height: 100%; object-fit: contain; }
.qr-ph { width: 160px; height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s-2); border: 1px dashed var(--c-line-strong); border-radius: var(--r-2); background: var(--c-surface-2); color: var(--c-ink-2); font-size: var(--fs-sm); }
.qr-ph svg { fill: none; stroke: var(--c-line-strong); stroke-width: 1.4; }
figcaption { font-size: var(--fs-xs); color: var(--c-ink-3); }
@media (max-width: 1099px) { .cards { grid-template-columns: minmax(0, 1fr); max-width: 420px; } }
@media (max-width: 640px) { .pg { padding-top: var(--s-6); padding-bottom: var(--s-6); } }
</style>
