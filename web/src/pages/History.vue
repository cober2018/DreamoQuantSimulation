<template>
  <PageFrame title="历史复盘" question="某一天的数据和历史对比是什么？" :env="env" :loading="loading" @retry="load">
    <template #tools>
      <div class="seg">
        <button v-for="t in IDX_TYPES" :key="t" :class="{ on: idxType === t }" @click="idxType = t">{{ t }}</button>
      </div>
      <input type="date" v-model="tradeDate" aria-label="交易日" />
    </template>

    <div class="panel">
      <h2>板块结构统计<small>{{ env.data?.idx_type }}，分母为当日有效板块数</small></h2>
      <div class="grid">
        <div class="stat"><div class="label">上涨板块占比</div><div class="value">{{ fmt.ratio(s.rising_sector_ratio?.value) }}</div>
          <div class="sub">{{ frac(s.rising_sector_ratio) }}</div></div>
        <div class="stat"><div class="label">扩散度均值</div><div class="value">{{ fmt.num(s.di_mean?.value, 3) }}</div>
          <div class="sub">n = {{ s.di_mean?.denominator ?? '—' }}</div></div>
        <div class="stat"><div class="label">站上MA20占比（中位数）</div><div class="value">{{ fmt.ratio(s.above_ma20_ratio_median?.value) }}</div>
          <div class="sub">n = {{ s.above_ma20_ratio_median?.denominator ?? '—' }}</div></div>
        <div class="stat"><div class="label">成交额前十集中度</div><div class="value">{{ fmt.ratio(s.top10_amount_concentration?.value) }}</div>
          <div class="sub">{{ fmt.num(s.top10_amount_concentration?.numerator, 0) }} / {{ fmt.num(s.top10_amount_concentration?.denominator, 0) }} 亿元</div></div>
        <div class="stat"><div class="label">资金与价格方向背离比例</div><div class="value">{{ fmt.ratio(s.flow_price_divergence_ratio?.value) }}</div>
          <div class="sub">{{ frac(s.flow_price_divergence_ratio) }}，剔除任一为 0 或缺失</div></div>
      </div>
    </div>

    <div class="panel" v-if="open5">
      <h2>开盘 5 分钟统计（Open5）<small>全市场，{{ open5.trade_date }}，数据状态 {{ open5.data_status }}</small></h2>
      <div class="grid">
        <div class="stat"><div class="label">覆盖率</div><div class="value">{{ fmt.ratio(open5.coverage_ratio) }}</div>
          <div class="sub">{{ fmt.num(open5.open5_ready_count, 0) }} / {{ fmt.num(open5.expected_stock_count, 0) }}</div></div>
        <div class="stat"><div class="label">开盘 5 分钟为正占比</div><div class="value">{{ fmt.ratio(open5.positive_open5_ratio) }}</div>
          <div class="sub">分母 {{ fmt.num(open5.open5_ready_count, 0) }}</div></div>
        <div class="stat"><div class="label">收盘延续占比</div><div class="value">{{ fmt.ratio(open5.continuation_ratio) }}</div>
          <div class="sub">分母 {{ fmt.num(open5.close_ready_count, 0) }}</div></div>
        <div class="stat"><div class="label">过度反应占比</div><div class="value">{{ fmt.ratio(open5.over_response_ratio) }}</div>
          <div class="sub">分母 {{ fmt.num(open5.close_ready_count, 0) }}</div></div>
      </div>
      <p class="note">数据不完整的股票不计入分子，也不计入占比分母；覆盖率反映数据完整程度，不代表市场表现。</p>
    </div>

    <div class="panel">
      <h2>板块资金净流入排行<small>全量 {{ ranking.length }} 个，单位亿元</small></h2>
      <div class="toolbar">
        <div class="seg">
          <button v-for="p in PERIODS" :key="p.v" :class="{ on: period === p.v }" @click="period = p.v">{{ p.l }}</button>
        </div>
      </div>
      <EChart :option="rankOption" :height="Math.max(320, ranking.length * 18) + 'px'" />
    </div>
  </PageFrame>
</template>

<script setup>
import { computed, ref } from 'vue'
import PageFrame from '../components/PageFrame.vue'
import EChart from '../components/EChart.vue'
import { fmt } from '../api'
import { useModule } from '../useModule'

const IDX_TYPES = ['行业板块', '概念板块', '地域板块']
const PERIODS = [{ v: '1d', l: '1 日' }, { v: '5d', l: '5 日' }, { v: '20d', l: '20 日' }]
const idxType = ref('行业板块')
const tradeDate = ref('')
const period = ref('1d')
const { env, loading, load } = useModule('history', () => ({ idx_type: idxType.value, trade_date: tradeDate.value, period: period.value }))
const s = computed(() => env.value.data?.structure || {})
const open5 = computed(() => env.value.data?.open5 || null)
const ranking = computed(() => env.value.data?.flow_ranking || [])
const frac = (r) => (r ? `${r.numerator} / ${r.denominator}` : '—')

const rankOption = computed(() => {
  const list = [...ranking.value].reverse()
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
</script>
