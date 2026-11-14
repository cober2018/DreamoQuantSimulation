import { reactive, ref, watch } from 'vue'
import { getModule } from './api'

// D9：当前页各模块的权限状态（full/partial/none），由后端按角色 × 看板 × 指标裁剪后给出；v-module 指令据此隐藏整块无权限的面板
export const moduleAccess = reactive({ map: {}, restricted: [], counts: {} })

// 模块部分开放时的标注，如"本等级开放 7/8 项"；全开放或未启用指标级策略时为空
export const openText = (m) => {
  const c = moduleAccess.counts[m]
  return c && c[0] < c[1] ? ` · 本等级开放 ${c[0]}/${c[1]} 项` : ''
}

// 页面通用取数：参数变化即重取；错误态由 PageFrame 渲染
export function useModule(path, paramsFn) {
  const env = ref({})
  const loading = ref(true)
  async function load() {
    loading.value = true
    const p = typeof path === 'function' ? path() : path
    const out = await getModule(p, paramsFn ? paramsFn() : {})
    moduleAccess.map = out?.module_access || {}
    moduleAccess.restricted = out?.restricted || []
    moduleAccess.counts = out?.module_counts || {}
    env.value = out
    loading.value = false
  }
  watch(() => [typeof path === 'function' ? path() : path, JSON.stringify(paramsFn ? paramsFn() : {})], load,
    { immediate: true })
  return { env, loading, load }
}
