<template>
  <StateView :state="state" :detail="detail" :env="env" perm="page.industries" @retry="load">
    <view class="card">
      <view class="card-title">行业涨幅</view>
      <view class="card-sub">{{ env?.trade_date }} · 共 {{ items.length }} 个行业，仅展示前后各 {{ N }} 名；点击行业查看近 N 日序列</view>
      <view class="muted" style="margin:8rpx 0">涨幅居前</view>
      <view class="row" v-for="i in top" :key="i.sector_code" @click="openSeries(i)">
        <text>{{ i.sector_name }}</text><text :class="dir(i.sector_return)">{{ pct(i.sector_return) }}</text>
      </view>
      <view class="muted" style="margin:16rpx 0 8rpx">涨幅居后</view>
      <view class="row" v-for="i in bottom" :key="i.sector_code" @click="openSeries(i)">
        <text>{{ i.sector_name }}</text><text :class="dir(i.sector_return)">{{ pct(i.sector_return) }}</text>
      </view>
    </view>
    <view class="card" v-if="picked">
      <view class="card-title">{{ picked.sector_name }} · 近 {{ seriesDays }} 日</view>
      <view v-if="series.state === 'loading'" class="muted">加载中…</view>
      <view v-else-if="series.state === 'forbidden'" class="card-sub">板块序列属于下钻明细，需要 {{ needDetail }}。<text v-if="payOn()">可到“我的”查看会员套餐。</text></view>
      <view v-else-if="series.state === 'error'" class="card-sub">数据服务暂时不可用，请稍后重试</view>
      <template v-else>
        <view v-if="series.env.gaps && series.env.gaps.length" class="card-sub">{{ series.env.gaps[0].reason }}</view>
        <view class="row muted sub"><text>日期</text><text>涨跌幅 · 资金净流入(亿) · 成交额(亿)</text></view>
        <view class="row" v-for="p in (series.env.data && series.env.data.points) || []" :key="p.trade_date">
          <text>{{ p.trade_date }}</text><text><text :class="dir(p.sector_return)">{{ pct(p.sector_return) }}</text> · {{ num(p.net_flow_1d) }} · {{ num(p.amount, 0) }}</text>
        </view>
      </template>
    </view>
    <view class="card">
      <view class="card-title">资金净流入（1日，亿元）</view>
      <view class="row" v-for="i in flow" :key="i.sector_code">
        <text>{{ i.sector_name }}</text><text :class="dir(i.net_flow_1d)">{{ num(i.net_flow_1d) }}</text>
      </view>
    </view>
    <view class="foot">{{ DISCLAIMER }}</view>
  </StateView>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { get, payOn, session } from '../../utils/auth'
import StateView from '../../utils/StateView.vue'
import { useData } from '../../utils/useData'
import { num, pct, dir } from '../../utils/fmt'
import { DISCLAIMER } from '../../utils/config'

const N = 8
const { env, state, detail, load } = useData('/api/v1/industries', { idx_type: '行业板块' })
const items = computed(() => env.value?.data?.items || [])
const top = computed(() => items.value.slice(0, N))
const bottom = computed(() => items.value.slice(-N).reverse())
const picked = ref(null)
const series = reactive({ state: '', env: {} })
const seriesDays = computed(() => Math.max(2, Math.min(20, session.user?.history_days || 5)))
const needDetail = computed(() => session.user?.perm_min_role?.['data.detail'] || '更高等级')
async function openSeries(i) {
  picked.value = i
  series.state = 'loading'
  const r = await get(`/api/v1/industries/${encodeURIComponent(i.sector_code)}/series`, { end_date: env.value?.trade_date, days: seriesDays.value })
  if (r.status === 403) series.state = 'forbidden'
  else if (!r.ok) series.state = 'error'
  else { series.env = r.data; series.state = 'ready' }
}
const flow = computed(() => [...items.value].filter((i) => i.net_flow_1d != null)
  .sort((a, b) => b.net_flow_1d - a.net_flow_1d).slice(0, N))
</script>

<style>
.sub { font-size: 22rpx; }
</style>
