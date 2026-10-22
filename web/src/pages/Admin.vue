<template>
  <section>
    <header class="page-head"><h1>管理后台</h1></header>
    <div class="seg" style="margin-bottom:12px">
      <button v-for="t in tabs" :key="t.k" :class="{ on: tab === t.k }" @click="tab = t.k; load()">{{ t.l }}</button>
    </div>
    <p v-if="msg" class="banner info">{{ msg }}</p>

    <div v-if="tab === 'users'" class="panel">
      <h2>用户</h2>
      <div class="toolbar">
        <label><input type="checkbox" v-model="expiringOnly" @change="load" /> 只看 7 天内到期</label>
      </div>
      <form v-if="grantFor" class="row grant" @submit.prevent="doGrant">
        <strong>为 {{ grantFor.username }} 开通</strong>
        <select v-model.number="grant.plan_id" @change="fillAmount">
          <option :value="null" disabled>选择套餐</option>
          <option v-for="p in plans" :key="p.id" :value="p.id">{{ p.name }}（{{ p.role_label }} {{ p.duration_days }} 天 ¥{{ yuan(p.price_cents) }}）{{ p.listed ? '' : ' · 未上架' }}</option>
        </select>
        <label>实收（元）<input type="number" step="0.01" min="0" v-model.number="grant.amount" /></label>
        <input v-model.trim="grant.channel" placeholder="收款渠道（微信/支付宝/转账）" />
        <input v-model.trim="grant.note" placeholder="备注" />
        <button class="btn primary" :disabled="!grant.plan_id">确认开通</button>
        <button type="button" class="btn" @click="grantFor = null">取消</button>
      </form>
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th class="left">用户名</th><th>基础角色</th><th>会员角色</th><th>到期</th><th>生效角色</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.id }}</td><td class="left">{{ u.username }}</td><td>{{ u.base_role }}</td><td>{{ u.member_role || '—' }}</td>
            <td>{{ u.member_expires_at ? date(u.member_expires_at) : '—' }}</td><td>{{ u.effective_role }}</td>
            <td>{{ u.disabled ? '已禁用' : '正常' }}</td>
            <td class="ops">
              <button class="btn" v-if="u.base_role !== 'admin'" @click="openGrant(u)">开通/续期</button>
              <button class="btn" v-if="u.member_role" @click="clearMember(u)">清除会员</button>
              <button class="btn" @click="patch(u, { disabled: !u.disabled })">{{ u.disabled ? '启用' : '禁用' }}</button>
              <button class="btn" @click="reset(u)">重置密码</button>
            </td>
          </tr>
        </tbody>
      </table></div>
    </div>

    <div v-if="tab === 'plans'" class="panel">
      <h2>套餐<small>新建默认未上架；已有开通记录的套餐只能下架不能删除</small></h2>
      <div class="table-wrap"><table>
        <thead><tr><th class="left">名称</th><th>等级</th><th>天数</th><th>标价（元）</th><th>排序</th><th>上架</th><th class="left">说明</th><th></th></tr></thead>
        <tbody><tr v-for="p in plans" :key="p.id">
          <td class="left"><input v-model.trim="p.name" /></td>
          <td><select v-model="p.role"><option v-for="r in sellable" :key="r.name" :value="r.name">{{ r.label }}</option></select></td>
          <td><input type="number" min="1" v-model.number="p.duration_days" class="num" /></td>
          <td><input type="number" min="0" step="0.01" :value="yuan(p.price_cents)" @change="p.price_cents = cents($event.target.value)" class="num" /></td>
          <td><input type="number" v-model.number="p.sort" class="num" /></td>
          <td><input type="checkbox" v-model="p.listed" /></td>
          <td class="left"><input v-model.trim="p.note" /></td>
          <td class="ops"><button class="btn" @click="savePlan(p)">保存</button><button class="btn" @click="delPlan(p)">删除</button></td>
        </tr></tbody>
      </table></div>
      <h3>新建套餐</h3>
      <form class="row" @submit.prevent="createPlan">
        <input v-model.trim="newPlan.name" placeholder="名称（如 VIP 月卡）" />
        <select v-model="newPlan.role"><option v-for="r in sellable" :key="r.name" :value="r.name">{{ r.label }}</option></select>
        <label>天数<input type="number" min="1" v-model.number="newPlan.duration_days" class="num" /></label>
        <label>标价（元）<input type="number" min="0" step="0.01" v-model.number="newPlan.price" class="num" /></label>
        <button class="btn">创建</button>
      </form>
      <h3>开通方式说明<small class="muted">（显示在会员套餐页，如客服微信号、付款后联系方式）</small></h3>
      <form class="col" @submit.prevent="saveContact">
        <textarea v-model="contact" rows="3" maxlength="500"></textarea>
        <button class="btn">保存说明</button>
      </form>
    </div>

    <div v-if="tab === 'grants'" class="panel">
      <h2>开通记录<small>只追加不修改；记错请冲正</small></h2>
      <form class="row" @submit.prevent="load">
        <label>起<input type="date" v-model="gf.start_date" /></label>
        <label>止<input type="date" v-model="gf.end_date" /></label>
        <select v-model="gf.source"><option value="">全部来源</option><option value="admin">后台开通</option><option value="invite">邀请码</option></select>
        <input v-model.trim="gf.username" placeholder="用户名" />
        <button class="btn">查询</button>
      </form>
      <div class="grid" style="margin-bottom:12px">
        <div class="stat"><div class="label">实收合计（元）</div><div class="value">{{ yuan(grants.total_cents) }}</div></div>
        <div class="stat"><div class="label">记录数</div><div class="value">{{ grants.count }}</div></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>时间</th><th class="left">用户</th><th>来源</th><th class="left">套餐</th><th>等级</th><th>天数</th><th>到期（开通后）</th><th>金额（元）</th><th class="left">渠道</th><th class="left">备注</th><th class="left">操作人</th><th></th></tr></thead>
        <tbody><tr v-for="g in grants.items" :key="g.id">
          <td>{{ new Date(g.at * 1000).toLocaleString('zh-CN') }}</td><td class="left">{{ g.username }}</td>
          <td>{{ SRC[g.source] || g.source }}</td><td class="left">{{ g.plan_name || '—' }}</td><td>{{ g.role || '—' }}</td>
          <td>{{ g.days || '—' }}</td><td>{{ g.expires_after ? date(g.expires_after) : '—' }}</td>
          <td :class="g.amount_cents < 0 ? 'fall' : ''">{{ yuan(g.amount_cents) }}</td>
          <td class="left">{{ g.channel === 'correction' ? `冲正 #${g.ref_id}` : (g.channel || '—') }}</td>
          <td class="left">{{ g.note || '—' }}</td><td class="left">{{ g.actor }}</td>
          <td><button class="btn" v-if="g.channel !== 'correction'" @click="correct(g)">冲正</button></td>
        </tr></tbody>
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

const tabs = [{ k: 'users', l: '用户' }, { k: 'plans', l: '套餐' }, { k: 'grants', l: '开通记录' }, { k: 'roles', l: '角色权限' },
  { k: 'invites', l: '邀请码' }, { k: 'audit', l: '审计' }]
const SRC = { admin: '后台开通', invite: '邀请码', payment: '在线支付' }
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
const yuan = (c) => ((c || 0) / 100).toFixed(2)
const cents = (v) => Math.round(Number(v || 0) * 100)
const expiringOnly = ref(false)
const plans = ref([])
const contact = ref('')
const newPlan = reactive({ name: '', role: 'vip', duration_days: 30, price: 0 })
const grantFor = ref(null)
const grant = reactive({ plan_id: null, amount: 0, channel: '', note: '' })
const grants = ref({ items: [], total_cents: 0, count: 0 })
const gf = reactive({ start_date: '', end_date: '', source: '', username: '' })
const sellable = computed(() => roles.value.filter((r) => r.name !== 'admin' && r.name !== 'free'))
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
  if (tab.value === 'users') {
    const r = await api('GET', `/api/v1/admin/users${expiringOnly.value ? '?expiring_within_days=7' : ''}`)
    if (r.ok) users.value = r.data.items
  }
  if (tab.value === 'users' || tab.value === 'plans') {
    const r = await api('GET', '/api/v1/admin/plans')
    if (r.ok) { plans.value = r.data.items; contact.value = r.data.contact_text }
  }
  if (tab.value === 'plans') {
    const r = await api('GET', '/api/v1/admin/roles')
    if (r.ok) roles.value = r.data.items
  }
  if (tab.value === 'grants') {
    const qs = new URLSearchParams(Object.entries(gf).filter(([, v]) => v))
    const r = await api('GET', `/api/v1/admin/grants${qs.toString() ? `?${qs}` : ''}`)
    if (r.ok) grants.value = r.data
  }
  if (tab.value === 'invites') { const r = await api('GET', '/api/v1/admin/invites'); if (r.ok) invites.value = r.data.items }
  if (tab.value === 'audit') { const r = await api('GET', '/api/v1/admin/audit'); if (r.ok) audit.value = r.data.items }
}
async function patch(u, body) {
  const r = await api('PATCH', `/api/v1/admin/users/${u.id}`, body)
  msg.value = r.ok ? '已更新' : (r.data.detail || '失败')
  load()
}
// 开通统一走 grant 接口, 保证每次开通都有金额记录
function openGrant(u) { grantFor.value = u; Object.assign(grant, { plan_id: null, amount: 0, channel: '', note: '' }) }
function fillAmount() { const p = plans.value.find((x) => x.id === grant.plan_id); if (p) grant.amount = p.price_cents / 100 }
async function doGrant() {
  const r = await api('POST', `/api/v1/admin/users/${grantFor.value.id}/grant`, {
    plan_id: grant.plan_id, amount_cents: cents(grant.amount), channel: grant.channel, note: grant.note })
  msg.value = r.ok ? `已开通：${r.data.role_label}，到期 ${date(r.data.member_expires_at)}` : (r.data.detail || '失败')
  if (r.ok) { grantFor.value = null; load() }
}
async function clearMember(u) {
  if (!window.confirm(`清除 ${u.username} 的会员（立即恢复为基础角色）？`)) return
  await patch(u, { clear_member: true })
}
async function createPlan() {
  const r = await api('POST', '/api/v1/admin/plans', { name: newPlan.name, role: newPlan.role,
    duration_days: newPlan.duration_days, price_cents: cents(newPlan.price) })
  msg.value = r.ok ? '已创建（未上架，勾选上架后保存才对用户可见）' : (r.data.detail || '失败')
  load()
}
async function savePlan(p) {
  const r = await api('PUT', `/api/v1/admin/plans/${p.id}`, p)
  msg.value = r.ok ? '套餐已保存' : (r.data.detail || '失败')
  load()
}
async function delPlan(p) {
  if (!window.confirm(`删除套餐 ${p.name}？`)) return
  const r = await api('DELETE', `/api/v1/admin/plans/${p.id}`)
  msg.value = r.ok ? '已删除' : (r.data.detail || '失败')
  load()
}
async function saveContact() {
  const r = await api('PUT', '/api/v1/admin/plan-contact', { text: contact.value })
  msg.value = r.ok ? '开通方式说明已保存' : (r.data.detail || '失败')
}
async function correct(g) {
  const amt = window.prompt(`冲正记录 #${g.id}：输入冲正金额（元，可为负数，如 -900）`)
  if (!amt) return
  const note = window.prompt('冲正说明（必填）')
  if (!note) return
  const r = await api('POST', `/api/v1/admin/grants/${g.id}/correction`, { amount_cents: cents(amt), note })
  msg.value = r.ok ? '已追加冲正记录' : (r.data.detail || '失败')
  load()
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
.grant { background: #f6f8fb; padding: 10px; border-radius: 6px; }
.num { width: 90px; }
.col { display: grid; gap: 8px; max-width: 520px; }
.codes { background: #f1f4f8; padding: 10px; border-radius: 6px; font-family: var(--mono); }
input, select { padding: 7px 9px; border: 1px solid var(--line); border-radius: 6px; }
</style>
