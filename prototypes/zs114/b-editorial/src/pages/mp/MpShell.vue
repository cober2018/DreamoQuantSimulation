<template>
  <div class="mp">
    <div class="status" aria-hidden="true">
      <span class="num">9:41</span>
      <span class="st-icons">
        <svg width="17" height="11" viewBox="0 0 17 11"><path d="M1 10h2V7H1zm4 0h2V5H5zm4 0h2V3H9zm4 0h2V1h-2z" fill="currentColor" /></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x=".5" y=".5" width="20" height="10" rx="2.5" fill="none" stroke="currentColor" opacity=".5" /><rect x="2" y="2" width="15" height="7" rx="1.5" fill="currentColor" /><path d="M22 4v3" stroke="currentColor" opacity=".5" /></svg>
      </span>
    </div>
    <header class="nav">
      <RouterLink v-if="back" class="nav-back" to="/mp" aria-label="返回">
        <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true"><path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" stroke-width="2" /></svg>
      </RouterLink>
      <h1 class="nav-t">{{ title }}</h1>
      <span class="capsule" aria-hidden="true"><i>···</i><b /><i class="dot" /></span>
    </header>
    <main class="body"><slot /></main>
    <nav class="tabs" aria-label="小程序底栏">
      <RouterLink v-for="t in TABS" :key="t.k" :to="t.to" class="tab" :class="{ on: t.k === tab }" :aria-current="t.k === tab ? 'page' : undefined">
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path :d="t.d" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
        <span>{{ t.t }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<script setup>
defineProps({ title: String, tab: String, back: Boolean })
const TABS = [
  { k: 'brief', t: '要点', to: '/mp', d: 'M5 6h14M5 11h14M5 16h9' },
  { k: 'ind', t: '行业', to: '/mp/industries', d: 'M5 19V11M10 19V6M15 19v-5M20 19V9' },
  { k: 'cal', t: '日历', to: '/mp', d: 'M4 7h16v13H4zM4 11h16M9 4v5M15 4v5' },
  { k: 'me', t: '我的', to: '/mp', d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6' },
]
</script>

<style scoped>
.mp { max-width: 430px; margin: 0 auto; min-height: 100vh; background: var(--paper); display: flex; flex-direction: column; border-inline: 1px solid var(--rule); }
.status { height: 44px; display: flex; justify-content: space-between; align-items: center; padding: 0 20px 0 28px; font: 600 15px/1 var(--font-sans); color: var(--ink); }
.st-icons { display: flex; gap: 6px; align-items: center; }
.nav { position: sticky; top: 0; z-index: 5; height: 44px; display: grid; grid-template-columns: 88px 1fr 88px; align-items: center; background: var(--paper); border-bottom: 1px solid var(--rule-strong); }
.nav-back { grid-column: 1; padding-left: 16px; color: var(--ink); display: flex; height: 44px; align-items: center; }
.nav-t { grid-column: 2; text-align: center; font: 600 17px/1 var(--font-sans); letter-spacing: .02em; }
.capsule { grid-column: 3; justify-self: end; margin-right: 7px; width: 87px; height: 32px; border-radius: 16px; border: 1px solid var(--rule); display: flex; align-items: center; justify-content: space-around; color: var(--ink); background: color-mix(in srgb, var(--sheet) 80%, transparent); }
.capsule i { font-style: normal; font-weight: 700; letter-spacing: 1px; font-size: 14px; }
.capsule b { width: 1px; height: 18px; background: var(--rule); }
.capsule .dot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid currentColor; box-shadow: inset 0 0 0 3px var(--sheet); background: currentColor; }
.body { flex: 1; padding: 16px 16px 108px; }
.tabs { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: min(100%, 430px); display: grid; grid-template-columns: repeat(4, 1fr); height: 84px; padding-bottom: 34px; background: color-mix(in srgb, var(--paper) 94%, transparent); backdrop-filter: blur(10px); border-top: 1px solid var(--rule); }
.tab { display: grid; justify-items: center; align-content: center; gap: 2px; color: var(--ink-3); text-decoration: none; font-size: 10px; }
.tab.on { color: var(--accent); font-weight: 600; }
</style>
