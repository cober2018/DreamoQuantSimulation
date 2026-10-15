<template>
  <PageFrame title="题材与涨跌结构" question="当日涨停、炸板、跌停如何分布？" :env="env" :loading="loading" @retry="load">
    <template #tools><input type="date" v-model="tradeDate" aria-label="交易日" /></template>

    <div class="panel" v-if="st">
      <h2>涨跌停结构<small>来自股票池统计，{{ env.trade_date }}</small></h2>
      <div class="grid">
        <div class="stat"><div class="label">涨停</div><div class="value">{{ fmt.num(st.limit_up_count, 0) }}</div></div>
        <div class="stat"><div class="label">炸板</div><div class="value">{{ fmt.num(st.broken_board_count, 0) }}</div></div>
        <div class="stat"><div class="label">跌停</div><div class="value">{{ fmt.num(st.limit_down_count, 0) }}</div></div>
        <div class="stat">
          <div class="label">炸板率</div><div class="value">{{ fmt.ratio(st.broken_board_rate?.value) }}</div>
          <div class="sub">{{ st.broken_board_rate?.numerator }} / {{ st.broken_board_rate?.denominator }}，{{ st.broken_board_rate?.definition }}</div>
        </div>
        <div class="stat">
          <div class="label">涨停 / 跌停</div><div class="value">{{ fmt.num(st.limit_up_down_ratio?.value, 2) }}</div>
          <div class="sub">{{ st.limit_up_down_ratio?.numerator }} / {{ st.limit_up_down_ratio?.denominator }}</div>
        </div>
      </div>
      <h3 class="sub-h">连板梯队</h3>
      <div class="grid">
        <div class="stat" v-for="t in tiers" :key="t.tier"><div class="label">{{ t.tier }}</div><div class="value">{{ t.count }}</div></div>
      </div>
    </div>

    <div class="panel" v-if="history.length">
      <h2>涨停、炸板、跌停的近期变化<small>{{ history.length }} 个交易日</small></h2>
      <EChart :option="historyOption" height="300px" />
    </div>

    <div class="panel">
      <h2>题材榜<small>{{ rule }}；当日样本 {{ env.data?.limit_up_sample_size ?? '—' }} 只涨停</small></h2>
      <div class="table-wrap" v-if="themes.length">
        <table>
          <thead>
            <tr><th class="left">题材</th><th>涨停</th><th>炸板</th><th>最高板</th><th>平均涨幅</th>
              <th v-for="b in buckets" :key="b">{{ b }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="t in themes" :key="t.industry">
              <td class="left">{{ t.industry }}</td>
              <td>{{ t.up_count }}</td>
              <td>{{ t.broken_count }}</td>
              <td>{{ t.highest_tier || '—' }}</td>
              <td :class="fmt.dir(t.avg_return_pct)">{{ fmt.signed(t.avg_return_pct) }}%</td>
              <td v-for="b in buckets" :key="b">{{ t.seal_time_buckets?.[b] || 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="muted">当日没有进入题材榜的行业。</p>
      <p class="note">封板时间为首次封板所在时间段的涨停只数；不展示个股名单、强度分与阶段判断。</p>
    </div>
  </PageFrame>
</template>

<script setup>
import { computed, ref } from 'vue'
import PageFrame from '../components/PageFrame.vue'
import EChart from '../components/EChart.vue'
import { fmt } from '../api'
import { useModule } from '../useModule'

const tradeDate = ref('')
const { env, loading, load } = useModule('themes', () => ({ trade_date: tradeDate.value }))
const st = computed(() => env.value.data?.structure || null)
const tiers = computed(() => env.value.data?.board_tiers || [])
const themes = computed(() => env.value.data?.themes || [])
const buckets = computed(() => env.value.data?.seal_time_buckets || [])
const history = computed(() => env.value.data?.history || [])
const rule = computed(() => env.value.data?.theme_member_rule || '')

const historyOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['涨停', '炸板', '跌停'] },
  grid: { left: 40, right: 20, top: 36, bottom: 28 },
  xAxis: { type: 'category', data: history.value.map((h) => h.trade_date.slice(5)) },
  yAxis: { type: 'value' },
  series: [
    { name: '涨停', type: 'bar', data: history.value.map((h) => h.limit_up_count), itemStyle: { color: '#d0342c' } },
    { name: '炸板', type: 'bar', data: history.value.map((h) => h.broken_board_count), itemStyle: { color: '#e8a33d' } },
    { name: '跌停', type: 'bar', data: history.value.map((h) => h.limit_down_count), itemStyle: { color: '#1a8f4c' } },
  ],
}))
</script>
