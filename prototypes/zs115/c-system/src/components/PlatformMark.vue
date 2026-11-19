<!-- 平台标识占位：单色虚线方块 + 一个字。不画任何平台的商标图形，以后换成各平台官方品牌资源。 -->
<template>
  <span class="pm" :class="size" aria-hidden="true">{{ GLYPH[platform] || '·' }}</span>
</template>

<script setup>
defineProps({ platform: String, size: { type: String, default: 'md' } })
const GLYPH = { 'wechat-oa': '公', douyin: '抖', xiaohongshu: '红' }
</script>

<style scoped>
.pm { display: inline-grid; place-items: center; flex: none; border: 1px dashed var(--c-line-strong); color: var(--c-ink-2); font-weight: 600; line-height: 1; }
.md { width: 40px; height: 40px; border-radius: var(--r-2); font-size: var(--fs-md); }
.sm { width: 20px; height: 20px; border-radius: var(--r-1); font-size: var(--fs-2xs); }
</style>
