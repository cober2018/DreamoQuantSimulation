<!-- 品牌标记的矢量重绘：柱体随主题取墨色，弧线与节点线保持品牌金。只用标记，不用含旧名称的横版图。 -->
<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" aria-hidden="true" class="mark">
    <g class="bars">
      <rect x="15" y="38" width="7" height="12" rx="1" />
      <rect x="25" y="32" width="7" height="18" rx="1" />
      <rect x="35" y="26" width="7" height="24" rx="1" />
      <rect x="45" y="20" width="7" height="30" rx="1" />
    </g>
    <path class="arc" d="M8 40 C 6 56, 40 62, 58 46" />
    <polyline class="line" points="10,30 24,22 38,18 52,8" />
    <circle class="node" cx="24" cy="22" r="2.6" />
    <circle class="node" cx="38" cy="18" r="2.6" />
    <circle class="node end" cx="52" cy="8" r="3.6" />
  </svg>
</template>

<script setup>
defineProps({ size: { type: Number, default: 28 } })
</script>

<style scoped>
.bars rect { fill: var(--c-star); }
.arc { fill: none; stroke: var(--c-accent); stroke-width: 3; stroke-linecap: round; }
.line { fill: none; stroke: var(--c-accent); stroke-width: 1.8; stroke-linejoin: round; }
.node { fill: var(--c-bg); stroke: var(--c-accent); stroke-width: 1.8; }
.node.end { fill: var(--c-accent); }
</style>
