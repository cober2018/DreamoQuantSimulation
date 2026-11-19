<template>
  <div class="page">
    <div class="gridlines" aria-hidden="true"><i v-for="n in 12" :key="n"></i></div>
    <header>
      <p class="eyebrow">·· · 状态设计</p>
      <h1>五种状态</h1>
      <p class="q">每个数据面板都用同一套状态：同一个外框、同一种图形语言、同一条「不用别的日期代替」的规则。</p>
    </header>

    <div class="gal">
      <section class="panel" aria-labelledby="s1">
        <div class="panel-h"><h2 id="s1"><span class="no mono">S1</span>加载中</h2><span class="meta">骨架行 = 真实行高 36px，无布局跳动</span></div>
        <StatePanel kind="loading" title="正在加载板块数据" :rows="6" />
      </section>

      <section class="panel" aria-labelledby="s2">
        <div class="panel-h"><h2 id="s2"><span class="no mono">S2</span>空</h2><span class="meta">有数据，但筛选后为 0</span></div>
        <StatePanel kind="empty" code="EMPTY · 筛选" title="没有匹配「半导体设备」的板块" body="换个关键词，或清空搜索。数据日期不变。">
          <template #actions><button class="btn" type="button">清空筛选</button></template>
        </StatePanel>
      </section>

      <section class="panel" aria-labelledby="s3">
        <div class="panel-h"><h2 id="s3"><span class="no mono">S3</span>错误</h2><span class="meta">取数失败，说明影响范围</span></div>
        <StatePanel kind="error" code="ERROR · 取数失败 · 18:42:07" title="行业数据暂时没有取到" body="本页其余面板不受影响。已记录本次失败；可以稍后重试，或先看其他页面。">
          <template #actions><button class="btn primary" type="button">重试</button><button class="btn" type="button">查看数据就绪</button></template>
        </StatePanel>
      </section>

      <section class="panel" aria-labelledby="s4">
        <div class="panel-h"><h2 id="s4"><span class="no mono">S4</span>无权限</h2><span class="meta">只列指标名称，不露任何数值</span></div>
        <StatePanel kind="locked" code="LOCKED · 当前等级" title="近期序列属于下钻明细" body="当前账号等级不含本面板。本面板包含：单板块近 20 日资金净流入、RS 比率与动量序列。">
          <template #actions><button class="btn" type="button">查看等级说明</button></template>
        </StatePanel>
      </section>

      <section class="panel" aria-labelledby="s5">
        <div class="panel-h"><h2 id="s5"><span class="no mono">S5</span>所选日期无数据</h2><span class="meta">非交易日 / 当晚未就绪</span></div>
        <StatePanel kind="nodate" code="NO_DATA · 2026-11-17" title="所选日期 2026-11-17 暂无数据" body="当晚数据可能尚未就绪。页面不会用其他日期的数据代替。">
          <template #actions><button class="btn" type="button">查看前一交易日 2026-11-16</button></template>
        </StatePanel>
      </section>

      <section class="panel" aria-labelledby="s6">
        <div class="panel-h"><h2 id="s6"><span class="no mono">S1b</span>图表加载中</h2><span class="meta">坐标先到，数据后画</span></div>
        <div class="chart-sk" aria-busy="true" role="status"><span class="sr-only">图表加载中</span>
          <svg viewBox="0 0 520 200" preserveAspectRatio="none" aria-hidden="true">
            <g class="ax"><path v-for="y in 5" :key="y" :d="`M40 ${y * 36} H510`" /><path d="M40 8 V180 H510" class="base" /></g>
          </svg>
          <div class="bars"><i v-for="(h, i) in [40, 64, 52, 80, 36, 58, 72, 44, 66, 50]" :key="i" class="skel" :style="{ height: h + '%' }"></i></div>
        </div>
      </section>
    </div>

    <section class="panel spec" aria-labelledby="sp">
      <div class="panel-h"><h2 id="sp">状态规则</h2></div>
      <table>
        <thead><tr><th scope="col">状态</th><th scope="col">图形</th><th scope="col">强调</th><th scope="col">文案规则</th></tr></thead>
        <tbody>
          <tr><td>加载中</td><td>骨架行 / 坐标骨架</td><td class="mono">--c-sunken</td><td>不写「请稍候」以外的承诺；骨架尺寸与真实内容一致</td></tr>
          <tr><td>空</td><td>空坐标框</td><td class="mono">--c-ink-2</td><td>说清楚为什么是空，给出可做的一步</td></tr>
          <tr><td>错误</td><td>断开的数据线</td><td class="mono">--c-warn</td><td>琥珀色，不用红色：红色在 A 股界面里代表上涨</td></tr>
          <tr><td>无权限</td><td>网格中的锁</td><td class="mono">--c-accent</td><td>只列指标名称，不显示任何数值；不催促付费</td></tr>
          <tr><td>所选日期无数据</td><td>缺一格的刻度尺</td><td class="mono">--c-accent</td><td>写明日期；不拿其他日期代替；给出前一交易日入口</td></tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
<script setup>
import StatePanel from '../../components/StatePanel.vue'
</script>
<style scoped>
.page { position: relative; isolation: isolate; padding: 32px 32px 48px; max-width: var(--max-w); }
.gridlines { --gm: 32px; }
h1 { margin-top: 8px; font: 700 var(--fs-2xl)/var(--lh-2xl) var(--font-display); }
.q { margin-top: 10px; color: var(--c-muted); font-size: var(--fs-sm); max-width: 60ch; }
.gal { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-top: 32px; }
.no { display: inline-block; min-width: 32px; color: var(--c-accent); font-size: var(--fs-2xs); }
.chart-sk { position: relative; height: 216px; padding: 8px 16px; }
.chart-sk svg { position: absolute; inset: 8px 16px; width: calc(100% - 32px); height: 200px; }
.ax path { stroke: var(--c-line); fill: none; } .ax .base { stroke: var(--c-line-strong); }
.bars { position: absolute; left: 64px; right: 32px; bottom: 36px; top: 24px; display: flex; align-items: flex-end; gap: 6%; }
.bars i { flex: 1; display: block; }
.spec { margin-top: 24px; }
.spec table { width: 100%; border-collapse: collapse; font-size: var(--fs-xs); }
.spec th, .spec td { text-align: left; padding: 10px 16px; border-bottom: 1px solid var(--c-line); }
.spec th { font-weight: 500; color: var(--c-muted); font-size: var(--fs-2xs); }
.spec td.mono { font-size: var(--fs-2xs); color: var(--c-ink-2); }
@media (max-width: 960px) { .gal { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 720px) { .page { padding: 20px 16px; } .gridlines { --cols: 4; --gutter: 16px; --gm: 16px; } .gridlines > i:nth-child(n + 5) { display: none; } }
</style>
