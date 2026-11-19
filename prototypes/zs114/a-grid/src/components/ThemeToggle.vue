<template>
  <button class="tt" type="button" id="theme-toggle" :aria-pressed="theme === 'dark'" :aria-label="theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'" @click="toggleTheme">
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" />
    </svg>
  </button>
</template>
<script setup>
import { theme, toggleTheme } from '../lib/theme.js'
</script>
<style scoped>
.tt { display: inline-grid; place-items: center; width: 32px; height: 32px; border: 1px solid var(--c-line); border-radius: var(--r-sm); background: transparent; color: var(--c-ink-2); transition: border-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease); }
.tt:hover { border-color: var(--c-line-strong); color: var(--c-ink); }
.tt svg { transition: transform var(--dur-slow) var(--ease); }
[data-theme='dark'] .tt svg { transform: rotate(180deg); }
</style>
