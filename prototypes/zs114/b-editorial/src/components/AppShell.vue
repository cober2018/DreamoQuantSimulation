<template>
  <a class="skip" href="#main">跳到正文</a>
  <header class="mast">
    <div class="wrap mast-util">
      <span class="eyebrow">A 股盘后数据 · 只给数据，不做建议</span>
      <span class="util-right">
        <span class="util-plan">试用账户</span>
        <ThemeToggle label />
      </span>
    </div>
    <div class="wrap mast-main">
      <RouterLink to="/" class="wordmark" aria-label="知数星耀 首页">
        <svg class="mark" width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <path d="M3 19h22M3 14h15M3 9h22" stroke="currentColor" stroke-width="1.6" />
          <circle cx="21.5" cy="14" r="2.2" fill="var(--accent)" />
        </svg>
        <span class="wm-text">知数星耀</span>
      </RouterLink>
      <span class="mast-deck serif">盘后纪要</span>
    </div>
  </header>
  <nav class="sections" aria-label="栏目">
    <div class="wrap sec-row">
      <RouterLink v-for="s in SECTIONS" :id="`nav-${s.key}`" :key="s.key" :to="s.path" class="sec"
        :class="{ on: isOn(s) }" :aria-current="isOn(s) ? 'page' : undefined">
        <span class="sec-full">{{ s.title }}</span><span class="sec-short">{{ s.short }}</span>
      </RouterLink>
    </div>
  </nav>
  <main id="main" class="wrap main" tabindex="-1"><slot /></main>
  <footer class="foot">
    <div class="wrap foot-in">
      <p class="legal">{{ LEGAL }}</p>
      <p class="foot-links">
        <span>知数星耀 · DreamOTech</span>
        <RouterLink class="ink-link" to="/landing">产品介绍</RouterLink>
        <RouterLink class="ink-link" to="/states">状态样张</RouterLink>
        <RouterLink class="ink-link" to="/mp">小程序样张</RouterLink>
      </p>
    </div>
  </footer>
</template>

<script setup>
import { useRoute } from 'vue-router'
import ThemeToggle from './ThemeToggle.vue'
import { SECTIONS, LEGAL } from '../lib/brief.js'

const route = useRoute()
const isOn = (s) => (s.path === '/' ? route.path === '/' : route.path.startsWith(s.path))
</script>

<style scoped>
.wrap { max-width: var(--shell); margin: 0 auto; padding: 0 var(--sp-6); }
.skip { position: absolute; left: -999px; top: 8px; z-index: 50; background: var(--ink); color: var(--paper); padding: 8px 12px; }
.skip:focus { left: 8px; }

.mast-util { display: flex; justify-content: space-between; align-items: center; height: 44px; border-bottom: 1px solid var(--rule); }
.util-right { display: flex; align-items: center; gap: var(--sp-4); font-size: var(--fs-xs); color: var(--ink-3); }
.mast-main { display: flex; align-items: baseline; gap: var(--sp-4); padding-top: var(--sp-5); padding-bottom: var(--sp-4); }
.wordmark { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; }
.mark { color: var(--ink); align-self: center; }
.wm-text { font: 800 var(--fs-2xl)/1 var(--font-serif); letter-spacing: .08em; }
.mast-deck { font-size: var(--fs-md); color: var(--ink-3); letter-spacing: .3em; padding-left: var(--sp-4); border-left: 1px solid var(--rule); }

.sections {
  position: sticky; top: 0; z-index: 20;
  background: color-mix(in srgb, var(--paper) 92%, transparent);
  backdrop-filter: saturate(1.2) blur(8px);
  border-top: 2px solid var(--rule-strong); border-bottom: 1px solid var(--rule-strong);
}
.sec-row { display: flex; gap: 0; overflow-x: auto; scrollbar-width: none; }
.sec-row::-webkit-scrollbar { display: none; }
.sec {
  position: relative; flex: none; padding: 12px 16px; color: var(--ink-2); text-decoration: none;
  font: 500 var(--fs-md)/20px var(--font-sans); white-space: nowrap;
  transition: color var(--dur-1) var(--ease);
}
.sec:first-child { padding-left: 0; }
.sec + .sec::before { content: ''; position: absolute; left: 0; top: 14px; bottom: 14px; width: 1px; background: var(--rule); }
.sec::after {
  content: ''; position: absolute; left: 16px; right: 16px; bottom: -1px; height: 3px; background: var(--accent);
  transform: scaleX(0); transform-origin: left; transition: transform var(--dur-3) var(--ease);
}
.sec:first-child::after { left: 0; }
.sec:hover { color: var(--ink); }
.sec:hover::after { transform: scaleX(.35); }
.sec.on { color: var(--ink); font-weight: 600; }
.sec.on::after { transform: scaleX(1); }
.sec-short { display: none; }

.main { padding-top: var(--sp-6); padding-bottom: var(--sp-8); outline: none; min-height: 60vh; }

.foot { border-top: 2px solid var(--rule-strong); }
.foot-in { padding-top: var(--sp-5); padding-bottom: var(--sp-6); display: grid; gap: var(--sp-3); }
.legal { font-size: var(--fs-xs); color: var(--ink-3); max-width: 72em; line-height: 1.7; }
.foot-links { display: flex; flex-wrap: wrap; gap: var(--sp-4); font-size: var(--fs-xs); color: var(--ink-3); }

@media (max-width: 760px) {
  .wrap { padding: 0 var(--sp-4); }
  .mast-util .eyebrow { font-size: var(--fs-2xs); letter-spacing: .08em; }
  .util-plan { display: none; }
  .mast-main { padding-top: var(--sp-4); padding-bottom: var(--sp-3); }
  .wm-text { font-size: var(--fs-xl); }
  .sec { padding: 10px 12px; }
  .sec::after { left: 12px; right: 12px; }
  .sec-full { display: none; }
  .sec-short { display: inline; }
  .main { padding-top: var(--sp-5); }
}
</style>
