<template>
  <PageFrame title="市场总览" question="今天市场发生了什么？" :env="env" :loading="loading" @retry="load" @jump="tradeDate = $event">
    <template #tools><input type="date" v-model="tradeDate" aria-label="交易日" /></template>
    <div class="grid">
      <div class="stat" v-ind="'overview.market.index_change_pct'">
        <div class="label">基准指数 {{ d.index_code || '' }}</div>
        <div :class="['value', fmt.dir(d.index_change_pct)]">{{ d.index_change_pct == null ? '—' : fmt.signed(d.index_change_pct) + '%' }}</div>
      </div>
      <div class="stat" v-ind="'overview.market.up_count'"><div class="label">上涨家数</div><div class="value rise">{{ fmt.num(d.up_count, 0) }}</div></div>
      <div class="stat" v-ind="'overview.market.down_count'"><div class="label">下跌家数</div><div class="value fall">{{ fmt.num(d.down_count, 0) }}</div></div>
      <div class="stat" v-ind="'overview.market.up_ratio'">
        <div class="label">上涨占比</div><div class="value">{{ fmt.ratio(d.up_ratio) }}</div>
        <div class="sub">上涨 ÷（上涨 + 下跌）</div>
      </div>
      <div class="stat" v-ind="'overview.market.turnover_yi'"><div class="label">两市成交额</div><div class="value">{{ turnoverBillion == null ? '—' : fmt.num(turnoverBillion, 0) }} 亿元</div><div class="sub">与参与度页同一口径</div></div>
    </div>
    <div class="modules">
      <section class="panel mod">
        <h2>主要指数一览<small>今天各主要指数怎么样，离一年高点多远，估值在什么位置</small></h2>
        <p class="placeholder">待接入：指数估值与价格位置（public-market-index-position · overview / history）。上线后显示每个指数的涨跌、离一年高点的距离和 60 日迷你折线。</p>
      </section>
      <section class="panel mod" v-if="d.up_count != null">
        <h2>涨跌家数分布<small>今天涨多跌少还是相反，分布在哪些区间</small></h2>
        <EChart :option="breadthOption" height="90px" />
      </section>
      <section class="panel mod">
        <h2>两市成交额 60 日<small>今天的成交在近期算高还是低</small></h2>
        <p class="placeholder">待接入：参与度历史（public-market-participation · history）。</p>
      </section>
      <section class="panel mod">
        <h2>涨跌停与炸板<small>极端涨跌个股有多少，附前一日对比</small></h2>
        <p class="placeholder">待接入：涨跌停与股票池结构（public-limit-pool-structure · pool-counts）。</p>
      </section>
    </div>
    <div class="panel" style="margin-top:16px">
      <h2>更多数据</h2>
      <div class="grid">
        <router-link v-for="p in more" :key="p.key" :to="p.path" class="stat more">
          <div class="label">{{ p.title }}<span v-if="!can(p.perm)" class="badge lock">🔒 {{ session.user?.perm_min_role?.[p.perm] || '会员' }}</span></div>
          <div class="sub">{{ p.question }}</div>
        </router-link>
      </div>
    </div>
  </PageFrame>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import PageFrame from '../components/PageFrame.vue'
import EChart from '../components/EChart.vue'
import { fmt, getModule } from '../api'
import { useModule } from '../useModule'
import { can, session } from '../auth'
import { PAGES } from '../pageCatalog'

const more = PAGES.filter((p) => p.key !== 'overview')

const tradeDate = ref('')
const { env, loading, load } = useModule('overview', () => ({ trade_date: tradeDate.value }))
const d = computed(() => env.value.data || {})
// 两市成交额与参与度页同源（participation_observation.total_amount_billion，精确到亿元）
const partData = ref(null)
async function loadTurnover() {
  // 只取参与度的观察字段，不改动本页的模块权限状态
  if (!can('page.participation')) { partData.value = null; return }
  const r = await getModule('participation', { trade_date: tradeDate.value })
  partData.value = r?.data || null
}
watch(tradeDate, loadTurnover)
onMounted(loadTurnover)
const turnoverBillion = computed(() => partData.value?.participation_observation?.total_amount_billion ?? null)
const breadthOption = computed(() => ({
  grid: { left: 10, right: 10, top: 10, bottom: 10 },
  xAxis: { type: 'value', show: false, max: (d.value.up_count || 0) + (d.value.down_count || 0) },
  yAxis: { type: 'category', show: false, data: ['涨跌'] },
  tooltip: {},
  series: [
    { name: '上涨', type: 'bar', stack: 'a', data: [d.value.up_count], itemStyle: { color: '#d0342c' }, barWidth: 28 },
    { name: '下跌', type: 'bar', stack: 'a', data: [d.value.down_count], itemStyle: { color: '#1a8f4c' } },
  ],
}))
</script>

<style scoped>
.modules { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
.mod h2 small { display: block; font-weight: 400; color: var(--muted); font-size: 12px; margin-top: 2px; }
.placeholder { color: var(--muted); font-size: 13px; margin: 8px 0 0; }
@media (max-width: 900px) { .modules { grid-template-columns: minmax(0, 1fr); } }
.more { display: block; color: var(--text); }
.more:hover { border-color: var(--accent); }
.more .badge { margin-left: 6px; }
</style>
