<template>
  <div v-if="text" class="wm" aria-hidden="true">
    <span v-for="n in 60" :key="n">{{ text }}</span>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { session } from '../auth'
const text = computed(() => (session.user ? `${session.user.username} · ${new Date().toISOString().slice(0, 10)}` : ''))
</script>
<style scoped>
.wm { position: fixed; inset: 0; pointer-events: none; z-index: 50; display: flex; flex-wrap: wrap; overflow: hidden;
  opacity: 0.07; transform: rotate(-18deg) scale(1.4); user-select: none; }
.wm span { width: 240px; padding: 28px 12px; font-size: 14px; white-space: nowrap; }
</style>
