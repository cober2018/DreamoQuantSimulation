import { useState } from 'react'
import { Panel } from '@/components/shell/Panel'
import { TrendTile } from '@/components/charts/TrendTile'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAdminAct, useAdminQuery } from '@/lib/admin'
import { confirmDialog, showSecret } from '@/lib/dialogs'
import { cents, dateOf, yuan } from '@/lib/format'
import { Pager, PAGE_SIZE } from './Pager'
import { QueryState } from './QueryState'

function GrantDialog({ user, plans, onClose }: { user: any; plans: any[]; onClose: () => void }) {
  const act = useAdminAct()
  const [planId, setPlanId] = useState('')
  const [amount, setAmount] = useState('0')
  const [channel, setChannel] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const pick = (id: string) => { setPlanId(id); const p = plans.find((x) => String(x.id) === id); if (p) setAmount(yuan(p.price_cents)) }
  async function submit() {
    setBusy(true)
    const r = await act('POST', `/api/v1/admin/users/${user.id}/grant`, { plan_id: Number(planId), amount_cents: cents(amount), channel, note },
      (d) => `已开通：${d.role_label}，到期 ${dateOf(d.member_expires_at)}`)
    setBusy(false)
    if (r.ok) onClose()
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); void submit() }} className="grid gap-4">
          <DialogHeader><DialogTitle>为 {user.username} 开通</DialogTitle><DialogDescription>开通统一走这里，保证每次开通都有金额记录。</DialogDescription></DialogHeader>
          <div className="grid gap-1.5"><Label htmlFor="g-plan">套餐</Label>
            <NativeSelect id="g-plan" value={planId} onChange={(e) => pick(e.target.value)}>
              <option value="" disabled>选择套餐</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}（{p.role_label} {p.duration_days} 天 ¥{yuan(p.price_cents)}）{p.listed ? '' : ' · 未上架'}</option>)}
            </NativeSelect></div>
          <div className="grid gap-1.5"><Label htmlFor="g-amount">实收（元）</Label><Input id="g-amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="g-channel">收款渠道</Label><Input id="g-channel" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="微信 / 支付宝 / 转账" /></div>
          <div className="grid gap-1.5"><Label htmlFor="g-note">备注</Label><Input id="g-note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>取消</Button><Button type="submit" disabled={!planId || busy}>确认开通</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function UsersTab() {
  const act = useAdminAct()
  const [expiring, setExpiring] = useState(false)
  const [kw, setKw] = useState('')
  const [page, setPage] = useState(0)
  const [grantFor, setGrantFor] = useState<any>(null)
  const users = useAdminQuery<{ items: any[] }>(['users', expiring], `/api/v1/admin/users${expiring ? '?expiring_within_days=7' : ''}`)
  const plans = useAdminQuery<{ items: any[] }>(['plans'], '/api/v1/admin/plans')
  const all = users.data?.items || []
  const now = Date.now() / 1000
  const stat = {
    total: all.length,
    members: all.filter((u) => u.member_role && (!u.member_expires_at || u.member_expires_at > now)).length,
    expiring: all.filter((u) => u.member_expires_at && u.member_expires_at > now && u.member_expires_at - now <= 7 * 86400).length,
    disabled: all.filter((u) => u.disabled).length,
  }
  const rows = kw ? all.filter((u) => String(u.username).toLowerCase().includes(kw.trim().toLowerCase())) : all
  const shown = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  async function clearMember(u: any) {
    if (await confirmDialog({ title: `清除 ${u.username} 的会员？`, body: '立即恢复为基础角色。', confirmText: '清除', danger: true })) await act('PATCH', `/api/v1/admin/users/${u.id}`, { clear_member: true }, '已更新')
  }
  async function reset(u: any) {
    if (!(await confirmDialog({ title: `重置 ${u.username} 的密码？`, body: '重置后原密码立即失效。', confirmText: '重置', danger: true }))) return
    const r = await act('POST', `/api/v1/admin/users/${u.id}/reset-password`)
    if (r.ok) showSecret({ title: `${u.username} 的临时密码`, note: '临时密码仅此一次显示，请立即转交给用户。用户登录后会被要求修改密码。', secret: r.data.temporary_password })
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TrendTile label="账号总数" value={stat.total} format={{ maximumFractionDigits: 0 }} />
          <TrendTile label="有效会员" value={stat.members} format={{ maximumFractionDigits: 0 }} />
          <TrendTile label="7 天内到期" value={stat.expiring} format={{ maximumFractionDigits: 0 }} />
          <TrendTile label="已禁用" value={stat.disabled} format={{ maximumFractionDigits: 0 }} />
        </div>
        {expiring && <p className="mt-1.5 text-xs text-ink-3">按当前筛选统计。</p>}
      </div>
      <Panel title="用户">
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Input value={kw} onChange={(e) => { setKw(e.target.value); setPage(0) }} placeholder="搜索用户名" aria-label="搜索用户名" className="w-52" />
          <label className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={expiring} onCheckedChange={(c) => { setExpiring(!!c); setPage(0) }} />只看 7 天内到期</label>
        </div>
        <QueryState q={users}>
          <Table>
            <TableHeader><TableRow>{['ID', '用户名', '基础角色', '会员角色', '到期', '生效角色', '状态', '操作'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {shown.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="tnum">{u.id}</TableCell><TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell>{u.base_role}</TableCell><TableCell>{u.member_role || '—'}</TableCell>
                  <TableCell className="tnum">{u.member_expires_at ? dateOf(u.member_expires_at) : '—'}</TableCell>
                  <TableCell>{u.effective_role}</TableCell>
                  <TableCell>
                    <label className="flex cursor-pointer items-center gap-2">
                      <Switch checked={!u.disabled} aria-label={`${u.username} ${u.disabled ? '已禁用' : '正常'}`} onCheckedChange={(on) => void act('PATCH', `/api/v1/admin/users/${u.id}`, { disabled: !on }, '已更新')} />
                      <span className="text-xs text-ink-3">{u.disabled ? '已禁用' : '正常'}</span>
                    </label>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      {u.base_role !== 'admin' && <Button size="xs" variant="outline" onClick={() => setGrantFor(u)}>开通 / 续期</Button>}
                      {u.member_role && <Button size="xs" variant="outline" onClick={() => clearMember(u)}>清除会员</Button>}
                      <Button size="xs" variant="outline" onClick={() => reset(u)}>重置密码</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!shown.length && <TableRow><TableCell colSpan={8} className="py-8 text-center text-ink-3">没有符合条件的用户</TableCell></TableRow>}
            </TableBody>
          </Table>
          <Pager total={rows.length} page={page} onPage={setPage} />
        </QueryState>
      </Panel>
      {grantFor && <GrantDialog user={grantFor} plans={plans.data?.items || []} onClose={() => setGrantFor(null)} />}
    </div>
  )
}
