import { useTheme } from '@/stores/theme'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { mode, toggle } = useTheme()
  const dark = mode === 'dark'
  return (
    <button type="button" onClick={toggle} aria-pressed={dark} title={dark ? '切换到亮色主题' : '切换到暗色主题'}
      className={cn('grid size-9 place-items-center rounded-md border border-border text-ink-2 transition-colors hover:border-[var(--c-line-strong)] hover:bg-surface-hover hover:text-foreground', className)}>
      <span className="sr-only">暗色主题</span>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        {dark
          ? <path d="M12.5 10.2A5.2 5.2 0 0 1 5.8 3.5 5.2 5.2 0 1 0 12.5 10.2Z" />
          : <><circle cx="8" cy="8" r="3.2" /><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" /></>}
      </svg>
    </button>
  )
}
