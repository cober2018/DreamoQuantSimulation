import { useEffect, useId, useRef, useState } from 'react'
import { motion } from 'motion/react'

// 迷你走势：线从左到右画出，末端的金色星点表示最新一日。只表达形状，不带坐标轴
interface Props { values: (number | null | undefined)[]; width: number; height: number; stroke?: string; area?: boolean; delay?: number; label?: string }

export function Sparkline({ values, width, height, stroke = 'var(--c-viz-1)', area = false, delay = 0, label }: Props) {
  const gid = `sp${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const pts = values.filter((v): v is number => v != null && Number.isFinite(v))
  if (pts.length < 2 || width <= 0) return null
  const min = Math.min(...pts), span = Math.max(...pts) - min || 1, pad = 5
  const x = (i: number) => pad + (i / (pts.length - 1)) * (width - pad * 2)
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2)
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const ex = x(pts.length - 1), ey = y(pts[pts.length - 1])
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label || `近 ${pts.length} 日走势`} className="overflow-visible">
      {area && (
        <>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={stroke} stopOpacity="0.12" /><stop offset="1" stopColor={stroke} stopOpacity="0" /></linearGradient></defs>
          <motion.path d={`${line}L${ex.toFixed(1)},${height}L${x(0).toFixed(1)},${height}Z`} fill={`url(#${gid})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + 0.5, duration: 0.6 }} />
        </>
      )}
      <motion.path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay, ease: 'easeOut' }} />
      <circle className="star-pulse" cx={ex} cy={ey} r={3} fill="var(--c-accent)" />
      <motion.circle cx={ex} cy={ey} r={2.6} fill="var(--c-accent)" stroke="var(--c-surface)" strokeWidth={1}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + 0.85, duration: 0.2 }} />
    </svg>
  )
}

// 跟随容器宽度的迷你走势（用在大卡片里）
export function FluidSparkline(props: Omit<Props, 'width'>) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return <div ref={ref} style={{ height: props.height }}>{w > 0 && <Sparkline {...props} width={w} />}</div>
}
