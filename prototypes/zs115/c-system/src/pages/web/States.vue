<template>
  <div class="page">
    <p class="eyebrow">设计系统 · 状态</p>
    <h1 class="display">五种状态</h1>
    <p class="sub">数据页里每一块（表格、图表、卡片）都用同一个状态组件。文字只说发生了什么、用户能做什么，不拿其他日期的数据代替。</p>
    <div class="gal">
      <figure v-for="s in list" :key="s.kind" class="cell">
        <figcaption><code>{{ s.kind }}</code>{{ s.name }}</figcaption>
        <div class="frame">
          <div class="fh"><span>行业比较与轮动 · 行业板块</span><span class="tnum">数据日期 {{ s.kind === 'nodate' ? '2026-11-15' : '2026-11-04' }}</span></div>
          <StatePanel :kind="s.kind" compact :rows="5">
            <button v-if="s.kind === 'error'" class="btn sm" type="button">重试</button>
            <button v-if="s.kind === 'empty'" class="btn sm" type="button">清除筛选</button>
            <a v-if="s.kind === 'forbidden'" class="btn sm primary" href="#">查看服务等级</a>
            <button v-if="s.kind === 'nodate'" class="btn sm" type="button">选最近的交易日 11-13</button>
          </StatePanel>
        </div>
      </figure>
      <figure class="cell">
        <figcaption><code>chart · loading</code>图表加载中（ECharts 主题）</figcaption>
        <div class="frame"><div class="fh"><span>单日资金净流入</span><span class="tnum">单位 亿元</span></div><EChart :height="200" loading empty-text=" " label="图表加载态示例" /></div>
      </figure>
      <figure class="cell">
        <figcaption><code>chart · empty</code>图表无数据（ECharts 主题）</figcaption>
        <div class="frame"><div class="fh"><span>轮动位置</span><span class="tnum">数据日期 2026-11-04</span></div><EChart :height="200" empty-text="筛选后没有板块" label="图表空态示例" /></div>
      </figure>
    </div>
  </div>
</template>

<script setup>
import StatePanel from '../../components/StatePanel.vue'
import EChart from '../../components/EChart.vue'
const list = [
  { kind: 'loading', name: '加载中' },
  { kind: 'empty', name: '空' },
  { kind: 'error', name: '错误' },
  { kind: 'forbidden', name: '无权限' },
  { kind: 'nodate', name: '所选日期无数据' },
]
</script>

<style scoped>
.page { max-width: 1320px; margin: 0 auto; padding: var(--s-6) var(--s-7) var(--s-7); }
.eyebrow { font-size: var(--fs-xs); letter-spacing: 0.16em; color: var(--c-accent-ink); margin-bottom: var(--s-2); }
h1 { font-size: var(--fs-2xl); line-height: 1.1; }
.sub { margin-top: var(--s-3); color: var(--c-ink-2); font-size: var(--fs-sm); max-width: 680px; }
.gal { margin-top: var(--s-6); display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: var(--s-5); }
.cell { margin: 0; }
figcaption { display: flex; align-items: center; gap: var(--s-2); font-size: var(--fs-sm); color: var(--c-ink-2); margin-bottom: var(--s-2); }
code { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--c-accent-ink); background: var(--c-accent-soft); padding: 0 6px; border-radius: var(--r-1); }
.frame { border: 1px solid var(--c-line); border-radius: var(--r-3); background: var(--c-surface); overflow: hidden; }
.fh { display: flex; justify-content: space-between; padding: var(--s-3) var(--s-4); border-bottom: 1px solid var(--c-line); font-size: var(--fs-xs); color: var(--c-ink-3); }
@media (max-width: 640px) { .page { padding: var(--s-4); } .gal { grid-template-columns: minmax(0, 1fr); } }
</style>
