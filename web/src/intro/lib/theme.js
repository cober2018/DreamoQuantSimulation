import { ref } from 'vue'

export const theme = ref(document.documentElement.dataset.theme || 'light')
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function apply(t) {
  theme.value = t
  document.documentElement.dataset.theme = t
  try { localStorage.setItem('zx-theme', t) } catch { /* 隐私模式下不记偏好即可 */ }
}

export function toggleTheme() {
  const next = theme.value === 'dark' ? 'light' : 'dark'
  // 主题切换用一次交叉淡入，支持 View Transitions 且未要求减少动效时才启用
  if (document.startViewTransition && !reducedMotion()) document.startViewTransition(() => apply(next))
  else apply(next)
}
