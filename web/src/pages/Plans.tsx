import { useQuery } from '@tanstack/react-query'
import { PageHead } from '@/components/shell/PageHead'
import { Panel } from '@/components/shell/Panel'
import { Disclaimer } from '@/components/shell/Disclaimer'
import { BlurFade } from '@/components/fx/blur-fade'
import { Button } from '@/components/ui/button'
import { api, useSession } from '@/lib/auth'
import { dateOf, yuan } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Component() {
  const user = useSession((s) => s.user)
  const q = useQuery({ queryKey: ['plans'], queryFn: () => api('GET', '/api/v1/plans') })
  const items: any[] = q.data?.ok ? q.data.data.items : []
  const contact: string = q.data?.ok ? q.data.data.contact_text : ''
  const error = q.data && !q.data.ok ? q.data.data.detail || '套餐信息暂时无法加载' : q.isError ? '套餐信息暂时无法加载' : ''
  return (
    <section>
      <PageHead title="会员套餐" sub={<>当前等级：{user?.role_label}{user?.member_expires_at ? `，到期 ${dateOf(user.member_expires_at)}` : ''}</>} />
      {q.isPending ? <div className="py-16 text-center text-ink-3">加载中…</div>
        : error ? (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            <span>{error}</span><Button size="sm" variant="outline" onClick={() => q.refetch()}>重试</Button>
          </div>
        ) : (
          <>
            {!items.length && <div className="py-10 text-center text-ink-3">暂未开放购买，如需开通请联系管理员。</div>}
            <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {items.map((p, i) => {
                const current = p.role === user?.role
                return (
                  <BlurFade key={p.id} delay={Math.min(i * 0.06, 0.4)}>
                    <div className={cn('h-full rounded-lg border bg-card p-5 shadow-[var(--shadow-1)]', current && 'border-primary')}>
                      <div className="flex items-center justify-between text-xs text-ink-3"><span>{p.role_label}</span>{current && <span className="rounded-full bg-accent px-2 py-0.5 text-primary">当前等级</span>}</div>
                      <h2 className="mt-1 text-[17px] font-medium">{p.name}</h2>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="num-display text-[26px] text-primary">¥{yuan(p.price_cents)}</span>
                        <span className="text-xs text-ink-3">/ {p.duration_days} 天</span>
                      </div>
                      {p.note && <p className="mt-2 text-xs leading-relaxed text-ink-3">{p.note}</p>}
                    </div>
                  </BlurFade>
                )
              })}
            </div>
            <Panel title="开通方式">
              <p className="whitespace-pre-wrap text-sm">{contact || '请联系管理员开通。'}</p>
              <p className="mt-3 text-xs leading-relaxed text-ink-3">付款后由管理员为您的账号（用户名：{user?.username}）开通，开通后无需重新登录即可生效。同等级续期从原到期日顺延；升级从开通当日起算。也可在“我的账号”使用邀请码。</p>
            </Panel>
          </>
        )}
      <Disclaimer />
    </section>
  )
}
