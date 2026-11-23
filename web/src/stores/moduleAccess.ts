import { create } from 'zustand'
import type { Envelope } from '@/lib/api'

// D9：当前页各模块的权限状态（full/partial/none），由后端按角色 × 看板 × 指标裁剪后给出
interface State {
  map: Record<string, string>
  restricted: string[]
  counts: Record<string, [number, number]>
  set: (env: Envelope) => void
}
export const useModuleAccess = create<State>((set) => ({
  map: {}, restricted: [], counts: {},
  set: (env) => set({ map: env.module_access || {}, restricted: env.restricted || [], counts: env.module_counts || {} }),
}))

// 模块部分开放时的标注，如"本等级开放 7/8 项"；全开放或未启用指标级策略时为空
export const useOpenText = () => {
  const counts = useModuleAccess((s) => s.counts)
  return (m: string) => { const c = counts[m]; return c && c[0] < c[1] ? ` · 本等级开放 ${c[0]}/${c[1]} 项` : '' }
}
