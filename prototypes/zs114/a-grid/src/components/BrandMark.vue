<template>
  <!-- 标志：3×3 网格 + 一个强调色数据点，取「网格、可追溯的秩序」 -->
  <svg :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true" class="mark">
    <rect x="0.5" y="0.5" width="23" height="23" rx="5" fill="var(--c-ink)" />
    <path d="M8.5 4v16M15.5 4v16M4 8.5h16M4 15.5h16" stroke="var(--c-bg)" stroke-opacity=".22" stroke-width="1" />
    <path d="M4.5 17.5 8.5 12.5 12 14 15.5 8.5" fill="none" stroke="var(--c-bg)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="15.5" cy="8.5" r="2.2" fill="var(--c-accent)" />
  </svg>
</template>
<script setup>
defineProps({ size: { type: Number, default: 24 } })
</script>
