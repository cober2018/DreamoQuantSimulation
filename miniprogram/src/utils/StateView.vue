<template>
  <view>
    <view v-if="state === 'loading'" class="state">加载中…</view>
    <view v-else-if="state === 'login'" class="state">
      <view>请先登录后查看数据</view>
      <view class="btn" @click="goMine">去登录</view>
    </view>
    <view v-else-if="state === 'forbidden'" class="state">
      <view>{{ detail || '当前账号权限不足' }}</view>
      <view class="btn ghost" @click="goMine">使用邀请码升级</view>
    </view>
    <view v-else-if="state === 'error'" class="state">
      <view>{{ detail }}</view>
      <view class="btn ghost" @click="$emit('retry')">重试</view>
    </view>
    <slot v-else />
  </view>
</template>

<script setup>
defineProps({ state: String, detail: String })
defineEmits(['retry'])
const goMine = () => uni.switchTab({ url: '/pages/mine/index' })
</script>
