<template>
  <StateView :state="state" :detail="detail" @retry="load">
    <view class="card" v-if="d">
      <view class="card-title">大盘与成交</view>
      <view class="card-sub">数据日期 {{ env.trade_date }} · 指数 {{ d.index_code || '—' }}</view>
      <view class="grid">
        <view class="stat"><view class="label">指数涨跌</view><view :class="['value', dir(d.index_change_pct)]">{{ num(d.index_change_pct) }}%</view></view>
        <view class="stat"><view class="label">成交额</view><view class="value">{{ num(d.turnover_yi, 0) }} 亿</view></view>
        <view class="stat"><view class="label">上涨家数</view><view class="value rise">{{ num(d.up_count, 0) }}</view></view>
        <view class="stat"><view class="label">下跌家数</view><view class="value fall">{{ num(d.down_count, 0) }}</view></view>
        <view class="stat"><view class="label">上涨占比</view><view class="value">{{ ratio(d.up_ratio) }}</view></view>
      </view>
    </view>
    <view class="note" v-if="env && env.status === 'partial'">部分数据暂缺，页面仅展示已有内容。</view>
    <view class="foot">{{ DISCLAIMER }}</view>
  </StateView>
</template>

<script setup>
import { computed } from 'vue'
import StateView from '../../utils/StateView.vue'
import { useData } from '../../utils/useData'
import { num, ratio, dir } from '../../utils/fmt'
import { DISCLAIMER } from '../../utils/config'

const { env, state, detail, load } = useData('/api/v1/overview')
const d = computed(() => env.value?.data || null)
</script>
