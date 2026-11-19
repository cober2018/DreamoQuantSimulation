<template>
  <div class="ec" :style="{ height: height + 'px' }">
    <div ref="el" class="ec-canvas" role="img" :aria-label="label"></div>
    <StatePanel v-if="!ready" class="ec-loading" kind="loading" compact :rows="4" title="图表加载中" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import StatePanel from './StatePanel.vue'
import { theme, reducedMotion } from '../lib/theme.js'
import { zxDark, zxLight, zxEmpty, zxLoading } from '../ds/echarts-theme.js'

// option 是函数：拿到当前主题的 zx 调色（红涨绿跌等），返回 ECharts 配置
const props = defineProps({ option: Function, height: { type: Number, default: 320 }, label: String, emptyText: String, loading: Boolean })
const emit = defineEmits(['click'])
const el = ref(null)
const ready = ref(false)
const chart = shallowRef(null)
let echarts, ro

function render() {
  chart.value?.dispose()
  const name = theme.value === 'light' ? 'zx-light' : 'zx-dark'
  const zx = (theme.value === 'light' ? zxLight : zxDark).zx
  chart.value = echarts.init(el.value, name, { renderer: 'canvas' })
  const mode = theme.value === 'light' ? 'light' : 'dark'
  // 空态与加载态也走设计系统：不出现空坐标轴，也不用 ECharts 默认的蓝色转圈
  if (props.emptyText) chart.value.setOption({ graphic: zxEmpty(mode, props.emptyText) })
  else chart.value.setOption({ animation: !reducedMotion(), animationDuration: 600, animationEasing: 'cubicOut', ...props.option(zx) })
  if (props.loading) chart.value.showLoading('default', zxLoading(mode))
  chart.value.on('click', (p) => emit('click', p))
}

onMounted(async () => {
  echarts = (await import('../lib/echarts.js')).default
  ready.value = true
  render()
  ro = new ResizeObserver(() => chart.value?.resize())
  ro.observe(el.value)
})
watch(theme, () => echarts && render())
watch(() => props.option, () => { if (!chart.value || props.emptyText) return; const zx = (theme.value === 'light' ? zxLight : zxDark).zx; chart.value.setOption(props.option(zx), { replaceMerge: ['series'] }) })
onBeforeUnmount(() => { ro?.disconnect(); chart.value?.dispose() })
</script>

<style scoped>
.ec { position: relative; width: 100%; }
.ec-canvas { position: absolute; inset: 0; }
.ec-loading { position: absolute; inset: 0; min-height: 0; }
</style>
