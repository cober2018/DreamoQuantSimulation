<template>
  <section>
    <header class="page-head">
      <h1>会员套餐</h1>
      <div class="question">当前等级：{{ session.user?.role_label }}<template v-if="session.user?.member_expires_at">，到期 {{ date(session.user.member_expires_at) }}</template></div>
    </header>
    <div v-if="loading" class="empty-state">加载中…</div>
    <div v-else-if="error" class="banner error"><span>{{ error }}</span><button class="btn" @click="load">重试</button></div>
    <template v-else>
      <div v-if="!items.length" class="empty-state">暂未开放购买，如需开通请联系管理员。</div>
      <div class="plans">
        <div class="panel plan" v-for="p in items" :key="p.id">
          <div class="muted">{{ p.role_label }}</div>
          <h2>{{ p.name }}</h2>
          <div class="price">¥{{ (p.price_cents / 100).toFixed(2) }}<small> / {{ p.duration_days }} 天</small></div>
          <p class="note" v-if="p.note">{{ p.note }}</p>
        </div>
      </div>
      <div class="panel">
        <h2>开通方式</h2>
        <p class="contact">{{ contact || '请联系管理员开通。' }}</p>
        <p class="note">付款后由管理员为您的账号（用户名：{{ session.user?.username }}）开通，开通后无需重新登录即可生效。
          同等级续期从原到期日顺延；升级从开通当日起算。也可在“我的账号”使用邀请码。</p>
      </div>
    </template>
    <footer class="footer">本平台仅提供证券信息汇总与历史数据统计，不构成任何证券投资建议。</footer>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { api, session } from '../auth'

const items = ref([])
const contact = ref('')
const loading = ref(true)
const error = ref('')
const date = (t) => new Date(t * 1000).toLocaleDateString('zh-CN')

async function load() {
  loading.value = true
  error.value = ''
  const r = await api('GET', '/api/v1/plans')
  if (r.ok) { items.value = r.data.items; contact.value = r.data.contact_text } else error.value = r.data.detail || '套餐信息暂时无法加载'
  loading.value = false
}
onMounted(load)
</script>

<style scoped>
.plans { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); margin-bottom: 16px; }
.plan h2 { margin: 4px 0 8px; }
.price { font-size: 24px; font-weight: 600; color: var(--accent); }
.price small { font-size: 13px; color: var(--muted); font-weight: 400; }
.contact { white-space: pre-wrap; font-size: 14px; }
</style>
