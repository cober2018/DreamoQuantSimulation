import { ref, watch } from 'vue'
import { getModule } from './api'

// 页面通用取数：参数变化即重取；错误态由 PageFrame 渲染
export function useModule(path, paramsFn) {
  const env = ref({})
  const loading = ref(true)
  async function load() {
    loading.value = true
    const p = typeof path === 'function' ? path() : path
    env.value = await getModule(p, paramsFn ? paramsFn() : {})
    loading.value = false
  }
  watch(() => [typeof path === 'function' ? path() : path, JSON.stringify(paramsFn ? paramsFn() : {})], load,
    { immediate: true })
  return { env, loading, load }
}
