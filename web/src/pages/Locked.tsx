import { Link, useParams } from 'react-router'
import { Lock } from 'lucide-react'
import { PageHead } from '@/components/shell/PageHead'
import { Panel } from '@/components/shell/Panel'
import { Disclaimer } from '@/components/shell/Disclaimer'
import { Button } from '@/components/ui/button'
import { payOn, useSession } from '@/lib/auth'
import { pageByKey } from '@/lib/pageCatalog'

// 无权限数据页的预告：只列指标名称，不请求任何数据接口
export function Component() {
  const { key } = useParams()
  const user = useSession((s) => s.user)
  const page = pageByKey(key || '')
  const need = (page && user?.perm_min_role?.[page.perm]) || '会员'
  return (
    <section>
      <PageHead title={page?.title || '会员内容'} sub={page?.question}
        badge={<span className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs text-ink-2"><Lock size={12} />需要 {need}</span>} />
      <Panel title="开通后可查看">
        <ul className="mb-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">{(page?.metrics || []).map((m) => <li key={m}>{m}</li>)}</ul>
        <p className="mb-4 text-sm text-ink-3">当前等级：{user?.role_label}。该页面需要 {need} 及以上等级。</p>
        {payOn() ? <Button asChild><Link to="/plans">查看会员套餐</Link></Button> : <p className="text-sm text-ink-3">会员购买暂未开放。</p>}
      </Panel>
      <Disclaimer />
    </section>
  )
}
