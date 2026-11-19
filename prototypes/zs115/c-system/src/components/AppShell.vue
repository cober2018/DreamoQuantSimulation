<template>
  <div class="shell">
    <a class="skip-link" href="#main">跳到正文</a>
    <header class="topbar">
      <router-link to="/app" class="brand" aria-label="知数星耀 今日要点"><BrandMark :size="26" /><span class="display">知数星耀</span></router-link>
      <div class="topbar-actions">
        <ThemeToggle />
        <button id="nav-menu" class="menu-btn" type="button" :aria-expanded="open" aria-controls="rail" @click="open = !open">
          <span class="sr-only">数据页菜单</span>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path :d="open ? 'M4 4l10 10M14 4L4 14' : 'M3 5h12M3 9h12M3 13h8'" /></svg>
        </button>
      </div>
    </header>

    <aside id="rail" class="rail" :class="{ open }" aria-label="侧边导航">
      <router-link to="/app" class="brand rail-brand" aria-label="知数星耀 今日要点"><BrandMark :size="28" /><span class="display">知数星耀</span></router-link>
      <nav aria-label="数据页">
        <p class="nav-cap">每日</p>
        <router-link id="nav-home" to="/app" class="nav-item" exact-active-class="active" @click="open = false">
          <span class="dot" aria-hidden="true"></span>今日要点
        </router-link>
        <p class="nav-cap">明细</p>
        <router-link v-for="m in MODULES" :id="'nav-' + m.key" :key="m.key" :to="m.to" class="nav-item" active-class="active" @click="open = false">
          <span class="dot" aria-hidden="true"></span>{{ m.label }}
        </router-link>
        <p class="nav-cap">原型</p>
        <router-link id="nav-states" to="/app/states" class="nav-item" active-class="active" @click="open = false"><span class="dot" aria-hidden="true"></span>状态样张</router-link>
        <router-link id="nav-landing" to="/" class="nav-item"><span class="dot" aria-hidden="true"></span>介绍页</router-link>
        <router-link id="nav-mp" to="/mp" class="nav-item"><span class="dot" aria-hidden="true"></span>小程序 H5</router-link>
      </nav>
      <div class="rail-foot">
        <ThemeToggle />
        <span class="ver">C 星图设计系统 v1 · 原型</span>
      </div>
    </aside>
    <div v-if="open" class="scrim" aria-hidden="true" @click="open = false"></div>

    <main id="main" tabindex="-1">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import BrandMark from './BrandMark.vue'
import ThemeToggle from './ThemeToggle.vue'
import { MODULES } from '../lib/brief.js'
const open = ref(false)
</script>

<style scoped>
.shell { min-height: 100vh; display: grid; grid-template-columns: 232px minmax(0, 1fr); background: linear-gradient(90deg, var(--c-bg-deep) 231px, var(--c-line) 231px, var(--c-line) 232px, var(--c-bg) 232px); }
.brand { display: inline-flex; align-items: center; gap: var(--s-2); font-size: 17px; color: var(--c-ink); }
.topbar { display: none; }
.rail {
  position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column;
  padding: var(--s-5) var(--s-4) var(--s-4); border-right: 1px solid var(--c-line);
  background: var(--c-bg-deep);
}
.rail-brand { padding: 0 var(--s-2) var(--s-5); }
nav { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto; }
.nav-cap { font-size: var(--fs-2xs); color: var(--c-ink-3); letter-spacing: 0.12em; padding: var(--s-4) var(--s-2) var(--s-2); }
.nav-item {
  position: relative; display: flex; align-items: center; gap: var(--s-3); height: 36px; padding: 0 var(--s-2);
  border-radius: var(--r-2); color: var(--c-ink-2); font-size: var(--fs-base);
  transition: background-color var(--dur-2) var(--ease-std), color var(--dur-2) var(--ease-std);
}
.nav-item:hover { background: var(--c-surface-hover); color: var(--c-ink); }
/* 导航上的星：当前页亮起为金色并带一条细线，呼应「可追溯」的连线 */
.dot { width: 5px; height: 5px; border-radius: 50%; background: var(--c-ink-3); flex: none; transition: background-color var(--dur-2), box-shadow var(--dur-2); }
.nav-item.active { color: var(--c-ink); background: var(--c-surface); }
.nav-item.active .dot { background: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-soft); }
.nav-item.active::before { content: ""; position: absolute; left: -16px; top: 10px; bottom: 10px; width: 1px; background: var(--c-accent); }
.rail-foot { display: flex; align-items: center; gap: var(--s-3); padding-top: var(--s-4); border-top: 1px solid var(--c-line); }
.ver { font-size: var(--fs-2xs); color: var(--c-ink-3); }
main { min-width: 0; outline: none; }
.scrim { display: none; }

@media (max-width: 1023px) {
  .shell { grid-template-columns: minmax(0, 1fr); background: var(--c-bg); }
  .topbar {
    position: sticky; top: 0; z-index: 30; display: flex; align-items: center; justify-content: space-between;
    height: 56px; padding: 0 var(--s-4); background: color-mix(in srgb, var(--c-bg) 86%, transparent);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-bottom: 1px solid var(--c-line);
  }
  .topbar-actions { display: flex; gap: var(--s-2); }
  .menu-btn { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--c-line); border-radius: var(--r-2); }
  .menu-btn svg { fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; }
  .rail { position: fixed; z-index: 40; left: 0; top: 0; width: 272px; transform: translateX(-100%); transition: transform var(--dur-3) var(--ease-out), visibility 0s linear var(--dur-3); visibility: hidden; }
  .rail.open { transform: none; visibility: visible; transition: transform var(--dur-3) var(--ease-out); }
  .scrim { display: block; position: fixed; inset: 0; z-index: 35; background: var(--c-scrim); }
}
</style>
