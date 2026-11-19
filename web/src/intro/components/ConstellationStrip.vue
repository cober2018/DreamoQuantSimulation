<!-- 今日要点星图：横向按来源数据页分区，纵向是偏离程度；背景暗星是各页的观察指标，亮星是今天入选的事实，按名次连线。 -->
<template>
  <figure ref="root" class="strip" :style="{ height: H + 'px' }">
    <svg :width="W" :height="H" role="img" :aria-label="label">
      <g class="axis">
        <line v-for="g in [100, 50, 0]" :key="g" :x1="PL" :x2="W - PR" :y1="yOf(g)" :y2="yOf(g)" />
        <text v-for="g in [100, 50]" :key="'t' + g" :x="PL - 8" :y="yOf(g) + 3" text-anchor="end">{{ g }}</text>
        <text :x="PL - 8" :y="yOf(0) + 3" text-anchor="end">偏离</text>
      </g>
      <g class="zones">
        <g v-for="(z, i) in zones" :key="z.key">
          <line v-if="i > 0" :x1="z.x0" :x2="z.x0" :y1="PT - 4" :y2="H - PB + 4" class="zsep" />
          <text :x="z.cx" :y="H - 8" text-anchor="middle" :class="{ hit: activeMods.includes(z.key) }">{{ narrow ? z.short : z.label }}</text>
        </g>
      </g>
      <g class="bg">
        <path v-for="(d, i) in bgEdges" :key="'e' + i" :d="d" />
        <circle v-for="n in bgNodes" :key="n.id" :cx="n.x" :cy="n.y" r="1.6"><title>{{ n.name }}</title></circle>
      </g>
      <g :key="animKey" class="facts" :class="{ anim: animate }">
        <polyline :points="chain" pathLength="1" class="chain" />
        <line v-if="activeStar" :x1="activeStar.x" :x2="activeStar.x" :y1="activeStar.y + 8" :y2="H - PB + 4" class="focus" />
        <g v-for="(s, i) in stars" :key="i" class="star" :class="{ on: i === active }" :style="{ '--d': i * 90 + 'ms' }"
           @mouseenter="$emit('hover', i)" @mouseleave="$emit('hover', -1)" @click="$emit('open', i)">
          <circle :cx="s.x" :cy="s.y" :r="s.r + 6" class="halo" />
          <circle :cx="s.x" :cy="s.y" :r="s.r" class="core" />
          <text :x="s.x" :y="s.y - s.r - 6" text-anchor="middle" class="rk">{{ String(i + 1).padStart(2, '0') }}</text>
        </g>
      </g>
    </svg>
  </figure>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MODULES, INDICATORS, modulesOfSource, metricOfSource } from '../lib/brief.js'
import { reducedMotion } from '../lib/theme.js'

const props = defineProps({ facts: Array, active: { type: Number, default: -1 }, date: String })
defineEmits(['hover', 'open'])

const root = ref(null)
const W = ref(960)
const narrow = computed(() => W.value < 640)
const H = computed(() => (narrow.value ? 132 : 164))
const PL = 40, PR = 12, PT = 18
const PB = 30
const plotH = computed(() => H.value - PT - PB)
const yOf = (v) => PT + plotH.value * (1 - v / 100)

// 稳定伪随机：同一个指标名永远落在同一位置，换日期时背景不跳
const hash = (s, k = 0) => { let h = 2166136261 ^ k; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000 }

const zones = computed(() => {
  const zw = (W.value - PL - PR) / MODULES.length
  return MODULES.map((m, i) => ({ ...m, x0: PL + zw * i, cx: PL + zw * (i + 0.5), zw }))
})
const nodesByModule = computed(() => {
  const out = {}
  for (const z of zones.value) {
    out[z.key] = INDICATORS[z.key].map((name, j, arr) => ({
      id: z.key + name, name,
      x: z.x0 + z.zw * (0.16 + 0.68 * ((j + 0.5) / arr.length) + (hash(name) - 0.5) * 0.12),
      y: PT + plotH.value * (0.12 + 0.76 * hash(name, 7)),
    }))
  }
  return out
})
const bgNodes = computed(() => Object.values(nodesByModule.value).flat())
const bgEdges = computed(() => Object.values(nodesByModule.value).map((ns) => 'M' + ns.map((n) => `${n.x.toFixed(1)} ${n.y.toFixed(1)}`).join(' L')))

const stars = computed(() => {
  const used = {}
  return props.facts.map((f, i) => {
    const mods = modulesOfSource(f.source)
    const metric = metricOfSource(f.source)
    let x
    if (mods.length > 1) {
      const zs = mods.map((k) => zones.value.find((z) => z.key === k))
      x = zs.reduce((a, z) => a + z.cx, 0) / zs.length
    } else {
      const node = nodesByModule.value[mods[0]]?.find((n) => n.name === metric)
      const z = zones.value.find((zz) => zz.key === mods[0])
      x = node ? node.x : z.cx + (hash(f.statement) - 0.5) * z.zw * 0.5
    }
    const key = Math.round(x)
    used[key] = (used[key] || 0) + 1
    x += (used[key] - 1) * 16
    return { x, y: yOf(f.strength), r: 2.2 + (f.strength / 100) * 3, mods }
  })
})
const chain = computed(() => [...stars.value].sort((a, b) => a.x - b.x).map((s) => `${s.x.toFixed(1)},${s.y.toFixed(1)}`).join(' '))
const activeStar = computed(() => stars.value[props.active])
const activeMods = computed(() => activeStar.value?.mods || [])
const label = computed(() => `今日要点星图：${props.facts.length} 条要点按来源数据页分布，纵向为偏离程度（0–100，只用于排序）`)

const animate = ref(false)
const animKey = ref(0)
watch(() => props.date, () => { animKey.value++ })

let ro
onMounted(() => {
  animate.value = !reducedMotion()
  ro = new ResizeObserver(([e]) => { W.value = Math.max(300, Math.round(e.contentRect.width)) })
  ro.observe(root.value)
})
onBeforeUnmount(() => ro?.disconnect())
</script>

<style scoped>
.strip { position: relative; margin: 0; width: 100%; }
/* 星图底纸：细网格只在中部显现，两端淡出 */
.strip::before { content: ""; position: absolute; inset: 0 0 24px 40px; pointer-events: none;
  background-image: linear-gradient(var(--c-grid) 1px, transparent 1px), linear-gradient(90deg, var(--c-grid) 1px, transparent 1px); background-size: 24px 24px;
  mask-image: linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent); -webkit-mask-image: linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent); }
svg { overflow: visible; }
.axis line { stroke: var(--c-line); stroke-dasharray: 2 4; }
.axis text, .zones text { fill: var(--c-ink-3); font-size: 11px; font-family: var(--font-sans); }
.zones text { transition: fill var(--dur-2); }
.zones text.hit { fill: var(--c-accent-ink); }
.zsep { stroke: var(--c-line); }
.bg path { fill: none; stroke: var(--c-star-dim); stroke-width: 0.6; opacity: 0.5; }
.bg circle { fill: var(--c-star-dim); }
.chain { fill: none; stroke: var(--c-star); stroke-opacity: 0.45; stroke-width: 1; stroke-dasharray: 1; stroke-dashoffset: 0; }
.focus { stroke: var(--c-accent); stroke-width: 1; stroke-dasharray: 2 3; }
.star { cursor: pointer; }
.star .halo { fill: var(--c-accent-soft); opacity: 0; transition: opacity var(--dur-2); }
.star .core { fill: var(--c-star); transition: fill var(--dur-2); }
.star .rk { fill: var(--c-ink-3); font-size: 10px; font-variant-numeric: tabular-nums; transition: fill var(--dur-2); }
.star.on .halo { opacity: 1; }
.star.on .core { fill: var(--c-accent); }
.star.on .rk { fill: var(--c-accent-ink); }

/* 入场：连线从第一名画到最后一名，星点依次亮起；减少动效时直接是终态 */
.anim .chain { animation: draw 1200ms var(--ease-out) both 200ms; }
.anim .star { animation: lit 600ms var(--ease-out) both; animation-delay: var(--d); }
@keyframes draw { from { stroke-dashoffset: 1; } }
@keyframes lit { from { opacity: 0; } }
</style>
