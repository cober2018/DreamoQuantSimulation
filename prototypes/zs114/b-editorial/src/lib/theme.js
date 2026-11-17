import { ref } from 'vue'

// 优先级：URL ?theme= （截图用）> 本地记忆 > 系统偏好
const fromUrl = new URLSearchParams(location.search).get('theme')
const saved = localStorage.getItem('zs-theme')
const system = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
export const theme = ref(fromUrl || saved || system)

const apply = (t) => { document.documentElement.dataset.theme = t }
apply(theme.value)

export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('zs-theme', theme.value)
  apply(theme.value)
}
