<template>
  <MpFrame title="行业比较与轮动" tab="ind">
    <div class="head">
      <div class="seg" role="tablist" aria-label="板块类型">
        <button v-for="t in src.data.idx_types" :key="t" role="tab" type="button" :aria-selected="t === idx" :class="{ on: t === idx }" @click="idx = t">{{ t.replace('板块', '') }}</button>
      </div>
      <p class="meta tnum">数据日期 {{ src.trade_date }} · 金额 亿元 · <span class="badge sample">示例数据</span></p>
    </div>

    <section class="pf"><span class="badge stat">统计</span><p>单日资金净流入最多的是 <b class="up tnum">{{ top.sector_name }} {{ sg(top.net_flow_1d) }} 亿</b>，最少的是 <b class="down tnum">{{ bot.sector_name }} {{ sg(bot.net_flow_1d) }} 亿</b>。</p></section>

    <div class="chips" role="group" aria-label="排序">
      <button v-for="s in SORTS" :id="'mp-sort-' + s.key" :key="s.key" type="button" :aria-pressed="key === s.key" :class="{ on: key === s.key }" @click="key = s.key">{{ s.label }}<span aria-hidden="true">{{ key === s.key ? ' ↓' : '' }}</span></button>
    </div>

    <StatePanel v-if="!list.length" kind="nodate" compact desc="示例数据只含行业板块。正式版这里显示所选类型的数据，所选日期没有数据时如实提示。" />
    <ul v-else class="rows">
      <li v-for="r in list" :key="r.sector_code">
        <button type="button" class="row" :aria-expanded="open === r.sector_code" @click="open = open === r.sector_code ? '' : r.sector_code">
          <span class="nm">{{ r.sector_name }}</span>
          <span class="bar" aria-hidden="true"><i :style="barStyle(r[key])" /></span>
          <span class="v tnum" :class="tone(r[key])">{{ fmt(r[key]) }}</span>
        </button>
        <dl v-if="open === r.sector_code" class="detail tnum">
          <div><dt>涨跌幅</dt><dd :class="tone(r.sector_return)">{{ pc(r.sector_return) }}%</dd></div>
          <div><dt>成交额</dt><dd>{{ r.amount.toFixed(1) }} 亿</dd></div>
          <div><dt>换手率</dt><dd>{{ r.turnover_rate.toFixed(2) }}%</dd></div>
          <div><dt>5 日净流入</dt><dd :class="tone(r.net_flow_5d)">{{ sg(r.net_flow_5d) }} 亿</dd></div>
          <div><dt>站上 20 日线</dt><dd>{{ (r.above_ma20_ratio * 100).toFixed(1) }}%</dd></div>
          <div><dt>RS 比值 / 动量</dt><dd>{{ r.rs_ratio.toFixed(1) }} / {{ r.rs_momentum.toFixed(1) }}</dd></div>
        </dl>
      </li>
    </ul>
    <p class="disc">本页为示例数据，仅用于比较视觉方向。{{ src.disclaimer }}</p>
  </MpFrame>
</template>

<script setup>
import { computed, ref } from 'vue'
import MpFrame from './MpFrame.vue'
import StatePanel from '../../components/StatePanel.vue'
import src from '@data/industries-sample.json'

const SORTS = [{ key: 'net_flow_1d', label: '净流入' }, { key: 'sector_return', label: '涨跌幅' }, { key: 'above_ma20_ratio', label: '站上 20 日线' }]
const idx = ref(src.data.idx_type), key = ref('net_flow_1d'), open = ref('')
const items = computed(() => src.data.items.filter((r) => r.idx_type === idx.value))
const list = computed(() => [...items.value].sort((a, b) => b[key.value] - a[key.value]))
const sorted = computed(() => [...src.data.items].sort((a, b) => b.net_flow_1d - a.net_flow_1d))
const top = computed(() => sorted.value[0]), bot = computed(() => sorted.value[sorted.value.length - 1])
const sg = (v) => (v > 0 ? '+' : '') + v.toFixed(1)
const pc = (v) => (v > 0 ? '+' : '') + (v * 100).toFixed(2)
const fmt = (v) => (key.value === 'net_flow_1d' ? sg(v) : key.value === 'sector_return' ? pc(v) + '%' : (v * 100).toFixed(1) + '%')
const tone = (v) => (key.value === 'above_ma20_ratio' && v === undefined ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '')
const max = computed(() => Math.max(...list.value.map((r) => Math.abs(r[key.value]))))
function barStyle(v) {
  const w = (Math.abs(v) / max.value) * 50
  const color = key.value === 'above_ma20_ratio' ? 'var(--c-star-dim)' : v >= 0 ? 'var(--c-up)' : 'var(--c-down)'
  return key.value === 'above_ma20_ratio' ? { left: '0', width: w * 2 + '%', background: color } : v >= 0 ? { left: '50%', width: w + '%', background: color } : { right: '50%', width: w + '%', background: color }
}
</script>

<style scoped lang="scss">
// uni-app 写法：rpx + tokens.scss 常量；颜色用与 Web 同名的 CSS 变量
@use '@ds/dist/tokens.scss' as *;
.head { padding: var(--s-3) var(--s-4) 0; }
.seg { display: grid; grid-template-columns: repeat(3, 1fr); padding: 6rpx; border-radius: var(--r-2); background: var(--c-surface); border: 2rpx solid var(--c-line); }
.seg button { height: 60rpx; border-radius: 12rpx; font-size: var(--fs-sm); color: var(--c-ink-2); }
.seg button.on { background: var(--c-surface-2); color: var(--c-ink); box-shadow: inset 0 -1px 0 var(--c-accent); }
.meta { margin-top: var(--s-2); display: flex; align-items: center; gap: 8rpx; font-size: var(--fs-2xs); color: var(--c-ink-3); }
.pf { margin: var(--s-3) var(--s-4) 0; padding: var(--s-3); display: flex; gap: var(--s-2); align-items: baseline; border-radius: var(--r-2); background: var(--c-surface); border: 2rpx solid var(--c-line); border-left-color: var(--c-accent); font-size: var(--fs-sm); color: var(--c-ink-2); line-height: 1.6; }
.pf .badge { flex: none; }
.chips { display: flex; gap: var(--s-2); padding: var(--s-3) var(--s-4) var(--s-2); }
.chips button { height: 56rpx; padding: 0 var(--s-3); border-radius: var(--r-pill); border: 2rpx solid var(--c-line); font-size: var(--fs-xs); color: var(--c-ink-2); }
.chips button.on { border-color: var(--c-accent); color: var(--c-accent-ink); background: var(--c-accent-soft); }
.rows { margin: 0 var(--s-3); border-radius: var(--r-3); background: var(--c-surface); border: 2rpx solid var(--c-line); overflow: hidden; }
.rows li + li { border-top: 2rpx solid var(--c-line); }
.row { width: 100%; display: grid; grid-template-columns: 192rpx 1fr 144rpx; align-items: center; gap: var(--s-3); height: 96rpx; padding: 0 var(--s-4); text-align: left; }
.row:active { background: var(--c-surface-hover); }
.nm { font-size: var(--fs-sm); color: var(--c-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bar { position: relative; height: 8rpx; background: linear-gradient(90deg, transparent calc(50% - 1rpx), var(--c-line-strong) 0, var(--c-line-strong) calc(50% + 1rpx), transparent 0); }
.bar i { position: absolute; top: 0; bottom: 0; border-radius: 2rpx; opacity: 0.85; }
.v { text-align: right; font-size: var(--fs-sm); font-weight: 600; color: var(--c-ink); }
.detail { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-2) var(--s-4); padding: 0 var(--s-4) var(--s-4); }
.detail div { display: flex; justify-content: space-between; font-size: var(--fs-xs); }
.detail dt { color: var(--c-ink-3); }
.detail dd { margin: 0; color: var(--c-ink); }
.disc { margin: var(--s-4) var(--s-4) 0; font-size: var(--fs-2xs); color: var(--c-ink-3); line-height: 1.6; }
</style>
