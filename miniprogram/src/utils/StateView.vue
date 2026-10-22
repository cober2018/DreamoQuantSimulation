<template>
  <view>
    <view v-if="expireDays !== null" class="note">{{ session.user.role_label }} 将于 {{ expireDays }} 天后到期，续期请到“我的”查看会员套餐。</view>
    <view v-if="state === 'loading'" class="state">加载中…</view>
    <view v-else-if="state === 'login'" class="state">
      <view>请先登录后查看数据</view>
      <view class="btn" @click="goMine">去登录</view>
    </view>
    <view v-else-if="state === 'forbidden'" class="card">
      <view class="card-title">{{ preview ? `开通 ${need} 后可查看` : '暂无权限' }}</view>
      <view class="card-sub">{{ detail || '当前等级无法查看该内容' }}</view>
      <view v-for="m in preview || []" :key="m" class="row"><text>· {{ m }}</text></view>
      <view class="btn" @click="goMine">查看会员套餐</view>
    </view>
    <view v-else-if="state === 'busy'" class="state">
      <view>请求过于频繁，请稍后再试</view>
      <view class="btn ghost" @click="$emit('retry')">重试</view>
    </view>
    <view v-else-if="state === 'empty'" class="state">暂无可用数据（上游数据维护中），请稍后再看</view>
    <view v-else-if="state === 'error'" class="state">
      <view>数据服务暂时不可用，请稍后重试</view>
      <view class="btn ghost" @click="$emit('retry')">重试</view>
    </view>
    <template v-else>
      <view v-if="gapItems.length" class="note">部分内容暂缺：{{ gapItems.join('、') }}。其余内容正常展示。</view>
      <slot />
    </template>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { session } from './auth'

// 预告只列指标名称, 不含数值; 真正的权限边界在服务端
const PREVIEW = {
  'page.participation': ['成交额及历史分位', '主动卖出占比', '股权风险溢价（ERP）', '涨停结构', '聪明钱五因子统计', '风格相对强度'],
  'page.industries': ['行业涨跌幅排名', '行业资金净流入排名'],
  'page.themes': ['涨停/炸板/跌停结构', '连板梯队', '题材榜'],
}
const props = defineProps({ state: String, detail: String, env: Object, perm: String })
defineEmits(['retry'])
const goMine = () => uni.switchTab({ url: '/pages/mine/index' })
const preview = computed(() => PREVIEW[props.perm])
const need = computed(() => session.user?.perm_min_role?.[props.perm] || '会员')
const gapItems = computed(() => (props.env?.status === 'partial'
  ? [...new Set((props.env.gaps || []).map((g) => g.item).filter(Boolean))] : []))
const expireDays = computed(() => {
  const t = session.user?.member_expires_at
  if (!t) return null
  const d = Math.ceil((t * 1000 - Date.now()) / 86400000)
  return d >= 0 && d <= 7 ? d : null
})
</script>
