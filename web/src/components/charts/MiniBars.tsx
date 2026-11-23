import { motion } from 'motion/react'

// 迷你柱：一组等宽柱依次长出，最后一根（当日）用品牌金
export function MiniBars({ values, height = 48, label }: { values: (number | null | undefined)[]; height?: number; label?: string }) {
  const pts = values.map((v) => (v != null && Number.isFinite(v) ? v : 0))
  const max = Math.max(...pts, 1)
  return (
    <div role="img" aria-label={label || `近 ${pts.length} 日`} className="flex items-end gap-[2px]" style={{ height }}>
      {pts.map((v, i) => (
        <motion.span key={i} className="min-w-0 flex-1 origin-bottom rounded-[1px]"
          style={{ height: `${Math.max((v / max) * 100, 2)}%`, background: i === pts.length - 1 ? 'var(--c-accent)' : 'var(--c-viz-1)', opacity: i === pts.length - 1 ? 1 : 0.2 }}
          initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.15 + i * 0.008, duration: 0.45, ease: [0.22, 1, 0.36, 1] }} />
      ))}
    </div>
  )
}
