<template>
  <div ref="el" class="echart" role="img" :aria-label="label" :style="{ height }"></div>
</template>
<script setup>
import { onMounted, onBeforeUnmount, watch, ref } from 'vue'
import echarts from '../charts/echarts.js'
import { themeName } from '../charts/echarts-theme.js'
import { theme } from '../lib/theme.js'
import { reducedMotion } from '../lib/env.js'

const props = defineProps({ option: { type: Function, required: true }, height: { type: String, default: '320px' }, label: { type: String, required: true } })
const emit = defineEmits(['click'])
const el = ref(null)
let chart, ro

function render() {
  chart?.dispose()
  chart = echarts.init(el.value, themeName(theme.value), { renderer: 'canvas' })
  // option 是函数：主题切换时用新的调色板重新生成
  chart.setOption({ aria: { enabled: true }, animation: !reducedMotion(), ...props.option(theme.value) })
  chart.on('click', (p) => emit('click', p))
}
onMounted(() => {
  render()
  let t
  ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => chart?.resize(), 120) })
  ro.observe(el.value)
})
watch(theme, render)
watch(() => props.option, () => chart?.setOption(props.option(theme.value), { notMerge: false }))
onBeforeUnmount(() => { ro?.disconnect(); chart?.dispose() })
</script>
<style scoped>
.echart { width: 100%; }
</style>
