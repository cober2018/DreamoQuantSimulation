// 页面工具栏的交易日输入框（空值表示最新交易日）
export function DateInput({ value, onChange, label = '交易日', min }: { value: string; onChange: (v: string) => void; label?: string; min?: string }) {
  return (
    <input type="date" value={value} min={min} onChange={(e) => onChange(e.target.value)} aria-label={label}
      className="tnum ml-auto h-9 rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
  )
}
