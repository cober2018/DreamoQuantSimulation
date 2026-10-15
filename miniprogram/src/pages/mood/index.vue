<template>
  <StateView :state="state" :detail="detail" @retry="load">
    <view class="card" v-if="obs">
      <view class="card-title">市场参与与卖压</view>
      <view class="card-sub">原始统计 · 数据日期 {{ obs.trade_date }}</view>
      <view class="grid">
        <view class="stat"><view class="label">成交额</view><view class="value">{{ num(obs.total_amount_billion, 0) }} 亿</view></view>
        <view class="stat"><view class="label">成交额/前20日中位</view><view class="value">{{ num(obs.amount_ratio_20d) }} 倍</view></view>
        <view class="stat"><view class="label">成交额分位(60日)</view><view class="value">{{ num(obs.participation_pctile_60d, 1) }}</view></view>
        <view class="stat"><view class="label">主动卖出占比</view><view class="value">{{ ratio(obs.active_sell_ratio) }}</view></view>
      </view>
    </view>
    <view class="card" v-if="erp">
      <view class="card-title">股权风险溢价 ERP</view>
      <view class="grid">
        <view class="stat"><view class="label">ERP</view><view class="value">{{ num(erp.erp_value_pct) }}%</view></view>
        <view class="stat"><view class="label">10年国债</view><view class="value">{{ num(erp.yield_10y) }}%</view></view>
        <view class="stat"><view class="label">近252日分位</view><view class="value">{{ erp.erp_percentile_252d == null ? '样本不足' : num(erp.erp_percentile_252d, 1) + '%' }}</view></view>
      </view>
    </view>
    <view class="card" v-if="lu">
      <view class="card-title">涨停结构（当日）</view>
      <view class="grid">
        <view class="stat"><view class="label">封板率</view><view class="value">{{ ratio(lu.seal_rate) }}</view></view>
        <view class="stat"><view class="label">最高连板</view><view class="value">{{ num(lu.max_consecutive_days, 0) }} 天</view></view>
      </view>
    </view>
    <view class="card" v-if="sm">
      <view class="card-title">聪明钱五因子</view>
      <view class="card-sub">截面净广度 · 数据日期 {{ sm.trade_date || '—' }}</view>
      <view class="grid">
        <view class="stat" v-for="f in sm.factors" :key="f.key">
          <view class="label">{{ f.label }}</view>
          <view class="value">{{ signed(f.net_breadth_pct, 1) }}%</view>
        </view>
      </view>
    </view>
    <view class="card" v-if="styleData">
      <view class="card-title">风格相对强度</view>
      <view class="card-sub">历史序列，非当前风格选择建议</view>
      <view class="grid">
        <view class="stat" v-for="c in styleData.camps" :key="c.key">
          <view class="label">{{ c.label }}</view>
          <view class="value">{{ num(c.strength_score, 1) }}</view>
        </view>
      </view>
    </view>
    <view class="foot">{{ DISCLAIMER }}</view>
  </StateView>
</template>

<script setup>
import { computed } from 'vue'
import StateView from '../../utils/StateView.vue'
import { useData } from '../../utils/useData'
import { num, ratio, signed } from '../../utils/fmt'
import { DISCLAIMER } from '../../utils/config'

const { env, state, detail, load } = useData('/api/v1/participation')
const obs = computed(() => env.value?.data?.participation_observation || null)
const erp = computed(() => env.value?.data?.erp || null)
const lu = computed(() => env.value?.data?.limit_up_structure || null)
const sm = computed(() => env.value?.data?.smart_money_factors || null)
const styleData = computed(() => env.value?.data?.style_strength || null)
</script>
