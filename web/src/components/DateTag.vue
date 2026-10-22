<template>
  <span v-if="date" class="date-tag">数据日 {{ date }}<em v-if="pageDate && date !== pageDate" class="badge partial">非当日</em></span>
</template>

<script setup>
// 同页各部分可能来自不同数据日, 不一致时显式标出, 避免把旧数据当成当日
defineProps({ date: String, pageDate: String })
</script>
