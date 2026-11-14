<template>
  <StateView :state="state" :detail="detail" :env="env" perm="page.themes" @retry="load">
    <view class="card" v-if="st && vis(env, 'structure')">
      <view class="card-title">涨跌停结构</view>
      <view class="card-sub">{{ env.trade_date }}</view>
      <view class="grid">
        <view class="stat"><view class="label">涨停</view><view class="value rise">{{ st.limit_up_count }}</view></view>
        <view class="stat"><view class="label">炸板</view><view class="value">{{ st.broken_board_count }}</view></view>
        <view class="stat"><view class="label">跌停</view><view class="value fall">{{ st.limit_down_count }}</view></view>
        <view class="stat"><view class="label">炸板率</view><view class="value">{{ ratio(st.broken_board_rate && st.broken_board_rate.value) }}</view></view>
      </view>
    </view>
    <view class="card" v-if="themes.length && vis(env, 'themes')">
      <view class="card-title">题材榜</view>
      <view class="row" v-for="t in themes" :key="t.industry">
        <text>{{ t.industry }}</text><text>涨停 {{ t.up_count }} · 炸板 {{ t.broken_count }}</text>
      </view>
    </view>
    <view class="card" v-if="themes.length">
      <view class="card-title">封板时间分布</view>
      <view v-if="locked" class="card-sub">封板时间分布属于下钻明细，需要 {{ needDetail }}。可到“我的”查看会员套餐。</view>
      <template v-else>
        <view class="card-sub">当日涨停样本 {{ env.data.limit_up_sample_size }} 只 · 按首次封板时间计数</view>
        <view v-for="t in themes" :key="'s' + t.industry" class="seal">
          <view class="seal-name">{{ t.industry }}</view>
          <view class="seal-row">
            <view v-for="b in buckets" :key="b" class="seal-cell"><view class="muted sub">{{ b }}</view><view>{{ (t.seal_time_buckets || {})[b] || 0 }}</view></view>
          </view>
        </view>
      </template>
    </view>
    <view class="foot">{{ DISCLAIMER }}</view>
  </StateView>
</template>

<script setup>
import { computed } from 'vue'
import StateView from '../../utils/StateView.vue'
import { useData } from '../../utils/useData'
import { ratio, vis } from '../../utils/fmt'
import { DISCLAIMER } from '../../utils/config'
import { session } from '../../utils/auth'

const { env, state, detail, load } = useData('/api/v1/themes')
const st = computed(() => env.value?.data?.structure || null)
const themes = computed(() => env.value?.data?.themes || [])
const locked = computed(() => !!env.value?.data?.detail_locked)
const buckets = computed(() => env.value?.data?.seal_time_buckets || [])
const needDetail = computed(() => session.user?.perm_min_role?.['data.detail'] || '更高等级')
</script>

<style>
.seal { border-top: 1rpx solid #eef0f3; padding: 12rpx 0; }
.seal-name { font-weight: 600; margin-bottom: 6rpx; }
.seal-row { display: flex; flex-wrap: wrap; }
.seal-cell { width: 33%; padding: 4rpx 0; font-size: 24rpx; }
.sub { font-size: 20rpx; }
</style>
