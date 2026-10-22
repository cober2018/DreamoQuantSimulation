<template>
  <PageFrame title="市场总览" question="今天市场发生了什么？" :env="env" :loading="loading" @retry="load" @jump="tradeDate = $event">
    <template #tools><input type="date" v-model="tradeDate" aria-label="交易日" /></template>
    <div class="grid">
      <div class="stat">
        <div class="label">基准指数 {{ d.index_code || '' }}</div>
        <div :class="['value', fmt.dir(d.index_change_pct)]">{{ d.index_change_pct == null ? '—' : fmt.signed(d.index_change_pct) + '%' }}</div>
      </div>
      <div class="stat"><div class="label">上涨家数</div><div class="value rise">{{ fmt.num(d.up_count, 0) }}</div></div>
      <div class="stat"><div class="label">下跌家数</div><div class="value fall">{{ fmt.num(d.down_count, 0) }}</div></div>
      <div class="stat">
        <div class="label">上涨占比</div><div class="value">{{ fmt.ratio(d.up_ratio) }}</div>
        <div class="sub">上涨 ÷（上涨 + 下跌）</div>
      </div>
      <div class="stat"><div class="label">两市成交额</div><div class="value">{{ fmt.num(d.turnover_yi, 0) }}</div><div class="sub">亿元</div></div>
    </div>
    <div class="panel" style="margin-top:16px" v-if="d.up_count != null">
      <h2>涨跌家数分布</h2>
      <EChart :option="breadthOption" height="90px" />
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
import { computed, ref } from 'vue'
import PageFrame from '../components/PageFrame.vue'
import EChart from '../components/EChart.vue'
import { fmt } from '../api'
import { useModule } from '../useModule'
import { can, session } from '../auth'
import { PAGES } from '../pageCatalog'

const more = PAGES.filter((p) => p.key !== 'overview')

const tradeDate = ref('')
const { env, loading, load } = useModule('overview', () => ({ trade_date: tradeDate.value }))
const d = computed(() => env.value.data || {})
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
.more { display: block; color: var(--text); }
.more:hover { border-color: var(--accent); }
.more .badge { margin-left: 6px; }
</style>
