<template>
  <div ref="el" class="chart" :style="{ height }" role="img" :aria-label="label" />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, MarkLineComponent, MarkAreaComponent, TooltipComponent, GraphicComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import { registerThemes, THEME_NAME, PALETTE, loadingStyle } from '../echarts-theme.js'
import { theme } from '../lib/theme.js'

echarts.use([BarChart, LineChart, ScatterChart, GridComponent, MarkLineComponent, MarkAreaComponent,
  TooltipComponent, GraphicComponent, SVGRenderer])
registerThemes(echarts)

// build(palette) 返回 option：系列颜色跟主题走，换主题时重建
const props = defineProps({ build: Function, height: { type: String, default: '320px' }, label: String, loading: Boolean })
const emit = defineEmits(['ready'])
const el = ref(null)
let chart
let ro

function init() {
  chart?.dispose()
  chart = echarts.init(el.value, THEME_NAME[theme.value], { renderer: 'svg' })
  chart.setOption(props.build(PALETTE[theme.value]))
  if (props.loading) chart.showLoading('default', loadingStyle(theme.value))
  emit('ready', chart)
}
onMounted(() => {
  init()
  // 只跟容器尺寸走，节流到一帧
  let raf = 0
  ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => chart?.resize()) })
  ro.observe(el.value)
})
watch(theme, init)
watch(() => props.build, () => chart?.setOption(props.build(PALETTE[theme.value]), true))
onBeforeUnmount(() => { ro?.disconnect(); chart?.dispose() })
</script>

<style scoped>
.chart { width: 100%; }
</style>
