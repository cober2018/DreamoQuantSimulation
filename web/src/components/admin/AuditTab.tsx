import { useState } from 'react'
import { Panel } from '@/components/shell/Panel'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAdminQuery } from '@/lib/admin'
import { dateTimeOf } from '@/lib/format'
import { Pager, PAGE_SIZE } from './Pager'
import { QueryState } from './QueryState'

export function AuditTab() {
  const q = useAdminQuery<{ items: any[] }>(['audit'], '/api/v1/admin/audit')
  const [kw, setKw] = useState('')
  const [page, setPage] = useState(0)
  const key = kw.trim().toLowerCase()
  const rows = (q.data?.items || []).filter((a) => !key || [a.actor, a.action, a.target].some((x) => String(x ?? '').toLowerCase().includes(key)))
  return (
    <Panel title="审计日志（最近 200 条）">
      <Input value={kw} onChange={(e) => { setKw(e.target.value); setPage(0) }} placeholder="按操作者、动作、对象搜索" aria-label="搜索审计日志" className="mb-3 w-64" />
      <QueryState q={q}>
        <Table>
          <TableHeader><TableRow>{['时间', '操作者', '动作', '对象', 'IP'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((a) => (
              <TableRow key={a.id}><TableCell className="tnum">{dateTimeOf(a.at)}</TableCell><TableCell>{a.actor}</TableCell><TableCell>{a.action}</TableCell><TableCell>{a.target}</TableCell><TableCell className="tnum">{a.ip}</TableCell></TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-ink-3">没有符合条件的记录</TableCell></TableRow>}
          </TableBody>
        </Table>
        <Pager total={rows.length} page={page} onPage={setPage} />
      </QueryState>
    </Panel>
  )
}
