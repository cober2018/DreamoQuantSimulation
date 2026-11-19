<template>
  <button id="theme-toggle" class="tt" type="button" :aria-pressed="theme === 'dark'"
    :aria-label="label ? undefined : '暗色模式'" :title="theme === 'dark' ? '切换到亮色纸本' : '切换到暗色'" @click="toggleTheme">
    <svg v-if="theme === 'dark'" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.4" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" stroke="currentColor" stroke-width="1.4" />
    </svg>
    <svg v-else width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z" fill="none" stroke="currentColor" stroke-width="1.4" />
    </svg>
    <span v-if="label" class="tt-label">暗色模式</span>
  </button>
</template>

<script setup>
import { theme, toggleTheme } from '../lib/theme.js'
defineProps({ label: Boolean })
</script>

<style scoped>
.tt {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; min-width: 32px; padding: 0 8px;
  border: 1px solid var(--rule); border-radius: var(--r-1); background: transparent; color: var(--ink-2); cursor: pointer;
  transition: color var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease), background-color var(--dur-1) var(--ease);
}
.tt:hover { color: var(--ink); border-color: var(--ink-3); background: var(--paper-2); }
.tt-label { font-size: var(--fs-xs); }
</style>
