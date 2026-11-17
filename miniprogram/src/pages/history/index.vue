<template>
  <view>
    <view class="card toolbar">
      <picker mode="date" :value="params.trade_date" @change="(e) => setDate(e.detail.value)">
        <view class="picker">交易日：{{ params.trade_date || '最新' }}</view>
      </picker>
      <view class="seg">
        <text v-for="t in IDX_TYPES" :key="t" :class="['seg-item', params.idx_type === t && 'on']" @click="set('idx_type', t)">{{ t }}</text>
      </view>
    </view>
    <StateView :state="state" :detail="detail" :env="env" perm="page.history" jumpable @retry="load" @jump="setDate">
      <view v-if="env">
      <view class="card" v-if="vis(env, 'structure')">
        <view class="card-title">板块结构统计</view>
        <view class="card-sub">{{ env.trade_date }} · {{ d.idx_type }}，分母为当日有效板块数</view>
        <view class="grid">
          <view class="stat"><view class="label">上涨板块占比</view><view class="value">{{ ratio(s.rising_sector_ratio && s.rising_sector_ratio.value) }}</view><view class="muted sub">{{ frac(s.rising_sector_ratio) }}</view></view>
          <view class="stat"><view class="label">扩散度均值</view><view class="value">{{ num(s.di_mean && s.di_mean.value, 3) }}</view><view class="muted sub">n = {{ s.di_mean ? s.di_mean.denominator : '—' }}</view></view>
          <view class="stat"><view class="label">站上MA20占比（中位数）</view><view class="value">{{ ratio(s.above_ma20_ratio_median && s.above_ma20_ratio_median.value) }}</view><view class="muted sub">n = {{ s.above_ma20_ratio_median ? s.above_ma20_ratio_median.denominator : '—' }}</view></view>
          <view class="stat"><view class="label">成交额前十集中度</view><view class="value">{{ ratio(s.top10_amount_concentration && s.top10_amount_concentration.value) }}</view><view class="muted sub">{{ s.top10_amount_concentration ? num(s.top10_amount_concentration.numerator, 0) + ' / ' + num(s.top10_amount_concentration.denominator, 0) + ' 亿元' : '—' }}</view></view>
          <view class="stat"><view class="label">资金与价格方向背离比例</view><view class="value">{{ ratio(s.flow_price_divergence_ratio && s.flow_price_divergence_ratio.value) }}</view><view class="muted sub">{{ frac(s.flow_price_divergence_ratio) }}，剔除任一为 0 或缺失</view></view>
        </view>
      </view>

      <view class="card" v-if="open5 && vis(env, 'open5')">
        <view class="card-title">开盘五分钟统计</view>
        <view class="card-sub">全市场 · 数据日 {{ open5.trade_date || '—' }}</view>
        <view class="grid">
          <view class="stat"><view class="label">覆盖率</view><view class="value">{{ ratio(open5.coverage_ratio) }}</view><view class="muted sub">{{ num(open5.open5_ready_count, 0) }} / {{ num(open5.expected_stock_count, 0) }}</view></view>
          <view class="stat"><view class="label">开盘 5 分钟为正占比</view><view class="value">{{ ratio(open5.positive_open5_ratio) }}</view><view class="muted sub">分母 {{ num(open5.open5_ready_count, 0) }}</view></view>
          <view class="stat"><view class="label">收盘延续占比</view><view class="value">{{ ratio(open5.continuation_ratio) }}</view><view class="muted sub">分母 {{ num(open5.close_ready_count, 0) }}</view></view>
          <view class="stat"><view class="label">过度反应占比</view><view class="value">{{ ratio(open5.over_response_ratio) }}</view><view class="muted sub">分母 {{ num(open5.close_ready_count, 0) }}</view></view>
        </view>
        <view class="muted sub">数据不完整的股票不计入分子，也不计入占比分母；覆盖率反映数据完整程度，不代表市场表现。</view>
      </view>

      <view class="card" v-if="vis(env, 'flow')">
        <view class="card-title">板块资金净流入排行</view>
        <view class="card-sub">全量 {{ ranking.length }} 个，单位亿元</view>
        <view class="seg" style="margin-bottom:12rpx">
          <text v-for="p in PERIODS" :key="p.v" :class="['seg-item', params.period === p.v && 'on']" @click="set('period', p.v)">{{ p.l }}</text>
        </view>
        <view class="row" v-for="(r, i) in shown" :key="r.sector_code">
          <text>{{ i + 1 }}. {{ r.sector_name }}</text><text :class="dir(r.net_flow)">{{ num(r.net_flow) }}</text>
        </view>
        <view v-if="shown.length < ranking.length" class="muted sub" style="text-align:center;margin-top:12rpx">上滑加载更多（{{ shown.length }} / {{ ranking.length }}）</view>
      </view>
      </view>
      <view class="foot">{{ DISCLAIMER }}</view>
    </StateView>
  </view>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { onReachBottom } from '@dcloudio/uni-app'
import StateView from '../../utils/StateView.vue'
import { useData } from '../../utils/useData'
import { num, ratio, dir, vis } from '../../utils/fmt'
import { DISCLAIMER } from '../../utils/config'

const IDX_TYPES = ['行业板块', '概念板块', '地域板块']
const PERIODS = [{ v: '1d', l: '1 日' }, { v: '5d', l: '5 日' }, { v: '20d', l: '20 日' }]
const PAGE = 50
const params = reactive({ trade_date: '', idx_type: '行业板块', period: '1d' })
const { env, state, detail, load } = useData('/api/v1/history', params)
const d = computed(() => env.value?.data || {})
const s = computed(() => d.value.structure || {})
const open5 = computed(() => d.value.open5 || null)
const ranking = computed(() => d.value.flow_ranking || [])
const limit = ref(PAGE)
const shown = computed(() => ranking.value.slice(0, limit.value))
const frac = (r) => (r ? `${r.numerator} / ${r.denominator}` : '—')
// 全量排行不截断：分批渲染，滚动到底继续加载
onReachBottom(() => { if (limit.value < ranking.value.length) limit.value += PAGE })
watch(ranking, () => { limit.value = PAGE })
function set(k, v) { params[k] = v; load() }
function setDate(v) { params.trade_date = v; load() }
</script>

<style>
.toolbar { display: flex; flex-direction: column; }
.picker { padding: 10rpx 0; color: #2f5d9b; }
.seg { display: flex; flex-wrap: wrap; }
.seg-item { padding: 8rpx 20rpx; margin: 6rpx 12rpx 6rpx 0; border-radius: 999rpx; background: #f0f2f5; font-size: 24rpx; }
.seg-item.on { background: #2f5d9b; color: #fff; }
.sub { font-size: 22rpx; }
</style>
