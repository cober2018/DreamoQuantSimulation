import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { motion } from 'motion/react'

// 可回看的历史曲线：线从左到右画出；指针移到曲线上时显示那一日的位置。
// hover 由外部持有，多条曲线共用同一个 hover 就能在同一日期上对比。
interface Props {
  values: (number | null | undefined)[]
  height: number
  color?: string
  hover?: number | null
  /** 不传则是只读迷你线：没有回看交互，也不显示十字光标 */
  onHover?: (i: number | null) => void
  label: string
  delay?: number
}

export function TrendSpark({ values, height, color = 'var(--c-viz-1)', hover = null, onHover, label, delay = 0 }: Props) {
  const gid = `ts${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = values.length
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v))
  const ok = n > 1 && nums.length > 1 && w > 0
  const min = Math.min(...nums), span = Math.max(...nums) - min || 1, pad = 5
  const x = (i: number) => pad + (i / (n - 1)) * (w - pad * 2)
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2)
  // 缺失的日子断开，不连线也不补 0
  let line = '', pen = false
  values.forEach((v, i) => { if (v == null || !Number.isFinite(v)) { pen = false; return } line += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true })
  const whole = nums.length === n
  let last = n - 1
  while (last > 0 && values[last] == null) last--
  const hv = hover != null ? values[hover] : null

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    onHover?.(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - pad) / (r.width - pad * 2)) * (n - 1)))))
  }

  return (
    <div ref={ref} style={{ height, touchAction: 'pan-y' }} className={onHover ? 'cursor-crosshair' : undefined} onPointerMove={ok && onHover ? move : undefined} onPointerLeave={onHover ? () => onHover(null) : undefined}>
      {ok && (
        <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} role="img" aria-label={label} className="overflow-visible">
          {whole && (
            <>
              <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.14" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
              <motion.path d={`${line}L${x(n - 1).toFixed(1)},${height}L${x(0).toFixed(1)},${height}Z`} fill={`url(#${gid})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + 0.5, duration: 0.6 }} />
            </>
          )}
          <motion.path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay, ease: 'easeOut' }} />
          {hover == null && values[last] != null && (
            <>
              <circle className="star-pulse" cx={x(last)} cy={y(values[last] as number)} r={3} fill="var(--c-accent)" />
              <motion.circle cx={x(last)} cy={y(values[last] as number)} r={2.6} fill="var(--c-accent)" stroke="var(--c-surface)" strokeWidth={1} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + 0.85, duration: 0.2 }} />
            </>
          )}
          {hover != null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={0} y2={height} stroke="var(--c-line-strong)" strokeWidth={1} strokeDasharray="2 3" />
              {hv != null && <circle cx={x(hover)} cy={y(hv)} r={3.2} fill="var(--c-accent)" stroke="var(--c-surface)" strokeWidth={1.2} />}
            </>
          )}
        </svg>
      )}
    </div>
  )
}
