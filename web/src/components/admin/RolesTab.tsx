import { useEffect, useState } from 'react'
import { Panel } from '@/components/shell/Panel'
import { Notice } from '@/components/shell/Notice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAdminAct, useAdminQuery } from '@/lib/admin'
import { confirmDialog } from '@/lib/dialogs'
import { QueryState } from './QueryState'

const PERM_LABEL: Record<string, string> = {
  'page.overview': '市场总览', 'page.participation': '参与度与资金环境', 'page.industries': '行业比较与轮动',
  'page.themes': '题材与涨跌结构', 'page.history': '开盘五分钟与板块统计', 'page.calendar': '事件日历',
  'data.detail': '下钻明细', 'data.members': '成分股统计', 'client.web': '网页端', 'client.mp': '小程序', 'admin.console': '管理后台',
  'data.history_days': '可查历史（交易日）', max_sessions: '同时在线会话数',
}

export function RolesTab() {
  const act = useAdminAct()
  const q = useAdminQuery<{ items: any[]; all_permissions: string[]; numeric: Record<string, [number, number]>; policy_active?: boolean }>(['roles'], '/api/v1/admin/roles')
  const policyActive = !!q.data?.policy_active
  const numeric = q.data?.numeric || {}
  const boolPerms = (q.data?.all_permissions || []).filter((p) => !numeric[p])
  // 每个角色一份可编辑的权限副本，保存后以服务端为准
  const [work, setWork] = useState<Record<string, Record<string, number>>>({})
  useEffect(() => { if (q.data) setWork(Object.fromEntries(q.data.items.map((r) => [r.name, { ...r.permissions }]))) }, [q.data])
  const [nr, setNr] = useState({ name: '', label: '' })
  const setPerm = (role: string, p: string, v: number | null) => setWork((w) => { const c = { ...w[role] }; if (v) c[p] = v; else delete c[p]; return { ...w, [role]: c } })

  async function del(r: any) {
    if (await confirmDialog({ title: `删除角色 ${r.label}？`, body: '已绑定这个角色的用户需要先改到别的角色。', confirmText: '删除', danger: true })) await act('DELETE', `/api/v1/admin/roles/${r.name}`, undefined, '已删除')
  }
  async function create() {
    const r = await act('POST', '/api/v1/admin/roles', { name: nr.name, label: nr.label, permissions: policyActive ? {} : { 'client.web': 1, 'page.overview': 1, 'data.history_days': 5, max_sessions: 1 } }, '已创建')
    if (r.ok) setNr({ name: '', label: '' })
  }

  return (
    <Panel title={<>角色<small className="ml-2 text-xs font-normal text-ink-3">内置角色不可删除</small></>}>
      <QueryState q={q}>
        {policyActive && <Notice className="mb-4">权限已改由“角色权限配置”页按策略版本修改（看差异、二次确认后生效）；这里只管理角色名称。新建的角色要在配置页加入策略后才能访问数据。</Notice>}
        {(q.data?.items || []).map((r) => (
          <div key={r.name} className="border-t py-4 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium">{r.label}</h3><code className="text-xs text-ink-3">{r.name}</code>
              {r.builtin && <Badge variant="outline" className="text-ink-3">内置</Badge>}
              <div className="ml-auto flex gap-1.5">
                {!policyActive && <Button size="xs" onClick={() => act('PUT', `/api/v1/admin/roles/${r.name}`, { label: r.label, permissions: work[r.name] }, '角色已保存，即时生效')}>保存</Button>}
                {!r.builtin && <Button size="xs" variant="outline" onClick={() => del(r)}>删除</Button>}
              </div>
            </div>
            {!policyActive && work[r.name] && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2.5 text-sm">
                {boolPerms.map((p) => <label key={p} className="flex cursor-pointer items-center gap-2"><Checkbox checked={!!work[r.name][p]} onCheckedChange={(c) => setPerm(r.name, p, c ? 1 : null)} />{PERM_LABEL[p] || p}</label>)}
                {Object.keys(numeric).map((p) => (
                  <label key={p} className="flex items-center gap-2">{PERM_LABEL[p] || p}
                    <Input type="number" min={1} max={numeric[p][1]} value={work[r.name][p] || ''} onChange={(e) => setPerm(r.name, p, e.target.value ? Number(e.target.value) : null)} className="h-8 w-20" /></label>
                ))}
              </div>
            )}
          </div>
        ))}
        <h3 className="mb-2 mt-4 border-t pt-4 text-sm font-medium">新建角色</h3>
        <form onSubmit={(e) => { e.preventDefault(); void create() }} className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5"><Label htmlFor="nr-name">标识</Label><Input id="nr-name" value={nr.name} onChange={(e) => setNr({ ...nr, name: e.target.value.trim() })} placeholder="如 trial" className="w-40" /></div>
          <div className="grid gap-1.5"><Label htmlFor="nr-label">名称</Label><Input id="nr-label" value={nr.label} onChange={(e) => setNr({ ...nr, label: e.target.value })} className="w-40" /></div>
          <Button type="submit" variant="outline" disabled={!nr.name || !nr.label.trim()}>创建{policyActive ? '' : '（权限创建后再勾选）'}</Button>
        </form>
      </QueryState>
    </Panel>
  )
}
