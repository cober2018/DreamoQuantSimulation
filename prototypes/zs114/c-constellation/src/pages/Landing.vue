<template>
  <div class="landing">
    <a class="skip-link" href="#main">跳到正文</a>
    <header class="top">
      <div class="wrap top-row">
        <router-link to="/" class="brand" aria-label="知数星耀 首页"><BrandMark :size="28" /><span class="display">知数星耀</span></router-link>
        <nav class="links" aria-label="介绍页">
          <a href="#trace">每日要点</a>
          <a href="#pages">数据页</a>
        </nav>
        <div class="acts">
          <ThemeToggle />
          <router-link id="nav-login" class="btn sm ghost login" to="/app">登录</router-link>
          <router-link id="nav-register" class="btn sm primary" to="/app">免费注册</router-link>
        </div>
      </div>
    </header>

    <main id="main">
      <section class="hero" aria-labelledby="hero-h">
        <canvas ref="sky" class="sky" aria-hidden="true"></canvas>
        <div class="sky-poster grid-bg" aria-hidden="true"></div>
        <div class="wrap hero-in">
          <p class="eyebrow">A 股盘后数据 · 按交易日更新</p>
          <h1 id="hero-h" class="display">知数星耀</h1>
          <p class="lead">盘后数据，整理成<br class="br-m" />可以核对的每日事实。</p>
          <p class="desc">指数与涨跌家数、成交与参与度、行业板块、涨停题材、未来事件日程，按固定规则提炼成当天的统计要点。每一条都标出数据日期、口径和来源字段，只描述市场状态，不预测涨跌。</p>
          <div class="ctas">
            <router-link id="hero-register" class="btn primary big" to="/app">免费注册</router-link>
            <router-link id="hero-login" class="btn big" to="/app">已有账号，登录</router-link>
          </div>
        </div>
        <p class="caption wrap"><span class="cdot" aria-hidden="true"></span>星图中每颗星是一项盘后统计，连线表示同属一个数据页；亮星与数值取自 {{ DEMO_DATE }} 的要点。</p>
      </section>

      <section id="trace" class="trace wrap" aria-labelledby="trace-h">
        <div class="trace-head">
          <p class="eyebrow">今日要点</p>
          <h2 id="trace-h" class="display">每一条要点，<br />都连着它的口径。</h2>
          <p class="desc">要点按固定模板生成，不经大模型改写。点开任意一条，能看到用到的字段、数据日期和计算规则，再落到对应的明细页核对原始数据。</p>
        </div>
        <div ref="board" class="board" @mouseleave="hot = -1">
          <svg class="wires" aria-hidden="true" :width="wires.w" :height="wires.h">
            <path v-for="(p, i) in wires.paths" :key="i" :d="p.d" :class="{ on: hot === p.card, drawn }" pathLength="1" />
            <circle v-for="(p, i) in wires.paths" :key="'c' + i" :cx="p.ex" :cy="p.ey" r="3" :class="{ on: hot === p.card }" />
          </svg>
          <ol class="cards">
            <li v-for="(f, i) in demoFacts" :key="i" :ref="(el) => (cardEls[i] = el)" class="card" :class="{ on: hot === i }" tabindex="0" @mouseenter="hot = i" @focus="hot = i" @blur="hot = -1">
              <div class="c-top"><span class="kind"><KindGlyph :kind="f.kind" />{{ f.kind }}</span><span class="badge stat">统计</span><span class="date tnum">{{ f.data_date }}</span></div>
              <p class="c-text"><Statement :fact="f" /></p>
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
        <h2 id="pages-h" class="display">首页看要点，六个数据页看明细</h2>
        <ul class="pgrid">
          <li v-for="p in PAGES" :key="p.title"><h3>{{ p.title }}</h3><p>{{ p.text }}</p></li>
        </ul>
      </section>
    </main>

    <footer class="foot">
      <div class="wrap">
        <p>本平台提供市场数据与历史统计，仅供研究和学习参考，不构成任何投资建议、证券推荐或交易指令。数据可能存在延迟、缺失或误差，请以交易所及上市公司的官方披露为准。</p>
        <p class="flinks">
          <a href="#">用户协议与隐私政策</a>
          <a href="https://www.dreamotech.cn/" rel="noopener" target="_blank">梦氧科技官网</a>
          <a href="https://beian.miit.gov.cn/" rel="noopener" target="_blank">浙ICP备2024135110号</a>
          <span>© DreamOTech</span>
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import BrandMark from '../components/BrandMark.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import KindGlyph from '../components/KindGlyph.vue'
import Statement from '../components/Statement.vue'
import { INDICATORS, MODULES, getDay, leadValue, metricOfSource, modulesOfSource } from '../lib/brief.js'
import { reducedMotion } from '../lib/theme.js'

const DEMO_DATE = '2026-11-04'
const day = getDay(DEMO_DATE)
const demoFacts = [2, 3, 5].map((i) => day.facts[i])

const PAGES = [
  { title: '今日要点', text: '每天 5–8 条统计事实，按偏离常态的程度排序，附明日的重要日程。' },
  { title: '市场总览', text: '主要指数涨跌、涨跌家数、成交额，以及数据来源与覆盖情况。' },
  { title: '参与度与资金环境', text: '成交参与度分位、主动卖出占比、股债收益差观察、衍生品持仓统计、风格强弱。' },
  { title: '行业比较与轮动', text: '行业、概念、地域板块的涨跌、成交、换手、资金净流入，以及近期序列。' },
  { title: '题材与涨跌结构', text: '涨停和炸板数、连板梯队、首次封板时间分布、股票池计数。' },
  { title: '历史复盘', text: '按日期回看以上数据，以及开盘五分钟统计。' },
  { title: '事件日历', text: '未来两周的宏观数据和事件日程。' },
]

// 星图数据：星座 = 数据页，星 = 观察指标；当天入选要点的指标变成亮星，标签用要点里的真实数值
const EXTRA = { overview: ['上涨占比'], industries: ['换手率', '成交额占比', '新高比例'], themes: ['封板率', '股票池计数'], history: ['开盘五分钟上涨占比'], calendar: ['事件重要性', '前值与预期'] }
// 星图上的短标签：把口径名换成更直白的指标名
const SHORT = { 衍生品统计: '持仓成交比标准分', 资金净流入: '电子 净流入' }
const AT = { overview: [0.2, 0.2], participation: [0.6, 0.1], industries: [0.92, 0.42], themes: [0.74, 0.86], history: [0.34, 0.88], calendar: [0.08, 0.6] }
const groups = MODULES.map((m) => {
  const names = [...INDICATORS[m.key], ...(EXTRA[m.key] || [])]
  const stars = names.map((name) => {
    const f = day.facts.find((x) => modulesOfSource(x.source).length === 1 && modulesOfSource(x.source)[0] === m.key && metricOfSource(x.source) === name)
    const lv = f && leadValue(f)
    return { name, value: lv ? `${SHORT[name] || name} ${lv.num}${lv.unit}` : null }
  })
  return { label: m.label, at: AT[m.key], stars, links: m.key === 'industries' ? [MODULES.findIndex((x) => x.key === 'themes')] : [] }
})

const sky = ref(null)
let field = null
const hot = ref(-1)
const hotMods = computed(() => (hot.value >= 0 ? modulesOfSource(demoFacts[hot.value].source) : []))

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
let ro, io
onMounted(async () => {
  const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 4 || (navigator.deviceMemory ?? 8) <= 4
  const startSky = async () => {
    const m = await import('../lib/starfield.js')
    if (!sky.value) return
    const wide = sky.value.getBoundingClientRect().width >= 900
    field = m.createStarfield(sky.value, { groups, reduced: reducedMotion(), lowEnd, layout: wide ? 'wide' : 'narrow' })
  }
  // 星图在首帧文字之后再加载，不挡 LCP
  ;(window.requestIdleCallback || ((f) => setTimeout(f, 120)))(startSky, { timeout: 600 })
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
.wrap { max-width: 1280px; margin: 0 auto; padding: 0 var(--s-6); }
.top { position: absolute; z-index: 10; inset: 0 0 auto; }
.top-row { display: flex; align-items: center; gap: var(--s-6); height: 72px; }
.brand { display: inline-flex; align-items: center; gap: var(--s-2); font-size: 18px; }
.links { display: flex; gap: var(--s-5); margin-left: var(--s-4); }
.links a { font-size: var(--fs-sm); color: var(--c-ink-2); transition: color var(--dur-2); }
.links a:hover { color: var(--c-ink); }
.acts { margin-left: auto; display: flex; align-items: center; gap: var(--s-2); }

.hero { position: relative; min-height: min(100svh, 920px); display: flex; flex-direction: column; justify-content: center; overflow: hidden; background: radial-gradient(120% 90% at 78% 40%, var(--c-bg) 0%, var(--c-bg-deep) 70%); border-bottom: 1px solid var(--c-line); }
.sky { position: absolute; inset: 0; width: 100%; height: 100%; }
/* 画布还没画出来（或浏览器不支持）时的静态海报：网格 + 柔光 */
.sky-poster { position: absolute; inset: 0; z-index: -0; pointer-events: none; mask-image: radial-gradient(60% 60% at 70% 45%, #000 0%, transparent 75%); -webkit-mask-image: radial-gradient(60% 60% at 70% 45%, #000 0%, transparent 75%); opacity: 0.8; }
.hero-in { position: relative; z-index: 1; width: 100%; padding-top: 96px; padding-bottom: 96px; }
.eyebrow { font-size: var(--fs-xs); letter-spacing: 0.18em; color: var(--c-accent-ink); margin-bottom: var(--s-4); }
h1 { font-size: var(--fs-display); line-height: 1; letter-spacing: 0.04em; }
.lead { margin-top: var(--s-5); font-family: var(--font-display); font-size: clamp(22px, 2.4vw, 32px); line-height: 1.4; color: var(--c-ink); max-width: 20em; }
.br-m { display: none; }
.desc { margin-top: var(--s-4); max-width: 34em; font-size: var(--fs-md); line-height: var(--lh-loose); color: var(--c-ink-2); }
.ctas { margin-top: var(--s-6); display: flex; gap: var(--s-3); flex-wrap: wrap; }
.btn.big { height: 48px; padding: 0 var(--s-6); font-size: var(--fs-md); }
.caption { position: absolute; z-index: 1; left: 0; right: 0; bottom: var(--s-5); display: flex; align-items: center; justify-content: flex-end; gap: var(--s-2); font-size: var(--fs-2xs); color: var(--c-ink-3); }
.cdot { width: 5px; height: 5px; border-radius: 50%; background: var(--c-accent); }

.trace { padding-top: var(--s-9); padding-bottom: var(--s-8); }
.trace-head { max-width: 640px; }
h2 { font-size: clamp(30px, 3.6vw, 48px); line-height: 1.2; }
.trace .desc { font-size: var(--fs-md); }
.board { position: relative; margin-top: var(--s-7); display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 160px; align-items: center; }
.wires { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
.wires path { fill: none; stroke: var(--c-line-strong); stroke-width: 1; stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke var(--dur-2), stroke-width var(--dur-2); }
.wires path.drawn { stroke-dashoffset: 0; transition: stroke-dashoffset 1400ms var(--ease-out), stroke var(--dur-2); }
.wires path.on { stroke: var(--c-accent); stroke-width: 1.4; }
.wires circle { fill: var(--c-ink-3); transition: fill var(--dur-2); }
.wires circle.on { fill: var(--c-accent); }
.cards { display: flex; flex-direction: column; gap: var(--s-4); }
.card { position: relative; padding: var(--s-5); border: 1px solid var(--c-line); border-radius: var(--r-3); background: color-mix(in srgb, var(--c-surface) 88%, transparent); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); transition: border-color var(--dur-2), box-shadow var(--dur-3), transform var(--dur-3) var(--ease-out); outline: none; }
.card.on { border-color: var(--c-accent); box-shadow: var(--shadow-glow); transform: translateX(4px); }
.card:focus-visible { outline: 2px solid var(--c-focus); outline-offset: 2px; }
.c-top { display: flex; align-items: center; gap: var(--s-2); }
.kind { display: inline-flex; align-items: center; gap: 6px; height: 20px; padding: 0 var(--s-2); border-radius: var(--r-1); background: var(--c-surface-2); font-size: var(--fs-xs); color: var(--c-ink-2); }
.date { margin-left: auto; font-size: var(--fs-xs); color: var(--c-ink-3); }
.c-text { margin-top: var(--s-3); font-size: var(--fs-md); line-height: 1.7; color: var(--c-ink-2); }
.c-src { margin-top: var(--s-2); font-size: var(--fs-xs); color: var(--c-ink-3); }
.pages { display: flex; flex-direction: column; gap: var(--s-2); }
.pg { display: grid; grid-template-columns: 12px minmax(0, 1fr); column-gap: var(--s-3); padding: var(--s-3) var(--s-4); border-radius: var(--r-2); border: 1px solid transparent; transition: border-color var(--dur-2), background-color var(--dur-2); }
.pg.on { border-color: var(--c-line); background: var(--c-surface); }
.pg-dot { grid-row: span 2; align-self: center; width: 7px; height: 7px; border-radius: 50%; border: 1px solid var(--c-ink-3); transition: background-color var(--dur-2), border-color var(--dur-2); }
.pg.on .pg-dot { background: var(--c-accent); border-color: var(--c-accent); }
.pg-name { font-size: var(--fs-md); color: var(--c-ink); }
.pg-ind { font-size: var(--fs-xs); color: var(--c-ink-3); }

.pages-sec { padding-bottom: var(--s-9); }
.pages-sec h2 { font-size: clamp(24px, 2.6vw, 34px); }
.pgrid { margin-top: var(--s-6); display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--c-line); border-left: 1px solid var(--c-line); }
.pgrid li { padding: var(--s-5); border-right: 1px solid var(--c-line); border-bottom: 1px solid var(--c-line); min-height: 148px; transition: background-color var(--dur-2); }
.pgrid li:first-child { background: var(--c-surface); box-shadow: inset 0 1px 0 var(--c-accent); }
.pgrid li:first-child h3 { color: var(--c-accent-ink); }
.pgrid li:hover { background: var(--c-surface); }
.pgrid h3 { font-size: var(--fs-md); font-weight: 600; }
.pgrid p { margin-top: var(--s-2); font-size: var(--fs-sm); color: var(--c-ink-2); line-height: 1.7; }

.foot { border-top: 1px solid var(--c-line); background: var(--c-bg-deep); padding: var(--s-6) 0; font-size: var(--fs-xs); color: var(--c-ink-3); }
.foot p { line-height: 1.8; max-width: 880px; }
.flinks { margin-top: var(--s-3); display: flex; flex-wrap: wrap; gap: var(--s-2) var(--s-5); }
.flinks a { color: var(--c-ink-2); }
.flinks a:hover { color: var(--c-ink); text-decoration: underline; }

@media (max-width: 1099px) {
  .board { grid-template-columns: minmax(0, 1fr); gap: var(--s-6); }
  .pgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 899px) {
  .links { display: none; }
  .hero { min-height: 0; justify-content: flex-start; }
  .sky { position: relative; inset: auto; height: 340px; flex: none; margin-top: 56px; }
  .sky-poster { mask-image: radial-gradient(70% 30% at 50% 22%, #000 0%, transparent 80%); -webkit-mask-image: radial-gradient(70% 30% at 50% 22%, #000 0%, transparent 80%); }
  .hero-in { padding-top: var(--s-2); padding-bottom: var(--s-6); }
  .caption { position: static; justify-content: flex-start; padding-bottom: var(--s-5); }
}
@media (max-width: 640px) {
  .wrap { padding: 0 var(--s-4); }
  .top-row { height: 56px; gap: var(--s-3); }
  .login { display: none; }
  .sky { height: 280px; }
  h1 { font-size: 52px; }
  .lead { font-size: 22px; }
  .br-m { display: inline; }
  .desc { font-size: 15px; }
  .ctas .btn { flex: 1; padding: 0 var(--s-4); }
  .trace { padding-top: var(--s-8); }
  .pgrid { grid-template-columns: minmax(0, 1fr); }
  .pgrid li { min-height: 0; }
}
</style>
