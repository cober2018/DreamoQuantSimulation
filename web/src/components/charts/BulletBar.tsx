import { motion } from 'motion/react'

// 子弹图：一根条表示当前值，一个金色刻度表示对照值。不按是否达标着色
interface Props { label: string; value: number | null | undefined; marker?: number | null; markerLabel?: string; max?: number; format?: (v: number) => string }

const f1 = (v: number) => v.toLocaleString('zh-CN', { maximumFractionDigits: 1 })

export function BulletBar({ label, value, marker, markerLabel = '对照', max, format = f1 }: Props) {
  const top = max ?? (Math.max(value ?? 0, marker ?? 0) * 1.15 || 1)
  const pos = (v: number) => `${Math.max(0, Math.min(1, v / top)) * 100}%`
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-ink-2">{label}</span>
        <span className="tnum">
          {value == null ? <span className="text-ink-3">数据待更新</span> : <b className="font-medium">{format(value)}</b>}
          {marker != null && <span className="ml-2 text-ink-3">{markerLabel} {format(marker)}</span>}
        </span>
      </div>
      <div className="relative mt-1.5 h-2 rounded-full bg-secondary">
        {value != null && <motion.i className="absolute inset-y-0 left-0 rounded-full" style={{ background: 'var(--c-viz-1)', opacity: 0.85 }} initial={{ width: 0 }} animate={{ width: pos(value) }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />}
        {marker != null && <i className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded bg-primary" style={{ left: pos(marker) }} title={`${markerLabel} ${format(marker)}`} />}
      </div>
    </div>
  )
}
