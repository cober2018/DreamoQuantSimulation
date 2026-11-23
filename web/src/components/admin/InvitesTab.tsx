import { useState } from 'react'
import { Panel } from '@/components/shell/Panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAdminAct, useAdminQuery } from '@/lib/admin'
import { confirmDialog, showSecret } from '@/lib/dialogs'
import { cn } from '@/lib/utils'
import { QueryState } from './QueryState'

export function InvitesTab() {
  const act = useAdminAct()
  const q = useAdminQuery<{ items: any[] }>(['invites'], '/api/v1/admin/invites')
  const roles = useAdminQuery<{ items: any[] }>(['roles'], '/api/v1/admin/roles')
  const [inv, setInv] = useState({ role: 'vip', duration_days: 30, count: 1, max_uses: 1, note: '' })
  const set = (patch: Partial<typeof inv>) => setInv((v) => ({ ...v, ...patch }))

  async function create() {
    const r = await act('POST', '/api/v1/admin/invites', inv)
    if (r.ok) showSecret({ title: `已生成 ${r.data.codes.length} 个邀请码`, note: '明文仅此一次显示，请立即保存；库内只存哈希。', secret: r.data.codes.join('\n') })
  }
  async function revoke(i: any) {
    if (await confirmDialog({ title: `作废邀请码（尾号 ${i.hint}）？`, body: '作废后不能再兑换。', confirmText: '作废', danger: true })) await act('POST', `/api/v1/admin/invites/${i.id}/revoke`, undefined, '已作废')
  }

  return (
    <Panel title="邀请码">
      <form onSubmit={(e) => { e.preventDefault(); void create() }} className="mb-5 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5"><Label htmlFor="iv-role">角色</Label>
          <NativeSelect id="iv-role" value={inv.role} onChange={(e) => set({ role: e.target.value })}>{(roles.data?.items || []).filter((x) => x.name !== 'admin').map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}</NativeSelect></div>
        <div className="grid gap-1.5"><Label htmlFor="iv-days">有效天数</Label><Input id="iv-days" type="number" min={1} value={inv.duration_days} onChange={(e) => set({ duration_days: Number(e.target.value) })} className="w-24" /></div>
        <div className="grid gap-1.5"><Label htmlFor="iv-n">数量</Label><Input id="iv-n" type="number" min={1} max={200} value={inv.count} onChange={(e) => set({ count: Number(e.target.value) })} className="w-24" /></div>
        <div className="grid gap-1.5"><Label htmlFor="iv-u">每码可用次数</Label><Input id="iv-u" type="number" min={1} value={inv.max_uses} onChange={(e) => set({ max_uses: Number(e.target.value) })} className="w-28" /></div>
        <div className="grid gap-1.5"><Label htmlFor="iv-note">备注</Label><Input id="iv-note" value={inv.note} onChange={(e) => set({ note: e.target.value })} className="w-44" /></div>
        <Button type="submit" variant="outline">生成</Button>
      </form>
      <QueryState q={q}>
        <Table>
          <TableHeader><TableRow>{['ID', '尾号', '角色', '天数', '已用 / 上限', '状态', '备注', ''].map((h, i) => <TableHead key={i}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {(q.data?.items || []).map((i) => (
              <TableRow key={i.id}>
                <TableCell className="tnum">{i.id}</TableCell><TableCell className="tnum">{i.hint}</TableCell><TableCell>{i.role}</TableCell><TableCell className="tnum">{i.duration_days}</TableCell>
                <TableCell className="tnum">{i.used_count} / {i.max_uses}</TableCell>
                <TableCell><Badge variant={i.status === 'active' ? 'secondary' : 'outline'} className={cn(i.status !== 'active' && 'text-ink-3')}>{i.status}</Badge></TableCell>
                <TableCell className="whitespace-normal">{i.note}</TableCell>
                <TableCell>{i.status === 'active' && <Button size="xs" variant="outline" onClick={() => revoke(i)}>作废</Button>}</TableCell>
              </TableRow>
            ))}
            {!q.data?.items?.length && <TableRow><TableCell colSpan={8} className="py-8 text-center text-ink-3">还没有邀请码</TableCell></TableRow>}
          </TableBody>
        </Table>
      </QueryState>
    </Panel>
  )
}
