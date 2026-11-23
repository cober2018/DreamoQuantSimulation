import { useState, type ReactElement, type ReactNode } from 'react'
import { Link } from 'react-router'
import NumberFlow from '@number-flow/react'
import { motion } from 'motion/react'
import { ArrowUpRight, Lock } from 'lucide-react'
import { PageFrame } from '@/components/shell/PageFrame'
import { DateInput } from '@/components/shell/DateInput'
import { Panel } from '@/components/shell/Panel'
import { PAGE_ICONS } from '@/components/shell/pageIcons'
import { FluidSparkline, Sparkline } from '@/components/charts/Sparkline'
import { MiniBars } from '@/components/charts/MiniBars'
import { TurnoverChart } from '@/components/charts/TurnoverChart'
import { LimitPanel, type LimitRow } from '@/components/charts/LimitPanel'
import { BreadthCard, type BreadthRow } from '@/components/charts/BreadthCard'
import BorderBeam from '@/components/fx/border-beam'
import { BlurFade } from '@/components/fx/blur-fade'
import GlowHover from '@/components/fx/glow-hover'
import { fmt } from '@/lib/api'
import { useCan, useSession } from '@/lib/auth'
import { PAGES } from '@/lib/pageCatalog'
import { useModule, useParticipationObservation, useSupplementQuery } from '@/lib/queries'
import { useModuleAccess } from '@/stores/moduleAccess'
import { cn } from '@/lib/utils'

const dirClass = (v: number | null | undefined) => (fmt.dir(v) === 'rise' ? 'text-up' : fmt.dir(v) === 'fall' ? 'text-down' : '')
const PENDING = '数据待更新'
const fixed2 = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const CARD = 'h-full rounded-lg border bg-card p-5 shadow-[var(--shadow-1)] sm:p-6'
const Eyebrow = ({ children }: { children: ReactNode }) => <div className="text-xs tracking-[0.08em] text-accent-ink">{children}</div>

export function Component() {
  const [tradeDate, setTradeDate] = useState('')
  const td = tradeDate || undefined
  const { env, loading, load } = useModule('overview', { trade_date: td })
  const idxOverview = useSupplementQuery('index_overview', td).data
  const idxHistory = useSupplementQuery('index_history', td).data
  const limitHist = useSupplementQuery('limit_history', td).data
  const breadthHist = useSupplementQuery('breadth_history', td).data
  const turnoverHist = useSupplementQuery('participation_history', td).data
  const can = useCan()
  const user = useSession((s) => s.user)
  const observation = useParticipationObservation(td, can('page.participation')).data
  const restricted = useModuleAccess((s) => s.restricted)
  const show = (ind: string) => !restricted.includes(`overview.market.${ind}`)

  const d = env.data || {}
  const turnoverBillion: number | null = observation?.total_amount_billion ?? null
  const idxRows: any[] = idxOverview?.rows || []
  const closes = (code: string) => (idxHistory?.rows || []).filter((r) => r.index_code === code).map((r) => r.close as number)
  const bench = idxRows.find((r) => r.index_code === d.index_code)
  const turnoverRows: any[] = turnoverHist?.rows || []
  const limitRows = (limitHist?.rows || []) as LimitRow[]
  const breadthRows = (breadthHist?.rows || []) as BreadthRow[]
  const maxDrawdown = Math.max(...idxRows.map((r) => Math.abs(r.drawdown_pct ?? 0)), 0.0001)

  // 首屏三张卡：每张卡受各自指标权限控制，被裁掉的不渲染
  const hero: { id: string; el: ReactElement }[] = []
  if (show('index_change_pct')) hero.push({ id: 'index', el: (
    <BorderBeam radius={12} duration={10} size={64} className="h-full">
      <div className={CARD}>
        <Eyebrow>基准指数 · {bench?.index_name ? `${bench.index_name} ` : ''}{d.index_code || ''}</Eyebrow>
        <div className={cn('num-display mt-2 text-[44px] leading-none', dirClass(d.index_change_pct))}>
          {d.index_change_pct == null ? '—' : <NumberFlow value={d.index_change_pct} format={{ signDisplay: 'exceptZero', minimumFractionDigits: 2, maximumFractionDigits: 2 }} suffix="%" />}
        </div>
        <div className="tnum mt-2 text-xs text-ink-3">
          {bench ? <>收盘 {fixed2(bench.close)} 点<span className="mx-1.5">·</span>20 日 <span className={dirClass(bench.return_20d_pct)}>{bench.return_20d_pct == null ? PENDING : fmt.signedPct(bench.return_20d_pct)}</span></> : '当日涨跌幅'}
        </div>
        {closes(d.index_code).length > 1 && <div className="mt-4"><FluidSparkline values={closes(d.index_code)} height={56} area delay={0.2} label="基准指数近 60 日收盘走势" /><div className="mt-1 text-[11px] text-ink-3">近 {closes(d.index_code).length} 日收盘</div></div>}
      </div>
    </BorderBeam>
  ) })
  if (d.up_count != null && (show('up_ratio') || show('up_count') || show('down_count'))) hero.push({ id: 'breadth', el: (
    <BreadthCard className={CARD} today={d} rows={breadthRows} show={show} />
  ) })
  if (show('turnover_yi')) hero.push({ id: 'turnover', el: (
    <div className={CARD}>
      <Eyebrow>两市成交额</Eyebrow>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="num-display text-[44px] leading-none">{turnoverBillion == null ? '—' : <NumberFlow value={Math.round(turnoverBillion)} />}</span>
        <span className="text-sm text-ink-3">亿元</span>
      </div>
      <div className="mt-2 text-xs text-ink-3">与参与度页同一口径</div>
      {turnoverRows.length > 1 && <div className="mt-4"><MiniBars values={turnoverRows.map((r) => r.turnover)} height={56} label="近 60 日两市成交额" /><div className="mt-1 flex justify-between text-[11px] text-ink-3"><span>近 {turnoverRows.length} 日</span><span className="flex items-center gap-1"><i className="inline-block size-1.5 rounded-full bg-primary" />最新一日</span></div></div>}
    </div>
  ) })

  const more = PAGES.filter((p) => p.key !== 'overview')

  return (
    <PageFrame title="市场总览" question="今天市场发生了什么？" env={env} loading={loading} onRetry={load} onJump={setTradeDate}
      tools={<DateInput value={tradeDate} onChange={setTradeDate} />}>
      <GlowHover className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" maskSize={520} glowIntensity={0.08}
        items={hero.map((h, i) => ({ id: h.id, element: <div><BlurFade delay={i * 0.07} className="h-full">{h.el}</BlurFade></div>, overlayElement: <div className="rounded-lg border" /> }))} />

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        {idxRows.length > 0 && (
          <BlurFade delay={0.2} className="xl:col-span-8">
            <Panel title="主要指数一览" hint="今天各主要指数怎么样，离一年高点多远" className="h-full">
              <p className="mb-1 text-[11px] text-ink-3 sm:hidden">左右滑动查看全部列 →</p>
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--c-line-strong)] text-xs text-ink-3">
                      <th className="px-2 py-2 text-left font-normal">指数</th><th className="px-2 text-right font-normal">收盘（点）</th><th className="px-2 text-right font-normal">当日涨跌</th>
                      <th className="px-2 text-right font-normal">20 日涨跌</th><th className="px-2 text-left font-normal">距一年高点回撤</th><th className="px-2 text-left font-normal">60 日走势</th>
                    </tr>
                  </thead>
                  <tbody>
                    {idxRows.map((r, i) => (
                      <tr key={r.index_code} className="border-b last:border-0 transition-colors hover:bg-surface-hover">
                        <td className="px-2 py-2.5">{r.index_name || r.index_code} <span className="tnum ml-1 text-xs text-ink-3">{r.index_code}</span></td>
                        <td className="tnum px-2 text-right">{fixed2(r.close)}</td>
                        <td className={cn('tnum px-2 text-right', dirClass(r.return_1d_pct))}>{r.return_1d_pct == null ? PENDING : fmt.signedPct(r.return_1d_pct)}</td>
                        <td className={cn('tnum px-2 text-right', dirClass(r.return_20d_pct))}>{r.return_20d_pct == null ? PENDING : fmt.signedPct(r.return_20d_pct)}</td>
                        <td className="px-2">
                          {r.drawdown_pct == null ? <span className="text-ink-3">{PENDING}</span> : (
                            <div className="flex items-center gap-2">
                              <span className="tnum w-14 shrink-0 text-right">{fmt.signedPct(r.drawdown_pct)}</span>
                              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary"><motion.i className="block h-full rounded-full bg-[var(--c-viz-5)]" initial={{ width: 0 }} animate={{ width: `${(Math.abs(r.drawdown_pct) / maxDrawdown) * 100}%` }} transition={{ duration: 0.7, delay: 0.35 + i * 0.05, ease: 'easeOut' }} /></span>
                            </div>
                          )}
                        </td>
                        <td className="px-2">{closes(r.index_code).length > 1 ? <Sparkline values={closes(r.index_code)} width={112} height={28} delay={0.3 + i * 0.06} label={`${r.index_name || r.index_code} 近 60 日走势`} /> : <span className="text-ink-3">{PENDING}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-ink-3">涨跌和回撤是历史表现与相对位置的统计，不代表未来收益或上涨概率。</p>
            </Panel>
          </BlurFade>
        )}
        {limitRows.length > 0 && (
          <BlurFade delay={0.26} className={idxRows.length ? 'xl:col-span-4' : 'xl:col-span-12'}>
            <LimitPanel rows={limitRows} className="h-full" />
          </BlurFade>
        )}
      </div>

      {turnoverRows.length > 0 && (
        <BlurFade delay={0.32} className="mt-4">
          <Panel title="两市成交额 60 日" hint="今天的成交在近期算高还是低"
            action={<div className="flex items-center gap-4 text-[11px] text-ink-3"><span>单位：亿元</span><span className="flex items-center gap-1.5"><i className="inline-block size-2 rounded-[2px] bg-primary" />最新一日</span><span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-3.5 rounded bg-[var(--c-viz-1)]" />20 日均值</span></div>}>
            <TurnoverChart rows={turnoverRows} />
          </Panel>
        </BlurFade>
      )}

      <BlurFade delay={0.38} className="mt-8">
        <h2 className="mb-3 text-[15px] font-medium">更多数据</h2>
        <GlowHover className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" maskSize={380} glowIntensity={0.1}
          items={more.map((p) => {
            const Icon = PAGE_ICONS[p.key]
            return {
              id: p.key,
              overlayElement: <div className="rounded-lg border" />,
              element: (
                <Link to={p.path} className="group flex h-full flex-col rounded-lg border bg-card p-4 shadow-[var(--shadow-1)] transition-colors hover:border-[var(--c-line-strong)]">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-md bg-accent text-primary"><Icon size={15} /></span>
                    <span className="text-sm font-medium">{p.title}</span>
                    {can(p.perm)
                      ? <ArrowUpRight size={14} className="ml-auto text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                      : <span className="ml-auto flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] text-ink-3"><Lock size={10} />{user?.perm_min_role?.[p.perm] || '会员'}</span>}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ink-3">{p.question}</p>
                </Link>
              ),
            }
          })} />
      </BlurFade>
    </PageFrame>
  )
}
