import { cn } from '@/lib/utils'

const SETTING_LABEL: Record<string, string> = { history_days: '可查历史（交易日）', max_sessions: '同时在线会话数', entries: '可登录入口', admin_console: '管理后台' }

// 一条变化：新增用「＋」（--c-up），移除用「－」（--c-down），其余用「·」
function Line({ sign, children }: { sign?: '+' | '-'; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className={cn('w-3 shrink-0 text-center', sign === '+' && 'text-up', sign === '-' && 'text-down', !sign && 'text-ink-3')}>{sign === '+' ? '＋' : sign === '-' ? '－' : '·'}</span>
      <span className="min-w-0">{children}</span>
    </li>
  )
}

function IdList({ sign, title, ids, L }: { sign: '+' | '-'; title: string; ids: string[]; L: (x: string) => string }) {
  return (
    <Line sign={sign}>
      {title} {ids.length} 项
      <ul className="mt-1 space-y-0.5 text-xs text-ink-3">{ids.map((i) => <li key={i}>{L(i)}</li>)}</ul>
    </Line>
  )
}

// 策略差异：路由变化 + 每个角色的看板、指标、设置变化
export function PolicyDiff({ diff, labels }: { diff: any; labels: Record<string, string> }) {
  const L = (x: string) => labels[x] || x
  const d = diff || {}
  const rt = d.routes || {}
  const routeLines: React.ReactNode[] = [
    ...Object.entries(rt.added || {}).map(([r, a]) => <Line key={`ra-${r}`} sign="+">路由：新增 {r} → {String(a)}</Line>),
    ...Object.entries(rt.removed || {}).map(([r, a]) => <Line key={`rr-${r}`} sign="-">路由：移除 {r}（原 {String(a)}）</Line>),
    ...Object.entries(rt.changed || {}).map(([r, c]: [string, any]) => <Line key={`rc-${r}`}>路由：{r} {c.before} → {c.after}</Line>),
  ]
  const roles = Object.entries(d.roles || {}) as [string, any][]
  if (!routeLines.length && !roles.length) return <p className="text-sm text-ink-3">无变化</p>
  return (
    <div className="space-y-4 text-sm">
      {routeLines.length > 0 && <ul className="space-y-1">{routeLines}</ul>}
      {roles.map(([role, c]) => (
        <section key={role}>
          <h4 className="mb-1.5 font-medium">{role}</h4>
          <ul className="space-y-1">
            {c.added && <Line sign="+">加入策略</Line>}
            {c.removed && <Line sign="-">移出策略</Line>}
            {c.pages_added && <Line sign="+">开放看板：{c.pages_added.map(L).join('、')}</Line>}
            {c.pages_removed && <Line sign="-">关闭看板：{c.pages_removed.map(L).join('、')}</Line>}
            {c.indicators_added && <IdList sign="+" title="新增指标" ids={c.indicators_added} L={L} />}
            {c.indicators_removed && <IdList sign="-" title="移除指标" ids={c.indicators_removed} L={L} />}
            {Object.entries(c.settings || {}).map(([k, v]: [string, any]) => <Line key={k}>{SETTING_LABEL[k] || k}：{JSON.stringify(v.before)} → {JSON.stringify(v.after)}</Line>)}
          </ul>
        </section>
      ))}
    </div>
  )
}
