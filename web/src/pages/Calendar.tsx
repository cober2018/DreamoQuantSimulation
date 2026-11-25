import { useMemo, useState } from 'react'
import { PageFrame } from '@/components/shell/PageFrame'
import { Panel } from '@/components/shell/Panel'
import { DateInput } from '@/components/shell/DateInput'
import { DayEvents } from '@/components/calendar/DayEvents'
import { DayStrip } from '@/components/calendar/DayStrip'
import { MonthGrid } from '@/components/calendar/MonthGrid'
import { ShareUnlock, UnlockCard } from '@/components/calendar/ShareUnlock'
import { addDays, datesBetween, importance, isIso, monthOf, type Ev } from '@/components/calendar/calUtil'
import { BlurFade } from '@/components/fx/blur-fade'
import { HaloSegmented } from '@/components/fx/halo-segmented'
import { useModule } from '@/lib/queries'

const DAYS = 45
const VIEWS = [{ value: 'day', label: '日' }, { value: 'month', label: '月' }]
const ALL = ''
// 默认只看中国和美国；其余国家和地区按需勾选
const HOME = '中国'
const DEFAULT_COUNTRIES = [HOME, '美国']
const NO_COUNTRY = '未标注'
// 重要程度用数据源自己的星级。国内数据源多数不评星级，所以默认档保留未评级的中国事件
const IMPORTANCE = [
  { value: 'key', label: '重要事件' },
  { value: '4', label: '4 星及以上' },
  { value: 'all', label: '全部' },
]
const passImportance = (e: Ev, mode: string) => {
  if (mode === 'all') return true
  const n = importance(e)
  if (mode === '4') return n != null && n >= 4
  return n != null ? n >= 3 : (e.country || NO_COUNTRY) === HOME
}

export function Component() {
  const [tradeDate, setTradeDate] = useState('')
  const [view, setView] = useState('day')
  const [type, setType] = useState(ALL)
  const [countries, setCountries] = useState<string[]>(DEFAULT_COUNTRIES)
  const [level, setLevel] = useState('key')
  const [moreOpen, setMoreOpen] = useState(false)
  const [picked, setPicked] = useState('')
  const [monthPick, setMonthPick] = useState('')
  const { env, loading, load } = useModule('calendar', { trade_date: tradeDate || undefined, days: String(DAYS) })
  const d = env.data
  const win = d?.window || {}
  const unlocks: any[] | null = d?.share_unlock ?? null
  const pageDate = env.trade_date

  // 解禁事件由右栏单独展示，不进日历
  const all: Ev[] = useMemo(() => ((d?.events || []) as Ev[]).filter((e) => e.category !== 'share_unlock'), [d])
  const types = useMemo(() => [...new Set(all.map((e) => e.event_type_label).filter(Boolean))] as string[], [all])
  // 国家和地区按事件数从多到少列出；中国、美国固定在前
  const countryList = useMemo(() => {
    const n: Record<string, number> = {}
    for (const e of all) { const c = e.country || NO_COUNTRY; n[c] = (n[c] || 0) + 1 }
    const rest = Object.keys(n).filter((c) => !DEFAULT_COUNTRIES.includes(c)).sort((a, b) => n[b] - n[a])
    return [...DEFAULT_COUNTRIES.filter((c) => n[c]), ...rest].map((c) => ({ name: c, n: n[c] }))
  }, [all])
  const toggleCountry = (c: string) => setCountries((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))
  const allCountries = countries.length === 0
  const events = all.filter((e) => (!type || e.event_type_label === type) && (allCountries || countries.includes(e.country || NO_COUNTRY)) && passImportance(e, level))
  const hidden = all.length - events.length
  const byDate = useMemo(() => { const m: Record<string, Ev[]> = {}; for (const e of events) if (isIso(e.event_date)) (m[e.event_date] ||= []).push(e); return m }, [events])
  const undated = events.filter((e) => !isIso(e.event_date))

  // 展示范围：接口只给数据日起前瞻 DAYS 天的事件，窗口再大也不把没取到的日子画成「无事件」
  const range = useMemo(() => {
    const evDates = all.map((e) => e.event_date).filter(isIso).sort()
    if (!isIso(pageDate) && !evDates.length) return [] as string[]
    const lo = [pageDate, evDates[0]].filter(isIso).sort()[0]
    const hi = [evDates.at(-1), isIso(pageDate) ? addDays(pageDate, DAYS - 1) : undefined].filter(isIso).sort().at(-1)!
    const start = isIso(win.start_date) && win.start_date > lo ? win.start_date : lo
    const end = isIso(win.end_date) && win.end_date < hi ? win.end_date : hi
    return start <= end ? datesBetween(start, end) : []
  }, [all, pageDate, win.start_date, win.end_date])
  const inRange = (x: string) => range.includes(x)
  const firstWithEvents = range.find((x) => (byDate[x] || []).length > 0)
  const selected = picked && inRange(picked) ? picked : isIso(pageDate) && inRange(pageDate) ? pageDate : firstWithEvents || range[0] || ''
  const months = useMemo(() => [...new Set(range.map(monthOf))], [range])
  const month = monthPick && months.includes(monthPick) ? monthPick : selected ? monthOf(selected) : ''
  const pick = (x: string) => { if (!inRange(x)) return; setPicked(x); setMonthPick(monthOf(x)) }

  const unlockOn = (x: string) => (unlocks || []).filter((u) => u.event_date === x)
  const unlockCount = (x: string) => unlockOn(x).reduce((s, u) => s + (Number(u.stock_count) || 0), 0)
  const hasAi = all.some((e) => e.ai_curated === true)

  return (
    <PageFrame title="事件日历" question="哪些事件已公布、将公布，事实是什么？" env={env} loading={loading} onRetry={load} onJump={setTradeDate}
      tools={<DateInput value={tradeDate} onChange={setTradeDate} label="数据日" />}>
      {win.complete === false && <div className="mb-4 rounded-md border border-[var(--c-warn)]/40 bg-[var(--c-warn)]/10 px-4 py-3 text-sm">所选时间范围超出了当日数据的覆盖范围，以下只列到 {win.end_date || '已取得的最后一天'}。</div>}
      {/* 限售股解禁和 A 股直接相关，放在最上面整行；宏观事件在下面 */}
      <div className="grid grid-cols-1 gap-4">
        <BlurFade className="min-w-0">
          <ShareUnlock unlocks={unlocks} label={d?.share_unlock_label} selectedDate={selected} fromDate={pageDate} onPickDate={pick} />
        </BlurFade>
        <BlurFade delay={0.08} className="min-w-0">
          <Panel title="宏观事件" hint={range.length ? `${range[0]} 至 ${range[range.length - 1]}，默认只显示中国和美国的重要事件` : '默认只显示中国和美国的重要事件'}
            action={<HaloSegmented items={VIEWS} value={view} onValueChange={setView} translucent={false} className="[&_button]:whitespace-nowrap" />}>
            {!range.length ? <p className="text-sm text-ink-3">窗口内暂无已登记事件。</p> : (
              <>
                <div className="mb-3 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="按国家或地区筛选">
                    <span className="mr-1 text-ink-3">国家或地区</span>
                    {countryList.slice(0, moreOpen ? undefined : 2).map((c) => (
                      <button key={c.name} type="button" aria-pressed={countries.includes(c.name)} onClick={() => toggleCountry(c.name)}
                        className={`cursor-pointer rounded-full border px-2.5 py-1 ${countries.includes(c.name) ? 'border-primary bg-accent text-foreground' : 'text-ink-2 hover:bg-surface-hover'}`}>{c.name} <span className="tnum text-ink-3">{c.n}</span></button>
                    ))}
                    {countryList.length > 2 && <button type="button" onClick={() => setMoreOpen((v) => !v)} className="cursor-pointer px-1.5 py-1 text-primary hover:underline">{moreOpen ? '收起' : `其他 ${countryList.length - 2} 个国家和地区`}</button>}
                    <button type="button" aria-pressed={allCountries} onClick={() => setCountries(allCountries ? DEFAULT_COUNTRIES : [])} className={`cursor-pointer rounded-full border px-2.5 py-1 ${allCountries ? 'border-primary bg-accent' : 'text-ink-2 hover:bg-surface-hover'}`}>全部</button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <label className="flex items-center gap-2 text-ink-3">重要程度
                      <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="重要程度" className="h-8 rounded-md border bg-background px-2 text-xs text-foreground">
                        {IMPORTANCE.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    {types.length > 1 && (
                      <label className="flex items-center gap-2 text-ink-3">事件类型
                        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="事件类型" className="h-8 rounded-md border bg-background px-2 text-xs text-foreground">
                          <option value={ALL}>全部类型</option>
                          {types.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </label>
                    )}
                    <span className="text-ink-3">显示 {events.length} / {all.length} 条{hidden > 0 && `，${hidden} 条被筛选隐藏`}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-ink-3">「重要事件」指数据源评为 3 星及以上的事件，加上没有星级的中国事件（国内数据源多数不评星级）。星级是数据源自己的评级。</p>
                </div>
                {view === 'month'
                  ? <MonthGrid month={month} onMonth={setMonthPick} months={months} inRange={inRange} eventsOf={(x) => byDate[x] || []} unlockCount={unlockCount} pageDate={pageDate} selected={selected} onSelect={pick} />
                  : <DayStrip dates={range} count={(x) => (byDate[x] || []).length} pageDate={pageDate} selected={selected} onSelect={pick} />}
                <div className="mt-4 space-y-3 border-t pt-4">
                  <DayEvents date={selected} events={byDate[selected] || []} hiddenCount={all.filter((e) => e.event_date === selected).length - (byDate[selected] || []).length} />
                  {unlockOn(selected).map((u) => <UnlockCard key={u.event_date + u.display_title} u={u} defaultOpen />)}
                </div>
              </>
            )}
            {undated.length > 0 && (
              <div className="mt-4 border-t pt-4"><DayEvents date="日期未定" events={undated} /></div>
            )}
            <p className="mt-4 text-[11px] text-ink-3">* {d?.consensus_label}；来源重要性为数据源自身评级。</p>
            {hasAi && d?.ai_curated_label && <p className="mt-1 text-[11px] text-ink-3">{d.ai_curated_label}</p>}
          </Panel>
        </BlurFade>
      </div>
    </PageFrame>
  )
}
