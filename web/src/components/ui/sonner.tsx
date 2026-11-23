import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useTheme } from '@/stores/theme'

// 本工程自己管主题（stores/theme），不用 next-themes；颜色走 --c-* 变量
export function Toaster(props: ToasterProps) {
  const mode = useTheme((s) => s.mode)
  return (
    <Sonner theme={mode} position="bottom-right" closeButton
      style={{ '--normal-bg': 'var(--c-surface)', '--normal-text': 'var(--c-ink)', '--normal-border': 'var(--c-line-strong)' } as React.CSSProperties}
      {...props} />
  )
}
