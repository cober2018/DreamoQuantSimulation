import { create } from 'zustand'

// 首页和平台共用一个主题偏好：默认亮色，用户切过就沿用（与旧版 intro/lib/theme.js 同一个键）
type Mode = 'light' | 'dark'
const KEY = 'zx-theme'
const read = (): Mode => {
  try { const v = localStorage.getItem(KEY); if (v === 'dark' || v === 'light') return v } catch { /* 隐私模式 */ }
  return 'light'
}
const apply = (m: Mode) => { document.documentElement.dataset.theme = m }

export const useTheme = create<{ mode: Mode; toggle: () => void }>((set, get) => ({
  mode: read(),
  toggle: () => {
    const next: Mode = get().mode === 'dark' ? 'light' : 'dark'
    apply(next)
    try { localStorage.setItem(KEY, next) } catch { /* 忽略 */ }
    set({ mode: next })
  },
}))

apply(useTheme.getState().mode)
