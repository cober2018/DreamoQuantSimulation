<!-- 公开站页头：产品 / 价格 / 文档 / 博客 / 登录（ZS-115 信息结构）。窄屏收成一个展开菜单。 -->
<template>
  <header class="sh" :class="{ overlay }">
    <div class="wrap row">
      <router-link to="/" class="brand" aria-label="知数星耀 首页"><BrandMark :size="28" /><span class="display">知数星耀</span></router-link>
      <nav id="site-nav" class="nav" :class="{ open }" aria-label="主导航">
        <router-link v-for="l in LINKS" :id="'nav-' + l.key" :key="l.key" :to="l.to" class="nl" :aria-current="isCurrent(l) ? 'page' : undefined" @click="open = false">{{ l.label }}</router-link>
        <router-link id="nav-login-m" to="/login" class="nl only-m" @click="open = false">登录</router-link>
      </nav>
      <div class="acts">
        <ThemeToggle />
        <router-link id="nav-login" class="btn sm login" to="/login">登录</router-link>
        <button id="nav-toggle" class="menu" type="button" :aria-expanded="open" aria-controls="site-nav" @click="open = !open">
          <span class="sr-only">{{ open ? '收起菜单' : '展开菜单' }}</span>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path :d="open ? 'M4 4l10 10M14 4L4 14' : 'M3 6h12M3 12h12'" /></svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import BrandMark from './BrandMark.vue'
import ThemeToggle from './ThemeToggle.vue'

defineProps({ overlay: Boolean })
const LINKS = [
  { key: 'product', label: '产品', to: '/' },
  { key: 'pricing', label: '价格', to: '/pricing' },
  { key: 'docs', label: '文档', to: '/docs' },
  { key: 'blog', label: '博客', to: '/blog' },
]
const route = useRoute()
const isCurrent = (l) => route.path === l.to
const open = ref(false)
</script>

<style scoped>
.sh { position: relative; z-index: var(--z-header); border-bottom: 1px solid var(--c-line); background: var(--c-bg); }
.sh.overlay { position: absolute; inset: 0 0 auto; border-bottom-color: transparent; background: transparent; }
.row { display: flex; align-items: center; gap: var(--s-6); height: 72px; }
.brand { display: inline-flex; align-items: center; gap: var(--s-2); font-size: 18px; }
.nav { display: flex; gap: var(--s-1); margin-left: var(--s-2); }
.nl { position: relative; display: inline-flex; align-items: center; height: 36px; padding: 0 var(--s-3); border-radius: var(--r-2); font-size: var(--fs-sm); color: var(--c-ink-2); transition: color var(--dur-2), background-color var(--dur-2); }
.nl:hover { color: var(--c-ink); background: var(--c-surface-hover); }
.nl[aria-current="page"] { color: var(--c-ink); }
.nl[aria-current="page"]::after { content: ""; position: absolute; left: var(--s-3); right: var(--s-3); bottom: 4px; height: 1px; background: var(--c-accent); }
.only-m { display: none; }
.acts { margin-left: auto; display: flex; align-items: center; gap: var(--s-2); }
.menu { display: none; width: 36px; height: 36px; place-items: center; border: 1px solid var(--c-line); border-radius: var(--r-2); }
.menu svg { fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; }

@media (max-width: 899px) {
  .row { height: 56px; gap: var(--s-3); }
  .menu { display: grid; }
  .login { display: none; }
  .nav { display: none; position: absolute; left: var(--s-4); right: var(--s-4); top: 60px; margin: 0; flex-direction: column; padding: var(--s-2); border: 1px solid var(--c-line-strong); border-radius: var(--r-3); background: var(--c-surface); box-shadow: var(--shadow-2); }
  .nav.open { display: flex; }
  .nl { height: 44px; font-size: var(--fs-md); }
  .nl[aria-current="page"]::after { left: 0; right: auto; top: 12px; bottom: 12px; width: 2px; height: auto; }
  .only-m { display: inline-flex; border-top: 1px solid var(--c-line); border-radius: 0; margin-top: var(--s-1); }
}
</style>
