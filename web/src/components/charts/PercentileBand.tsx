import { motion } from 'motion/react'

// 分位带：0–100 的轨道上一个点；轨道左蓝右橙，只描述历史相对位置
export function PercentileBand({ label, value }: { label: string; value: number | null | undefined }) {
  const pos = value == null ? null : Math.min(Math.max(value, 0), 100)
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)_72px] items-center gap-2 text-xs">
      <span className="text-ink-3">{label}</span>
      <span className="relative h-2 rounded-full" style={{ background: 'linear-gradient(90deg, hsl(214 40% 88%), hsl(28 50% 88%))' }} aria-hidden="true">
        {pos != null && <motion.i className="absolute top-1/2 size-3 rounded-full border-2 border-card bg-primary" style={{ translateX: '-50%', translateY: '-50%' }} initial={{ left: '0%' }} animate={{ left: `${pos}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />}
      </span>
      <b className="tnum text-right font-medium">{value == null ? <span className="font-normal text-ink-3">数据待更新</span> : `${value.toFixed(1)}%`}</b>
    </div>
  )
}
