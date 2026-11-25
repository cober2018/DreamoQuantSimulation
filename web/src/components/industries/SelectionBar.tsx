import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { fmt } from '@/lib/api'
import { cellPending } from '@/lib/industryPending'
import { QUADRANTS, quadrantOf } from '@/lib/rrg'
import { cn } from '@/lib/utils'

// 选中行业后从视口底部浮出的一条：position fixed，不占文档流，不会把页面内容顶开
interface Props {
  row: any | null
  day: string
  flowKey: string
  flowLabel: string
  rrgRef: number
  rsOk: boolean
  canDetail: boolean
  onClose: () => void
  onJumpDetail: () => void
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return <span className="whitespace-nowrap"><span className="text-ink-3">{label}</span> <span className="tnum">{children}</span></span>
}

export function SelectionBar({ row, day, flowKey, flowLabel, rrgRef, rsOk, canDetail, onClose, onJumpDetail }: Props) {
  const val = (key: string, f: (v: number) => string) => (row && !cellPending(key, row, day) && row[key] != null ? f(row[key] + 0) : '—')
  const signed = (key: string) => (row && !cellPending(key, row, day) ? fmt.dir(row[key]) : '')
  const quadrant = row && rsOk && row.rs_ratio != null && row.rs_momentum != null ? QUADRANTS.find((q) => q.key === quadrantOf(row.rs_ratio, row.rs_momentum, rrgRef))?.label : null
  return (
    <AnimatePresence>
      {row && (
        <motion.div key="selection-bar" role="region" aria-label="已选行业"
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed inset-x-3 bottom-3 z-40 flex justify-center lg:pl-[232px]">
          <div className="pointer-events-auto flex w-full max-w-[960px] flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border bg-card px-4 py-2.5 text-sm shadow-lg">
            <span className="font-semibold">已选　{row.sector_name}<span className="tnum ml-1.5 text-xs font-normal text-ink-3">{row.sector_code}</span></span>
            <Item label="涨跌幅"><span className={cn(signed('sector_return') === 'rise' && 'text-up', signed('sector_return') === 'fall' && 'text-down')}>{val('sector_return', (v) => fmt.pct(v))}</span></Item>
            <Item label="成交额">{val('amount', (v) => `${fmt.num(v, 1)} 亿元`)}</Item>
            <Item label={`净流入（${flowLabel}）`}><span className={cn(signed(flowKey) === 'rise' && 'text-up', signed(flowKey) === 'fall' && 'text-down')}>{val(flowKey, (v) => `${fmt.num(v)} 亿元`)}</span></Item>
            <Item label="扩散度">{val('di', (v) => fmt.num(v, 3))}</Item>
            {quadrant && <Item label="所在象限">{quadrant}</Item>}
            <span className="ml-auto flex items-center gap-2">
              {canDetail && <button type="button" onClick={onJumpDetail} className="cursor-pointer text-xs text-primary hover:underline">近期序列与成分股 ↓</button>}
              <button type="button" onClick={onClose} aria-label="取消选中" className="cursor-pointer rounded p-1 text-ink-3 hover:bg-surface-hover hover:text-foreground"><X className="size-4" /></button>
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
