// 回看时的日期小标签：没有指针时显示「最新一日 日期」，指针在曲线上时显示「回看 日期」
export function DayChip({ hover, date }: { hover: number | null; date?: string }) {
  return (
    <span className={`tnum rounded-full border px-2.5 py-0.5 text-[11px] ${hover == null ? 'text-ink-3' : 'border-primary/50 bg-accent text-foreground'}`}>
      {hover == null ? '最新一日' : '回看'} {date}
    </span>
  )
}
