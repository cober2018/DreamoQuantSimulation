import { useQuery } from '@tanstack/react-query'

// 能选到的最晚一天由网关给（上海时间 21:30 前为昨天），时刻也从网关读，前端不另写
const useVisibleDate = () =>
  useQuery<{ max_date: string; cutoff: string } | null>({
    queryKey: ['visible-date'],
    queryFn: async () => { const r = await fetch('/api/v1/meta/visible-date'); return r.ok ? r.json() : null },
  })

// 页面工具栏的交易日输入框（空值表示最新交易日）
export function DateInput({ value, onChange, label = '交易日', min }: { value: string; onChange: (v: string) => void; label?: string; min?: string }) {
  const visible = useVisibleDate().data
  return (
    <span className="ml-auto flex items-center gap-2">
      {visible && <span className="text-xs text-ink-3">当日数据 {visible.cutoff} 后更新</span>}
      <input type="date" value={value} min={min} max={visible?.max_date} onChange={(e) => onChange(e.target.value)} aria-label={label}
        className="tnum h-9 rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
    </span>
  )
}
