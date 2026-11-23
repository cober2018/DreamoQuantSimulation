// 首屏「市场星图」：画布、静态底纹、DOM 标签层。画图和标签避让都在 intro/starfield.js 里（原样搬自旧版），这里只负责挂载、传数据、接点击。
// 星座 = 六个数据页，星 = 指标；亮星只有四颗，数值取样例最后一天，点击标签回到第二屏对应的格子。
import { useEffect, useMemo, useRef, useState } from 'react'
import { AT, BRIGHT, EXTRA, INDICATORS, SITE_PAGES, type TileKey } from '@/intro/content'
import '@/intro/landing.css'

interface Reading { n: number; text: string; group: string; collapsed?: boolean }
interface Props {
  /** 四颗亮星的标签文字；值缺失的那一颗不亮 */
  labels: Partial<Record<TileKey, string>>
  /** 文字块、星图说明、页头：星图标签不能压到它们 */
  avoid: () => (HTMLElement | null)[]
  onPick: (key: TileKey) => void
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Sky({ labels, avoid, onPick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const [legend, setLegend] = useState<Reading[]>([])
  const avoidRef = useRef(avoid)
  const pickRef = useRef(onPick)
  useEffect(() => { avoidRef.current = avoid; pickRef.current = onPick })

  // 地址栏 ?sky=dense：每颗星都挂一个读数，用来验证「标签放不下收成编号」的路径
  const dense = useMemo(() => new URLSearchParams(location.search).get('sky') === 'dense', [])
  const groups = useMemo(() => SITE_PAGES.map((p) => ({
    label: p.title,
    at: AT[p.key],
    stars: [...INDICATORS[p.key], ...(EXTRA[p.key] || [])].map((name) => {
      const tile = BRIGHT[name]
      const text = tile ? labels[tile] : undefined
      return { name, value: text ?? (dense ? `${name} 压力测试` : null) }
    }),
    links: p.key === 'industries' ? [SITE_PAGES.findIndex((x) => x.key === 'themes')] : [],
  })), [labels, dense])
  const readings = useMemo<Reading[]>(() => groups.flatMap((g) => g.stars.filter((s) => s.value).map((s) => ({ group: g.label, text: s.value as string })))
    .map((r, i) => ({ ...r, n: i + 1 })), [groups])

  useEffect(() => {
    let field: { destroy: () => void } | null = null
    let dead = false
    let idleId = 0
    const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 4 || ((navigator as any).deviceMemory ?? 8) <= 4

    // 亮星的标签可以点：滚到第二屏，对应的格子描边闪一下
    const linkStars = () => {
      layerRef.current?.querySelectorAll<HTMLElement>('.sl.fact').forEach((el) => {
        const key = Object.entries(labels).find(([, t]) => t === el.textContent)?.[0] as TileKey | undefined
        if (!key) return
        el.classList.add('link')
        el.title = '看这项指标的历史'
        el.onclick = () => pickRef.current(key)
      })
    }
    const start = async () => {
      const m = await import('@/intro/starfield.js')
      const canvas = canvasRef.current
      if (dead || !canvas) return
      const wide = canvas.getBoundingClientRect().width >= 900
      const rel = () => {
        const c = canvas.getBoundingClientRect()
        return avoidRef.current().filter((el): el is HTMLElement => !!el).map((el) => {
          const r = el.getBoundingClientRect()
          return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height }
        }).filter((r) => r.w)
      }
      field = (m.createStarfield as any)(canvas, {
        groups, layer: layerRef.current, avoid: rel, reduced: reducedMotion(), lowEnd, layout: wide ? 'wide' : 'narrow',
        onLayout: (rs: Reading[]) => { setLegend(rs.filter((r) => r.collapsed)); linkStars() },
      })
      // 不支持 Canvas 时：静态底纹 + 把全部读数作为可见列表
      if (!field) setLegend(readings)
    }
    // 星图在首帧文字之后再加载，不挡 LCP
    const idle = () => {
      const ric = (window as any).requestIdleCallback as undefined | ((f: () => void, o?: object) => number)
      idleId = ric ? ric(start, { timeout: 1500 }) : window.setTimeout(start, 200)
    }
    const onLoad = () => idle()
    if (document.readyState === 'complete') idle()
    else window.addEventListener('load', onLoad, { once: true })
    return () => {
      dead = true
      window.removeEventListener('load', onLoad)
      if (idleId) { const cic = (window as any).cancelIdleCallback as undefined | ((n: number) => void); if (cic) cic(idleId); window.clearTimeout(idleId) }
      field?.destroy()
    }
  }, [groups, readings, labels])

  return (
    <>
      <div className="sky-wrap">
        <canvas ref={canvasRef} className="sky" aria-hidden="true" />
        <div className="sky-poster grid-bg" aria-hidden="true" />
        <div ref={layerRef} className="sky-labels" />
      </div>
      {legend.length > 0 && (
        <ol className="sky-legend" aria-label="星图编号读数">
          {legend.map((r) => <li key={r.n}><span className="ln tnum" aria-hidden="true">{r.n}</span><span className="sr-only">编号 {r.n}：</span>{r.text}</li>)}
        </ol>
      )}
      <ul className="sr-only" aria-label="星图读数">
        {readings.map((r) => <li key={r.n}>{r.group}：{r.text}</li>)}
      </ul>
    </>
  )
}
