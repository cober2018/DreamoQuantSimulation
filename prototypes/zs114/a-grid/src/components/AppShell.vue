<template>
  <div class="shell" :class="{ 'nav-open': navOpen }">
    <a class="skip" href="#main">跳到正文</a>
    <aside class="side" id="app-nav" aria-label="主导航"><div class="side-in">
      <router-link to="/" class="brand" id="nav-brand"><BrandMark :size="22" /><span>知数星耀</span></router-link>
      <nav>
        <p class="eyebrow grp">数据</p>
        <ul>
          <li v-for="s in SECTIONS" :key="s.key">
            <router-link :to="s.to" :id="`nav-${s.key}`" class="item" :class="{ on: current === s.key }" :aria-current="current === s.key ? 'page' : undefined" @click="navOpen = false">
              <span class="no mono">{{ s.no }}</span><span>{{ s.label }}</span>
            </router-link>
          </li>
        </ul>
        <p class="eyebrow grp">原型</p>
        <ul>
          <li><router-link to="/app/states" id="nav-states" class="item" :class="{ on: current === 'states' }" @click="navOpen = false"><span class="no mono">··</span><span>状态设计</span></router-link></li>
          <li><router-link to="/mp" id="nav-mp" class="item"><span class="no mono">··</span><span>小程序预览</span></router-link></li>
        </ul>
      </nav>
      <div class="side-foot">
        <span class="acct"><span class="dot" aria-hidden="true"></span>试用账号</span>
        <ThemeToggle />
      </div>
    </div></aside>
    <div class="scrim" @click="navOpen = false" aria-hidden="true"></div>

    <div class="body">
      <header class="top">
        <button class="menu" type="button" id="nav-menu" aria-controls="app-nav" :aria-expanded="navOpen" aria-label="打开导航" @click="navOpen = !navOpen">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" stroke-width="1.4" /></svg>
        </button>
        <router-link to="/" class="brand m"><BrandMark :size="20" /><span>知数星耀</span></router-link>
        <nav class="crumb" aria-label="位置"><span class="muted">知数星耀</span><span class="sep" aria-hidden="true">/</span><span>{{ crumb }}</span></nav>
        <div class="top-r">
          <span class="upd mono">按交易日更新 · 收盘后</span>
          <span class="m-theme"><ThemeToggle /></span>
        </div>
      </header>
      <main id="main" tabindex="-1"><router-view /></main>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import BrandMark from './BrandMark.vue'
import ThemeToggle from './ThemeToggle.vue'
import { SECTIONS, sectionByKey } from '../lib/data.js'

const route = useRoute()
const navOpen = ref(false)
const current = computed(() => route.meta.section || route.params.key)
const crumb = computed(() => (current.value === 'states' ? '状态设计' : sectionByKey(current.value)?.label || ''))
const onKey = (e) => { if (e.key === 'Escape') navOpen.value = false }
onMounted(() => addEventListener('keydown', onKey))
onBeforeUnmount(() => removeEventListener('keydown', onKey))
</script>

<style scoped>
.shell { display: grid; grid-template-columns: 232px minmax(0, 1fr); min-height: 100vh; }
.side { border-right: 1px solid var(--c-line); background: var(--c-surface); }
.side-in { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; padding: 16px 12px; overflow-y: auto; }
.brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 20px; font-weight: 600; font-size: var(--fs-md); letter-spacing: .02em; }
.grp { padding: 16px 8px 6px; }
.item { display: flex; align-items: center; gap: 10px; height: 32px; padding: 0 8px; border-radius: var(--r-sm); color: var(--c-ink-2); font-size: var(--fs-sm); position: relative; transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease); }
.item:hover { background: var(--c-surface-2); color: var(--c-ink); }
.item.on { color: var(--c-ink); background: var(--c-accent-soft); font-weight: 600; }
.item.on::before { content: ''; position: absolute; left: -12px; top: 6px; bottom: 6px; width: 2px; background: var(--c-accent); }
.no { font-size: var(--fs-2xs); color: var(--c-muted); width: 18px; }
.item.on .no { color: var(--c-accent); }
.side-foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; padding: 12px 8px 0; border-top: 1px solid var(--c-line); }
.acct { display: inline-flex; align-items: center; gap: 8px; font-size: var(--fs-xs); color: var(--c-muted); }
.dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c-accent); }

.body { min-width: 0; display: flex; flex-direction: column; }
.top { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 16px; height: 48px; padding: 0 32px; border-bottom: 1px solid var(--c-line); background: color-mix(in srgb, var(--c-bg) 86%, transparent); backdrop-filter: saturate(1.2) blur(10px); }
.crumb { display: flex; gap: 8px; font-size: var(--fs-xs); }
.sep { color: var(--c-line-strong); }
.top-r { margin-left: auto; display: flex; align-items: center; gap: 12px; }
.upd { font-size: var(--fs-2xs); color: var(--c-muted); }
.menu, .brand.m, .m-theme { display: none; }
main { outline: none; }
.scrim { display: none; }

@media (max-width: 959px) {
  .shell { grid-template-columns: minmax(0, 1fr); }
  .side { position: fixed; z-index: 40; left: 0; top: 0; bottom: 0; width: 272px; transform: translateX(-100%); transition: transform var(--dur-slow) var(--ease); box-shadow: var(--shadow-pop); }
  .nav-open .side { transform: none; }
  .nav-open .scrim { display: block; position: fixed; inset: 0; z-index: 30; background: rgba(0, 0, 0, .32); }
  .top { padding: 0 12px 0 8px; gap: 8px; }
  .menu { display: inline-grid; place-items: center; width: 36px; height: 36px; border: 0; background: transparent; color: var(--c-ink); border-radius: var(--r-sm); }
  .brand.m { display: flex; padding: 0; gap: 8px; font-size: var(--fs-sm); }
  .crumb { display: none; }
  .upd { display: none; }
  .m-theme { display: block; }
}
</style>
