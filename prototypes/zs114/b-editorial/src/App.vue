<template>
  <RouterView v-if="$route.meta.bare" />
  <AppShell v-else><RouterView /></AppShell>
</template>

<script setup>
import AppShell from './components/AppShell.vue'
</script>
