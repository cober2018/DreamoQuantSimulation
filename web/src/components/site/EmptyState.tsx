// 占位说明：星点连线小图 + 标题 + 说明 + 按钮。小图照旧版 StatePanel 的「空」那一种。
import type { ReactNode } from 'react'

export function EmptyState({ title, desc, children }: { title: string; desc: string; children?: ReactNode }) {
  return (
    <section role="status" className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-5 py-14 text-center">
      <svg width="96" height="75" viewBox="0 0 72 56" aria-hidden="true" className="mb-3">
        <g>
          {[[14, 38], [30, 18], [48, 34], [60, 14]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.6" fill="var(--c-ink-3)" />)}
          <path d="M14 38 L30 18 L48 34 L60 14" fill="none" stroke="var(--c-line-strong)" strokeWidth="1" strokeDasharray="2 3" />
        </g>
      </svg>
      <p className="text-[length:var(--fs-md)] font-semibold text-foreground">{title}</p>
      <p className="max-w-[400px] text-balance text-[length:var(--fs-sm)] leading-[var(--lh-base)] text-ink-2">{desc}</p>
      {children && <div className="mt-3 flex gap-2">{children}</div>}
    </section>
  )
}
