<template>
  <section>
    <header class="page-head"><h1>管理后台</h1></header>
    <div class="seg" style="margin-bottom:12px">
      <button v-for="t in tabs" :key="t.k" :class="{ on: tab === t.k }" @click="tab = t.k; load()">{{ t.l }}</button>
    </div>
    <p v-if="msg" class="banner info">{{ msg }}</p>

    <div v-if="tab === 'users'" class="panel">
      <h2>用户</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th class="left">用户名</th><th>基础角色</th><th>会员角色</th><th>到期</th><th>生效角色</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.id }}</td><td class="left">{{ u.username }}</td><td>{{ u.base_role }}</td><td>{{ u.member_role || '—' }}</td>
            <td>{{ u.member_expires_at ? date(u.member_expires_at) : '—' }}</td><td>{{ u.effective_role }}</td>
            <td>{{ u.disabled ? '已禁用' : '正常' }}</td>
            <td class="ops">
              <select @change="setMember(u, $event.target.value)">
                <option value="">设会员角色…</option>
                <option v-for="r in roles" :key="r.name" :value="r.name">{{ r.label }}</option>
              </select>
              <button class="btn" @click="patch(u, { disabled: !u.disabled })">{{ u.disabled ? '启用' : '禁用' }}</button>
              <button class="btn" @click="reset(u)">重置密码</button>
            </td>
          </tr>
        </tbody>
      </table></div>
    </div>

    <div v-if="tab === 'roles'" class="panel">
      <h2>角色与权限<small>改动对用户下一次请求立即生效；内置角色不可删除</small></h2>
      <div v-for="r in roles" :key="r.name" class="role">
        <h3>{{ r.label }} <small>{{ r.name }}{{ r.builtin ? ' · 内置' : '' }}</small></h3>
        <div class="perms">
          <label v-for="p in boolPerms" :key="p"><input type="checkbox" :checked="!!r.permissions[p]" @change="toggle(r, p, $event.target.checked)" /> {{ permLabel[p] || p }}</label>
          <label v-for="p in numPerms" :key="p">{{ permLabel[p] }}
            <input type="number" min="1" :max="numeric[p][1]" :value="r.permissions[p] || ''" @change="setNum(r, p, $event.target.value)" /></label>
        </div>
        <button class="btn" @click="saveRole(r)">保存</button>
        <button v-if="!r.builtin" class="btn" @click="delRole(r)">删除</button>
      </div>
      <h3>新建角色</h3>
      <form class="row" @submit.prevent="createRole">
        <input v-model.trim="newRole.name" placeholder="标识 (如 trial)" />
        <input v-model.trim="newRole.label" placeholder="名称" />
        <button class="btn">创建（权限创建后再勾选）</button>
      </form>
    </div>

    <div v-if="tab === 'invites'" class="panel">
      <h2>邀请码</h2>
      <form class="row" @submit.prevent="createInvites">
        <select v-model="inv.role"><option v-for="r in roles.filter((x) => x.name !== 'admin')" :key="r.name" :value="r.name">{{ r.label }}</option></select>
        <label>有效天数<input type="number" v-model.number="inv.duration_days" min="1" /></label>
        <label>数量<input type="number" v-model.number="inv.count" min="1" max="200" /></label>
        <label>每码可用次数<input type="number" v-model.number="inv.max_uses" min="1" /></label>
        <input v-model.trim="inv.note" placeholder="备注" />
        <button class="btn">生成</button>
      </form>
      <pre v-if="newCodes.length" class="codes">{{ newCodes.join('\n') }}</pre>
      <p v-if="newCodes.length" class="note">明文仅此一次显示，请立即保存；库内只存哈希。</p>
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>尾号</th><th>角色</th><th>天数</th><th>已用/上限</th><th>状态</th><th class="left">备注</th><th></th></tr></thead>
        <tbody><tr v-for="i in invites" :key="i.id">
          <td>{{ i.id }}</td><td>{{ i.hint }}</td><td>{{ i.role }}</td><td>{{ i.duration_days }}</td>
          <td>{{ i.used_count }}/{{ i.max_uses }}</td><td>{{ i.status }}</td><td class="left">{{ i.note }}</td>
          <td><button class="btn" v-if="i.status === 'active'" @click="revoke(i)">作废</button></td>
        </tr></tbody>
      </table></div>
    </div>

    <div v-if="tab === 'audit'" class="panel">
      <h2>审计日志（最近 200 条）</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>时间</th><th class="left">操作者</th><th class="left">动作</th><th class="left">对象</th><th>IP</th></tr></thead>
        <tbody><tr v-for="a in audit" :key="a.id">
          <td>{{ new Date(a.at * 1000).toLocaleString('zh-CN') }}</td><td class="left">{{ a.actor }}</td>
          <td class="left">{{ a.action }}</td><td class="left">{{ a.target }}</td><td>{{ a.ip }}</td>
        </tr></tbody>
      </table></div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '../auth'

const tabs = [{ k: 'users', l: '用户' }, { k: 'roles', l: '角色权限' }, { k: 'invites', l: '邀请码' }, { k: 'audit', l: '审计' }]
const tab = ref('users')
const msg = ref('')
const users = ref([])
const roles = ref([])
const allPerms = ref([])
const numeric = ref({})
const invites = ref([])
const audit = ref([])
const newCodes = ref([])
const newRole = reactive({ name: '', label: '' })
const inv = reactive({ role: 'vip', duration_days: 30, count: 1, max_uses: 1, note: '' })
const date = (t) => new Date(t * 1000).toLocaleDateString('zh-CN')
const permLabel = {
  'page.overview': '市场总览', 'page.participation': '参与度与资金环境', 'page.industries': '行业比较与轮动',
  'page.themes': '题材与涨跌结构', 'page.history': '历史复盘', 'page.calendar': '事件日历',
  'data.detail': '下钻明细', 'client.web': '网页端', 'client.mp': '小程序', 'admin.console': '管理后台',
  'data.history_days': '可查历史（交易日）', max_sessions: '同时在线会话数',
}
const numPerms = computed(() => Object.keys(numeric.value))
const boolPerms = computed(() => allPerms.value.filter((p) => !numeric.value[p]))

async function load() {
  msg.value = ''
  if (tab.value === 'users' || tab.value === 'roles' || tab.value === 'invites') {
    const r = await api('GET', '/api/v1/admin/roles')
    if (r.ok) { roles.value = r.data.items; allPerms.value = r.data.all_permissions; numeric.value = r.data.numeric }
  }
  if (tab.value === 'users') { const r = await api('GET', '/api/v1/admin/users'); if (r.ok) users.value = r.data.items }
  if (tab.value === 'invites') { const r = await api('GET', '/api/v1/admin/invites'); if (r.ok) invites.value = r.data.items }
  if (tab.value === 'audit') { const r = await api('GET', '/api/v1/admin/audit'); if (r.ok) audit.value = r.data.items }
}
async function patch(u, body) {
  const r = await api('PATCH', `/api/v1/admin/users/${u.id}`, body)
  msg.value = r.ok ? '已更新' : (r.data.detail || '失败')
  load()
}
async function setMember(u, role) {
  if (!role) return
  const days = Number(window.prompt('会员有效天数', '30'))
  if (!days) return
  await patch(u, { member_role: role, member_expires_at: Date.now() / 1000 + days * 86400 })
}
async function reset(u) {
  if (!window.confirm(`重置 ${u.username} 的密码？`)) return
  const r = await api('POST', `/api/v1/admin/users/${u.id}/reset-password`)
  msg.value = r.ok ? `临时密码（仅此一次）：${r.data.temporary_password}` : (r.data.detail || '失败')
}
function toggle(r, p, on) { if (on) r.permissions[p] = 1; else delete r.permissions[p] }
function setNum(r, p, v) { if (v) r.permissions[p] = Number(v); else delete r.permissions[p] }
async function saveRole(r) {
  const res = await api('PUT', `/api/v1/admin/roles/${r.name}`, { label: r.label, permissions: r.permissions })
  msg.value = res.ok ? '角色已保存，即时生效' : (res.data.detail || '失败')
}
async function createRole() {
  const res = await api('POST', '/api/v1/admin/roles', { name: newRole.name, label: newRole.label, permissions: { 'client.web': 1, 'page.overview': 1, 'data.history_days': 5, max_sessions: 1 } })
  msg.value = res.ok ? '已创建' : (res.data.detail || '失败')
  load()
}
async function delRole(r) {
  if (!window.confirm(`删除角色 ${r.label}？`)) return
  const res = await api('DELETE', `/api/v1/admin/roles/${r.name}`)
  msg.value = res.ok ? '已删除' : (res.data.detail || '失败')
  load()
}
async function createInvites() {
  const res = await api('POST', '/api/v1/admin/invites', { ...inv })
  if (res.ok) { newCodes.value = res.data.codes; load() } else msg.value = res.data.detail || '失败'
}
async function revoke(i) { await api('POST', `/api/v1/admin/invites/${i.id}/revoke`); load() }
onMounted(load)
</script>

<style scoped>
.ops { display: flex; gap: 6px; justify-content: center; }
.role { border-top: 1px solid var(--line); padding: 12px 0; }
.perms { display: flex; flex-wrap: wrap; gap: 10px 18px; margin: 8px 0; font-size: 13px; }
.perms input[type=number] { width: 70px; margin-left: 6px; }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: end; margin-bottom: 12px; }
.codes { background: #f1f4f8; padding: 10px; border-radius: 6px; font-family: var(--mono); }
input, select { padding: 7px 9px; border: 1px solid var(--line); border-radius: 6px; }
</style>
