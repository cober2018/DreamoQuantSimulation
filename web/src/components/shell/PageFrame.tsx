import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { fmt, SERVICE_NAMES, type Envelope } from '@/lib/api'
import { payOn } from '@/lib/auth'

export const DISCLAIMER = '本平台提供市场数据与历史统计，仅供研究和学习参考，不构成任何投资建议、证券推荐或交易指令。数据可能存在延迟、缺失或误差，请以交易所及上市公司的官方披露为准。投资有风险，决策请独立判断。'
const LABELS: Record<string, string> = {
  ok: '数据完整', partial: '部分缺失', empty: '数据暂缺', not_connected: '数据待接入',
  upstream_error: '数据服务不可用', server_error: '服务错误', unauthorized: '未登录', forbidden: '权限不足', rate_limited: '请求过于频繁',
}
const ERRORS = ['upstream_error', 'server_error', 'unauthorized', 'forbidden', 'rate_limited']

const Banner = ({ tone = 'warn', children }: { tone?: 'warn' | 'error' | 'info'; children: ReactNode }) => (
  <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-md border px-4 py-3 text-sm ${tone === 'error' ? 'border-destructive/40 bg-destructive/10' : tone === 'info' ? 'bg-secondary' : 'border-[var(--c-warn)]/40 bg-[var(--c-warn)]/10'}`}>{children}</div>
)
const Btn = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} className="rounded-md border border-[var(--c-line-strong)] bg-card px-3 py-1.5 text-sm hover:bg-surface-hover">{children}</button>
)

interface Props {
  title: string
  question?: string
  env: Envelope
  loading?: boolean
  tools?: ReactNode
  onRetry?: () => void
  onJump?: (date: string) => void
  children: ReactNode
}

export function PageFrame({ title, question, env, loading, tools, onRetry, onJump, children }: Props) {
  // 数据中台慢时（约 20 秒仍未返回）提示用户稍后刷新，不一直转圈
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!loading) { setSlow(false); return }
    const t = window.setTimeout(() => setSlow(true), 20_000)
    return () => window.clearTimeout(t)
  }, [loading])
  const status = env.status || ''
  const isError = ERRORS.includes(status)
  const errorText = ({
    upstream_error: '数据服务暂时不可用，请稍后重试。', unauthorized: '登录已失效，请重新登录。',
    forbidden: env.detail || '当前等级无法查看该内容。', rate_limited: '请求过于频繁，请稍后再试。',
  } as Record<string, string>)[status] || '服务出现错误，请稍后重试。'
  const canJump = !!env.latest_available_date && env.latest_available_date !== env.trade_date
  const lockedMods = (env.restricted_modules || []).map((m) => (m.state === 'partial' ? `${m.label}（开放 ${m.open}/${m.total} 项）` : m.label))
  const gapItems = [...new Set((env.gaps || []).map((g) => g.item).filter(Boolean))]

  return (
    <section>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-[30px] font-normal leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{title}</h1>
          {status && (
            <span className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs text-ink-2">
              <i className={`inline-block size-1.5 rounded-full ${status === 'ok' ? 'bg-[var(--c-ok,var(--c-down))]' : isError ? 'bg-destructive' : 'bg-[var(--c-warn)]'}`} />{LABELS[status] || status}
            </span>
          )}
          {tools}
        </div>
        <p className="mt-1.5 text-sm text-ink-3">
          {question}{question && env.trade_date && <span className="mx-2">·</span>}{env.trade_date && <span className="tnum">数据日期 {env.trade_date}</span>}
        </p>
      </header>

      {env.data_mode === 'fixture' && <Banner>开发夹具数据，非实时行情。部分数值为合成样本，仅用于演示页面结构。</Banner>}

      {loading ? <div className="py-16 text-center text-ink-3">{slow ? '数据加载较慢，请稍后刷新' : '加载中…'}</div>
        : isError ? (
          <Banner tone="error">
            <span>{errorText}</span>
            {status === 'forbidden' && payOn() ? <Link className="rounded-md border px-3 py-1.5 text-sm" to="/plans">查看会员套餐</Link>
              : status === 'forbidden' ? <span className="text-ink-3">会员购买暂未开放</span>
              : status === 'unauthorized' ? <Link className="rounded-md border px-3 py-1.5 text-sm" to="/login">重新登录</Link>
              : onRetry && <Btn onClick={onRetry}>重试</Btn>}
          </Banner>
        ) : status === 'empty' ? (
          <div className="py-16 text-center text-ink-3">
            <p>{env.trade_date ? `${env.trade_date} 的数据暂缺（上游数据维护中）` : '暂无可用数据（上游数据维护中）'}</p>
            {canJump && onJump && <div className="mt-3"><Btn onClick={() => onJump(env.latest_available_date!)}>查看最近有数据的交易日 {env.latest_available_date}</Btn></div>}
          </div>
        ) : (
          <>
            {status === 'partial' && gapItems.length > 0 && <Banner>部分内容暂缺：{gapItems.join('、')}。其余内容正常展示。</Banner>}
            {lockedMods.length > 0 && <Banner tone="info">以下内容需要更高等级或未在当前等级开放：{lockedMods.join('、')}。{payOn() && <Link className="underline" to="/plans">查看会员套餐</Link>}</Banner>}
            {children}
          </>
        )}

      {!loading && !!env.gaps?.length && (
        <details className="mt-6 rounded-lg border bg-card px-5 py-3">
          <summary className="cursor-pointer text-sm">未提供或不完整的内容（{env.gaps.length}）</summary>
          <ul className="mt-2 list-disc pl-5 text-sm text-ink-2">{env.gaps.map((g, i) => <li key={i}>{g.item}：{g.reason}</li>)}</ul>
        </details>
      )}

      {!loading && !!env.sources?.length && (
        <details className="mt-3 rounded-lg border bg-card px-5 py-3">
          <summary className="cursor-pointer text-sm">数据来源与覆盖</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-ink-3"><th className="py-1 pr-4 font-normal">数据</th><th className="pr-4 font-normal">数据日</th><th className="pr-4 font-normal">快照时间</th><th className="pr-4 font-normal">覆盖率</th><th className="font-normal">缺失来源</th></tr></thead>
              <tbody>
                {env.sources.map((s: any) => (
                  <tr key={s.service_key} className="border-t">
                    <td className="py-1 pr-4">{SERVICE_NAMES[s.service_key] || '其他数据'}</td>
                    <td className="tnum pr-4">{s.source_date || '无该日数据'}</td>
                    <td className="tnum pr-4">{s.snapshot_time || '—'}</td>
                    <td className="tnum pr-4">{fmt.ratio(s.coverage_ratio)}</td>
                    <td>{s.missing_sources?.length ? s.missing_sources.join('、') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <footer className="mt-8 text-xs leading-relaxed text-ink-3">{DISCLAIMER}</footer>
    </section>
  )
}
