import { useEffect, useState } from 'react'
import { Panel } from '@/components/shell/Panel'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useAdminAct, useAdminQuery } from '@/lib/admin'
import { confirmDialog } from '@/lib/dialogs'
import { cents, yuan } from '@/lib/format'
import { QueryState } from './QueryState'

// 一行里改过、还没保存的字段；价格先存文本（输入「1.」时不能被改写成「1.00」），保存时再转分
type Edit = Partial<{ name: string; role: string; duration_days: number; sort: number; listed: boolean; note: string; price: string }>

export function PlansTab() {
  const act = useAdminAct()
  const plans = useAdminQuery<{ items: any[]; contact_text: string }>(['plans'], '/api/v1/admin/plans')
  const roles = useAdminQuery<{ items: any[] }>(['roles'], '/api/v1/admin/roles')
  const sellable = (roles.data?.items || []).filter((r) => r.name !== 'admin' && r.name !== 'free')
  const [edits, setEdits] = useState<Record<number, Edit>>({})
  const [contact, setContact] = useState('')
  const [np, setNp] = useState({ name: '', role: 'vip', duration_days: 30, price: '0' })
  useEffect(() => { if (plans.data) setContact(plans.data.contact_text || '') }, [plans.data])
  const set = (id: number, patch: Edit) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }))

  async function save(p: any) {
    const { price, ...rest } = edits[p.id] || {}
    const r = await act('PUT', `/api/v1/admin/plans/${p.id}`, { ...p, ...rest, price_cents: price != null ? cents(price) : p.price_cents }, '套餐已保存')
    if (r.ok) setEdits((e) => { const n = { ...e }; delete n[p.id]; return n })
  }
  async function del(p: any) {
    if (await confirmDialog({ title: `删除套餐 ${p.name}？`, body: '已有开通记录的套餐不能删除，只能下架。', confirmText: '删除', danger: true })) await act('DELETE', `/api/v1/admin/plans/${p.id}`, undefined, '已删除')
  }
  async function create() {
    const r = await act('POST', '/api/v1/admin/plans', { name: np.name, role: np.role, duration_days: np.duration_days, price_cents: cents(np.price) }, '已创建（未上架，勾选上架后保存才对用户可见）')
    if (r.ok) setNp({ name: '', role: 'vip', duration_days: 30, price: '0' })
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <Panel title={<>套餐<small className="ml-2 text-xs font-normal text-ink-3">新建默认未上架；已有开通记录的套餐只能下架不能删除</small></>}>
        <QueryState q={plans}>
          <Table>
            <TableHeader><TableRow>{['名称', '等级', '天数', '标价（元）', '排序', '上架', '说明', ''].map((h, i) => <TableHead key={i}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {(plans.data?.items || []).map((p) => {
                const e = edits[p.id]
                const v = { ...p, ...e }
                return (
                  <TableRow key={p.id}>
                    <TableCell><Input aria-label="套餐名称" value={v.name} onChange={(ev) => set(p.id, { name: ev.target.value })} className="w-36" /></TableCell>
                    <TableCell><NativeSelect aria-label="等级" value={v.role} onChange={(ev) => set(p.id, { role: ev.target.value })}>{sellable.map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}</NativeSelect></TableCell>
                    <TableCell><Input aria-label="天数" type="number" min={1} value={v.duration_days} onChange={(ev) => set(p.id, { duration_days: Number(ev.target.value) })} className="w-20" /></TableCell>
                    <TableCell><Input aria-label="标价（元）" type="number" min={0} step="0.01" value={e?.price ?? yuan(p.price_cents)} onChange={(ev) => set(p.id, { price: ev.target.value })} className="w-24" /></TableCell>
                    <TableCell><Input aria-label="排序" type="number" value={v.sort} onChange={(ev) => set(p.id, { sort: Number(ev.target.value) })} className="w-20" /></TableCell>
                    <TableCell><Checkbox aria-label="上架" checked={!!v.listed} onCheckedChange={(c) => set(p.id, { listed: !!c })} /></TableCell>
                    <TableCell><Input aria-label="说明" value={v.note || ''} onChange={(ev) => set(p.id, { note: ev.target.value })} className="w-48" /></TableCell>
                    <TableCell><div className="flex gap-1.5"><Button size="xs" variant={e ? 'default' : 'outline'} onClick={() => save(p)}>保存</Button><Button size="xs" variant="outline" onClick={() => del(p)}>删除</Button></div></TableCell>
                  </TableRow>
                )
              })}
              {!plans.data?.items?.length && <TableRow><TableCell colSpan={8} className="py-8 text-center text-ink-3">还没有套餐</TableCell></TableRow>}
            </TableBody>
          </Table>
        </QueryState>
        <h3 className="mb-2 mt-6 text-sm font-medium">新建套餐</h3>
        <form onSubmit={(e) => { e.preventDefault(); void create() }} className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5"><Label htmlFor="np-name">名称</Label><Input id="np-name" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} placeholder="如 VIP 月卡" className="w-44" /></div>
          <div className="grid gap-1.5"><Label htmlFor="np-role">等级</Label><NativeSelect id="np-role" value={np.role} onChange={(e) => setNp({ ...np, role: e.target.value })}>{sellable.map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}</NativeSelect></div>
          <div className="grid gap-1.5"><Label htmlFor="np-days">天数</Label><Input id="np-days" type="number" min={1} value={np.duration_days} onChange={(e) => setNp({ ...np, duration_days: Number(e.target.value) })} className="w-24" /></div>
          <div className="grid gap-1.5"><Label htmlFor="np-price">标价（元）</Label><Input id="np-price" type="number" min={0} step="0.01" value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} className="w-28" /></div>
          <Button type="submit" variant="outline" disabled={!np.name.trim()}>创建</Button>
        </form>
      </Panel>
      <Panel title="开通方式说明" hint="显示在会员套餐页，如客服微信号、付款后联系方式">
        <form onSubmit={(e) => { e.preventDefault(); void act('PUT', '/api/v1/admin/plan-contact', { text: contact }, '开通方式说明已保存') }} className="grid max-w-[520px] gap-2">
          <Textarea aria-label="开通方式说明" value={contact} onChange={(e) => setContact(e.target.value)} rows={3} maxLength={500} />
          <div className="flex items-center justify-between"><Button type="submit" variant="outline">保存说明</Button><span className="tnum text-xs text-ink-3">{contact.length} / 500</span></div>
        </form>
      </Panel>
    </div>
  )
}
