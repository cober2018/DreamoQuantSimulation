<!-- 小程序 H5 外壳：按微信规范的状态栏 44 + 导航栏 44（标题居中、右侧胶囊）+ 底部标签栏 50 + 安全区 34。宽屏下居中成 375 的机身。 -->
<template>
  <div class="stage">
    <div class="phone">
      <header class="bar">
        <div class="status" aria-hidden="true"><span class="tnum">9:41</span><span class="sig"><i /><i /><i /><i /></span></div>
        <div class="nav">
          <router-link v-if="back" to="/mp" class="back" aria-label="返回"><svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true"><path d="M10 2 L2 10 L10 18" /></svg></router-link>
          <h1 class="title">{{ title }}</h1>
          <div class="capsule" aria-hidden="true"><span class="dots"><i /><i /><i /></span><span class="sep" /><span class="ring" /></div>
        </div>
      </header>
      <main id="main" class="body"><slot /></main>
      <nav class="tabs" aria-label="小程序标签栏">
        <router-link v-for="t in TABS" :id="'tab-' + t.key" :key="t.key" :to="t.to" class="tab" :class="{ on: t.key === tab }" :aria-current="t.key === tab ? 'page' : undefined">
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path :d="t.icon" /></svg>
          <span>{{ t.label }}</span>
        </router-link>
      </nav>
    </div>
  </div>
</template>

<script setup>
defineProps({ title: String, tab: String, back: Boolean })
const TABS = [
  { key: 'brief', label: '要点', to: '/mp', icon: 'M5 18 L9 9 L14 13 L19 5 M5 18 h0 M9 9 h0 M14 13 h0 M19 5 h0' },
  { key: 'ind', label: '行业', to: '/mp/industries', icon: 'M5 19 V12 M10 19 V7 M15 19 V10 M20 19 V4' },
  { key: 'cal', label: '日历', to: '/mp', icon: 'M4 7 H20 V20 H4 Z M4 11 H20 M8 4 V8 M16 4 V8' },
  { key: 'me', label: '我的', to: '/mp', icon: 'M12 12 a4 4 0 1 0 0 -8 a4 4 0 1 0 0 8 M4 21 c1.5 -4 4.5 -6 8 -6 s6.5 2 8 6' },
]
</script>

<style scoped>
.stage { min-height: 100vh; display: flex; justify-content: center; background: var(--c-bg-deep); }
.phone { position: relative; width: 100%; max-width: 375px; min-height: 100vh; background: var(--c-bg); display: flex; flex-direction: column; }
@media (min-width: 420px) {
  .stage { padding: var(--s-6) 0; align-items: flex-start; }
  .phone { min-height: 812px; height: 812px; border-radius: 40px; border: 1px solid var(--c-line-strong); overflow: hidden; box-shadow: var(--shadow-2); }
  .body { overflow-y: auto; }
}
.bar { position: sticky; top: 0; z-index: 5; background: color-mix(in srgb, var(--c-bg) 92%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid var(--c-line); }
.status { height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; font-size: 15px; font-weight: 600; }
.sig { display: flex; gap: 2px; align-items: flex-end; }
.sig i { width: 3px; background: var(--c-ink); border-radius: 1px; }
.sig i:nth-child(1) { height: 4px; } .sig i:nth-child(2) { height: 6px; } .sig i:nth-child(3) { height: 8px; } .sig i:nth-child(4) { height: 10px; }
.nav { position: relative; height: 44px; display: flex; align-items: center; justify-content: center; }
.title { font-size: 17px; font-weight: 600; }
.back { position: absolute; left: 8px; width: 36px; height: 44px; display: grid; place-items: center; }
.back path { fill: none; stroke: var(--c-ink); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.capsule { position: absolute; right: 7px; width: 87px; height: 32px; border-radius: 16px; border: 1px solid var(--c-line-strong); background: color-mix(in srgb, var(--c-surface) 70%, transparent); display: flex; align-items: center; justify-content: space-around; padding: 0 10px; }
.dots { display: flex; gap: 3px; } .dots i { width: 4px; height: 4px; border-radius: 50%; background: var(--c-ink); }
.dots i:nth-child(2) { width: 6px; height: 6px; margin-top: -1px; }
.sep { width: 1px; height: 18px; background: var(--c-line-strong); }
.ring { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--c-ink); box-shadow: inset 0 0 0 3px var(--c-bg); background: var(--c-ink); }
.body { flex: 1; padding-bottom: 96px; }
.tabs { position: sticky; bottom: 0; z-index: 5; display: grid; grid-template-columns: repeat(4, 1fr); height: 84px; padding-bottom: 34px; background: color-mix(in srgb, var(--c-bg-deep) 94%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-top: 1px solid var(--c-line); margin-top: auto; }
@media (min-width: 420px) { .tabs { position: absolute; left: 0; right: 0; } }
.tab { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 10px; color: var(--c-ink-3); }
.tab svg path { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.tab.on { color: var(--c-accent-ink); }
</style>
