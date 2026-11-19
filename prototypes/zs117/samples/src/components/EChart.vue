<template>
  <div ref="box" class="ec" :style="{ height: height + 'px' }">
    <div ref="el" class="ec-canvas" role="img" :aria-label="label"></div>
    <StatePanel v-if="!ready" class="ec-loading" kind="loading" compact :rows="4" title="图表加载中" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import StatePanel from './StatePanel.vue'
import { theme, reducedMotion } from '../lib/theme.js'
import { zxDark, zxLight, palette } from '@ds/echarts-theme.js'

// option 是函数：拿到当前主题的 zx 调色（红涨绿跌等），返回 ECharts 配置。
// 与 c-system 的区别：进入视口附近才初始化，减少首屏主线程占用；配置变化时整体替换（窄屏会换坐标轴）。
const props = defineProps({ option: Function, height: { type: Number, default: 320 }, label: String })
const box = ref(null)
const el = ref(null)
const ready = ref(false)
const chart = shallowRef(null)
let echarts, ro, io

// zx 主题扩展里没有系列色和 warn，这里从同一份 token 补上（不另存颜色值）
const zxNow = () => {
  const mode = theme.value === 'light' ? 'light' : 'dark', p = palette(mode)
  return { ...(mode === 'light' ? zxLight : zxDark).zx, viz1: p['viz-1'], viz3: p['viz-3'], viz4: p['viz-4'], viz5: p['viz-5'], warn: p.warn, mode }
}
function render() {
  chart.value?.dispose()
  chart.value = echarts.init(el.value, theme.value === 'light' ? 'zx-light' : 'zx-dark', { renderer: 'canvas' })
  chart.value.setOption({ animation: !reducedMotion(), animationDuration: 500, animationEasing: 'cubicOut', ...props.option(zxNow()) })
}
async function start() {
  echarts = (await import('../lib/echarts.js')).default
  ready.value = true
  render()
  ro = new ResizeObserver(() => chart.value?.resize())
  ro.observe(el.value)
}

onMounted(() => {
  if (!('IntersectionObserver' in window)) return start()
  io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); start() } }, { rootMargin: '200px 0px' })
  io.observe(box.value)
})
watch(theme, () => echarts && render())
watch(() => props.option, () => { if (chart.value) chart.value.setOption(props.option(zxNow()), { notMerge: true }) })
onBeforeUnmount(() => { io?.disconnect(); ro?.disconnect(); chart.value?.dispose() })
</script>

<style scoped>
.ec { position: relative; width: 100%; }
.ec-canvas { position: absolute; inset: 0; }
.ec-loading { position: absolute; inset: 0; min-height: 0; }
</style>
