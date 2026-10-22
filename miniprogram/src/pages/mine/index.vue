<template>
  <view>
    <view class="card" v-if="!session.user">
      <view class="card-title">登录</view>
      <view class="card-sub">使用微信登录；首次登录需同意用户协议与隐私政策。</view>
      <view class="muted" style="font-size:24rpx">本平台仅提供信息汇总与历史数据统计，不构成投资建议；会员可通过邀请码或联系客服线下开通。</view>
      <label style="display:flex;align-items:center;margin-top:16rpx" @click="terms = !terms">
        <checkbox :checked="terms" /> <text style="font-size:24rpx">我已阅读并同意用户协议与隐私政策</text>
      </label>
      <view class="btn" @click="login">微信登录</view>
      <view v-if="msg" class="note">{{ msg }}</view>
    </view>

    <view v-else>
      <view class="card">
        <view class="card-title">{{ session.user.username }}</view>
        <view class="card-sub">当前等级：{{ session.user.role_label }}
          <text v-if="session.user.member_expires_at"> · 到期 {{ date(session.user.member_expires_at) }}（剩 {{ leftDays }} 天）</text></view>
        <view class="card-sub">可查看历史 {{ session.user.history_days }} 个交易日</view>
      </view>
      <view v-if="leftDays !== null && leftDays <= 7" class="note">会员将于 {{ leftDays }} 天后到期，续期方式见下方会员套餐。</view>
      <view class="card">
        <view class="card-title">会员套餐</view>
        <view v-if="!plans.length" class="card-sub">暂未开放购买，如需开通请联系管理员。</view>
        <view class="row" v-for="p in plans" :key="p.id">
          <text>{{ p.name }}（{{ p.duration_days }} 天）</text><text>¥{{ (p.price_cents / 100).toFixed(2) }}</text>
        </view>
        <view class="card-sub" style="white-space:pre-wrap;margin-top:12rpx">{{ contact || '请联系管理员开通。' }}</view>
        <view class="muted" style="font-size:22rpx;margin-top:8rpx">付款后由管理员为您的账号（{{ session.user.username }}）开通，同等级续期从原到期日顺延。</view>
      </view>
      <view class="card">
        <view class="card-title">邀请码兑换</view>
        <input class="input" v-model="code" placeholder="XXXX-XXXX-XXXX" />
        <view class="btn" @click="redeem">兑换</view>
      </view>
      <view class="card">
        <view class="card-title">绑定网页账号</view>
        <view class="card-sub">绑定后与网页端共用等级与会员期限。</view>
        <input class="input" v-model="bindUser" placeholder="网页用户名" />
        <input class="input" v-model="bindPw" password placeholder="网页密码" />
        <view class="btn ghost" @click="bind">绑定</view>
      </view>
      <view v-if="msg" class="note">{{ msg }}</view>
      <view class="btn ghost" style="margin:20rpx" @click="out">退出登录</view>
    </view>
    <view class="foot">{{ DISCLAIMER }}</view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { session, wechatLogin, signedRequest, logout } from '../../utils/auth'
import { DISCLAIMER } from '../../utils/config'

const terms = ref(false)
const msg = ref('')
const code = ref('')
const bindUser = ref('')
const bindPw = ref('')
const date = (t) => new Date(t * 1000).toLocaleDateString('zh-CN')
const plans = ref([])
const contact = ref('')
const leftDays = computed(() => (session.user?.member_expires_at
  ? Math.max(0, Math.ceil((session.user.member_expires_at * 1000 - Date.now()) / 86400000)) : null))
async function loadPlans() {
  if (!session.user) return
  // 管理员开通后无需重新登录: 进入"我的"即刷新等级与到期时间
  const me = await signedRequest('GET', '/api/v1/auth/me')
  if (me.ok) session.user = me.data
  const r = await signedRequest('GET', '/api/v1/plans')
  if (r.ok) { plans.value = r.data.items; contact.value = r.data.contact_text }
}
onShow(loadPlans)

async function login() {
  msg.value = ''
  const r = await wechatLogin(terms.value)
  if (!r.ok) msg.value = r.data.detail || (r.status === 503 ? '微信登录尚未开通' : '登录失败')
  else loadPlans()
}
async function redeem() {
  const r = await signedRequest('POST', '/api/v1/invite/redeem', {}, { code: code.value })
  if (r.ok) {
    msg.value = `兑换成功：${r.data.role_label}`
    const me = await signedRequest('GET', '/api/v1/auth/me')
    if (me.ok) session.user = me.data
  } else msg.value = r.data.detail || '兑换失败'
}
async function bind() {
  const r = await signedRequest('POST', '/api/v1/auth/wechat/bind', {}, { username: bindUser.value, password: bindPw.value })
  if (r.ok) { session.token = r.data.access_token; session.signKey = r.data.sign_key; session.user = r.data.user; msg.value = '绑定成功' }
  else msg.value = r.data.detail || '绑定失败'
}
async function out() { await logout() }
</script>
