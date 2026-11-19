<template>
  <PageFrame title="行业比较与轮动" question="不同板块已发生的表现有什么差异？" :env="env" :loading="loading" @retry="load" @jump="tradeDate = $event">
    <template #tools>
      <div class="seg">
        <button v-for="t in IDX_TYPES" :key="t" :class="{ on: idxType === t }" @click="idxType = t">{{ t }}</button>
      </div>
      <input type="text" v-model="keyword" placeholder="搜索名称或代码" aria-label="搜索行业名称或代码" />
      <input type="date" v-model="tradeDate" :min="FLOOR" aria-label="交易日" />
    </template>

    <p class="note floor-note">行业数据从 {{ FLOOR }} 起提供。</p>

    <div class="pair">
      <IndustryRrg v-module="'rrg'" id="industries-rrg" :items="items" :day="day" :end-date="day" :in-window="inWindow"
                   :rrg-ref="rrgRef" :can-detail="canDetail" :lock-text="lockText" />
      <IndustryTreemap id="industries-treemap" :items="items" :day="day" />
    </div>

    <div class="pair">
      <IndustryFlowBars id="industries-flow" :items="items" />
      <IndustryDiffusion id="industries-diffusion" :items="items" />
    </div>

    <IndustryTable id="industries-table-module" :items="items" :keyword="keyword" :day="day" :end-date="day"
                   :can-detail="canDetail" :lock-text="lockText" :selected="selected" @select="selected = $event" />

    <section v-if="selected" class="panel" aria-labelledby="industries-detail-title">
      <h2 id="industries-detail-title">{{ series.data?.sector_name || items.find((r) => r.sector_code === selected)?.sector_name || selected }} 近期序列
        <small v-if="canDetail">{{ series.data?.points?.length || 0 }} / {{ series.data?.requested_days || 5 }} 个交易日
          <span v-if="series.status === 'partial'">（不足，未插值）</span></small></h2>
      <div v-if="!canDetail" class="lock-card">近期序列属于下钻明细，需要 {{ lockText }}。<router-link v-if="payOn()" to="/plans">查看会员套餐</router-link></div>
      <div v-else-if="seriesLoading" class="empty-state">加载中…</div>
      <div v-else-if="series.status && !['ok', 'partial', 'empty'].includes(series.status)" class="empty-state">序列暂时无法加载，请稍后重试。</div>
      <div v-else-if="!series.data?.points?.length" class="empty-state">没有可用序列。</div>
      <div v-else class="pair">
        <EChart :option="seriesOption" height="280px" />
        <EChart :option="trailOption" height="280px" />
      </div>
    </section>
  </PageFrame>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import PageFrame from '../components/PageFrame.vue'
import EChart from '../components/EChart.vue'
import IndustryRrg from '../components/industries/IndustryRrg.vue'
import IndustryTreemap from '../components/industries/IndustryTreemap.vue'
import IndustryFlowBars from '../components/industries/IndustryFlowBars.vue'
import IndustryDiffusion from '../components/industries/IndustryDiffusion.vue'
import IndustryTable from '../components/industries/IndustryTable.vue'
import { getModule } from '../api'
import { useModule } from '../useModule'
import { INDUSTRY_FLOOR, rollingMask } from '../lib/industryPending.js'
import { can, payOn, session } from '../auth'

const canDetail = computed(() => can('data.detail'))
const lockText = computed(() => session.user?.perm_min_role?.['data.detail'] || '更高等级')

const IDX_TYPES = ['行业板块', '概念板块', '地域板块']
const FLOOR = INDUSTRY_FLOOR

const idxType = ref('行业板块')
const tradeDate = ref('')
const keyword = ref('')
const selected = ref('')

const { env, loading, load } = useModule('industries', () => ({ idx_type: idxType.value, trade_date: tradeDate.value }))
const items = computed(() => env.value.data?.items || [])
const day = computed(() => env.value.trade_date || '')
const rrgRef = computed(() => Number(env.value.data?.rrg_reference) || 100)
// RS 指标窗口跨到下限之前时，RRG 整体待更新
const inWindow = computed(() => rollingMask(day.value).rs)
watch([idxType, keyword, tradeDate], () => { selected.value = '' })

// 近期序列（点击行后的下钻明细）
const series = ref({})
const seriesLoading = ref(false)
watch(selected, async (code) => {
  if (!code || !canDetail.value) return
  seriesLoading.value = true
  series.value = await getModule(`industries/${encodeURIComponent(code)}/series`, { end_date: env.value.trade_date })
  seriesLoading.value = false
})
const pts = computed(() => series.value.data?.points || [])
const seriesOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['涨跌幅%', '净流入(亿元)'] },
  grid: { left: 50, right: 50, top: 36, bottom: 30 },
  xAxis: { type: 'category', data: pts.value.map((p) => p.trade_date) },
  yAxis: [{ type: 'value', name: '%' }, { type: 'value', name: '亿元' }],
  series: [
    { name: '涨跌幅%', type: 'bar', data: pts.value.map((p) => (p.sector_return == null ? null : +(p.sector_return * 100).toFixed(2))),
      itemStyle: { color: (p) => (p.value >= 0 ? '#d0342c' : '#1a8f4c') } },
    { name: '净流入(亿元)', type: 'line', yAxisIndex: 1, data: pts.value.map((p) => p.net_flow_1d), itemStyle: { color: '#2f5d9b' } },
  ],
}))
const trailOption = computed(() => ({
  tooltip: { formatter: (p) => `${p.data[2]}<br/>RS ${p.data[0]}<br/>Mom ${p.data[1]}` },
  grid: { left: 50, right: 30, top: 40, bottom: 40 },
  xAxis: { type: 'value', scale: true, name: 'RS-Ratio', nameLocation: 'middle', nameGap: 26 },
  yAxis: { type: 'value', scale: true },
  series: [{
    type: 'line', symbolSize: 8, itemStyle: { color: '#2f5d9b' },
    data: pts.value.filter((p) => p.rs_ratio != null && !rollingMask(p.trade_date).rs).map((p) => [p.rs_ratio, p.rs_momentum, p.trade_date]),
    markLine: { silent: true, symbol: 'none', lineStyle: { color: '#9aa3b2', type: 'dashed' }, data: [{ xAxis: 100 }, { yAxis: 100 }] },
  }],
}))
</script>

<style scoped>
.floor-note { margin: -4px 0 14px; }
.pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; margin-bottom: 16px; }
.pair > * { min-width: 0; margin-bottom: 0; }
@media (max-width: 1100px) { .pair { grid-template-columns: minmax(0, 1fr); } }
</style>
