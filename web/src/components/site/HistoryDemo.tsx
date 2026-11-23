// 首页第二屏：历史曲线演示。用平台里已有的组件拼成，访客看到的就是登录后真实的操作方式。
// 数据是 intro/data/sample.json 的静态样例；移动日期，四个数字、曲线上的标记、对比图上的竖线一起切到那一天。
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { HaloSegmented } from '@/components/fx/halo-segmented'
import Scrubber from '@/components/fx/scrubber'
import { SeriesChart } from '@/components/charts/SeriesChart'
import { TrendTile } from '@/components/charts/TrendTile'
import { cn } from '@/lib/utils'
import type { TileKey } from '@/intro/content'
import { DAYS, int, RANGE, weekday } from '@/intro/sample'

const N = DAYS.length
// 入场演示：从第一天走到最后一天。数字滚动明显卡顿时，把 FROM 改成 N - 20 只走最后 20 天
const SWEEP = { from: 0, ms: 1800, tick: 60 }
const PCT = { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 } as const

const signed = (v: number) => `${v > 0 ? '+' : ''}${int(v)}`
const diffText = (cur: number | null, prev: number | null | undefined) => (cur != null && prev != null ? `较前一日 ${signed(cur - prev)}` : '')
const join = (...parts: string[]) => parts.filter(Boolean).join(' · ')

function useNarrow(px: number) {
  const [n, setN] = useState(() => window.innerWidth < px)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${px - 1}px)`)
    const on = () => setN(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [px])
  return n
}

type Compare = 'limit' | 'flow'
const COMPARE = [{ value: 'limit', label: <span className="whitespace-nowrap">涨停 · 跌停 · 炸板</span> }, { value: 'flow', label: <span className="whitespace-nowrap">成交额 · 上涨占比</span> }]
const LEGEND: Record<Compare, { label: string; color: string }[]> = {
  limit: [{ label: '涨停', color: 'var(--c-up)' }, { label: '跌停', color: 'var(--c-down)' }, { label: '炸板', color: 'var(--c-viz-1)' }],
  flow: [{ label: '成交额（亿元）', color: 'var(--c-viz-1)' }, { label: '上涨占比', color: 'var(--c-viz-3)' }],
}

export default function HistoryDemo({ flash }: { flash: { key: TileKey; n: number } | null }) {
  const [sel, setSel] = useState(N - 1)
  const [cmp, setCmp] = useState<Compare>('limit')
  const [flashKey, setFlashKey] = useState<TileKey | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const sweeping = useRef(false)
  const played = useRef(false)
  const narrow = useNarrow(640)

  // 访客一碰（指针按下、键盘、移到曲线上）就停掉入场演示
  const stop = useCallback(() => { sweeping.current = false }, [])
  const pick = useCallback((i: number | null) => { if (i == null) return; stop(); setSel(i) }, [stop])

  useEffect(() => {
    const el = cardRef.current
    if (!el || played.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let timer = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || played.current) return
      played.current = true
      io.disconnect()
      sweeping.current = true
      const t0 = performance.now()
      setSel(SWEEP.from)
      timer = window.setInterval(() => {
        if (!sweeping.current) { window.clearInterval(timer); return }
        const p = Math.min(1, (performance.now() - t0) / SWEEP.ms)
        setSel(Math.round(SWEEP.from + (1 - (1 - p) ** 3) * (N - 1 - SWEEP.from)))
        if (p >= 1) { sweeping.current = false; window.clearInterval(timer) }
      }, SWEEP.tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => { io.disconnect(); window.clearInterval(timer) }
  }, [])

  // 星图上点亮星：对应的格子描边闪 1.2 秒
  useEffect(() => {
    if (!flash) return
    setFlashKey(flash.key)
    const t = window.setTimeout(() => setFlashKey(null), 1200)
    return () => window.clearTimeout(t)
  }, [flash])

  const day = DAYS[sel], prev = DAYS[sel - 1]
  const series = useMemo(() => ({
    turnover: DAYS.map((x) => x.turnover), ratio: DAYS.map((x) => x.ratio), limitUp: DAYS.map((x) => x.limit_up), seal: DAYS.map((x) => x.seal),
  }), [])
  const chartData = useMemo(() => DAYS.map((x) => ({ d: x.d, up: x.limit_up, down: x.limit_down, broken: x.broken, turnover: x.turnover, ratio: x.ratio == null ? null : x.ratio * 100 })), [])
  const tile = (k: TileKey) => cn('transition-shadow', flashKey === k && 'tile-flash')
  const tiles: { key: TileKey; node: React.ReactNode }[] = [
    { key: 'turnover', node: <TrendTile label="两市成交额" unit="亿元" value={day.turnover} format={{ maximumFractionDigits: 0 }} color="var(--c-viz-1)" delay={0.1}
      sub={diffText(day.turnover, prev?.turnover)} series={series.turnover} hover={sel} onHover={pick} className={tile('turnover')} /> },
    { key: 'upRatio', node: <TrendTile label="上涨占比" value={day.ratio} format={PCT} color="var(--c-viz-3)" delay={0.18}
      sub={join(day.up != null ? `上涨 ${int(day.up)} 家` : '', day.down != null ? `下跌 ${int(day.down)} 家` : '')} series={series.ratio} hover={sel} onHover={pick} className={tile('upRatio')} /> },
    { key: 'limitUp', node: <TrendTile label="涨停" unit="只" value={day.limit_up} format={{ maximumFractionDigits: 0 }} tone="up" color="var(--c-up)" delay={0.26}
      sub={join(diffText(day.limit_up, prev?.limit_up), day.limit_down != null ? `跌停 ${int(day.limit_down)} 只` : '')} series={series.limitUp} hover={sel} onHover={pick} className={tile('limitUp')} /> },
    { key: 'seal', node: <TrendTile label="封板率" value={day.seal} format={PCT} color="var(--c-viz-2)" delay={0.34}
      sub={day.broken != null ? `炸板 ${int(day.broken)} 只` : ''} series={series.seal} hover={sel} onHover={pick} className={tile('seal')} /> },
  ]

  return (
    <div ref={cardRef} onPointerDownCapture={stop} onKeyDownCapture={stop}
      className="rounded-[var(--r-4)] border border-[var(--c-line)] bg-[var(--c-surface)] p-6 shadow-[var(--shadow-2)] max-sm:p-4">
      {/* 第一行：日期 */}
      <div className="flex items-end gap-6 max-[759px]:flex-col max-[759px]:items-stretch max-[759px]:gap-4">
        <div className="flex min-w-[210px] flex-col gap-1">
          <span className="text-xs text-ink-3">回看日期</span>
          <div className="flex items-baseline gap-2">
            <span className="num-display text-[28px] leading-none" aria-live="polite">{day.d}</span>
            <span className="text-[13px] text-ink-3">{weekday(day.d)}</span>
          </div>
          <button type="button" onClick={() => { stop(); setSel(N - 1) }}
            className={cn('mt-1 h-6 self-start rounded-[var(--r-2)] border border-[var(--c-line-strong)] px-2 text-xs text-ink-2 hover:bg-surface-hover hover:text-foreground', sel === N - 1 && 'invisible')}
            tabIndex={sel === N - 1 ? -1 : 0}>回到最新一日</button>
        </div>
        <div className="ml-auto w-full max-w-[640px] max-[759px]:ml-0">
          <Scrubber value={sel} min={0} max={N - 1} step={1} ticks={0} label="回看日期" valueText={`${day.d} ${weekday(day.d)}`} onValueChange={pick} onInteract={stop} />
          <div className="mt-1.5 flex justify-between text-[11px] text-ink-3"><span className="tnum">{RANGE.start}</span><span className="tnum">{RANGE.end}</span></div>
        </div>
      </div>

      {/* 第二行：四个格子，共用选中的那一天 */}
      <div className="mt-5 grid grid-cols-4 gap-3 max-[759px]:grid-cols-2">{tiles.map((t) => <Fragment key={t.key}>{t.node}</Fragment>)}</div>

      {/* 第三行：对比图 */}
      <div className="mt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <HaloSegmented items={COMPARE} value={cmp} onValueChange={(v) => setCmp(v as Compare)} translucent={false} />
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3" aria-label="图例">
            {LEGEND[cmp].map((l) => <li key={l.label} className="flex items-center gap-1.5"><i className="inline-block size-2 rounded-[2px]" style={{ background: l.color }} />{l.label}</li>)}
          </ul>
        </div>
        {cmp === 'limit' ? (
          <SeriesChart data={chartData} xKey="d" height={narrow ? 200 : 240} markX={day.d} onHover={pick} xTickFormat={(v) => String(v).slice(5)} valueFormat={int}
            series={[{ key: 'up', label: '涨停（只）', color: 'var(--c-up)' }, { key: 'down', label: '跌停（只）', color: 'var(--c-down)' }, { key: 'broken', label: '炸板（只）', color: 'var(--c-viz-1)' }]} />
        ) : (
          <SeriesChart data={chartData} xKey="d" height={narrow ? 200 : 240} markX={day.d} onHover={pick} xTickFormat={(v) => String(v).slice(5)} valueFormat={int}
            rightDomain={[0, 100]} rightFormat={(v) => `${Math.round(v * 10) / 10}%`}
            series={[{ key: 'turnover', label: '成交额（亿元）', color: 'var(--c-viz-1)', type: 'bar' }, { key: 'ratio', label: '上涨占比', color: 'var(--c-viz-3)', yAxisId: 'right' }]} />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-[var(--c-line)] pt-4 text-xs text-ink-3">
        <p>样例数据：{RANGE.start} 至 {RANGE.end}，共 {RANGE.n} 个交易日，和平台用的是同一套数据。缺数的日子留空，不补 0。</p>
        <Link to="/login?mode=register" className="text-[var(--c-accent-ink)] underline-offset-4 hover:underline">免费注册，查看最新交易日 →</Link>
      </div>
    </div>
  )
}
