<template>
  <div class="stage">
    <div class="phone">
      <div class="status mono" aria-hidden="true"><span>9:41</span><span class="sig"><i></i><i></i><i></i><i></i></span></div>
      <header class="nav">
        <button v-if="back" class="back" type="button" aria-label="返回" @click="$router.back()"><svg width="10" height="18" viewBox="0 0 10 18" aria-hidden="true"><path d="M9 1 1 9l8 8" fill="none" stroke="currentColor" stroke-width="1.6" /></svg></button>
        <h1 class="ttl">{{ title }}</h1>
        <div class="capsule" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span><span class="sep"></span><span class="ring"></span></div>
      </header>
      <main class="content" id="mp-main"><slot /></main>
      <nav class="tabbar" aria-label="小程序底栏">
        <router-link v-for="t in TABS" :key="t.label" :to="t.to" class="tab" :class="{ on: t.key === tab, off: !t.live }" :aria-current="t.key === tab ? 'page' : undefined" :aria-disabled="!t.live || undefined" @click="(e) => !t.live && e.preventDefault()">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path :d="t.icon" /></svg>
          <span>{{ t.label }}</span>
        </router-link>
      </nav>
    </div>
    <p class="hint">小程序 H5 预览 · 375 宽 · 胶囊与状态栏为示意 · <router-link to="/app">返回 Web 平台</router-link></p>
  </div>
</template>
<script setup>
defineProps({ title: String, tab: String, back: Boolean })
const TABS = [
  { key: 'brief', label: '要点', to: '/mp', live: true, icon: 'M3 4h16M3 9h10M3 14h16M3 19h8' },
  { key: 'ind', label: '行业', to: '/mp/industries', live: true, icon: 'M3 19V11M8 19V5M13 19v-9M18 19V8M2 19.5h18' },
  { key: 'cal', label: '日历', to: '/mp', live: false, icon: 'M3 5h16v14H3zM3 9h16M7 2v5M15 2v5' },
  { key: 'me', label: '我的', to: '/mp', live: false, icon: 'M11 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 20c1-4 4.5-6 8-6s7 2 8 6' },
]
</script>
<style scoped>
.stage { min-height: 100vh; display: flex; flex-direction: column; align-items: center; background: var(--c-sunken); }
.phone { position: relative; width: 100%; max-width: 375px; min-height: 100vh; display: flex; flex-direction: column; background: var(--c-bg); }
@media (min-width: 520px) { .stage { padding: 32px 0; } .phone { min-height: 812px; height: 812px; border: 1px solid var(--c-line-strong); border-radius: 36px; overflow: hidden; box-shadow: var(--shadow-pop); } }
.status { display: flex; justify-content: space-between; align-items: center; height: 44px; padding: 0 24px; font-size: 14px; font-weight: 500; flex: none; }
.sig { display: flex; gap: 2px; align-items: flex-end; } .sig i { width: 3px; background: var(--c-ink); border-radius: 1px; }
.sig i:nth-child(1) { height: 4px; } .sig i:nth-child(2) { height: 6px; } .sig i:nth-child(3) { height: 8px; } .sig i:nth-child(4) { height: 10px; }
.nav { position: relative; display: flex; align-items: center; justify-content: center; height: 44px; flex: none; border-bottom: 1px solid var(--c-line); }
.ttl { font-size: 17px; font-weight: 600; }
.back { position: absolute; left: 8px; width: 36px; height: 36px; display: grid; place-items: center; border: 0; background: transparent; color: var(--c-ink); }
.capsule { position: absolute; right: 7px; display: flex; align-items: center; width: 87px; height: 32px; border: 1px solid var(--c-line-strong); border-radius: 16px; background: color-mix(in srgb, var(--c-surface) 70%, transparent); }
.capsule .dots { flex: 1; display: flex; justify-content: center; gap: 3px; } .capsule .dots i { width: 4px; height: 4px; border-radius: 50%; background: var(--c-ink); }
.capsule .sep { width: 1px; height: 18px; background: var(--c-line-strong); }
.capsule .ring { flex: 1; display: grid; place-items: center; } .capsule .ring::after { content: ''; width: 14px; height: 14px; border: 2px solid var(--c-ink); border-radius: 50%; box-sizing: border-box; }
.content { flex: 1; overflow-y: auto; }
.tabbar { display: grid; grid-template-columns: repeat(4, 1fr); height: 56px; padding-bottom: env(safe-area-inset-bottom); border-top: 1px solid var(--c-line); background: var(--c-surface); flex: none; }
.tab { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 10px; color: var(--c-muted); }
.tab svg { fill: none; stroke: currentColor; stroke-width: 1.5; }
.tab.on { color: var(--c-accent); font-weight: 600; }
.tab.off { cursor: default; }
.hint { padding: 12px; font-size: var(--fs-2xs); color: var(--c-muted); } .hint a { color: var(--c-accent); text-decoration: underline; text-underline-offset: 2px; }
@media (max-width: 519px) { .hint { display: none; } .phone { height: 100vh; height: 100dvh; } }
</style>
