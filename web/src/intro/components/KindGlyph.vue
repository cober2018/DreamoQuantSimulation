<!-- 要点类型的星图符号：只用几何形状区分类型，不占用颜色（颜色留给涨跌和唯一的强调色） -->
<template>
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" class="kg">
    <path v-if="g === 'extreme'" d="M6 1 L11 6 L6 11 L1 6 Z" />
    <path v-else-if="g === 'change'" d="M6 1.5 L11 10.5 H1 Z" />
    <g v-else-if="g === 'streak'"><circle cx="2" cy="6" r="1.4" /><circle cx="6" cy="6" r="1.4" /><circle cx="10" cy="6" r="1.4" /><path d="M2 6 H10" /></g>
    <g v-else-if="g === 'diverge'"><path d="M1 6 H5 L11 1.5 M5 6 L11 10.5" /></g>
    <g v-else-if="g === 'rank'"><path d="M1 2.5 H11 M1 6 H8 M1 9.5 H5" /></g>
    <g v-else><circle cx="6" cy="6" r="4.5" /><path d="M6 3.5 V6 L8 7.2" /></g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { KINDS } from '../lib/brief.js'
const props = defineProps({ kind: String })
const g = computed(() => KINDS[props.kind]?.glyph || 'event')
</script>

<style scoped>
.kg { fill: none; stroke: currentColor; stroke-width: 1.2; stroke-linejoin: round; stroke-linecap: round; flex: none; }
</style>
