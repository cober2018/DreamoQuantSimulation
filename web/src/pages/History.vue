<template>
  <PageFrame title="历史复盘" question="某一天的数据和历史对比是什么？" :env="env" :loading="loading" @retry="load" @jump="tradeDate = $event">
    <template #tools>
      <input type="date" v-model="tradeDate" aria-label="交易日" />
    </template>

    <section class="panel" id="history-brief" aria-labelledby="history-brief-title">
      <h2 id="history-brief-title">当日要点回看<small>那一天有哪些不寻常</small></h2>
      <p class="placeholder">即将推出</p>
    </section>

    <section v-if="open5" class="panel" id="history-open5" aria-labelledby="history-open5-title" v-module="'open5'">
      <h2 id="history-open5-title">开盘五分钟<small>开盘时上涨的个股占多少，开盘方向是否延续到收盘</small><DateTag :date="open5.trade_date" :page-date="env.trade_date" /></h2>
      <div class="grid">
        <div class="stat" v-ind="'history.open5.coverage_ratio'"><div class="label">覆盖率</div><div :class="['value', open5Partial && 'muted']">{{ ratioOrPending(open5.coverage_ratio) }}</div>
          <div class="sub">{{ fmt.num(open5.open5_ready_count, 0) }} / {{ fmt.num(open5.expected_stock_count, 0) }}</div></div>
        <div class="stat" v-ind="'history.open5.positive_open5_ratio'"><div class="label">开盘 5 分钟为正占比</div><div :class="['value', open5Partial && 'muted']">{{ ratioOrPending(open5.positive_open5_ratio) }}</div>
          <div class="sub">分母 {{ fmt.num(open5.open5_ready_count, 0) }}</div></div>
        <div class="stat" v-ind="'history.open5.continuation_ratio'"><div class="label">收盘延续占比</div><div :class="['value', open5Partial && 'muted']">{{ ratioOrPending(open5.continuation_ratio) }}</div>
          <div class="sub">分母 {{ fmt.num(open5.close_ready_count, 0) }}</div></div>
        <div class="stat" v-ind="'history.open5.over_response_ratio'"><div class="label">过度反应占比</div><div :class="['value', open5Partial && 'muted']">{{ ratioOrPending(open5.over_response_ratio) }}</div>
          <div class="sub">分母 {{ fmt.num(open5.close_ready_count, 0) }}</div></div>
      </div>
      <p v-if="open5Partial" class="note">覆盖不全，仅供参考。</p>
      <p class="note">数据不完整的股票不计入分子，也不计入占比分母；覆盖率反映数据完整程度，不代表市场表现。</p>
    </section>

    <section class="panel" id="history-flow" aria-labelledby="history-flow-title" v-module="'flow'">
      <h2 id="history-flow-title">行业资金净流入排行<small>净流入最多与净流出最多的行业，单位亿元</small></h2>
      <div class="toolbar">
        <div class="seg" role="group" aria-label="统计周期">
          <button v-for="p in PERIODS" :key="p.v" :class="{ on: period === p.v }" :aria-pressed="period === p.v" @click="period = p.v">{{ p.l }}</button>
        </div>
      </div>
      <p v-if="belowFloor(day)" class="placeholder" id="history-flow-pending">数据待更新（行业数据从 {{ INDUSTRY_FLOOR }} 起提供）</p>
      <p v-else-if="!divergingRows.length" class="placeholder">没有可用的资金流数据。</p>
      <EChart v-else :option="rankOption" :height="Math.max(240, divergingRows.length * 22) + 'px'" />
    </section>

    <section class="panel" id="history-leaders" aria-labelledby="history-leaders-title">
      <h2 id="history-leaders-title">领涨行业 5 日走势<small>当日涨幅最大的 3 个行业，之前几天是否也在涨</small></h2>
      <p v-if="belowFloor(day)" class="placeholder" id="history-leaders-pending">数据待更新（行业数据从 {{ INDUSTRY_FLOOR }} 起提供）</p>
      <div v-else-if="!can('page.industries')" class="lock-card">领涨行业需要行业页权限。</div>
      <p v-else-if="!leaderCharts.length" class="placeholder">没有可用的领涨行业数据。</p>
      <div v-else class="leaders">
        <article v-for="c in leaderCharts" :key="c.code" class="leader" :id="'history-leader-' + c.code">
          <header class="leader-head">
            <span class="leader-name">{{ c.name }}</span>
            <span class="rise">{{ fmt.pct(c.pct) }}</span>
          </header>
          <EChart v-if="c.option" :option="c.option" height="120px" />
          <p v-else class="placeholder">序列暂时无法加载。</p>
        </article>
      </div>
      <p class="note">早于下限的日期不画点。</p>
    </section>
  </PageFrame>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import PageFrame from '../components/PageFrame.vue'
import EChart from '../components/EChart.vue'
import DateTag from '../components/DateTag.vue'
import { fmt, getModule } from '../api'
import { can } from '../auth'
import { useModule } from '../useModule'
import { INDUSTRY_FLOOR, isPending } from '../lib/industryPending.js'

const PERIODS = [{ v: '1d', l: '1 日' }, { v: '5d', l: '5 日' }, { v: '20d', l: '20 日' }]
const period = ref('1d')
const tradeDate = ref('')
const { env, loading, load } = useModule('history', () => ({ idx_type: '行业板块', trade_date: tradeDate.value, period: period.value }))
const open5 = computed(() => env.value.data?.open5 || null)
// 覆盖率未满 100% 时数值灰显，提示仅供参考（ready 的正式判定待中台给出）
// 中台约定：null 表示未知，显示「数据待更新」，不能显示 0
const ratioOrPending = (v) => (v == null ? '数据待更新' : fmt.ratio(v))
const open5Partial = computed(() => open5.value?.coverage_ratio != null && open5.value.coverage_ratio < 1)
const day = computed(() => env.value.trade_date || tradeDate.value)

// isPending 只按日期判定（成交额键），这里传入非空占位行，使判定只看日期下限
const belowFloor = (d) => isPending('amount', { amount: 0 }, d)

const ranking = computed(() => (env.value.data?.flow_ranking || [])
  .filter((r) => r.net_flow != null)
  .sort((a, b) => b.net_flow - a.net_flow))
// 行数多时只取净流入前 10 和净流出前 10，避免全量行把页面撑长
const divergingRows = computed(() => (ranking.value.length > 20
  ? [...ranking.value.slice(0, 10), ...ranking.value.slice(-10)]
  : ranking.value))

const rankOption = computed(() => {
  const list = [...divergingRows.value].reverse()
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 110, right: 50, top: 10, bottom: 24 },
    xAxis: { type: 'value', name: '亿元' },
    yAxis: { type: 'category', data: list.map((r) => r.sector_name), axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar', data: list.map((r) => r.net_flow),
      itemStyle: { color: (p) => (p.value >= 0 ? '#d0342c' : '#1a8f4c') },
    }],
  }
})

const leaderOption = (points) => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 10, top: 10, bottom: 22 },
  xAxis: { type: 'category', data: points.map((p) => String(p.trade_date).slice(5)), axisLabel: { fontSize: 10 } },
  yAxis: { type: 'value', scale: true, axisLabel: { fontSize: 10, formatter: (v) => `${v}%` } },
  series: [{
    type: 'line', symbolSize: 5, connectNulls: false, itemStyle: { color: '#2f5d9b' },
    data: points.map((p) => (p.sector_return == null || belowFloor(p.trade_date) ? null : +(p.sector_return * 100).toFixed(2))),
  }],
})

// 领涨行业取板块日表（industries 列表），5 日序列沿用 industries/{code}/series
const leaderCharts = ref([])
let seq = 0
async function loadLeaders(d) {
  const token = ++seq
  leaderCharts.value = []
  if (!d || belowFloor(d) || !can('page.industries')) return
  // 用 getModule 而非 useModule：后者会覆盖本页的模块权限状态
  const list = await getModule('industries', { idx_type: '行业板块', trade_date: d })
  if (token !== seq) return
  const top = (list?.data?.items || [])
    .filter((r) => r.sector_return != null)
    .sort((a, b) => b.sector_return - a.sector_return)
    .slice(0, 3)
  const charts = await Promise.all(top.map(async (row) => {
    const s = can('data.detail')
      ? await getModule(`industries/${encodeURIComponent(row.sector_code)}/series`, { end_date: d })
      : null
    const points = s?.data?.points || []
    return { code: row.sector_code, name: row.sector_name, pct: row.sector_return, option: points.length ? leaderOption(points) : null }
  }))
  if (token !== seq) return
  leaderCharts.value = charts
}
watch(day, loadLeaders, { immediate: true })
</script>

<style scoped>
.placeholder { color: var(--muted); font-size: 13px; margin: 8px 0 0; }
.leaders { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.leader { border: 1px solid var(--line); border-radius: var(--radius); padding: 10px 12px; min-width: 0; }
.leader-head { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; margin-bottom: 4px; }
.leader-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
