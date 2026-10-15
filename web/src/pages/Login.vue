<template>
  <div class="auth-wrap">
    <div class="panel auth-card">
      <h1>{{ mode === 'login' ? '登录' : '注册' }}</h1>
      <p class="muted">量化数据洞察 · 仅提供信息汇总与历史统计</p>
      <form @submit.prevent="submit">
        <label>用户名<input v-model.trim="username" autocomplete="username" required minlength="3" maxlength="32" /></label>
        <label>密码<input v-model="password" type="password" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" required /></label>
        <template v-if="mode === 'register'">
          <label>邀请码（选填）<input v-model.trim="invite" placeholder="XXXX-XXXX-XXXX" /></label>
          <label class="check">
            <input type="checkbox" v-model="terms" />
            我已阅读并同意 <router-link to="/terms">《用户协议与隐私政策》</router-link>
          </label>
          <p class="note">密码至少 10 位，需包含大小写字母与数字中的至少两类。</p>
        </template>
        <p v-if="error" class="banner error">{{ error }}</p>
        <button class="btn primary" :disabled="busy">{{ mode === 'login' ? '登录' : '注册并登录' }}</button>
      </form>
      <p class="switch">
        <a href="#" @click.prevent="mode = mode === 'login' ? 'register' : 'login'">
          {{ mode === 'login' ? '没有账号？注册' : '已有账号？登录' }}
        </a>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { login, register } from '../auth'

const router = useRouter()
const route = useRoute()
const mode = ref('login')
const username = ref('')
const password = ref('')
const invite = ref('')
const terms = ref(false)
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    if (mode.value === 'register') {
      const r = await register(username.value, password.value, terms.value, invite.value)
      if (!r.ok) { error.value = r.data.detail || '注册失败'; return }
    }
    const r = await login(username.value, password.value)
    if (!r.ok) { error.value = r.data.detail || '登录失败'; return }
    router.replace(r.data.user.must_change_password ? '/account' : (route.query.next || '/overview'))
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.auth-wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.auth-card { width: 360px; max-width: 100%; }
.auth-card h1 { margin: 0 0 4px; }
form { display: grid; gap: 12px; margin-top: 12px; }
label { display: grid; gap: 4px; font-size: 13px; color: var(--muted); }
input:not([type=checkbox]) { padding: 9px 10px; border: 1px solid var(--line); border-radius: 6px; font-size: 14px; }
.check { display: flex; gap: 8px; align-items: center; }
.btn.primary { background: var(--accent); color: #fff; border: 0; padding: 10px; border-radius: 6px; cursor: pointer; }
.switch { text-align: center; margin-top: 12px; font-size: 13px; }
</style>
