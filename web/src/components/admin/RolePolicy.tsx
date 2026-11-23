import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Panel } from '@/components/shell/Panel'
import { Notice } from '@/components/shell/Notice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAdminQuery } from '@/lib/admin'
import { api, useSession } from '@/lib/auth'
import { confirmDialog, promptDialog } from '@/lib/dialogs'
import { dateTimeOf } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PolicyDiff } from './PolicyDiff'
import { QueryState } from './QueryState'

const STATUS: Record<string, string> = { draft: '草稿', pending: '待审批', active: '生效中', retired: '已退役', rejected: '已放弃/驳回' }
const ROLE_ORDER = ['free', 'vip', 'svip', 'admin']
const roleRank = (n: string) => (ROLE_ORDER.indexOf(n) + 1 || 99)

interface RoleCfg { pages: Record<string, string[]>; history_days: number; max_sessions: number; entries: string[]; admin_console: boolean }
interface Policy { routes: Record<string, string>; roles: Record<string, RoleCfg> | null }
const EMPTY: Policy = { routes: {}, roles: null }

export function RolePolicy() {
  const qc = useQueryClient()
  const me = useSession((s) => s.user?.username)
  const catQ = useAdminQuery<any>(['policy', 'catalog'], '/api/v1/admin/policy/catalog')
  const verQ = useAdminQuery<{ items: any[] }>(['policy', 'versions'], '/api/v1/admin/policy/versions')
  const cat = catQ.data
  const versions = verQ.data?.items || []
  const active = cat?.active || null
  const pending = versions.filter((v) => v.status === 'draft' || v.status === 'pending')
  const roleList: any[] = useMemo(() => [...(cat?.roles || [])].sort((a, b) => roleRank(a.name) - roleRank(b.name)), [cat])

  // work 是正在编辑的策略副本；只在「生效版本变了」时才从服务端重置，避免窗口重新聚焦时冲掉没提交的修改
  const [work, setWork] = useState<Policy>(EMPTY)
  const [sel, setSel] = useState('')
  const [reason, setReason] = useState('')
  const [legacyReason, setLegacyReason] = useState('')
  const [draft, setDraft] = useState<any>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [cmp, setCmp] = useState<number[]>([])
  const [cmpDiff, setCmpDiff] = useState<any>(null)
  const upd = (fn: (w: Policy) => void) => setWork((w) => { const c = structuredClone(w); fn(c); return c })

  const reset = () => {
    const pol = cat?.active?.policy
    const next: Policy = pol ? structuredClone(pol) : { routes: {}, roles: null }
    setWork(next)
    setSel((cur) => cur || (next.roles ? Object.keys(next.roles).sort((a, b) => roleRank(a) - roleRank(b))[0] : '') || '')
    setErr('')
  }
  useEffect(() => { if (cat) reset() }, [cat?.active?.version, !!cat]) // eslint-disable-line react-hooks/exhaustive-deps

  const cfg = work.roles?.[sel] || null
  const accounts: Record<string, any> = cat?.accounts || {}
  const selAccount = work.routes?.[sel] || Object.keys(accounts)[0]
  const accountOk = (a: string) => !!accounts[a]?.available
  const blocked = (id: string): string => accounts[selAccount]?.blocked?.[id] || (accountOk(selAccount) ? '' : '上游上限暂不可查')
  const selectable = (p: any) => p.modules.flatMap((m: any) => m.indicators).filter((i: any) => !blocked(i.id))
  const countSel = (role: string) => Object.values(work.roles?.[role]?.pages || {}).reduce((n, l) => n + l.length, 0)
  const builtin = (name: string) => !!cat?.roles.find((r: any) => r.name === name)?.builtin
  const labels = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of cat?.pages || []) { m[p.page] = p.label; for (const mod of p.modules) for (const i of mod.indicators) m[i.id] = `${p.label} / ${mod.label} / ${i.label}` }
    return m
  }, [cat])

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] })
  function addRole() { upd((w) => { w.routes[sel] = Object.keys(accounts)[0]; w.roles![sel] = { pages: {}, history_days: 5, max_sessions: 1, entries: ['web'], admin_console: false } }) }
  function removeRole() { upd((w) => { delete w.roles![sel]; delete w.routes[sel] }) }
  function toggleEntry(e: string, on: boolean) { upd((w) => { const c = w.roles![sel]; c.entries = on ? [...new Set([...c.entries, e])] : c.entries.filter((x) => x !== e) }) }
  function togglePage(p: any, on: boolean) { upd((w) => { const c = w.roles![sel]; if (on) c.pages[p.page] = selectable(p).map((i: any) => i.id); else delete c.pages[p.page] }) }
  const ids = (m: any) => m.indicators.filter((i: any) => !blocked(i.id)).map((i: any) => i.id)
  function modState(p: any, m: any): 'all' | 'some' | 'none' {
    const list = ids(m)
    const n = list.filter((i: string) => cfg!.pages[p.page].includes(i)).length
    return n === 0 ? 'none' : n === list.length ? 'all' : 'some'
  }
  function toggleModule(p: any, m: any, on: boolean) { upd((w) => { const c = w.roles![sel]; const own = ids(m); const cur = c.pages[p.page].filter((i) => !own.includes(i)); c.pages[p.page] = on ? [...cur, ...own] : cur }) }
  function toggleInd(p: any, id: string, on: boolean) { upd((w) => { const c = w.roles![sel]; const cur = c.pages[p.page].filter((i) => i !== id); c.pages[p.page] = on ? [...cur, id] : cur }) }

  async function initRoutes() {
    setErr('')
    const account = Object.keys(accounts)[0]
    const routes = Object.fromEntries(cat.roles.filter((r: any) => r.builtin).map((r: any) => [r.name, account]))
    const r = await api('POST', '/api/v1/admin/policy/drafts', { policy: { routes }, reason: legacyReason })
    if (!r.ok) { setErr(r.data.detail || '创建失败'); return }
    const why = legacyReason; setLegacyReason(''); await refresh()
    setDraft({ ...r.data, reason: why, created_by: me })
  }
  async function fromLegacy() {
    setErr('')
    const r = await api('POST', '/api/v1/admin/policy/drafts/from-legacy', { reason: legacyReason })
    if (!r.ok) { setErr(r.data.detail || '生成失败'); return }
    setLegacyReason(''); await refresh()
    setDraft({ ...r.data, reason: '由现有权限生成', created_by: me })
  }
  async function submit() {
    setErr(''); setBusy(true)
    const r = await api('POST', '/api/v1/admin/policy/drafts', { policy: work, reason })
    setBusy(false)
    if (!r.ok) { setErr(r.data.detail || '提交失败'); return }
    setDraft({ ...r.data, reason, created_by: me })
    await refresh()
  }
  async function openDraft(v: any) {
    const base = versions.find((x) => x.status === 'active')
    const d = base ? await api('GET', `/api/v1/admin/policy/diff?from_version=${base.version}&to_version=${v.version}`) : null
    setDraft({ ...v, diff: v.diff || (d && d.ok ? d.data : {}) })
  }
  async function act(url: string, body?: unknown) {
    setErr('')
    const r = await api('POST', url, body)
    if (!r.ok) { setErr(r.data.detail || '操作失败'); return }
    setDraft(null); setReason(''); setCmpDiff(null); await refresh()
  }
  async function confirmDraft() {
    const n = Object.keys(draft.diff?.roles || {}).length + Object.values(draft.diff?.routes || {}).reduce((a: number, x: any) => a + Object.keys(x).length, 0)
    const second = !!cat.requires_second_approver
    const ok = await confirmDialog({ title: second ? `提交版本 ${draft.version} 等待其他管理员审批？` : `确认让版本 ${draft.version} 立即生效？`, body: second ? undefined : `涉及 ${n} 处角色/路由变化\n原因：${draft.reason}`, confirmText: second ? '提交审批' : '确认生效' })
    if (ok) await act(`/api/v1/admin/policy/versions/${draft.version}/confirm`)
  }
  async function approveDraft() {
    if (await confirmDialog({ title: `通过版本 ${draft.version} 并立即生效？`, confirmText: '通过' })) await act(`/api/v1/admin/policy/versions/${draft.version}/approve`)
  }
  async function rejectDraft() {
    const v = await promptDialog({ title: `放弃或驳回版本 ${draft.version}`, fields: [{ key: 'reason', label: '原因', required: true }], confirmText: '确定' })
    if (v) await act(`/api/v1/admin/policy/versions/${draft.version}/reject`, { reason: v.reason })
  }
  async function compare() {
    const [a, b] = [...cmp].sort((x, y) => x - y)
    const r = await api('GET', `/api/v1/admin/policy/diff?from_version=${a}&to_version=${b}`)
    setCmpDiff(r.ok ? { ...r.data, _from: a, _to: b } : null)
  }

  return (
    <QueryState q={catQ}>
      {cat && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <Panel title="角色权限配置" hint="按角色 × 看板 × 指标配置；看差异、填原因、二次确认后生效">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              {active ? <span>当前生效：版本 {active.version} · {dateTimeOf(active.activated_at)} · 确认人 {active.approved_by}</span> : <span>尚无生效的策略版本</span>}
              {cat.requires_second_approver && <Badge variant="secondary">双人审批已开启</Badge>}
            </div>
            <div className="mt-3 grid gap-2.5">
              {pending.map((p) => (
                <Notice key={p.version} className="flex flex-wrap items-center gap-3">
                  <span>{p.status === 'draft' ? '未确认草稿' : '待审批版本'}：版本 {p.version}（{p.created_by}，{p.reason}）</span>
                  <Button size="xs" variant="outline" onClick={() => openDraft(p)}>查看差异</Button>
                </Notice>
              ))}
              {!accountOk(selAccount) && <Notice tone="warn">暂时无法查询账号 {selAccount} 的上游上限：配置页只读，不能提交。</Notice>}
              {!active && !pending.length && (
                <Notice>
                  尚无生效的路由规则：所有数据请求将按"没有生效规则"拒绝（切到事实视图的页面）。先创建版本 1：内置角色全部路由到 {Object.keys(accounts)[0]}。
                  <div className="mt-2 flex gap-2"><Input value={legacyReason} onChange={(e) => setLegacyReason(e.target.value)} placeholder="原因（必填）" aria-label="原因" className="flex-1 bg-background" /><Button disabled={!legacyReason.trim()} onClick={initRoutes}>创建路由规则版本 1</Button></div>
                </Notice>
              )}
              {active && !work.roles && (
                <Notice>
                  尚未启用"看板 × 指标"策略，当前权限仍来自旧的权限点。先由现有权限生成一份完整策略草稿（开放的看板默认勾选全部指标），确认后再细调。
                  <div className="mt-2 flex gap-2"><Input value={legacyReason} onChange={(e) => setLegacyReason(e.target.value)} placeholder="原因（必填）" aria-label="原因" className="flex-1 bg-background" /><Button disabled={!legacyReason.trim()} onClick={fromLegacy}>由现有权限生成草稿</Button></div>
                </Notice>
              )}
              {err && !work.roles && !draft && <Notice tone="warn">{err}</Notice>}
            </div>
          </Panel>

          {work.roles && (
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[240px_1fr]">
              <aside className="rounded-lg border bg-card p-2 shadow-[var(--shadow-1)]" aria-label="角色">
                {roleList.map((r) => (
                  <button key={r.name} type="button" onClick={() => setSel(r.name)} aria-pressed={sel === r.name}
                    className={cn('relative block w-full cursor-pointer rounded-md px-3 py-2.5 text-left', sel === r.name ? 'bg-accent' : 'hover:bg-surface-hover')}>
                    {sel === r.name && <span className="absolute inset-y-2.5 left-0 w-0.5 rounded bg-primary" />}
                    <div className="text-sm"><strong className="font-medium">{r.label}</strong> <small className="text-ink-3">{r.name}</small></div>
                    <div className="mt-0.5 text-xs text-ink-3">{work.roles![r.name] ? `${work.routes[r.name]} · ${Object.keys(work.roles![r.name].pages).length} 个看板 · ${countSel(r.name)} 项指标` : '未加入策略（该角色的请求会被拒绝）'}</div>
                  </button>
                ))}
              </aside>

              <section className="rounded-lg border bg-card p-5 shadow-[var(--shadow-1)] sm:p-6">
                {!sel ? <p className="text-sm text-ink-3">请选择左侧的角色。</p> : !cfg ? (
                  <div className="flex flex-wrap items-center gap-3 text-sm"><span>角色 {sel} 尚未加入策略。</span><Button size="sm" onClick={addRole}>加入策略</Button></div>
                ) : (
                  <>
                    <div className="mb-3 flex items-center justify-between"><h3 className="text-[15px] font-medium">基本设置</h3>
                      {sel !== 'admin' && !builtin(sel) && <Button size="xs" variant="outline" onClick={removeRole}>移出策略</Button>}</div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
                      <label className="flex items-center gap-2">路由账号
                        <NativeSelect value={work.routes[sel]} onChange={(e) => upd((w) => { w.routes[sel] = e.target.value })}>{Object.keys(accounts).map((a) => <option key={a} value={a}>{a}</option>)}</NativeSelect></label>
                      <label className="flex items-center gap-2">可查历史（交易日）<Input type="number" min={1} max={250} value={cfg.history_days} onChange={(e) => upd((w) => { w.roles![sel].history_days = Number(e.target.value) })} className="h-9 w-20" /></label>
                      <label className="flex items-center gap-2">同时在线会话数<Input type="number" min={1} max={20} value={cfg.max_sessions} onChange={(e) => upd((w) => { w.roles![sel].max_sessions = Number(e.target.value) })} className="h-9 w-20" /></label>
                      {(['web', 'mp'] as const).map((e) => <label key={e} className="flex cursor-pointer items-center gap-2"><Checkbox checked={cfg.entries.includes(e)} onCheckedChange={(c) => toggleEntry(e, !!c)} />{e === 'web' ? '网页' : '小程序'}可登录</label>)}
                      <label className={cn('flex items-center gap-2', sel === 'admin' ? 'cursor-pointer' : 'opacity-60')}><Checkbox checked={cfg.admin_console} disabled={sel !== 'admin'} onCheckedChange={(c) => upd((w) => { w.roles![sel].admin_console = !!c })} />管理后台{sel !== 'admin' && '（仅 admin）'}</label>
                    </div>

                    <h3 className="mb-3 mt-7 text-[15px] font-medium">看板 × 指标</h3>
                    <div className="grid gap-5">
                      {cat.pages.map((p: any) => (
                        <div key={p.page} className="rounded-md border bg-background/50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <label className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={!!cfg.pages[p.page]} onCheckedChange={(c) => togglePage(p, !!c)} /><strong className="font-medium">{p.label}</strong></label>
                            <span className="tnum text-xs text-ink-3">已选 {(cfg.pages[p.page] || []).length} / {selectable(p).length} 项</span>
                          </div>
                          {cfg.pages[p.page] && (
                            <div className="mt-3 grid gap-4">
                              {p.modules.map((m: any) => (
                                <div key={m.module}>
                                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                                    <Checkbox checked={modState(p, m) === 'all' ? true : modState(p, m) === 'some' ? 'indeterminate' : false} onCheckedChange={(c) => toggleModule(p, m, c === true)} />
                                    {m.label}{m.detail && <Badge variant="outline" className="text-ink-3">下钻</Badge>}<small className="text-ink-3">{m.cnt}</small>
                                  </label>
                                  <div className="mt-2 grid gap-x-4 gap-y-2 pl-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                                    {m.indicators.map((i: any) => (
                                      <label key={i.id} title={blocked(i.id) || undefined} className={cn('flex items-start gap-2 text-[13px]', blocked(i.id) ? 'cursor-not-allowed text-ink-3' : 'cursor-pointer')}>
                                        <Checkbox className="mt-0.5" disabled={!!blocked(i.id)} checked={cfg.pages[p.page].includes(i.id)} onCheckedChange={(c) => toggleInd(p, i.id, !!c)} />
                                        <span>{i.label}{i.unit && <small className="text-ink-3">（{i.unit}）</small>}{blocked(i.id) && <small className="block text-xs">{blocked(i.id)}</small>}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </div>
          )}

          {work.roles && (
            <div className="sticky bottom-0 z-10 -mx-1 rounded-lg border bg-card p-3 shadow-[var(--shadow-1)]">
              <div className="flex flex-wrap items-center gap-2">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="修改原因（必填）" aria-label="修改原因" className="min-w-52 flex-1" />
                <Button disabled={!reason.trim() || !accountOk(selAccount) || busy} onClick={submit}>查看差异</Button>
                <Button variant="outline" onClick={reset}>撤销未提交的修改</Button>
              </div>
              {err && <Notice tone="warn" className="mt-2">{err}</Notice>}
            </div>
          )}

          <Panel title="历史版本" hint="任选两个版本查看差异">
            <QueryState q={verQ}>
              <Table>
                <TableHeader><TableRow>{['对比', '版本', '状态', '提交人', '确认/审批人', '时间', '原因'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {versions.map((v) => (
                    <TableRow key={v.version}>
                      <TableCell><Checkbox aria-label={`选择版本 ${v.version} 对比`} checked={cmp.includes(v.version)} onCheckedChange={(c) => setCmp((cur) => (c ? [...cur, v.version].slice(-2) : cur.filter((x) => x !== v.version)))} /></TableCell>
                      <TableCell className="tnum">{v.version}</TableCell>
                      <TableCell><Badge variant={v.status === 'active' ? 'secondary' : 'outline'} className={cn(v.status !== 'active' && 'text-ink-3')}>{STATUS[v.status] || v.status}</Badge></TableCell>
                      <TableCell>{v.created_by}</TableCell><TableCell>{v.approved_by || '—'}</TableCell>
                      <TableCell className="tnum">{dateTimeOf(v.activated_at || v.created_at)}</TableCell><TableCell className="whitespace-normal">{v.reason}</TableCell>
                    </TableRow>
                  ))}
                  {!versions.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-ink-3">还没有策略版本</TableCell></TableRow>}
                </TableBody>
              </Table>
              <Button className="mt-3" variant="outline" disabled={cmp.length !== 2} onClick={compare}>查看所选两版差异</Button>
              {cmpDiff && <div className="mt-4 rounded-md border bg-background/50 p-4"><div className="mb-2 text-xs text-ink-3">版本 {cmpDiff._from} → 版本 {cmpDiff._to}</div><PolicyDiff diff={cmpDiff} labels={labels} /></div>}
            </QueryState>
          </Panel>

          {draft && (
            <Dialog open onOpenChange={(o) => { if (!o) setDraft(null) }}>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>版本 {draft.version} 与当前生效版本的差异</DialogTitle>
                  <DialogDescription>原因：{draft.reason}</DialogDescription>
                </DialogHeader>
                <PolicyDiff diff={draft.diff} labels={labels} />
                {err && <Notice tone="warn">{err}</Notice>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {draft.status === 'draft' && draft.created_by === me ? (
                    <>
                      <Button onClick={confirmDraft}>{cat.requires_second_approver ? '提交审批' : '确认生效'}</Button>
                      <Button variant="outline" onClick={rejectDraft}>放弃草稿</Button>
                    </>
                  ) : draft.status === 'pending' && draft.created_by !== me ? (
                    <>
                      <Button onClick={approveDraft}>通过</Button>
                      <Button variant="outline" onClick={rejectDraft}>驳回</Button>
                    </>
                  ) : <span className="text-sm text-ink-3">{draft.status === 'pending' ? '等待其他管理员审批' : ''}</span>}
                  <Button variant="outline" className="ml-auto" onClick={() => setDraft(null)}>关闭</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </QueryState>
  )
}
