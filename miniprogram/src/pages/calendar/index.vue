<template>
  <view>
    <view class="card toolbar">
      <picker mode="date" :value="params.trade_date" @change="(e) => setDate(e.detail.value)">
        <view class="picker">数据日：{{ params.trade_date || '最新' }}</view>
      </picker>
    </view>
    <StateView :state="state" :detail="detail" :env="env" perm="page.calendar" jumpable @retry="load" @jump="setDate">
      <view v-if="env">
      <view v-if="win.complete === false" class="note">日历窗口不完整，以下仅列出已取得的事件。</view>
      <view class="card">
        <view class="card-title">事件列表</view>
        <view class="card-sub">窗口 {{ win.start_date || '—' }} 至 {{ win.end_date || '—' }} · {{ d.family_filter }}</view>
        <view v-if="!events.length" class="muted">窗口内暂无已登记事件。</view>
        <view v-for="g in grouped" :key="g.day" style="margin-bottom:16rpx">
          <view class="day">{{ g.day }}</view>
          <view class="event" v-for="e in g.list" :key="e.event_id">
            <view class="event-head"><text class="muted">{{ e.event_time || '待定' }} · {{ e.country || '—' }}</text><text class="muted">{{ stars(e.source_importance) }}</text></view>
            <view class="event-title">{{ e.title || '—' }}<text v-if="e.ai_curated === true" class="ai-tag">AI 整理</text></view>
            <view class="muted sub">{{ [e.event_type_label, e.indicator_code !== 'UNKNOWN' ? e.indicator_code : '', e.period, e.unit].filter(Boolean).join(' · ') || '—' }}</view>
            <view class="grid">
              <view class="cell"><view class="muted sub">前值</view><view>{{ e.previous_value || '—' }}</view></view>
              <view class="cell"><view class="muted sub">市场预期*</view><view>{{ e.consensus_value || '—' }}</view></view>
              <view class="cell"><view class="muted sub">公布值</view><view class="strong">{{ e.actual_value || '未公布' }}</view></view>
              <view class="cell"><view class="muted sub">状态</view><view>{{ PUB[e.publication_status] || '—' }}</view></view>
            </view>
          </view>
        </view>
        <view class="muted sub">* {{ d.consensus_label }}；来源重要性为数据源自身评级。</view>
        <view v-if="hasAi" class="muted sub">{{ d.ai_curated_label }}</view>
      </view>
      </view>
      <view class="foot">{{ DISCLAIMER }}</view>
    </StateView>
  </view>
</template>

<script setup>
import { computed, reactive } from 'vue'
import StateView from '../../utils/StateView.vue'
import { useData } from '../../utils/useData'
import { DISCLAIMER } from '../../utils/config'

// 未登记的状态（含 unknown）显示「—」，不把上游原值的英文露给用户
const PUB = { published: '已公布', scheduled: '待公布', upcoming: '待公布', revised: '已修正', delayed: '延期' }
const params = reactive({ trade_date: '' })
const { env, state, detail, load } = useData('/api/v1/calendar', params)
const d = computed(() => env.value?.data || {})
const win = computed(() => d.value.window || {})
const events = computed(() => d.value.events || [])
const hasAi = computed(() => events.value.some((e) => e.ai_curated === true))
const grouped = computed(() => {
  const m = {}
  for (const e of events.value) (m[e.event_date || '日期未定'] = m[e.event_date || '日期未定'] || []).push(e)
  return Object.keys(m).map((day) => ({ day, list: m[day] }))
})
const stars = (v) => (v != null && Number(v) > 0 ? '★'.repeat(Number(v)) : '')
function setDate(v) { params.trade_date = v; load() }
</script>

<style>
.picker { padding: 10rpx 0; color: #2f5d9b; }
.day { font-weight: 600; margin: 12rpx 0 8rpx; }
.event { border-top: 1rpx solid #eef0f3; padding: 14rpx 0; }
.event-head { display: flex; justify-content: space-between; font-size: 22rpx; }
.event-title { font-weight: 600; margin: 6rpx 0; }
.ai-tag { margin-left: 12rpx; padding: 2rpx 12rpx; border-radius: 20rpx; font-size: 20rpx; font-weight: 400; background: #fff6e0; color: #8a5a00; }
.cell { width: 25%; padding-top: 8rpx; font-size: 24rpx; }
.strong { font-weight: 600; }
.sub { font-size: 22rpx; }
</style>
