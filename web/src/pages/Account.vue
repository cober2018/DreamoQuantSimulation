<template>
  <section>
    <header class="page-head"><h1>我的账号</h1></header>
    <div class="panel">
      <h2>账号信息</h2>
      <div class="grid">
        <div class="stat"><div class="label">用户名</div><div class="value">{{ u.username }}</div></div>
        <div class="stat"><div class="label">当前等级</div><div class="value">{{ u.role_label }}</div>
          <div class="sub" v-if="u.member_expires_at">到期 {{ date(u.member_expires_at) }}（剩 {{ leftDays }} 天）</div></div>
        <div class="stat"><div class="label">可查看历史</div><div class="value">{{ u.history_days }} 个交易日</div></div>
      </div>
      <p class="banner info" v-if="u.must_change_password">请先修改初始/临时密码，否则无法访问数据页面。</p>
      <p v-if="leftDays !== null && leftDays <= 7" class="banner fixture">会员将于 {{ leftDays }} 天后到期，续期请查看会员套餐。</p>
      <router-link class="btn primary" to="/plans">{{ u.member_expires_at ? '续期 / 升级' : '开通会员' }}</router-link>
    </div>

    <div class="panel">
      <h2>邀请码兑换</h2>
      <p class="muted">已获得邀请码可在此兑换；付费开通请查看<router-link to="/plans">会员套餐</router-link>。</p>
      <form class="row" @submit.prevent="redeem">
        <input v-model.trim="code" placeholder="XXXX-XXXX-XXXX" />
        <button class="btn" :disabled="!code">兑换</button>
      </form>
      <p v-if="redeemMsg" :class="['banner', redeemOk ? 'info' : 'error']">{{ redeemMsg }}</p>
    </div>

    <div class="panel">
      <h2>修改密码</h2>
      <form class="col" @submit.prevent="changePw">
        <input v-model="oldPw" type="password" placeholder="原密码" autocomplete="current-password" />
        <input v-model="newPw" type="password" placeholder="新密码（至少 10 位，含大小写与数字中至少两类）" autocomplete="new-password" />
        <button class="btn" :disabled="!oldPw || !newPw">修改并重新登录</button>
      </form>
      <p v-if="pwMsg" class="banner error">{{ pwMsg }}</p>
    </div>

    <div class="panel"><button class="btn" @click="out">退出登录</button></div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, logout, reloadMe, session } from '../auth'

const router = useRouter()
const u = computed(() => session.user || {})
const code = ref('')
const redeemMsg = ref('')
const redeemOk = ref(false)
const oldPw = ref('')
const newPw = ref('')
const pwMsg = ref('')
const date = (t) => new Date(t * 1000).toLocaleDateString('zh-CN')
const leftDays = computed(() => (u.value.member_expires_at
  ? Math.max(0, Math.ceil((u.value.member_expires_at * 1000 - Date.now()) / 86400000)) : null))

async function redeem() {
  const r = await api('POST', '/api/v1/invite/redeem', { code: code.value })
  redeemOk.value = r.ok
  redeemMsg.value = r.ok ? `兑换成功：${r.data.role_label}，到期 ${date(r.data.member_expires_at)}` : (r.data.detail || '兑换失败')
  if (r.ok) { code.value = ''; await reloadMe() }
}
async function changePw() {
  const r = await api('POST', '/api/v1/auth/change-password', { old_password: oldPw.value, new_password: newPw.value })
  if (!r.ok) { pwMsg.value = r.data.detail || '修改失败'; return }
  await logout()
  router.replace('/login')
}
async function out() { await logout(); router.replace('/login') }
</script>

<style scoped>
.row { display: flex; gap: 8px; }
.col { display: grid; gap: 8px; max-width: 420px; }
input { padding: 9px 10px; border: 1px solid var(--line); border-radius: 6px; font-size: 14px; }
</style>
