// 同页各部分可能来自不同数据日, 不一致时显式标出, 避免把旧数据当成当日
export function DateTag({ date, pageDate }: { date?: string | null; pageDate?: string | null }) {
  if (!date) return null
  return (
    <span className="tnum ml-2 inline-flex items-center gap-1.5 text-[11px] font-normal text-ink-3">
      数据日 {date}
      {pageDate && date !== pageDate && <em className="rounded-full border border-[var(--c-warn)]/50 bg-[var(--c-warn)]/10 px-1.5 not-italic">非当日</em>}
    </span>
  )
}
