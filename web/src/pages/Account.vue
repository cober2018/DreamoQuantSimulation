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
      <p v-if="trialText()" class="banner info">{{ trialText() }}</p>
      <p v-if="leftDays !== null && leftDays <= 7" class="banner fixture">会员将于 {{ leftDays }} 天后到期<template v-if="payOn()">，续期请查看会员套餐</template>。</p>
      <router-link v-if="payOn()" class="btn primary" to="/plans">{{ u.member_expires_at ? '续期 / 升级' : '开通会员' }}</router-link>
    </div>

    <div v-if="payOn()" class="panel">
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

    <div v-if="mcp" class="panel">
      <h2>MCP 数据接入（内测）</h2>
      <p class="muted">在支持 MCP 的大模型客户端里只读调用本平台数据，等级与网页一致。当前限额：每分钟 {{ mcp.limits.per_minute }} 次、24 小时 {{ mcp.limits.per_day }} 次；每人最多 {{ mcp.max_active }} 把有效令牌。</p>
      <p>服务地址：<code>{{ endpoint }}</code></p>
      <form class="row" @submit.prevent="createToken">
        <input v-model.trim="tokenName" maxlength="32" placeholder="备注（如 Claude Desktop）" />
        <select v-model="tokenDays">
          <option :value="30">30 天有效</option><option :value="90">90 天有效</option>
          <option :value="180">180 天有效</option><option :value="null">长期有效</option>
        </select>
        <button class="btn primary">生成令牌</button>
      </form>
      <p v-if="mcpMsg" class="banner error">{{ mcpMsg }}</p>
      <div v-if="newToken" class="banner info">
        <div>新令牌只显示这一次，请立即复制保存：</div>
        <code class="token">{{ newToken }}</code>
        <button class="btn" type="button" @click="copy(newToken)">复制</button>
      </div>
      <div class="sub-h">客户端配置（把令牌填进 Authorization）</div>
      <pre class="snippet">{{ snippet }}</pre>
      <button class="btn" type="button" @click="copy(snippet)">复制配置</button>
      <div class="table-wrap" v-if="mcp.items.length"><table>
        <thead><tr><th class="left">令牌</th><th class="left">备注</th><th>创建</th><th>到期</th><th>最近使用</th><th>状态</th><th></th></tr></thead>
        <tbody><tr v-for="t in mcp.items" :key="t.id">
          <td class="left"><code>{{ t.prefix }}…</code></td><td class="left">{{ t.name || '-' }}</td>
          <td>{{ date(t.created_at) }}</td><td>{{ t.expires_at ? date(t.expires_at) : '长期' }}</td>
          <td>{{ t.last_used_at ? date(t.last_used_at) : '-' }}</td><td>{{ STATUS[t.status] || t.status }}</td>
          <td><button v-if="t.status === 'active'" class="btn" @click="revokeToken(t)">吊销</button></td>
        </tr></tbody>
      </table></div>
    </div>

    <div class="panel"><button class="btn" @click="out">退出登录</button></div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, logout, payOn, reloadMe, session, trialText } from '../auth'

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

// MCP 内测：接口 404（未开启）或 403（不在名单）时整块不显示
const STATUS = { active: '有效', revoked: '已吊销', expired: '已过期', invalidated: '改密后失效' }
const mcp = ref(null)
const tokenName = ref('')
const tokenDays = ref(90)
const newToken = ref('')
const mcpMsg = ref('')
const endpoint = computed(() => `${location.origin}${mcp.value?.endpoint_path || '/mcp'}`)
const snippet = computed(() => JSON.stringify({ mcpServers: { 'zhishu-xingyao': {
  type: 'http', url: endpoint.value, headers: { Authorization: `Bearer ${newToken.value || '<你的令牌>'}` } } } }, null, 2))
async function loadTokens() {
  const r = await api('GET', '/api/v1/account/mcp-tokens')
  mcp.value = r.ok ? r.data : null
}
async function createToken() {
  mcpMsg.value = ''
  const r = await api('POST', '/api/v1/account/mcp-tokens', { name: tokenName.value, expires_days: tokenDays.value })
  if (!r.ok) { mcpMsg.value = r.data.detail || '生成失败'; return }
  newToken.value = r.data.token
  tokenName.value = ''
  await loadTokens()
}
async function revokeToken(t) {
  if (!confirm(`吊销令牌 ${t.prefix}…？使用它的客户端将立即无法读取数据。`)) return
  const r = await api('POST', `/api/v1/account/mcp-tokens/${t.id}/revoke`)
  if (!r.ok) { mcpMsg.value = r.data.detail || '吊销失败'; return }
  await loadTokens()
}
const copy = (text) => navigator.clipboard?.writeText(text)
onMounted(loadTokens)
</script>

<style scoped>
.row { display: flex; gap: 8px; }
.col { display: grid; gap: 8px; max-width: 420px; }
input { padding: 9px 10px; border: 1px solid var(--line); border-radius: 6px; font-size: 14px; }
select { padding: 9px 10px; border: 1px solid var(--line); border-radius: 6px; font-size: 14px; }
.token { display: block; margin: 6px 0; word-break: break-all; }
.snippet { background: var(--info-bg); padding: 10px; border-radius: 6px; font-size: 12px; overflow: auto; }
</style>
