<template><div ref="el" class="chart" :style="{ height }" /></template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, MarkLineComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { registerZxThemes } from '../intro/ds/echarts-theme.js'

echarts.use([BarChart, LineChart, ScatterChart, GridComponent, MarkLineComponent, TooltipComponent,
  LegendComponent, DataZoomComponent, CanvasRenderer])
registerZxThemes(echarts)

const props = defineProps({ option: Object, height: { type: String, default: '360px' } })
const el = ref(null)
let chart
const resize = () => chart?.resize()

onMounted(() => {
  chart = echarts.init(el.value, 'zx-light')
  chart.setOption(props.option || {})
  window.addEventListener('resize', resize)
})
// 容器高度随数据量变化时必须先 resize，否则画布按旧尺寸拉伸
watch(() => [props.option, props.height], async ([o]) => {
  await nextTick()
  chart?.resize()
  chart?.setOption(o || {}, true)
}, { deep: true })
onBeforeUnmount(() => { window.removeEventListener('resize', resize); chart?.dispose() })
</script>
