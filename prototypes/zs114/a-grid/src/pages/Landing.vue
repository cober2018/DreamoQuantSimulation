<template>
  <div class="lp">
    <a class="skip" href="#lp-main">跳到正文</a>
    <header class="top">
      <div class="wrap row">
        <router-link to="/" class="brand" id="lp-brand" aria-label="知数星耀 首页"><BrandMark :size="24" /><span>知数星耀</span></router-link>
        <nav class="links" aria-label="页内导航">
          <a href="#pages">能看到什么</a><a href="#rules">口径</a><a href="#start">开始使用</a>
        </nav>
        <div class="acts">
          <ThemeToggle />
          <router-link class="btn ghost login" to="/app" id="lp-login-top">登录</router-link>
          <router-link class="btn primary" to="/app" id="lp-register-top">免费注册</router-link>
        </div>
      </div>
    </header>

    <main id="lp-main">
      <section class="hero" ref="hero" @pointermove="onMove" @pointerleave="xh.on = false" aria-labelledby="lp-h1">
        <div class="wrap hgrid">
          <div class="gridlines" aria-hidden="true"><i v-for="n in 12" :key="n"></i></div>
          <div class="copy">
            <p class="eyebrow">A 股 · 盘后数据 · 按交易日更新</p>
            <h1 id="lp-h1"><span class="l1">A 股盘后数据，</span><span class="l2">按固定页面整理好。</span></h1>
            <p class="desc">指数和涨跌家数、成交和参与度、行业板块、涨停题材、未来事件日程，每天复盘要翻的数据整理成几张固定的页面。每页标出数据日期，指标附定义。</p>
            <div class="cta">
              <router-link class="btn primary lg" to="/app" id="lp-register">免费注册</router-link>
              <router-link class="btn lg" to="/app" id="lp-login">已有账号，登录</router-link>
            </div>
            <dl class="spec">
              <div><dt class="mono">06</dt><dd>固定数据页</dd></div>
              <div><dt class="mono">DATE</dt><dd>每页标出数据日期</dd></div>
              <div><dt class="mono">DEF</dt><dd>每个指标附口径定义</dd></div>
            </dl>
          </div>

          <figure class="inst" aria-labelledby="inst-cap">
            <div class="inst-frame">
              <svg class="plot" viewBox="0 0 560 420" role="img" aria-label="示例图：行业板块相对强度与动量散点，以及化肥板块近 7 个有数交易日的轨迹">
                <g class="ticks">
                  <path v-for="i in 9" :key="'v' + i" :d="`M${40 + (i - 1) * 60} 20 V380`" />
                  <path v-for="i in 7" :key="'h' + i" :d="`M40 ${20 + (i - 1) * 60} H520`" />
                </g>
                <path class="axis" d="M40 20 V380 H520" />
                <path class="ref" :d="`M${sx(100)} 20 V380`" pathLength="1" /><path class="ref" :d="`M40 ${sy(100)} H520`" pathLength="1" />
                <text v-for="i in 5" :key="'xl' + i" class="tl" :x="40 + (i - 1) * 120" y="398" text-anchor="middle">{{ (X0 + (i - 1) * (X1 - X0) / 4).toFixed(1) }}</text>
                <text v-for="i in 4" :key="'yl' + i" class="tl" x="32" :y="384 - (i - 1) * 120" text-anchor="end">{{ (Y0 + (i - 1) * (Y1 - Y0) / 3).toFixed(1) }}</text>
                <g class="dots"><circle v-for="(p, i) in dots" :key="i" :cx="p.x" :cy="p.y" r="2.6" :style="{ animationDelay: `${200 + i * 18}ms` }" /></g>
                <g class="trace">
                  <path :d="`M${end.x} ${end.y} V380`" pathLength="1" class="tr" /><path :d="`M${end.x} ${end.y} H40`" pathLength="1" class="tr" />
                  <text :x="end.x" y="376" class="ax-v" text-anchor="middle">{{ endPt.rs_ratio.toFixed(2) }}</text>
                  <text x="44" :y="end.y - 6" class="ax-v">{{ endPt.rs_momentum.toFixed(2) }}</text>
                  <circle :cx="end.x" :cy="end.y" r="5" class="end" />
                  <text :x="end.x + 10" :y="end.y - 10" class="rd">化肥 · {{ endPt.trade_date }}</text>
                </g>
                <line v-if="xh.on" class="xh" :x1="xh.x" y1="20" :x2="xh.x" y2="380" />
                <line v-if="xh.on" class="xh" x1="40" :y1="xh.y" x2="520" :y2="xh.y" />
              </svg>
              <div class="readout mono" aria-hidden="true">
                <span>X RS 比率</span><span>Y RS 动量</span><span v-if="xh.on" class="live">{{ xh.vx }} / {{ xh.vy }}</span><span v-else>2026-09-09</span>
              </div>
              <article class="sample" aria-label="今日要点示例卡片">
                <p class="s-top"><KindTag kind="变化" /><span class="chip stat">统计</span><span class="mono d">2026-11-04</span></p>
                <p class="s-val mono"><TickNum text="116" :delay="500" /><span>家</span><em>前一交易日 48 家</em></p>
                <p class="s-stmt">涨停 116 家，前一交易日 48 家</p>
                <p class="s-src"><span>题材与涨跌结构 · 涨停数</span><span class="mono">limit_up_count</span></p>
              </article>
            </div>
            <figcaption id="inst-cap">示例数据：行业板块相对强度—动量；化肥为最新一日位置，虚线回溯到坐标轴。卡片为「今日要点」规则回放示例（开发中）。</figcaption>
          </figure>
        </div>
      </section>

      <section class="sec" id="pages" aria-labelledby="pages-h">
        <div class="wrap g12">
          <div class="gridlines" aria-hidden="true"><i v-for="n in 12" :key="n"></i></div>
          <div class="sec-h">
            <p class="eyebrow">01 — 能看到什么</p>
            <h2 id="pages-h">六张固定的数据页</h2>
            <p class="sec-d">不用在多个网站和软件之间来回切换。当天的市场概况、板块表现、涨停结构和事件日程，按固定顺序放在一起。</p>
          </div>
          <ol class="index">
            <li v-for="(p, i) in PAGES" :key="p.title">
              <span class="ix mono">{{ String(i + 1).padStart(2, '0') }}</span>
              <h3>{{ p.title }}</h3>
              <p>{{ p.text }}</p>
            </li>
          </ol>
        </div>
      </section>

      <section class="sec" id="rules" aria-labelledby="rules-h">
        <div class="wrap g12">
          <div class="gridlines" aria-hidden="true"><i v-for="n in 12" :key="n"></i></div>
          <div class="sec-h">
            <p class="eyebrow">02 — 口径</p>
            <h2 id="rules-h">只给数据，口径写清楚</h2>
          </div>
          <div class="rules">
            <div class="rule"><p class="r-n mono">A</p><h3>平台独有的统计口径</h3><p>除常规行情统计外，平台还自行计算一组观察指标：成交参与度历史分位、主动卖出占比、风格强弱分、板块扩散度、开盘五分钟统计、股债收益差观察。</p></div>
            <div class="rule"><p class="r-n mono">B</p><h3>日期总是可见</h3><p>每页顶部可以选择交易日，并标出数据日期。所选日期没有数据时页面会明确提示，不拿其他日期代替。</p></div>
            <div class="rule"><p class="r-n mono">C</p><h3>只描述市场状态</h3><p>每个指标附定义和数据日期，只描述市场状态，不预测涨跌，不提供买卖建议。</p></div>
          </div>
        </div>
      </section>

      <section class="sec" id="start" aria-labelledby="start-h">
        <div class="wrap g12">
          <div class="gridlines" aria-hidden="true"><i v-for="n in 12" :key="n"></i></div>
          <div class="sec-h">
            <p class="eyebrow">03 — 开始使用</p>
            <h2 id="start-h">三步开始</h2>
          </div>
          <ol class="steps">
            <li><span class="mono">01</span><p>注册账号：设置用户名和密码，阅读并同意用户协议与隐私政策。</p></li>
            <li><span class="mono">02</span><p>登录后从「市场总览」开始，在左侧切换各页。</p></li>
            <li><span class="mono">03</span><p>试用期内，注册用户可以使用全部页面；试用期结束后的安排会提前在站内公告。</p></li>
          </ol>
          <div class="cta end"><router-link class="btn primary lg" to="/app" id="lp-register-end">免费注册</router-link></div>
        </div>
      </section>
    </main>

    <footer class="foot">
      <div class="wrap">
        <p>本平台提供市场数据与历史统计，仅供研究和学习参考，不构成任何投资建议、证券推荐或交易指令。数据可能存在延迟、缺失或误差，请以交易所及上市公司的官方披露为准。</p>
        <p class="fl">
          <span class="mono">© DreamOTech</span>
          <a href="#">用户协议与隐私政策</a>
          <a href="https://www.dreamotech.cn/" rel="noopener" target="_blank">梦氧科技官网</a>
          <a href="https://beian.miit.gov.cn/" rel="noopener" target="_blank">浙ICP备2024135110号</a>
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import BrandMark from '../components/BrandMark.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import KindTag from '../components/KindTag.vue'
import TickNum from '../components/TickNum.vue'
import { finePointer, reducedMotion } from '../lib/env.js'
import ind from '../../../data/industries-sample.json'
import ser from '../../../data/industry-series-sample.json'

const PAGES = [
  { title: '市场总览', text: '主要指数涨跌、涨跌家数、成交额，以及数据来源与覆盖情况。' },
  { title: '参与度与资金环境', text: '成交参与度分位、主动卖出占比、股债收益差观察、衍生品持仓统计、风格强弱。' },
  { title: '行业比较与轮动', text: '行业、概念、地域板块的涨跌、成交、换手、资金净流入，以及近期序列。' },
  { title: '题材与涨跌结构', text: '涨停和炸板数、连板梯队、首次封板时间分布、股票池计数。' },
  { title: '历史复盘', text: '按日期回看以上数据，以及开盘五分钟统计。' },
  { title: '事件日历', text: '未来两周的宏观数据和事件日程。' },
]

// 坐标映射：示例数据的 RS 比率 / 动量，画在 480×360 的绘图区
const pts = ind.data.items
const trailPts = ser.data.points
const allX = [...pts.map((p) => p.rs_ratio), ...trailPts.map((p) => p.rs_ratio)]
const allY = [...pts.map((p) => p.rs_momentum), ...trailPts.map((p) => p.rs_momentum)]
const span = (a) => { const d = Math.max(Math.max(...a) - 100, 100 - Math.min(...a)) * 1.1; return [100 - d, 100 + d] }
const [X0, X1] = span(allX), [Y0, Y1] = span(allY)
const sx = (v) => 40 + ((v - X0) / (X1 - X0)) * 480
const sy = (v) => 380 - ((v - Y0) / (Y1 - Y0)) * 360
const dots = pts.map((p) => ({ x: sx(p.rs_ratio), y: sy(p.rs_momentum) }))
const endPt = trailPts[trailPts.length - 1]
const end = { x: sx(endPt.rs_ratio), y: sy(endPt.rs_momentum) }

const hero = ref(null)
const xh = reactive({ on: false, x: 0, y: 0, vx: '', vy: '' })
let raf = 0
function onMove(e) {
  if (!finePointer() || reducedMotion()) return
  const svg = hero.value?.querySelector('.plot')
  if (!svg || raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    const r = svg.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 560, y = ((e.clientY - r.top) / r.height) * 420
    if (x < 40 || x > 520 || y < 20 || y > 380) { xh.on = false; return }
    Object.assign(xh, { on: true, x, y, vx: (X0 + ((x - 40) / 480) * (X1 - X0)).toFixed(2), vy: (Y0 + ((380 - y) / 360) * (Y1 - Y0)).toFixed(2) })
  })
}
</script>

<style scoped>
.lp { min-height: 100vh; background: var(--c-bg); }
.wrap { position: relative; isolation: isolate; max-width: 1440px; margin: 0 auto; padding: 0 48px; }
.gridlines { --gm: 48px; }
.top { position: sticky; top: 0; z-index: 20; border-bottom: 1px solid var(--c-line); background: color-mix(in srgb, var(--c-bg) 84%, transparent); backdrop-filter: saturate(1.2) blur(12px); }
.row { display: flex; align-items: center; gap: 32px; height: 60px; }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 600; letter-spacing: .02em; }
.links { display: flex; gap: 24px; font-size: var(--fs-sm); color: var(--c-ink-2); }
.links a { position: relative; padding: 4px 0; transition: color var(--dur-fast) var(--ease); }
.links a::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--c-accent); transform: scaleX(0); transform-origin: left; transition: transform var(--dur-base) var(--ease); }
.links a:hover { color: var(--c-ink); } .links a:hover::after { transform: scaleX(1); }
.acts { margin-left: auto; display: flex; align-items: center; gap: 8px; }

.hero { border-bottom: 1px solid var(--c-line); overflow: hidden; }
.hgrid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); column-gap: 24px; align-items: center; min-height: min(calc(100svh - 61px), 860px); padding-top: 64px; padding-bottom: 64px; }
.copy { grid-column: 1 / span 6; }
h1 { margin-top: 20px; font: 700 clamp(36px, 4.3vw, 68px)/1.08 var(--font-display); letter-spacing: -0.02em; }
h1 span { white-space: nowrap; }
h1 span { display: block; animation: lift var(--dur-draw) var(--ease) both; }
h1 .l2 { color: var(--c-ink-2); animation-delay: 80ms; }
.desc { margin-top: 24px; max-width: 34em; font-size: var(--fs-base); line-height: 28px; color: var(--c-ink-2); }
.cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
.spec { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 48px; border-top: 1px solid var(--c-line-strong); }
.spec div { padding: 12px 16px 0 0; }
.spec dt { font-size: var(--fs-xs); color: var(--c-accent); font-weight: 500; }
.spec dd { margin-top: 4px; font-size: var(--fs-sm); color: var(--c-ink-2); }

.inst { grid-column: 7 / span 6; position: relative; }
.inst { margin-bottom: 40px; }
.inst-frame { position: relative; border: 1px solid var(--c-line-strong); border-radius: var(--r-lg); background: var(--c-surface); box-shadow: var(--shadow-2); padding: 16px 16px 40px; }
.plot { width: 100%; height: auto; }
.ticks path { stroke: var(--c-line); stroke-width: 1; }
.axis { stroke: var(--c-ink-2); fill: none; stroke-width: 1; }
.ref { stroke: var(--c-line-strong); fill: none; }
.tl { font: 10px var(--font-mono); fill: var(--c-muted); }
.dots circle { fill: var(--c-ink-2); opacity: 0; animation: pop var(--dur-slow) var(--ease) forwards; }
.trace path.tr { stroke: var(--c-accent); stroke-width: 1.2; fill: none; stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1.1s var(--ease) .9s forwards; }
.trace .end, .trace .rd, .trace .ax-v { opacity: 0; animation: fade var(--dur-slow) var(--ease) 1.8s forwards; }
.ax-v { font: 500 10px var(--font-mono); fill: var(--c-accent); }
.ref { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1s var(--ease) .2s forwards; }
.end { fill: var(--c-surface); stroke: var(--c-accent); stroke-width: 2; }
.rd { font: 500 11px var(--font-mono); fill: var(--c-accent); }
.xh { stroke: var(--c-accent); stroke-width: .8; opacity: .7; }
.readout { position: absolute; left: 16px; right: 16px; bottom: 12px; display: flex; gap: 16px; font-size: 10.5px; color: var(--c-muted); }
.readout .live, .readout span:last-child { margin-left: auto; color: var(--c-ink-2); }
.sample { position: absolute; right: 16px; bottom: -40px; width: 272px; padding: 14px 16px; border: 1px solid var(--c-line-strong); border-radius: var(--r-md); background: var(--c-surface); box-shadow: var(--shadow-pop); animation: lift var(--dur-draw) var(--ease) .3s both; }
.sample::before { content: ''; position: absolute; left: -1px; top: 12px; bottom: 12px; width: 2px; background: var(--c-accent); }
.s-top { display: flex; align-items: center; gap: 6px; } .s-top .d { margin-left: auto; font-size: 10.5px; color: var(--c-muted); }
.s-val { display: flex; align-items: baseline; gap: 6px; margin-top: 12px; font-size: 32px; line-height: 36px; font-weight: 500; letter-spacing: -0.02em; }
.s-val span:not(.num) { font: 500 var(--fs-xs)/1 var(--font-sans); color: var(--c-muted); }
.s-val em { margin-left: auto; font-style: normal; font-size: 10.5px; color: var(--c-ink-2); letter-spacing: 0; }
.s-stmt { margin-top: 8px; font-size: var(--fs-sm); }
.s-src { display: flex; justify-content: space-between; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--c-line); font-size: 10.5px; color: var(--c-muted); }
figcaption { margin-top: 12px; max-width: calc(100% - 290px); font-size: var(--fs-2xs); line-height: var(--lh-2xs); color: var(--c-muted); }

.sec { border-bottom: 1px solid var(--c-line); }
.g12 { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); column-gap: 24px; padding-top: 96px; padding-bottom: 96px; }
.sec-h { grid-column: 1 / span 4; align-self: start; position: sticky; top: 96px; }
h2 { margin-top: 12px; font: 700 var(--fs-2xl)/var(--lh-2xl) var(--font-display); letter-spacing: -0.01em; }
.sec-d { margin-top: 16px; color: var(--c-ink-2); font-size: var(--fs-md); line-height: 24px; max-width: 28em; }
.index { grid-column: 6 / span 7; border-top: 1px solid var(--c-line-strong); }
.index li { display: grid; grid-template-columns: 48px 200px minmax(0, 1fr); gap: 16px; align-items: baseline; padding: 20px 0; border-bottom: 1px solid var(--c-line); transition: padding var(--dur-base) var(--ease); }
.index li:hover { padding-left: 8px; }
.ix { font-size: var(--fs-xs); color: var(--c-muted); transition: color var(--dur-fast) var(--ease); }
.index li:hover .ix { color: var(--c-accent); }
.index h3 { font-size: var(--fs-lg); line-height: var(--lh-lg); font-weight: 600; }
.index p { font-size: var(--fs-sm); line-height: 22px; color: var(--c-ink-2); }
.rules { grid-column: 6 / span 7; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--c-line-strong); }
.rule { padding: 20px 20px 0 0; }
.rule + .rule { padding-left: 20px; border-left: 1px solid var(--c-line); }
.r-n { font-size: var(--fs-xs); color: var(--c-accent); font-weight: 500; }
.rule h3 { margin-top: 24px; font-size: var(--fs-base); font-weight: 600; }
.rule p:last-child { margin-top: 8px; font-size: var(--fs-sm); line-height: 22px; color: var(--c-ink-2); }
.steps { grid-column: 6 / span 7; border-top: 1px solid var(--c-line-strong); }
.steps li { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--c-line); font-size: var(--fs-md); line-height: 24px; }
.steps span { color: var(--c-muted); font-size: var(--fs-xs); }
.cta.end { grid-column: 6 / span 7; }
.foot { padding: 32px 0 48px; font-size: var(--fs-xs); line-height: var(--lh-xs); color: var(--c-muted); }
.foot p { max-width: 72em; }
.fl { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-top: 12px; }
.fl a:hover { color: var(--c-ink); text-decoration: underline; text-underline-offset: 3px; }

@keyframes lift { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes pop { from { opacity: 0; } to { opacity: .55; } }
@keyframes draw { to { stroke-dashoffset: 0; } }
@keyframes fade { to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  h1 span, .sample { animation: none; }
  .dots circle { animation: none; opacity: .55; } .trace path.tr, .ref { animation: none; stroke-dashoffset: 0; } .trace .end, .trace .rd, .trace .ax-v { animation: none; opacity: 1; }
}

@media (max-width: 1199px) {
  .copy { grid-column: 1 / span 12; } .inst { grid-column: 1 / span 12; margin-top: 48px; }
  .hgrid { min-height: 0; }
  .sec-h { grid-column: 1 / span 12; position: static; margin-bottom: 32px; }
  .index, .rules, .steps, .cta.end { grid-column: 1 / span 12; }
  .sample { right: 16px; }
}
@media (max-width: 767px) {
  .wrap { padding: 0 16px; } .gridlines { --cols: 4; --gutter: 16px; --gm: 16px; } .gridlines > i:nth-child(n + 5) { display: none; }
  .row { gap: 12px; height: 56px; } .links, .login { display: none; }
  .hgrid { padding-top: 40px; padding-bottom: 40px; }
  h1 { font-size: 36px; line-height: 42px; }
  .desc { font-size: var(--fs-md); line-height: 24px; }
  .cta .btn { flex: 1; }
  .spec { margin-top: 32px; } .spec dd { font-size: var(--fs-xs); }
  .inst { margin-top: 32px; } .inst-frame { padding: 8px 8px 36px; }
  .sample { position: relative; right: auto; bottom: auto; width: auto; margin: 8px 0 0; box-shadow: none; }
  figcaption { max-width: none; } .inst { margin-bottom: 0; }
  .g12 { padding-top: 56px; padding-bottom: 56px; }
  h2 { font-size: var(--fs-xl); line-height: var(--lh-xl); }
  .index li { grid-template-columns: 32px minmax(0, 1fr); } .index li p { grid-column: 2; }
  .rules { grid-template-columns: minmax(0, 1fr); } .rule, .rule + .rule { padding: 16px 0; border-left: 0; border-bottom: 1px solid var(--c-line); } .rule h3 { margin-top: 8px; }
}
</style>
