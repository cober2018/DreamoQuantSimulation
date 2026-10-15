<template>
  <StateView :state="state" :detail="detail" @retry="load">
    <view class="card">
      <view class="card-title">行业涨幅</view>
      <view class="card-sub">{{ env?.trade_date }} · 共 {{ items.length }} 个行业，仅展示前后各 {{ N }} 名</view>
      <view class="muted" style="margin:8rpx 0">涨幅居前</view>
      <view class="row" v-for="i in top" :key="i.sector_code">
        <text>{{ i.sector_name }}</text><text :class="dir(i.sector_return)">{{ pct(i.sector_return) }}</text>
      </view>
      <view class="muted" style="margin:16rpx 0 8rpx">涨幅居后</view>
      <view class="row" v-for="i in bottom" :key="i.sector_code">
        <text>{{ i.sector_name }}</text><text :class="dir(i.sector_return)">{{ pct(i.sector_return) }}</text>
      </view>
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
import { computed } from 'vue'
import StateView from '../../utils/StateView.vue'
import { useData } from '../../utils/useData'
import { num, pct, dir } from '../../utils/fmt'
import { DISCLAIMER } from '../../utils/config'

const N = 8
const { env, state, detail, load } = useData('/api/v1/industries', { idx_type: '行业板块' })
const items = computed(() => env.value?.data?.items || [])
const top = computed(() => items.value.slice(0, N))
const bottom = computed(() => items.value.slice(-N).reverse())
const flow = computed(() => [...items.value].filter((i) => i.net_flow_1d != null)
  .sort((a, b) => b.net_flow_1d - a.net_flow_1d).slice(0, N))
</script>
