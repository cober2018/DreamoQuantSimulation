<template>
  <div class="landing">
    <a class="skip" href="#lp-main">跳到正文</a>
    <header class="bar">
      <div class="wrap bar-in">
        <a href="/landing" class="wordmark" aria-label="知数星耀">
          <svg width="26" height="26" viewBox="0 0 28 28" aria-hidden="true">
            <path d="M3 19h22M3 14h15M3 9h22" stroke="currentColor" stroke-width="1.6" />
            <circle cx="21.5" cy="14" r="2.2" fill="var(--accent)" />
          </svg>
          <span>知数星耀</span>
        </a>
        <nav class="bar-nav" aria-label="介绍页">
          <a class="ink-link" href="#anatomy">一条要点</a>
          <a class="ink-link" href="#contents">栏目</a>
          <ThemeToggle />
          <RouterLink id="lp-login" class="btn sm" to="/">登录</RouterLink>
        </nav>
      </div>
    </header>

    <main id="lp-main">
      <section class="hero" aria-labelledby="lp-h1">
        <div class="wrap hero-in">
          <div class="hero-copy">
            <p class="eyebrow reveal">A 股盘后数据 · 每个交易日更新</p>
            <h1 id="lp-h1" class="h1">
              <span class="ln rise" style="--i: 1">盘后的事实，</span>
              <span class="ln rise" style="--i: 2">排好版，</span>
              <span class="ln rise" style="--i: 3"><span class="under">注明出处<i class="draw" style="--i: 6" aria-hidden="true" /></span>。</span>
            </h1>
            <p class="lead rise" style="--i: 4">
              知数星耀把 A 股盘后数据整理成每天几条可核对的统计事实：成交、资金、板块、涨停、衍生品和事件日程里，偏离常态最明显的几处。每条写明数据日期和口径，点开就能看到原始数据。
            </p>
            <div class="cta reveal" style="--i: 5">
              <RouterLink id="lp-register" class="btn primary lg" to="/">免费注册</RouterLink>
              <RouterLink class="btn lg" to="/">已有账号，登录</RouterLink>
            </div>
            <p class="fine reveal" style="--i: 6">只提供数据与历史统计，不构成投资建议。</p>
          </div>

          <figure class="sheet reveal" style="--i: 3" aria-label="今日要点样张，2026 年 11 月 4 日真实回放数据">
            <div class="sheet-h">
              <span class="serif sh-t">今日要点</span>
              <span class="num sh-d">2026-11-04 · 星期三</span>
            </div>
            <ol class="sheet-list">
              <li v-for="(f, i) in sample" :key="i" class="reveal" :style="{ '--i': 5 + i }">
                <span class="sl-no serif num">{{ String(i + 1).padStart(2, '0') }}</span>
                <span class="sl-k">{{ f.kind }}</span>
                <p class="sl-s serif">
                  <template v-for="(s, j) in segments(f.statement)" :key="j"><em v-if="s.num" class="v num" :class="{ hl: s.lead }">{{ s.t }}</em><template v-else>{{ s.t }}</template></template><sup>{{ i + 1 }}</sup>
                </p>
                <i class="sl-rule draw" :style="{ '--i': 6 + i }" aria-hidden="true" />
              </li>
            </ol>
            <figcaption class="sheet-notes">
              <p v-for="(f, i) in sample" :key="i"><sup>{{ i + 1 }}</sup> {{ f.source }} · 数据日 {{ f.data_date }}</p>
              <p class="sheet-src">样张取自 2026-11-04 真实回放数据，按固定规则计算，标注为「统计」。</p>
            </figcaption>
          </figure>
        </div>
      </section>

      <section id="anatomy" class="anat" aria-labelledby="lp-h2">
        <div class="wrap">
          <header class="sec-h">
            <span class="sec-no serif num">§ 1</span>
            <h2 id="lp-h2">一条要点，六样东西</h2>
            <p class="sec-d">不用大模型自由写。每条按固定模板生成，带着能核对的全部信息。</p>
          </header>

          <div class="specimen" aria-hidden="true">
            <span class="sp-k"><b class="mk">1</b>◆ 极值</span>
            <p class="sp-s serif">
              <b class="mk">2</b>中证1000 股指期货持仓成交比的 60 日标准分为
              <b class="mk">3</b><span class="sp-v num">+3.05</span><sup class="sp-fn">1<b class="mk">5</b></sup>
            </p>
            <p class="sp-meta"><span class="tag solid"><b class="mk mk-on">6</b>统计</span> 参与度与资金环境 · 衍生品统计 · <span class="num"><b class="mk">4</b>数据日 2026-11-04</span></p>
          </div>

          <dl class="parts">
            <div v-for="(p, i) in PARTS" :key="p.t" class="part">
              <dt><span class="pn num">{{ i + 1 }}</span>{{ p.t }}</dt>
              <dd>{{ p.d }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="contents" class="toc" aria-labelledby="lp-h3">
        <div class="wrap">
          <header class="sec-h">
            <span class="sec-no serif num">§ 2</span>
            <h2 id="lp-h3">栏目</h2>
            <p class="sec-d">要点是首页；下面六页是下钻层，每页顶部标出数据日期，指标附定义。</p>
          </header>
          <ol class="toc-list">
            <li v-for="(s, i) in TOC" :key="s.t">
              <span class="toc-no serif num">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="toc-t serif">{{ s.t }}</span>
              <span class="toc-lead" aria-hidden="true" />
              <span class="toc-d">{{ s.d }}</span>
            </li>
          </ol>
        </div>
      </section>
    </main>

    <footer class="foot">
      <div class="wrap">
        <p>{{ LEGAL }}</p>
        <p class="links">
          <span>知数星耀 · DreamOTech</span>
          <a class="ink-link" href="#terms">用户协议与隐私政策</a>
          <a class="ink-link" href="https://www.dreamotech.cn/" rel="noopener" target="_blank">梦氧科技官网</a>
          <a class="ink-link" href="https://beian.miit.gov.cn/" rel="noopener" target="_blank">浙ICP备2024135110号</a>
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import ThemeToggle from '../components/ThemeToggle.vue'
import { dayOf, segments, LEGAL } from '../lib/brief.js'

const sample = dayOf('2026-11-04').facts.filter((f) => !f.statement.includes('名称相同')).slice(0, 4)
const PARTS = [
  { t: '类型', d: '极值、变化、连续、背离、排名，五类之一。同一类每天最多两条，避免一类刷屏。' },
  { t: '陈述', d: '固定模板生成，模板里没有建议性的词；上线前做禁用词扫描。' },
  { t: '数值与参照', d: '当前值和它的参照系：近 60 日分位、标准分、前一交易日。' },
  { t: '数据日期', d: '每条都标数据日。某天没取到数据就如实写，不拿其他日期代替。' },
  { t: '口径', d: '中文口径名和定义写在脚注里；点开落到明细页对应的指标。' },
  { t: '统计', d: '按规则算出来的事实，不是判断。AI 整理的内容会单独标「AI 整理」。' },
]
const TOC = [
  { t: '今日要点', d: '5–8 条偏离常态的统计事实，加明日日程' },
  { t: '市场总览', d: '主要指数涨跌、涨跌家数、成交额' },
  { t: '参与度与资金环境', d: '成交分位、主动卖出占比、衍生品统计、风格强弱' },
  { t: '行业比较与轮动', d: '板块涨跌、成交、资金净流入、相对强度' },
  { t: '题材与涨跌结构', d: '涨停和炸板、连板梯队、封板时间' },
  { t: '历史复盘', d: '按日期回看，开盘五分钟统计' },
  { t: '事件日历', d: '未来两周的宏观数据和事件日程' },
]
</script>

<style scoped>
.landing { min-height: 100vh; }
.wrap { max-width: 1240px; margin: 0 auto; padding: 0 var(--sp-6); }
.skip { position: absolute; left: -999px; top: 8px; z-index: 50; background: var(--ink); color: var(--paper); padding: 8px 12px; }
.skip:focus { left: 8px; }

.bar { border-bottom: 1px solid var(--rule); }
.bar-in { display: flex; justify-content: space-between; align-items: center; height: 64px; }
.wordmark { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; font: 800 var(--fs-xl)/1 var(--font-serif); letter-spacing: .08em; }
.bar-nav { display: flex; align-items: center; gap: var(--sp-5); font-size: var(--fs-sm); }

/* 账本纸：32px 基线网格 + 一条页边线 */
.hero {
  position: relative; overflow: hidden;
  background-image: repeating-linear-gradient(to bottom, transparent 0 31px, color-mix(in srgb, var(--rule) 55%, transparent) 31px 32px);
  border-bottom: 2px solid var(--rule-strong);
}
.hero::before { content: ''; position: absolute; top: 0; bottom: 0; left: max(16px, calc(50% - 620px + 12px)); width: 1px; background: color-mix(in srgb, var(--accent) 45%, transparent); }
.hero-in { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: var(--sp-8); align-items: center; padding-top: var(--sp-9); padding-bottom: var(--sp-9); }
.hero-copy { display: grid; gap: var(--sp-5); }
.hero-copy .lead { margin-top: var(--sp-3); }
.h1 { font-size: clamp(40px, 6.4vw, 88px); font-weight: 900; line-height: 1.12; letter-spacing: .02em; }
.ln { display: block; }
.under { position: relative; white-space: nowrap; }
.under i { position: absolute; left: 0; right: 0; bottom: -.08em; height: .08em; background: var(--accent); }
.lead { font: 400 var(--fs-lg)/1.8 var(--font-serif); color: var(--ink-2); max-width: 32em; }
.cta { display: flex; flex-wrap: wrap; gap: var(--sp-3); }
.btn.lg { height: 48px; padding: 0 var(--sp-5); font-size: var(--fs-base); }
.fine { font-size: var(--fs-xs); color: var(--ink-3); }

.sheet {
  margin: 0; background: var(--sheet); border: 1px solid var(--rule); box-shadow: var(--shadow-3);
  padding: var(--sp-5) var(--sp-5) var(--sp-4); transform: rotate(-.6deg);
}
.sheet-h { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: var(--sp-2); border-bottom: 2px solid var(--rule-strong); }
.sh-t { font-size: var(--fs-xl); font-weight: 800; }
.sh-d { font-size: var(--fs-xs); color: var(--ink-3); }
.sheet-list { list-style: none; margin: 0; padding: 0; }
.sheet-list li { position: relative; display: grid; grid-template-columns: 28px 1fr; column-gap: var(--sp-3); padding: var(--sp-3) 0; }
.sl-no { grid-row: span 2; font-size: var(--fs-lg); color: var(--ink-3); font-weight: 600; }
.sl-k { font-size: var(--fs-2xs); color: var(--accent); font-weight: 600; letter-spacing: .08em; }
.sl-s { font-size: var(--fs-md); line-height: 1.6; font-weight: 600; }
.sl-s sup { color: var(--accent); font: 600 10px/0 var(--font-sans); margin-left: 1px; }
.sl-rule { position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--rule); }
.v { font-style: normal; color: var(--accent); }
.v.hl { background: linear-gradient(var(--mark), var(--mark)) 0 88% / 100% 36% no-repeat; }
.sheet-notes { margin-top: var(--sp-3); display: grid; gap: 2px; font-size: var(--fs-2xs); color: var(--ink-3); line-height: 1.6; }
.sheet-notes sup { color: var(--accent); font-weight: 600; }
.sheet-src { margin-top: var(--sp-2); padding-top: var(--sp-2); border-top: 1px dashed var(--rule); }

.sec-h { display: grid; grid-template-columns: auto 1fr; column-gap: var(--sp-4); row-gap: var(--sp-2); align-items: baseline; padding-bottom: var(--sp-5); border-bottom: 1px solid var(--rule-strong); }
.sec-no { font-size: var(--fs-xl); color: var(--accent); font-weight: 600; }
.sec-h h2 { font-size: var(--fs-4xl); font-weight: 900; }
.sec-d { grid-column: 2; font: 400 var(--fs-lg)/1.6 var(--font-serif); color: var(--ink-2); }

.anat { padding: var(--sp-9) 0 var(--sp-8); }
.specimen { padding: var(--sp-7) 0 var(--sp-6); border-bottom: 1px solid var(--rule); display: grid; gap: var(--sp-4); }
.sp-k { font-size: var(--fs-sm); color: var(--accent); font-weight: 600; letter-spacing: .08em; display: inline-flex; align-items: center; gap: 6px; }
.sp-s { font-size: clamp(24px, 3.4vw, 44px); font-weight: 600; line-height: 1.4; max-width: 22em; }
.sp-v { position: relative; color: var(--accent); background: linear-gradient(var(--mark), var(--mark)) 0 88% / 100% 34% no-repeat; }
.sp-fn { color: var(--accent); font: 600 .4em/0 var(--font-sans); position: relative; }
.sp-meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); font-size: var(--fs-sm); color: var(--ink-3); }
.mk {
  display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%;
  border: 1px solid var(--accent); color: var(--accent); background: var(--paper);
  font: 700 11px/1 var(--font-sans); vertical-align: middle; margin-right: 4px;
}
.sp-s .mk { vertical-align: .9em; margin: 0 2px 0 4px; }
.sp-fn .mk { vertical-align: 0; }
.mk-on { background: var(--ink); border-color: var(--paper); color: var(--paper); }
.parts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 var(--sp-6); margin: 0; }
.part { padding: var(--sp-4) 0; border-bottom: 1px solid var(--rule); }
.part dt { font: 600 var(--fs-lg)/1.4 var(--font-serif); display: flex; align-items: center; gap: var(--sp-2); }
.pn { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--accent); color: var(--accent); font: 700 12px/1 var(--font-sans); }
.part dd { margin: var(--sp-2) 0 0 30px; color: var(--ink-2); line-height: 1.7; font-size: var(--fs-md); }

.toc { padding: 0 0 var(--sp-9); }
.toc-list { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: var(--sp-8); }
.toc-list li { break-inside: avoid; display: grid; grid-template-columns: 36px auto 1fr; grid-template-rows: auto auto; column-gap: var(--sp-2); align-items: baseline; padding: var(--sp-4) 0; border-bottom: 1px solid var(--rule); }
.toc-no { color: var(--ink-3); font-weight: 600; }
.toc-t { font-size: var(--fs-xl); font-weight: 600; }
.toc-lead { border-bottom: 1px dotted var(--ink-3); transform: translateY(-4px); }
.toc-d { grid-column: 2 / -1; font-size: var(--fs-sm); color: var(--ink-3); margin-top: 4px; }

.foot { border-top: 2px solid var(--rule-strong); padding: var(--sp-5) 0 var(--sp-6); font-size: var(--fs-xs); color: var(--ink-3); }
.foot p { line-height: 1.7; max-width: 72em; }
.links { display: flex; flex-wrap: wrap; gap: var(--sp-4); margin-top: var(--sp-2); }

@media (max-width: 1080px) {
  .hero-in { grid-template-columns: 1fr; gap: var(--sp-7); padding-top: var(--sp-8); padding-bottom: var(--sp-8); }
  .sheet { max-width: 560px; }
  .parts { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 760px) {
  .wrap { padding: 0 var(--sp-4); }
  .bar-nav .ink-link { display: none; }
  .bar-nav { gap: var(--sp-2); }
  .hero::before { left: 8px; }
  .hero-in { padding-top: var(--sp-7); padding-bottom: var(--sp-7); gap: var(--sp-6); }
  .h1 { font-size: 40px; }
  .lead { font-size: var(--fs-base); }
  .sheet { transform: none; padding: var(--sp-4); }
  .sec-h { grid-template-columns: 1fr; }
  .sec-h h2 { font-size: var(--fs-3xl); }
  .sec-d { grid-column: 1; font-size: var(--fs-base); }
  .anat { padding: var(--sp-8) 0 var(--sp-7); }
  .parts { grid-template-columns: 1fr; }
  .toc-list { columns: 1; }
}
</style>
