import { ref } from 'vue'

export const theme = ref(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

export function setTheme(t) {
  theme.value = t
  document.documentElement.dataset.theme = t
  try { localStorage.setItem('zs-theme', t) } catch { /* 隐私模式下不持久化即可 */ }
}
export const toggleTheme = () => setTheme(theme.value === 'dark' ? 'light' : 'dark')
