import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHead } from '@/components/shell/PageHead'
import { Panel } from '@/components/shell/Panel'
import { Notice } from '@/components/shell/Notice'
import { PasswordInput } from '@/components/shell/PasswordInput'
import { BlurFade } from '@/components/fx/blur-fade'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, logout, payOn, reloadMe, trialText, useSession } from '@/lib/auth'
import { confirmDialog } from '@/lib/dialogs'
import { cn } from '@/lib/utils'
import { daysLeft, dateOf } from '@/lib/format'

const STATUS: Record<string, string> = { active: '有效', revoked: '已吊销', expired: '已过期', invalidated: '改密后失效' }
const selectCls = 'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(() => toast.success('已复制'), () => toast.error('复制失败，请手动选中复制'))
}

function PasswordPanel() {
  const nav = useNavigate()
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setMsg(''); setBusy(true)
    const r = await api('POST', '/api/v1/auth/change-password', { old_password: oldPw, new_password: newPw })
    setBusy(false)
    if (!r.ok) { setMsg(r.data.detail || '修改失败'); return }
    await logout()
    nav('/login', { replace: true })
  }
  return (
    <Panel title="修改密码">
      <form onSubmit={submit} className="grid max-w-[420px] gap-3">
        <PasswordInput label="原密码" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder="原密码" autoComplete="current-password" />
        <PasswordInput label="新密码" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="新密码（至少 10 位，含大小写与数字中至少两类）" autoComplete="new-password" />
        <div><Button type="submit" disabled={!oldPw || !newPw || busy}>修改并重新登录</Button></div>
      </form>
      {msg && <Notice tone="error" className="mt-3">{msg}</Notice>}
    </Panel>
  )
}

function RedeemPanel() {
  const [code, setCode] = useState('')
  const [res, setRes] = useState<{ ok: boolean; text: string } | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    const r = await api('POST', '/api/v1/invite/redeem', { code })
    setRes({ ok: r.ok, text: r.ok ? `兑换成功：${r.data.role_label}，到期 ${dateOf(r.data.member_expires_at)}` : r.data.detail || '兑换失败' })
    if (r.ok) { setCode(''); await reloadMe() }
  }
  return (
    <Panel title="邀请码兑换">
      <p className="mb-3 text-sm text-ink-3">已获得邀请码可在此兑换；付费开通请查看<Link className="text-primary underline" to="/plans">会员套餐</Link>。</p>
      <form onSubmit={submit} className="flex max-w-[420px] gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value.trim())} placeholder="XXXX-XXXX-XXXX" aria-label="邀请码" />
        <Button type="submit" variant="outline" disabled={!code}>兑换</Button>
      </form>
      {res && <Notice tone={res.ok ? 'info' : 'error'} className="mt-3">{res.text}</Notice>}
    </Panel>
  )
}

// 接口 404（未开启）或 403（不在名单）时整块不显示
function McpPanel({ data }: { data: any }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [days, setDays] = useState('90')
  const [msg, setMsg] = useState('')
  // 新令牌只放在内存里，离开页面就没有了
  const [token, setToken] = useState('')
  const endpoint = `${location.origin}${data.endpoint_path || '/mcp'}`
  const snippet = JSON.stringify({ mcpServers: { 'zhishu-xingyao': { type: 'http', url: endpoint, headers: { Authorization: `Bearer ${token || '<你的令牌>'}` } } } }, null, 2)
  const create = useMutation({
    mutationFn: () => api('POST', '/api/v1/account/mcp-tokens', { name, expires_days: days === 'forever' ? null : Number(days) }),
    onSuccess: (r) => {
      if (!r.ok) { setMsg(r.data.detail || '生成失败'); return }
      setMsg(''); setToken(r.data.token); setName('')
      void qc.invalidateQueries({ queryKey: ['mcp-tokens'] })
    },
  })
  const revoke = useMutation({
    mutationFn: (id: number) => api('POST', `/api/v1/account/mcp-tokens/${id}/revoke`),
    onSuccess: (r) => { if (!r.ok) { setMsg(r.data.detail || '吊销失败'); return } setMsg(''); void qc.invalidateQueries({ queryKey: ['mcp-tokens'] }) },
  })
  async function onRevoke(t: any) {
    if (await confirmDialog({ title: `吊销令牌 ${t.prefix}…？`, body: '使用它的客户端将立即无法读取数据。', confirmText: '吊销', danger: true })) revoke.mutate(t.id)
  }
  return (
    <Panel title="大模型客户端接入（内测）">
      <p className="mb-3 text-sm leading-relaxed text-ink-3">在支持的大模型客户端里只读调用本平台数据，等级与网页一致。当前限额：每分钟 {data.limits?.per_minute} 次、24 小时 {data.limits?.per_day} 次；每人最多 {data.max_active} 把有效令牌。</p>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span>服务地址：</span><code className="rounded bg-secondary px-1.5 py-0.5 text-[13px]">{endpoint}</code>
        <Button type="button" size="xs" variant="outline" onClick={() => copy(endpoint)}>复制</Button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate() }} className="flex flex-wrap gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} placeholder="备注（如 Claude Desktop）" aria-label="令牌备注" className="w-56" />
        <select value={days} onChange={(e) => setDays(e.target.value)} aria-label="有效期" className={selectCls}>
          <option value="30">30 天有效</option><option value="90">90 天有效</option><option value="180">180 天有效</option><option value="forever">长期有效</option>
        </select>
        <Button type="submit" disabled={create.isPending}>生成令牌</Button>
      </form>
      {msg && <Notice tone="error" className="mt-3">{msg}</Notice>}
      {token && (
        <Notice className="mt-3">
          <div>新令牌只显示这一次，请立即复制保存：</div>
          <code className="my-1.5 block break-all rounded bg-background px-2 py-1.5 font-mono text-[13px]">{token}</code>
          <Button type="button" size="xs" variant="outline" onClick={() => copy(token)}>复制</Button>
        </Notice>
      )}
      <div className="mb-1.5 mt-5 text-xs text-ink-3">客户端配置（把令牌填进 Authorization）</div>
      <pre className="max-h-56 overflow-auto rounded-md bg-secondary p-3 text-xs">{snippet}</pre>
      <Button type="button" size="xs" variant="outline" className="mt-2" onClick={() => copy(snippet)}>复制配置</Button>
      {data.items?.length > 0 && (
        <div className="mt-5">
          <Table>
            <TableHeader><TableRow>{['令牌', '备注', '创建', '到期', '最近使用', '状态', ''].map((h, i) => <TableHead key={i}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {data.items.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell><code>{t.prefix}…</code></TableCell><TableCell>{t.name || '-'}</TableCell>
                  <TableCell className="tnum">{dateOf(t.created_at)}</TableCell>
                  <TableCell className="tnum">{t.expires_at ? dateOf(t.expires_at) : '长期'}</TableCell>
                  <TableCell className="tnum">{t.last_used_at ? dateOf(t.last_used_at) : '-'}</TableCell>
                  <TableCell><Badge variant={t.status === 'active' ? 'secondary' : 'outline'} className={cn(t.status !== 'active' && 'text-ink-3')}>{STATUS[t.status] || t.status}</Badge></TableCell>
                  <TableCell>{t.status === 'active' && <Button size="xs" variant="outline" onClick={() => onRevoke(t)}>吊销</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  )
}

export function Component() {
  const nav = useNavigate()
  const user = useSession((s) => s.user)!
  const left = daysLeft(user.member_expires_at)
  const mcp = useQuery({ queryKey: ['mcp-tokens'], queryFn: () => api('GET', '/api/v1/account/mcp-tokens') })
  const mcpData = mcp.data?.ok ? mcp.data.data : null
  async function out() { await logout(); nav('/login', { replace: true }) }
  const trial = trialText(user)
  return (
    <section>
      <PageHead title="我的账号" />
      <div className={cn('grid grid-cols-1 gap-4', mcpData && 'xl:grid-cols-12')}>
        <div className={cn('grid content-start gap-4', mcpData ? 'xl:col-span-5' : 'max-w-[720px]')}>
          <BlurFade>
            <Panel title="账号信息">
              <dl className="divide-y rounded-md border bg-background/50 text-sm">
                {[
                  ['用户名', user.username, undefined],
                  ['当前等级', user.role_label, user.member_expires_at ? `到期 ${dateOf(user.member_expires_at)}（剩 ${left} 天）` : undefined],
                  ['可查看历史', `${user.history_days} 个交易日`, undefined],
                ].map(([k, v, sub]) => (
                  <div key={k as string} className="flex items-baseline justify-between gap-4 px-3.5 py-2.5">
                    <dt className="shrink-0 text-ink-3">{k}</dt>
                    <dd className="min-w-0 text-right"><span className="break-all font-medium">{v}</span>{sub && <div className="tnum text-xs text-ink-3">{sub}</div>}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 grid gap-2">
                {user.must_change_password && <Notice>请先修改初始/临时密码，否则无法访问数据页面。</Notice>}
                {trial && <Notice>{trial}</Notice>}
                {left !== null && left <= 7 && <Notice tone="warn">会员将于 {left} 天后到期{payOn() && '，续期请查看会员套餐'}。</Notice>}
              </div>
              {payOn() && <Button asChild className="mt-4"><Link to="/plans">{user.member_expires_at ? '续期 / 升级' : '开通会员'}</Link></Button>}
            </Panel>
          </BlurFade>
          <BlurFade delay={0.06}><PasswordPanel /></BlurFade>
          {payOn() && <BlurFade delay={0.12}><RedeemPanel /></BlurFade>}
          <BlurFade delay={0.18}><Panel><Button variant="outline" onClick={out}>退出登录</Button></Panel></BlurFade>
        </div>
        {mcpData && <div className="xl:col-span-7"><BlurFade delay={0.1}><McpPanel data={mcpData} /></BlurFade></div>}
      </div>
    </section>
  )
}
