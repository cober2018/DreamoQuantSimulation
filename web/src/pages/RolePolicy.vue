<template>
  <div>
    <div class="panel">
      <h2>角色权限配置<small>按角色 × 看板 × 指标配置；看差异、填原因、二次确认后生效</small></h2>
      <p v-if="!cat" class="muted">加载中…</p>
      <template v-else>
        <div class="row-info">
          <span v-if="active">当前生效：版本 {{ active.version }} · {{ dt(active.activated_at) }} · 确认人 {{ active.approved_by }}</span>
          <span v-else>尚无生效的策略版本</span>
          <span v-if="cat.requires_second_approver" class="tag">双人审批已开启</span>
        </div>
        <p v-for="p in pending" :key="p.version" class="banner info">
          {{ p.status === 'draft' ? '未确认草稿' : '待审批版本' }}：版本 {{ p.version }}（{{ p.created_by }}，{{ p.reason }}）
          <button class="btn" @click="openDraft(p)">查看差异</button>
        </p>
        <p v-if="!accountOk(selAccount)" class="banner fixture">暂时无法查询账号 {{ selAccount }} 的上游上限：配置页只读，不能提交。</p>
        <div v-if="!active && !pending.length" class="banner info">
          尚无生效的路由规则：所有数据请求将按"没有生效规则"拒绝（切到事实视图的页面）。先创建版本 1：内置角色全部路由到 {{ Object.keys(cat.accounts)[0] }}（D7 7.2）。
          <div class="row" style="margin-top:8px">
            <input v-model.trim="legacyReason" placeholder="原因（必填）" style="flex:1" />
            <button class="btn" :disabled="!legacyReason" @click="initRoutes">创建路由规则版本 1</button>
          </div>
        </div>
        <div v-if="active && !work.roles" class="banner info">
          尚未启用"看板 × 指标"策略，当前权限仍来自旧的权限点。先由现有权限生成一份完整策略草稿（开放的看板默认勾选全部指标），确认后再细调。
          <div class="row" style="margin-top:8px">
            <input v-model.trim="legacyReason" placeholder="原因（必填）" style="flex:1" />
            <button class="btn" :disabled="!legacyReason" @click="fromLegacy">由现有权限生成草稿</button>
          </div>
        </div>
        <p v-if="err && !work.roles && !draft" class="banner fixture">{{ err }}</p>
      </template>
    </div>

    <div v-if="cat && work.roles" class="layout">
      <aside class="panel roles">
        <div v-for="r in cat.roles" :key="r.name" :class="['role-item', sel === r.name && 'on']" @click="sel = r.name">
          <strong>{{ r.label }}</strong> <small class="muted">{{ r.name }}</small>
          <div class="muted small" v-if="work.roles[r.name]">{{ work.routes[r.name] }} · {{ Object.keys(work.roles[r.name].pages).length }} 个看板 · {{ countSel(r.name) }} 项指标</div>
          <div class="muted small" v-else>未加入策略（该角色的请求会被拒绝）</div>
        </div>
      </aside>

      <section class="panel editor" v-if="sel">
        <template v-if="!cfg">
          <p>角色 {{ sel }} 尚未加入策略。</p>
          <button class="btn" @click="addRole">加入策略</button>
        </template>
        <template v-else>
          <h3>基本设置 <button v-if="sel !== 'admin' && !builtin(sel)" class="btn small" @click="removeRole">移出策略</button></h3>
          <div class="settings">
            <label>路由账号
              <select v-model="work.routes[sel]"><option v-for="a in Object.keys(cat.accounts)" :key="a" :value="a">{{ a }}</option></select></label>
            <label>可查历史（交易日）<input type="number" min="1" max="250" v-model.number="cfg.history_days" /></label>
            <label>同时在线会话数<input type="number" min="1" max="20" v-model.number="cfg.max_sessions" /></label>
            <label v-for="e in ['web', 'mp']" :key="e"><input type="checkbox" :checked="cfg.entries.includes(e)" @change="toggleEntry(e, $event.target.checked)" /> {{ e === 'web' ? '网页' : '小程序' }}可登录</label>
            <label><input type="checkbox" v-model="cfg.admin_console" :disabled="sel !== 'admin'" /> 管理后台{{ sel !== 'admin' ? '（仅 admin）' : '' }}</label>
          </div>

          <h3>看板 × 指标</h3>
          <div v-for="p in cat.pages" :key="p.page" class="page-block">
            <div class="page-head-row">
              <label><input type="checkbox" :checked="!!cfg.pages[p.page]" @change="togglePage(p, $event.target.checked)" /> <strong>{{ p.label }}</strong></label>
              <span class="muted small">{{ (cfg.pages[p.page] || []).length }} / {{ selectable(p).length }} 项</span>
            </div>
            <div v-if="cfg.pages[p.page]" class="modules">
              <div v-for="m in p.modules" :key="m.module" class="module">
                <label><input type="checkbox" :checked="modState(p, m) === 'all'" :indeterminate.prop="modState(p, m) === 'some'"
                  @change="toggleModule(p, m, $event.target.checked)" /> {{ m.label }}<span v-if="m.detail" class="tag">下钻</span> <small class="muted">{{ m.cnt }}</small></label>
                <div class="inds">
                  <label v-for="i in m.indicators" :key="i.id" :class="{ blocked: blocked(i.id) }" :title="blocked(i.id) || ''">
                    <input type="checkbox" :disabled="!!blocked(i.id)" :checked="cfg.pages[p.page].includes(i.id)"
                      @change="toggleInd(p, i.id, $event.target.checked)" /> {{ i.label }}<small v-if="i.unit" class="muted">（{{ i.unit }}）</small>
                    <small v-if="blocked(i.id)" class="why">{{ blocked(i.id) }}</small>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </template>
      </section>
    </div>

    <div v-if="cat && work.roles" class="panel">
      <div class="row">
        <input v-model.trim="reason" placeholder="修改原因（必填）" style="flex:1" />
        <button class="btn primary" :disabled="!reason || !accountOk(selAccount) || busy" @click="submit">查看差异</button>
        <button class="btn" @click="reset">撤销未提交的修改</button>
      </div>
      <p v-if="err" class="banner fixture">{{ err }}</p>
    </div>

    <div v-if="draft" class="modal" @click.self="draft = null">
      <div class="modal-body panel">
        <h2>版本 {{ draft.version }} 与当前生效版本的差异<small>原因：{{ draft.reason }}</small></h2>
        <DiffView :diff="draft.diff" :labels="labels" />
        <p v-if="err" class="banner fixture">{{ err }}</p>
        <div class="row" style="margin-top:12px">
          <template v-if="draft.status === 'draft' && draft.created_by === me">
            <button class="btn primary" @click="confirmDraft">{{ cat.requires_second_approver ? '提交审批' : '确认生效' }}</button>
            <button class="btn" @click="rejectDraft">放弃草稿</button>
          </template>
          <template v-else-if="draft.status === 'pending' && draft.created_by !== me">
            <button class="btn primary" @click="approveDraft">通过</button>
            <button class="btn" @click="rejectDraft">驳回</button>
          </template>
          <span v-else class="muted">{{ draft.status === 'pending' ? '等待其他管理员审批' : '' }}</span>
          <button class="btn" @click="draft = null">关闭</button>
        </div>
      </div>
    </div>

    <div v-if="cat" class="panel">
      <h2>历史版本<small>任选两个版本查看差异</small></h2>
      <div class="table-wrap"><table>
        <thead><tr><th>对比</th><th>版本</th><th>状态</th><th>提交人</th><th>确认/审批人</th><th>时间</th><th class="left">原因</th></tr></thead>
        <tbody>
          <tr v-for="v in versions" :key="v.version">
            <td><input type="checkbox" :value="v.version" v-model="cmp" /></td>
            <td>{{ v.version }}</td><td>{{ STATUS[v.status] || v.status }}</td><td>{{ v.created_by }}</td>
            <td>{{ v.approved_by || '—' }}</td><td>{{ dt(v.activated_at || v.created_at) }}</td><td class="left">{{ v.reason }}</td>
          </tr>
        </tbody>
      </table></div>
      <button class="btn" :disabled="cmp.length !== 2" @click="compare">查看所选两版差异</button>
      <DiffView v-if="cmpDiff" :diff="cmpDiff" :labels="labels" />
    </div>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, ref } from 'vue'
import { api, session } from '../auth'

const STATUS = { draft: '草稿', pending: '待审批', active: '生效中', retired: '已退役', rejected: '已放弃/驳回' }
const ROLE_ORDER = ['free', 'vip', 'svip', 'admin']
const cat = ref(null)
const work = ref({ routes: {}, roles: null })
const versions = ref([])
const sel = ref('')
const reason = ref('')
const legacyReason = ref('')
const draft = ref(null)
const err = ref('')
const busy = ref(false)
const cmp = ref([])
const cmpDiff = ref(null)
const me = computed(() => session.user?.username)
const active = computed(() => cat.value?.active || null)
const pending = computed(() => versions.value.filter((v) => v.status === 'draft' || v.status === 'pending'))
const cfg = computed(() => work.value.roles?.[sel.value] || null)
const selAccount = computed(() => work.value.routes?.[sel.value] || Object.keys(cat.value?.accounts || {})[0])
const labels = computed(() => {
  const m = {}
  for (const p of cat.value?.pages || []) for (const mod of p.modules) for (const i of mod.indicators) m[i.id] = `${p.label} / ${mod.label} / ${i.label}`
  for (const p of cat.value?.pages || []) m[p.page] = p.label
  return m
})
const dt = (t) => (t ? new Date(t * 1000).toLocaleString('zh-CN') : '—')
const builtin = (name) => cat.value.roles.find((r) => r.name === name)?.builtin
const accountOk = (a) => !!cat.value?.accounts?.[a]?.available
const blocked = (id) => cat.value.accounts?.[selAccount.value]?.blocked?.[id] || (accountOk(selAccount.value) ? '' : '上游上限暂不可查')
const selectable = (p) => p.modules.flatMap((m) => m.indicators).filter((i) => !blocked(i.id))
const countSel = (role) => Object.values(work.value.roles[role].pages).reduce((n, l) => n + l.length, 0)

async function load() {
  const [c, v] = await Promise.all([api('GET', '/api/v1/admin/policy/catalog'), api('GET', '/api/v1/admin/policy/versions')])
  if (c.ok) {
    c.data.roles.sort((a, b) => (ROLE_ORDER.indexOf(a.name) + 1 || 99) - (ROLE_ORDER.indexOf(b.name) + 1 || 99))
    cat.value = c.data
  }
  if (v.ok) versions.value = v.data.items
  reset()
}
function reset() {
  const pol = cat.value?.active?.policy
  work.value = pol ? JSON.parse(JSON.stringify(pol)) : { routes: {}, roles: null }
  if (!sel.value && work.value.roles) sel.value = Object.keys(work.value.roles).sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b))[0]
  err.value = ''
}
function addRole() {
  work.value.routes[sel.value] = Object.keys(cat.value.accounts)[0]
  work.value.roles[sel.value] = { pages: {}, history_days: 5, max_sessions: 1, entries: ['web'], admin_console: false }
}
function removeRole() { delete work.value.roles[sel.value]; delete work.value.routes[sel.value] }
function toggleEntry(e, on) { cfg.value.entries = on ? [...new Set([...cfg.value.entries, e])] : cfg.value.entries.filter((x) => x !== e) }
function togglePage(p, on) {
  if (on) cfg.value.pages[p.page] = selectable(p).map((i) => i.id)
  else delete cfg.value.pages[p.page]
}
function modState(p, m) {
  const ids = m.indicators.filter((i) => !blocked(i.id)).map((i) => i.id)
  const n = ids.filter((i) => cfg.value.pages[p.page].includes(i)).length
  return n === 0 ? 'none' : n === ids.length ? 'all' : 'some'
}
function toggleModule(p, m, on) {
  const ids = m.indicators.filter((i) => !blocked(i.id)).map((i) => i.id)
  const cur = cfg.value.pages[p.page].filter((i) => !ids.includes(i))
  cfg.value.pages[p.page] = on ? [...cur, ...ids] : cur
}
function toggleInd(p, id, on) {
  const cur = cfg.value.pages[p.page].filter((i) => i !== id)
  cfg.value.pages[p.page] = on ? [...cur, id] : cur
}
async function initRoutes() {
  err.value = ''
  const account = Object.keys(cat.value.accounts)[0]
  const routes = Object.fromEntries(cat.value.roles.filter((r) => r.builtin).map((r) => [r.name, account]))
  const r = await api('POST', '/api/v1/admin/policy/drafts', { policy: { routes }, reason: legacyReason.value })
  if (!r.ok) { err.value = r.data.detail || '创建失败'; return }
  const why = legacyReason.value
  legacyReason.value = ''
  await refreshVersions()
  draft.value = { ...r.data, reason: why, created_by: me.value }
}
async function fromLegacy() {
  err.value = ''
  const r = await api('POST', '/api/v1/admin/policy/drafts/from-legacy', { reason: legacyReason.value })
  if (!r.ok) { err.value = r.data.detail || '生成失败'; return }
  legacyReason.value = ''
  await load()
  openDraft({ ...r.data, reason: '由现有权限生成', created_by: me.value })
}
async function submit() {
  err.value = ''; busy.value = true
  const r = await api('POST', '/api/v1/admin/policy/drafts', { policy: work.value, reason: reason.value })
  busy.value = false
  if (!r.ok) { err.value = r.data.detail || '提交失败'; return }
  draft.value = { ...r.data, reason: reason.value, created_by: me.value }
  await refreshVersions()
}
async function openDraft(v) {
  const base = versions.value.find((x) => x.status === 'active')
  const d = base ? await api('GET', `/api/v1/admin/policy/diff?from_version=${base.version}&to_version=${v.version}`) : null
  draft.value = { ...v, diff: v.diff || (d && d.ok ? d.data : {}) }
}
async function confirmDraft() {
  const n = Object.keys(draft.value.diff?.roles || {}).length + Object.values(draft.value.diff?.routes || {}).reduce((a, x) => a + Object.keys(x).length, 0)
  const msg = cat.value.requires_second_approver ? `提交版本 ${draft.value.version} 等待其他管理员审批？` : `确认让版本 ${draft.value.version} 立即生效？\n涉及 ${n} 处角色/路由变化\n原因：${draft.value.reason}`
  if (!window.confirm(msg)) return
  await act(`/api/v1/admin/policy/versions/${draft.value.version}/confirm`)
}
async function approveDraft() { if (window.confirm(`通过版本 ${draft.value.version} 并立即生效？`)) await act(`/api/v1/admin/policy/versions/${draft.value.version}/approve`) }
async function rejectDraft() {
  const why = window.prompt('原因（必填）')
  if (!why) return
  await act(`/api/v1/admin/policy/versions/${draft.value.version}/reject`, { reason: why })
}
async function act(url, body) {
  err.value = ''
  const r = await api('POST', url, body)
  if (!r.ok) { err.value = r.data.detail || '操作失败'; return }
  draft.value = null; reason.value = ''
  await load()
}
async function refreshVersions() { const v = await api('GET', '/api/v1/admin/policy/versions'); if (v.ok) versions.value = v.data.items }
async function compare() {
  const [a, b] = [...cmp.value].sort((x, y) => x - y)
  const r = await api('GET', `/api/v1/admin/policy/diff?from_version=${a}&to_version=${b}`)
  cmpDiff.value = r.ok ? r.data : null
}

const DiffView = defineComponent({
  props: { diff: Object, labels: Object },
  setup(props) {
    const L = (x) => props.labels[x] || x
    return () => {
      const d = props.diff || {}
      const rows = []
      const rt = d.routes || {}
      for (const [r, a] of Object.entries(rt.added || {})) rows.push(h('li', `路由：新增 ${r} → ${a}`))
      for (const [r, a] of Object.entries(rt.removed || {})) rows.push(h('li', `路由：移除 ${r}（原 ${a}）`))
      for (const [r, c] of Object.entries(rt.changed || {})) rows.push(h('li', `路由：${r} ${c.before} → ${c.after}`))
      for (const [role, c] of Object.entries(d.roles || {})) {
        const items = []
        if (c.added) items.push(h('li', '加入策略'))
        if (c.removed) items.push(h('li', '移出策略'))
        if (c.pages_added) items.push(h('li', `开放看板：${c.pages_added.map(L).join('、')}`))
        if (c.pages_removed) items.push(h('li', `关闭看板：${c.pages_removed.map(L).join('、')}`))
        if (c.indicators_added) items.push(h('li', [`新增指标 ${c.indicators_added.length} 项`, h('ul', c.indicators_added.map((i) => h('li', L(i))))]))
        if (c.indicators_removed) items.push(h('li', [`移除指标 ${c.indicators_removed.length} 项`, h('ul', c.indicators_removed.map((i) => h('li', L(i))))]))
        for (const [k, v] of Object.entries(c.settings || {})) items.push(h('li', `${k}：${JSON.stringify(v.before)} → ${JSON.stringify(v.after)}`))
        rows.push(h('li', [h('strong', role), h('ul', items)]))
      }
      return h('ul', { class: 'diff' }, rows.length ? rows : [h('li', '无变化')])
    }
  },
})
onMounted(load)
</script>

<style scoped>
.row-info { display: flex; gap: 12px; align-items: center; margin: 6px 0; }
.tag { background: #eef3fb; color: #2f5d9b; border-radius: 6px; padding: 1px 6px; font-size: 12px; margin-left: 6px; }
.layout { display: grid; grid-template-columns: 240px 1fr; gap: 12px; align-items: start; }
@media (max-width: 760px) { .layout { grid-template-columns: 1fr; } }
.role-item { padding: 8px; border-radius: 8px; cursor: pointer; }
.role-item.on { background: #eef3fb; }
.small { font-size: 12px; }
.settings { display: flex; flex-wrap: wrap; gap: 12px 20px; margin-bottom: 8px; }
.settings input[type=number] { width: 70px; margin-left: 6px; }
.page-block { border-top: 1px solid var(--line); padding: 8px 0; }
.page-head-row { display: flex; justify-content: space-between; }
.modules { padding-left: 18px; }
.module { margin: 6px 0; }
.inds { display: flex; flex-wrap: wrap; gap: 4px 14px; padding-left: 18px; font-size: 13px; }
.inds .blocked { color: #9aa3b2; }
.why { color: #b5651d; margin-left: 4px; }
.modal { position: fixed; inset: 0; background: rgba(0, 0, 0, .35); display: flex; align-items: center; justify-content: center; z-index: 50; }
.modal-body { max-width: 720px; width: calc(100% - 32px); max-height: 80vh; overflow: auto; }
.diff { font-size: 13px; }
.btn.small { padding: 2px 8px; font-size: 12px; margin-left: 8px; }
</style>
