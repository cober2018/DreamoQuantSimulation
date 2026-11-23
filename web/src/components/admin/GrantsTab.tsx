import { useState } from 'react'
import { Panel } from '@/components/shell/Panel'
import { TrendTile } from '@/components/charts/TrendTile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAdminAct, useAdminQuery } from '@/lib/admin'
import { promptDialog } from '@/lib/dialogs'
import { cents, dateOf, dateTimeOf, yuan } from '@/lib/format'
import { cn } from '@/lib/utils'
import { QueryState } from './QueryState'

const SRC: Record<string, string> = { admin: '后台开通', invite: '邀请码', payment: '在线支付' }
const EMPTY = { start_date: '', end_date: '', source: '', username: '' }

export function GrantsTab() {
  const act = useAdminAct()
  const [f, setF] = useState(EMPTY)
  const [applied, setApplied] = useState(EMPTY)
  const qs = new URLSearchParams(Object.entries(applied).filter(([, v]) => v)).toString()
  const q = useAdminQuery<{ items: any[]; total_cents: number; count: number }>(['grants', applied], `/api/v1/admin/grants${qs ? `?${qs}` : ''}`)

  async function correct(g: any) {
    const v = await promptDialog({ title: `冲正记录 #${g.id}`, body: '冲正是追加一条反向记录，原记录不改。', confirmText: '追加冲正',
      fields: [{ key: 'amount', label: '冲正金额（元，可为负数）', placeholder: '如 -900', required: true, type: 'number' }, { key: 'note', label: '冲正说明', required: true }] })
    if (v) await act('POST', `/api/v1/admin/grants/${g.id}/correction`, { amount_cents: cents(v.amount), note: v.note }, '已追加冲正记录')
  }

  return (
    <Panel title={<>开通记录<small className="ml-2 text-xs font-normal text-ink-3">只追加不修改；记错请冲正</small></>}>
      <form onSubmit={(e) => { e.preventDefault(); setApplied(f) }} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5"><Label htmlFor="gf-s">起</Label><Input id="gf-s" type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} className="w-40" /></div>
        <div className="grid gap-1.5"><Label htmlFor="gf-e">止</Label><Input id="gf-e" type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} className="w-40" /></div>
        <div className="grid gap-1.5"><Label htmlFor="gf-src">来源</Label>
          <NativeSelect id="gf-src" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}><option value="">全部来源</option><option value="admin">后台开通</option><option value="invite">邀请码</option></NativeSelect></div>
        <div className="grid gap-1.5"><Label htmlFor="gf-u">用户名</Label><Input id="gf-u" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} className="w-40" /></div>
        <Button type="submit" variant="outline">查询</Button>
      </form>
      <QueryState q={q}>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
          <TrendTile label="实收合计（元）" text={yuan(q.data?.total_cents)} />
          <TrendTile label="记录数" value={q.data?.count ?? 0} format={{ maximumFractionDigits: 0 }} />
        </div>
        <Table>
          <TableHeader><TableRow>{['时间', '用户', '来源', '套餐', '等级', '天数', '到期（开通后）', '金额（元）', '渠道', '备注', '操作人', ''].map((h, i) => <TableHead key={i}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {(q.data?.items || []).map((g) => (
              <TableRow key={g.id}>
                <TableCell className="tnum">{dateTimeOf(g.at)}</TableCell><TableCell>{g.username}</TableCell><TableCell>{SRC[g.source] || g.source}</TableCell>
                <TableCell>{g.plan_name || '—'}</TableCell><TableCell>{g.role || '—'}</TableCell><TableCell className="tnum">{g.days || '—'}</TableCell>
                <TableCell className="tnum">{g.expires_after ? dateOf(g.expires_after) : '—'}</TableCell>
                <TableCell className={cn('tnum text-right', g.amount_cents < 0 && 'text-down')}>{yuan(g.amount_cents)}</TableCell>
                <TableCell>{g.channel === 'correction' ? `冲正 #${g.ref_id}` : g.channel || '—'}</TableCell>
                <TableCell className="max-w-48 whitespace-normal">{g.note || '—'}</TableCell><TableCell>{g.actor}</TableCell>
                <TableCell>{g.channel !== 'correction' && <Button size="xs" variant="outline" onClick={() => correct(g)}>冲正</Button>}</TableCell>
              </TableRow>
            ))}
            {!q.data?.items?.length && <TableRow><TableCell colSpan={12} className="py-8 text-center text-ink-3">没有符合条件的记录</TableCell></TableRow>}
          </TableBody>
        </Table>
      </QueryState>
    </Panel>
  )
}
