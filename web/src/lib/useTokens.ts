import { useMemo } from 'react'
import { useTheme } from '@/stores/theme'
import { hslToRgba } from '@/lib/zx/color.js'

// ECharts 不认 CSS 变量，也不认 CSS4 的 hsl 空格写法：按当前主题读取 --c-*，转成 rgb()/rgba()
const NAMES = ['up', 'down', 'ink', 'ink-2', 'ink-3', 'line', 'line-strong', 'surface', 'accent', 'viz-1', 'viz-2', 'viz-3', 'viz-4', 'viz-5'] as const
export type Tokens = Record<(typeof NAMES)[number], string>

export function useTokens(): Tokens {
  const mode = useTheme((s) => s.mode)
  // mode 变化时 data-theme 已经更新，此时读到的是新主题的值
  return useMemo(() => {
    const cs = getComputedStyle(document.documentElement)
    return Object.fromEntries(NAMES.map((n) => [n, hslToRgba(cs.getPropertyValue(`--c-${n}`).trim())])) as Tokens
  }, [mode])
}
