<template>
  <div class="landing">
    <a class="skip-link" href="#main">跳到正文</a>
    <SiteHeader ref="hdr" overlay />

    <main id="main">
      <section class="hero" aria-labelledby="hero-h">
        <div class="sky-wrap">
          <canvas ref="sky" class="sky" aria-hidden="true"></canvas>
          <div class="sky-poster grid-bg" aria-hidden="true"></div>
          <div ref="layer" class="sky-labels"></div>
        </div>
        <ol v-if="legend.length" class="sky-legend" aria-label="星图编号读数">
          <li v-for="r in legend" :key="r.n"><span class="ln tnum" aria-hidden="true">{{ r.n }}</span><span class="sr-only">编号 {{ r.n }}：</span>{{ r.text }}</li>
        </ol>
        <div class="wrap hero-in">
          <div ref="copyEl" class="hero-copy">
            <p class="eyebrow">A 股盘后数据 · 按交易日更新</p>
            <h1 id="hero-h" class="display">知数星耀</h1>
            <p class="lead" v-html="COPY.heroLead"></p>
            <p class="desc">{{ COPY.heroDesc }}</p>
            <div class="ctas">
              <router-link id="hero-pricing" class="btn primary big" to="/pricing">查看价格与权益</router-link>
              <router-link id="hero-login" class="btn big" to="/login">登录</router-link>
            </div>
            <p class="mp-note">免费版与会员的区别见价格与权益页；档位和价格待公布。</p>
          </div>
        </div>
        <p ref="capEl" class="caption"><span class="cdot" aria-hidden="true"></span>{{ COPY.caption }}</p>
        <ul class="sr-only" aria-label="星图读数">
          <li v-for="r in readings" :key="r.n">{{ r.group }}：{{ r.text }}</li>
        </ul>
      </section>

      <section id="trace" class="trace wrap" aria-labelledby="trace-h">
        <div class="trace-head">
          <p class="eyebrow">{{ COPY.traceEyebrow }}</p>
          <h2 id="trace-h" class="display" v-html="COPY.traceTitle"></h2>
          <p class="desc">{{ COPY.traceDesc }}</p>
        </div>
        <div ref="board" class="board" :class="{ sample: !!COPY.cardBadge }" @mouseleave="hot = -1">
          <svg class="wires" aria-hidden="true" :width="wires.w" :height="wires.h">
            <path v-for="(p, i) in wires.paths" :key="i" :d="p.d" :class="{ on: hot === p.card, drawn }" pathLength="1" />
            <circle v-for="(p, i) in wires.paths" :key="'c' + i" :cx="p.ex" :cy="p.ey" r="3" :class="{ on: hot === p.card }" />
          </svg>
          <ol class="cards" :aria-label="COPY.cardBadge ? '要点样张（不是线上界面）' : '要点示例'">
            <li v-for="(f, i) in demoFacts" :key="i" :ref="(el) => (cardEls[i] = el)" class="card" :class="{ on: hot === i }" tabindex="0" @mouseenter="hot = i" @focus="hot = i" @blur="hot = -1">
              <div class="c-top">
                <span class="kind"><KindGlyph :kind="f.kind" />{{ f.kind }}</span><span class="badge stat">统计</span>
                <span v-if="COPY.cardBadge" class="badge sample">{{ COPY.cardBadge }}</span>
                <span class="date tnum">{{ f.data_date }}</span>
              </div>
              <div class="c-body">
                <p class="c-text"><Statement :fact="f" /></p>
                <p v-if="leadValue(f)" class="c-num" aria-hidden="true"><span class="display tnum" :class="colorsBySign(f) && leadValue(f).sign ? (leadValue(f).sign > 0 ? 'up' : 'down') : ''">{{ leadValue(f).num }}</span><small>{{ leadValue(f).unit }}</small></p>
              </div>
              <p class="c-src">{{ f.source }}</p>
            </li>
          </ol>
          <ul class="pages">
            <li v-for="m in MODULES" :key="m.key" :ref="(el) => (pageEls[m.key] = el)" class="pg" :class="{ on: hotMods.includes(m.key) }">
              <span class="pg-dot" aria-hidden="true"></span>
              <span class="pg-name">{{ m.label }}</span>
              <span class="pg-ind">{{ INDICATORS[m.key].slice(0, 3).join(' · ') }}</span>
            </li>
          </ul>
        </div>
      </section>

      <section id="pages" class="pages-sec wrap" aria-labelledby="pages-h">
        <h2 id="pages-h" class="display">{{ COPY.pagesTitle }}</h2>
        <ul class="pgrid">
          <li v-for="p in PAGES" :key="p.key" :class="{ soon: p.key === 'brief' && COPY.briefTag, lead: p.key === 'brief' }">
            <ConstellationGlyph :names="INDICATORS[p.key] || ['统计', '口径', '日期', '来源', '性质']" />
            <h3>{{ p.title }}<span v-if="p.key === 'brief' && COPY.briefTag" class="badge sample">{{ COPY.briefTag }}</span></h3>
            <p>{{ p.text }}</p>
          </li>
        </ul>
      </section>

      <section v-if="SOCIAL.length" class="follow-strip wrap" aria-labelledby="fs-h">
        <div class="fs-in">
          <h2 id="fs-h" class="fs-t">关注知数Talk 主理人</h2>
          <p class="fs-d">市场数据的口径和读法，也会发在这些平台。</p>
          <ul class="fs-list">
            <li v-for="s in SOCIAL" :key="s.platform"><PlatformMark :platform="s.platform" size="sm" />{{ s.platformName }}</li>
          </ul>
          <router-link id="fs-more" to="/follow" class="btn sm">扫码关注</router-link>
        </div>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import PlatformMark from '../components/PlatformMark.vue'
import ConstellationGlyph from '../components/ConstellationGlyph.vue'
import KindGlyph from '../components/KindGlyph.vue'
import Statement from '../components/Statement.vue'
import { INDICATORS, MODULES, colorsBySign, getDay, leadValue, metricOfSource, modulesOfSource } from '../lib/brief.js'
import { reducedMotion } from '../lib/theme.js'
import { COPY } from '../config.js'
import { PAGES } from '../copy.js'
import { SOCIAL } from '../lib/social.js'

const DEMO_DATE = '2026-11-04'
const DENSE = new URLSearchParams(location.search).get('sky') === 'dense'
const day = getDay(DEMO_DATE)
const demoFacts = [2, 3, 4].map((i) => day.facts[i])

// 星图数据：星座 = 数据页，星 = 观察指标；当天入选要点的指标变成亮星，标签用要点里的真实数值
const EXTRA = { overview: ['上涨占比'], industries: ['换手率', '成交额占比', '新高比例'], themes: ['封板率', '股票池计数'], history: ['开盘五分钟上涨占比'], calendar: ['事件重要性', '前值与预期'] }
// 星图上的短标签：口径名换成直白的指标名
const SHORT = { 衍生品统计: '持仓成交比标准分' }
// 排名类要点：标签写当天排第一的名称（从句子里取，不写死）
const firstName = (f) => f.statement.match(/：\s*([^\s：、，]+?)\s*[+\-−]/)?.[1]
const AT = { overview: [0.2, 0.2], participation: [0.6, 0.1], industries: [0.92, 0.42], themes: [0.74, 0.86], history: [0.34, 0.88], calendar: [0.08, 0.6] }
const groups = MODULES.map((m) => {
  const names = [...INDICATORS[m.key], ...(EXTRA[m.key] || [])]
  const stars = names.map((name) => {
    const f = day.facts.find((x) => modulesOfSource(x.source).length === 1 && modulesOfSource(x.source)[0] === m.key && metricOfSource(x.source) === name)
    const lv = f && leadValue(f)
    const label = f?.kind === '排名' && firstName(f) ? `${firstName(f)} ${name.replace('资金', '')}` : SHORT[name] || name
    // 原型压力测试（?sky=dense）：每颗星都挂一个读数，用来验证放不下时收成编号标记的路径
    if (DENSE && !lv) return { name, value: `${name} 压力测试` }
    return { name, value: lv ? `${label} ${lv.num}${lv.unit}` : null }
  })
  return { label: m.label, at: AT[m.key], stars, links: m.key === 'industries' ? [MODULES.findIndex((x) => x.key === 'themes')] : [] }
})
const readings = groups.flatMap((g) => g.stars.filter((s) => s.value).map((s) => ({ group: g.label, text: s.value }))).map((r, i) => ({ ...r, n: i + 1 }))

const sky = ref(null), layer = ref(null), copyEl = ref(null), capEl = ref(null), hdr = ref(null)
const legend = ref([])
let field = null
const hot = ref(-1)
const hotMods = computed(() => (hot.value >= 0 ? modulesOfSource(demoFacts[hot.value].source) : []))

// 文案区、说明文字、页头相对画布的位置：星图标签不能压到它们
function avoid() {
  const c = sky.value.getBoundingClientRect()
  const rel = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height } }
  return [rel(copyEl.value), rel(capEl.value), rel(hdr.value?.$el)].filter((r) => r && r.w)
}

// 要点卡片 → 数据页的连线，按实际布局计算；窄屏改为纵向排列时不画线
const board = ref(null)
const cardEls = [], pageEls = {}
const wires = reactive({ w: 0, h: 0, paths: [] })
const drawn = ref(false)
function layoutWires() {
  const b = board.value?.getBoundingClientRect()
  if (!b || b.width < 900) { wires.paths = []; return }
  wires.w = b.width; wires.h = b.height
  wires.paths = demoFacts.flatMap((f, i) => modulesOfSource(f.source).map((k) => {
    const c = cardEls[i].getBoundingClientRect(), p = pageEls[k].getBoundingClientRect()
    const sx = c.right - b.left, sy = c.top + c.height / 2 - b.top, ex = p.left - b.left + 4, ey = p.top + p.height / 2 - b.top
    const mx = (sx + ex) / 2
    return { card: i, d: `M${sx} ${sy} C${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`, ex, ey }
  }))
}
// 首屏亮星 → 第二屏同一条要点：点星图上的读数，滚到对应卡片并点亮它连向数据页的线（只做指针增强，卡片本身可键盘聚焦）
function linkStars() {
  layer.value?.querySelectorAll('.sl.fact').forEach((el) => {
    const i = demoFacts.findIndex((f) => { const lv = leadValue(f); return lv && el.textContent.endsWith(lv.num + lv.unit) })
    if (i < 0) return
    el.classList.add('link')
    el.title = '看这条要点的口径'
    el.onclick = () => {
      document.getElementById('trace').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' })
      cardEls[i]?.focus({ preventScroll: true })
      hot.value = i
    }
  })
}
let ro, io
onMounted(async () => {
  const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 4 || (navigator.deviceMemory ?? 8) <= 4
  const startSky = async () => {
    const m = await import('../lib/starfield.js')
    if (!sky.value) return
    const wide = sky.value.getBoundingClientRect().width >= 900
    field = m.createStarfield(sky.value, {
      groups, layer: layer.value, avoid, reduced: reducedMotion(), lowEnd, layout: wide ? 'wide' : 'narrow',
      onLayout: (rs) => { legend.value = rs.filter((r) => r.collapsed); linkStars() },
    })
    if (field) window.__zxSky = field
    // 不支持 Canvas 时：静态海报 + 把全部读数作为可见列表
    if (!field) legend.value = readings
  }
  // 星图在首帧文字之后再加载，不挡 LCP
  const idle = () => (window.requestIdleCallback || ((f) => setTimeout(f, 200)))(startSky, { timeout: 1500 })
  if (document.readyState === 'complete') idle()
  else window.addEventListener('load', idle, { once: true })
  await nextTick()
  layoutWires()
  ro = new ResizeObserver(layoutWires)
  ro.observe(board.value)
  io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { drawn.value = true; io.disconnect() } }, { threshold: 0.3 })
  io.observe(board.value)
  if (reducedMotion()) drawn.value = true
})
onBeforeUnmount(() => { field?.destroy(); ro?.disconnect(); io?.disconnect() })
</script>

<style scoped>
.landing { background: var(--c-bg); color: var(--c-ink); min-height: 100vh; }

.hero { position: relative; min-height: min(100svh, 920px); display: flex; flex-direction: column; justify-content: center; overflow: hidden; background: radial-gradient(120% 90% at 78% 40%, var(--c-bg) 0%, var(--c-bg-deep) 70%); border-bottom: 1px solid var(--c-line); }
.sky-wrap { position: absolute; inset: 0; }
.sky { position: absolute; inset: 0; width: 100%; height: 100%; }
/* 画布还没画出来（或浏览器不支持）时的静态海报：网格 + 柔光 */
.sky-poster { position: absolute; inset: 0; pointer-events: none; mask-image: radial-gradient(60% 60% at 70% 45%, #000 0%, transparent 75%); -webkit-mask-image: radial-gradient(60% 60% at 70% 45%, #000 0%, transparent 75%); opacity: 0.8; }
.sky-labels { position: absolute; inset: 0; pointer-events: none; z-index: 2; will-change: transform; }
.sky-labels :deep(.sl) { position: absolute; white-space: nowrap; line-height: 16px; font-size: var(--fs-xs); text-shadow: 0 0 2px var(--c-bg-deep), 0 0 4px var(--c-bg-deep), 0 0 8px var(--c-bg-deep); opacity: 0; transition: opacity var(--dur-slow) var(--ease-out), color var(--dur-2); transition-delay: var(--d, 0ms), 0ms; }
.sky-labels.in :deep(.sl) { opacity: 1; }
.sky-labels :deep(.sl.fact) { color: var(--c-ink-2); font-weight: 500; }
.sky-labels :deep(.sl.fact.on) { color: var(--c-accent-ink); }
.sky-labels :deep(.sl.fact.link) { pointer-events: auto; cursor: pointer; text-decoration: underline dashed var(--c-line-strong); text-underline-offset: 4px; }
.sky-labels :deep(.sl.fact.link:hover) { color: var(--c-accent-ink); text-decoration-color: var(--c-accent); }
.sky-labels :deep(.sl.grp) { color: var(--c-ink-3); font-size: var(--fs-2xs); letter-spacing: 0.04em; }
.sky-labels :deep(.sl.grp.on) { color: var(--c-accent-ink); }
/* 放不下的读数：编号标记，悬停 / 聚焦 / 轻触时展开 */
.sky-labels :deep(.sky-mark) { position: absolute; width: 20px; height: 20px; display: grid; place-items: center; border-radius: 50%; border: 1px solid var(--c-line-strong); background: var(--c-bg); color: var(--c-ink-2); font-size: 10px; font-weight: 600; font-variant-numeric: tabular-nums; pointer-events: auto; opacity: 0; transition: opacity var(--dur-slow) var(--ease-out), border-color var(--dur-2), color var(--dur-2); transition-delay: var(--d, 0ms), 0ms, 0ms; }
.sky-labels.in :deep(.sky-mark) { opacity: 1; }
.sky-labels :deep(.sky-mark.on), .sky-labels :deep(.sky-mark:hover), .sky-labels :deep(.sky-mark:focus-visible) { border-color: var(--c-accent); color: var(--c-accent-ink); }
.sky-labels :deep(.sky-mark .pop) { position: absolute; left: 26px; top: 50%; transform: translateY(-50%); padding: 4px var(--s-2); border: 1px solid var(--c-line-strong); border-radius: var(--r-1); background: var(--c-surface-2); color: var(--c-ink); font-size: var(--fs-xs); font-weight: 500; white-space: nowrap; box-shadow: var(--shadow-2); opacity: 0; visibility: hidden; transition: opacity var(--dur-2), visibility 0s linear var(--dur-2); z-index: 3; }
.sky-labels :deep(.sky-mark.pop-left .pop) { left: auto; right: 26px; }
.sky-labels :deep(.sky-mark:hover .pop), .sky-labels :deep(.sky-mark:focus-visible .pop), .sky-labels :deep(.sky-mark:focus .pop) { opacity: 1; visibility: visible; transition: opacity var(--dur-2); }
.sky-legend { position: absolute; z-index: 2; right: var(--s-6); bottom: 48px; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--s-1) var(--s-4); max-width: 46%; font-size: var(--fs-2xs); color: var(--c-ink-2); }
.sky-legend li { display: inline-flex; align-items: center; gap: 6px; }
.ln { display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; border: 1px solid var(--c-line-strong); font-size: 9px; font-weight: 600; }

.hero-in { position: relative; z-index: 1; width: 100%; padding-top: 96px; padding-bottom: 96px; pointer-events: none; }
.hero-copy { max-width: 560px; pointer-events: auto; }
.eyebrow { font-size: var(--fs-xs); letter-spacing: var(--tr-caps); color: var(--c-accent-ink); margin-bottom: var(--s-4); }
h1 { font-size: var(--fs-display); line-height: 1; letter-spacing: 0.04em; }
.lead { margin-top: var(--s-5); font-family: var(--font-display); font-size: clamp(22px, 2.4vw, 32px); line-height: 1.4; color: var(--c-ink); }
.lead :deep(.br-m) { display: none; }
.desc { margin-top: var(--s-4); max-width: 34em; font-size: var(--fs-md); line-height: var(--lh-loose); color: var(--c-ink-2); }
.ctas { margin-top: var(--s-6); display: flex; gap: var(--s-3); flex-wrap: wrap; }
.btn.big { height: 48px; padding: 0 var(--s-6); font-size: var(--fs-md); }
.mp-note { margin-top: var(--s-3); font-size: var(--fs-xs); color: var(--c-ink-3); }
.caption { position: absolute; z-index: 1; right: var(--s-6); bottom: var(--s-5); display: flex; align-items: center; gap: var(--s-2); max-width: 46%; font-size: var(--fs-2xs); color: var(--c-ink-3); }
.cdot { width: 5px; height: 5px; border-radius: 50%; background: var(--c-accent); flex: none; }

.trace { padding-top: var(--s-9); padding-bottom: var(--s-8); }
.trace-head { max-width: 680px; }
h2 { font-size: clamp(30px, 3.6vw, 48px); line-height: 1.2; }
.trace .desc { font-size: var(--fs-md); }
.board { position: relative; margin-top: var(--s-7); display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 160px; align-items: center; }
.wires { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
.wires path { fill: none; stroke: var(--c-line-strong); stroke-width: 1; stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke var(--dur-2), stroke-width var(--dur-2); }
.wires path.drawn { stroke-dashoffset: 0; transition: stroke-dashoffset 1400ms var(--ease-out), stroke var(--dur-2); }
.wires path.on { stroke: var(--c-accent); stroke-width: 1.4; stroke-dasharray: 0.02 0.012; animation: flow 1.6s linear infinite; }
@keyframes flow { to { stroke-dashoffset: -0.064; } }
.wires circle { fill: var(--c-ink-3); transition: fill var(--dur-2); }
.wires circle.on { fill: var(--c-accent); }
.cards { display: flex; flex-direction: column; gap: var(--s-4); }
.card { position: relative; padding: var(--s-5); border: 1px solid var(--c-line); border-radius: var(--r-3); background: color-mix(in srgb, var(--c-surface) 88%, transparent); transition: border-color var(--dur-2), box-shadow var(--dur-3), transform var(--dur-3) var(--ease-out); outline: none; }
.board.sample .card { border-style: dashed; }
.card.on { border-color: var(--c-accent); box-shadow: var(--shadow-glow); transform: translateX(4px); }
.card:focus-visible { outline: 2px solid var(--c-focus); outline-offset: 2px; }
.c-top { display: flex; align-items: center; gap: var(--s-2); }
.kind { display: inline-flex; align-items: center; gap: 6px; height: 20px; padding: 0 var(--s-2); border-radius: var(--r-1); background: var(--c-surface-2); font-size: var(--fs-xs); color: var(--c-ink-2); }
.date { margin-left: auto; font-size: var(--fs-xs); color: var(--c-ink-3); }
.c-body { margin-top: var(--s-3); display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--s-4); align-items: center; }
.c-text { font-size: var(--fs-md); line-height: 1.7; color: var(--c-ink-2); }
.c-num { white-space: nowrap; text-align: right; }
.c-num span { font-size: 32px; line-height: 1; color: var(--c-ink); }
.c-num span.up { color: var(--c-up); }
.c-num span.down { color: var(--c-down); }
.c-num small { margin-left: 4px; font-size: var(--fs-xs); color: var(--c-ink-3); }
.c-src { margin-top: var(--s-2); font-size: var(--fs-xs); color: var(--c-ink-3); }
.pages { display: flex; flex-direction: column; gap: var(--s-2); }
.pg { display: grid; grid-template-columns: 12px minmax(0, 1fr); column-gap: var(--s-3); padding: var(--s-3) var(--s-4); border-radius: var(--r-2); border: 1px solid transparent; transition: border-color var(--dur-2), background-color var(--dur-2); }
.pg.on { border-color: var(--c-line); background: var(--c-surface); }
.pg-dot { grid-row: span 2; align-self: center; width: 7px; height: 7px; border-radius: 50%; border: 1px solid var(--c-ink-3); transition: background-color var(--dur-2), border-color var(--dur-2); }
.pg.on .pg-dot { background: var(--c-accent); border-color: var(--c-accent); }
.pg-name { font-size: var(--fs-md); color: var(--c-ink); }
.pg-ind { font-size: var(--fs-xs); color: var(--c-ink-3); }

.pages-sec { padding-bottom: var(--s-8); }
.pages-sec h2 { font-size: clamp(24px, 2.6vw, 34px); }
.pgrid { margin-top: var(--s-6); display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--c-line); border-left: 1px solid var(--c-line); }
.pgrid li { padding: var(--s-5); border-right: 1px solid var(--c-line); border-bottom: 1px solid var(--c-line); min-height: 148px; transition: background-color var(--dur-2); }
.pgrid li.lead { background: var(--c-surface); box-shadow: inset 0 1px 0 var(--c-accent); }
.pgrid li.lead h3 { color: var(--c-accent-ink); }
.pgrid li.soon { box-shadow: inset 0 1px 0 var(--c-line-strong); }
.pgrid li.soon h3 { color: var(--c-ink); }
.pgrid li:hover { background: var(--c-surface); }
.pgrid .cg { margin-bottom: var(--s-3); }
.pgrid h3 { display: flex; align-items: center; gap: var(--s-2); font-size: var(--fs-md); font-weight: 600; }
.pgrid p { margin-top: var(--s-2); font-size: var(--fs-sm); color: var(--c-ink-2); line-height: 1.7; }

.follow-strip { padding-bottom: var(--s-8); }
.fs-in { display: flex; align-items: center; gap: var(--s-3) var(--s-5); flex-wrap: wrap; padding: var(--s-4) var(--s-5); border: 1px solid var(--c-line); border-radius: var(--r-3); background: var(--c-surface); }
.fs-t { font-family: var(--font-sans); font-size: var(--fs-base); font-weight: 600; }
.fs-d { font-size: var(--fs-sm); color: var(--c-ink-2); }
.fs-list { display: flex; gap: var(--s-4); flex-wrap: wrap; font-size: var(--fs-sm); color: var(--c-ink-2); }
.fs-list li { display: inline-flex; align-items: center; gap: 6px; }
.fs-in .btn { margin-left: auto; }

@media (max-width: 1099px) {
  .board { grid-template-columns: minmax(0, 1fr); gap: var(--s-6); }
  .pgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 899px) {
  .hero { min-height: 0; justify-content: flex-start; }
  .sky-wrap { position: relative; inset: auto; height: 340px; flex: none; margin-top: 56px; }
  .sky-poster { mask-image: radial-gradient(70% 40% at 50% 45%, #000 0%, transparent 80%); -webkit-mask-image: radial-gradient(70% 40% at 50% 45%, #000 0%, transparent 80%); }
  .sky-legend { position: static; max-width: none; justify-content: flex-start; padding: var(--s-2) var(--s-6) 0; }
  .hero-in { padding-top: var(--s-5); padding-bottom: var(--s-4); }
  .caption { position: static; max-width: none; padding: 0 var(--s-6) var(--s-5); }
}
@media (max-width: 640px) {
  .sky-wrap { height: 300px; }
  .sky-legend, .caption { padding-left: var(--s-4); padding-right: var(--s-4); }
  h1 { font-size: 52px; }
  .lead { font-size: 22px; }
  .lead :deep(.br-m) { display: inline; }
  .desc { font-size: 15px; }
  .ctas .btn { flex: 1; padding: 0 var(--s-4); }
  .trace { padding-top: var(--s-8); }
  .c-body { grid-template-columns: minmax(0, 1fr); gap: var(--s-2); }
  .c-num { text-align: left; order: -1; }
  .c-num span { font-size: 26px; }
  .pgrid { grid-template-columns: minmax(0, 1fr); }
  .pgrid li { min-height: 0; }
  .fs-in .btn { margin-left: 0; }
}
</style>
