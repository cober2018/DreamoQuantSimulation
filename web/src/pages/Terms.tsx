import { Link } from 'react-router'
import { BrandMark } from '@/components/shell/BrandMark'
import { ThemeToggle } from '@/components/shell/ThemeToggle'
import { TERMS } from '@/legal/terms'
import type { Block, LegalDoc } from '@/legal/types'

function BlockView({ b }: { b: Block }) {
  if (typeof b === 'string') return <p className="mb-2 text-sm leading-relaxed text-ink-2">{b}</p>
  if ('list' in b) return <ul className="mb-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-2">{b.list.map((t) => <li key={t}>{t}</li>)}</ul>
  // 表格：固定列宽、文字折行，手机宽度下不横向撑破页面
  return (
    <table className="mb-3 w-full table-fixed border-collapse text-sm leading-relaxed text-ink-2">
      <thead><tr>{b.table.head.map((h) => <th key={h} className="border-b px-2 py-1.5 text-left align-bottom font-medium text-foreground first:pl-0">{h}</th>)}</tr></thead>
      <tbody>{b.table.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className="break-words border-b px-2 py-1.5 align-top first:pl-0">{c}</td>)}</tr>)}</tbody>
    </table>
  )
}

// 公开页（登录前也要能看），不带侧栏。正文在 src/legal/ 下，和排版分开
export function LegalPage({ doc, other }: { doc: LegalDoc; other: { to: string; label: string } }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[720px] items-center gap-2.5 px-4 pt-6 sm:px-0">
        <BrandMark size={26} />
        <span className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>知数星耀</span>
        <ThemeToggle className="ml-auto !size-8" />
        <Link to={other.to} className="text-sm text-primary underline-offset-4 hover:underline">{other.label}</Link>
        <Link to="/login" className="text-sm text-primary underline-offset-4 hover:underline">返回登录</Link>
      </div>
      <main className="mx-auto max-w-[720px] px-4 pb-16 pt-6 sm:px-0">
        <h1 className="mb-2 text-[30px] font-normal leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{doc.title}</h1>
        <p className="mb-6 text-xs text-ink-3">{doc.meta}</p>
        <div className="rounded-lg border bg-card p-5 shadow-[var(--shadow-1)] sm:p-7">
          {doc.sections.map((s) => (
            <section key={s.h} className="mb-5 last:mb-0">
              <h2 className="mb-2 text-[15px] font-medium">{s.h}</h2>
              {s.body.map((b, i) => <BlockView key={i} b={b} />)}
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}

export function Component() {
  return <LegalPage doc={TERMS} other={{ to: '/privacy', label: '隐私政策' }} />
}
