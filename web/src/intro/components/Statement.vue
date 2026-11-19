<!-- 要点句子：数字按规则加粗，资金净流入的正负按红入绿出着色 -->
<template>
  <span class="stmt"><template v-for="(s, i) in segs" :key="i"><b v-if="s.num" class="tnum" :class="tone(s)">{{ s.t }}</b><template v-else>{{ s.t }}</template></template></span>
</template>

<script setup>
import { computed } from 'vue'
import { splitStatement, colorsBySign } from '../lib/brief.js'
const props = defineProps({ fact: Object })
const segs = computed(() => splitStatement(props.fact.statement))
const tone = (s) => (colorsBySign(props.fact) && s.sign ? (s.sign > 0 ? 'up' : 'down') : '')
</script>

<style scoped>
b { font-weight: 600; color: var(--c-ink); }
b.up { color: var(--c-up); }
b.down { color: var(--c-down); }
</style>
