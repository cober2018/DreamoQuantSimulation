<template>
  <StateView :state="state" :detail="detail" @retry="load">
    <view class="card" v-if="st">
      <view class="card-title">涨跌停结构</view>
      <view class="card-sub">{{ env.trade_date }}</view>
      <view class="grid">
        <view class="stat"><view class="label">涨停</view><view class="value rise">{{ st.limit_up_count }}</view></view>
        <view class="stat"><view class="label">炸板</view><view class="value">{{ st.broken_board_count }}</view></view>
        <view class="stat"><view class="label">跌停</view><view class="value fall">{{ st.limit_down_count }}</view></view>
        <view class="stat"><view class="label">炸板率</view><view class="value">{{ ratio(st.broken_board_rate && st.broken_board_rate.value) }}</view></view>
      </view>
    </view>
    <view class="card" v-if="themes.length">
      <view class="card-title">题材榜</view>
      <view class="row" v-for="t in themes" :key="t.industry">
        <text>{{ t.industry }}</text><text>涨停 {{ t.up_count }} · 炸板 {{ t.broken_count }}</text>
      </view>
      <view class="card-sub" style="margin-top:12rpx">小程序仅展示统计摘要，不含个股与封板时间明细。</view>
    </view>
    <view class="foot">{{ DISCLAIMER }}</view>
  </StateView>
</template>

<script setup>
import { computed } from 'vue'
import StateView from '../../utils/StateView.vue'
import { useData } from '../../utils/useData'
import { ratio } from '../../utils/fmt'
import { DISCLAIMER } from '../../utils/config'

const { env, state, detail, load } = useData('/api/v1/themes')
const st = computed(() => env.value?.data?.structure || null)
const themes = computed(() => env.value?.data?.themes || [])
</script>
