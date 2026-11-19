<template>
  <button id="theme-toggle" class="tt" type="button" :aria-pressed="theme === 'dark'" :title="theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'" @click="toggleTheme">
    <span class="sr-only">暗色主题</span>
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="3.2" class="sun" />
      <g class="rays"><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" /></g>
      <path class="moon" d="M12.5 10.2A5.2 5.2 0 0 1 5.8 3.5 5.2 5.2 0 1 0 12.5 10.2Z" />
    </svg>
  </button>
</template>

<script setup>
import { theme, toggleTheme } from '../lib/theme.js'
</script>

<style scoped>
.tt { width: 36px; height: 36px; display: grid; place-items: center; border-radius: var(--r-2); color: var(--c-ink-2); border: 1px solid var(--c-line); transition: color var(--dur-2) var(--ease-std), border-color var(--dur-2) var(--ease-std), background-color var(--dur-2) var(--ease-std); }
.tt:hover { color: var(--c-ink); border-color: var(--c-line-strong); background: var(--c-surface-hover); }
svg { fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; }
.moon { display: none; }
[data-theme="dark"] .moon { display: block; }
[data-theme="dark"] .sun, [data-theme="dark"] .rays { display: none; }
</style>
