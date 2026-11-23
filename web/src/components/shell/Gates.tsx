import type { ReactNode } from 'react'
import { useModuleAccess } from '@/stores/moduleAccess'

// 替代旧版 v-module / v-ind 指令。后端已裁掉无权限指标；整块无权限的模块在前端不渲染（以后端裁剪为准）
export function ModuleGate({ module, children }: { module: string; children: ReactNode }) {
  const none = useModuleAccess((s) => s.map[module] === 'none')
  return none ? null : <>{children}</>
}

// 单个指标被裁掉时不渲染对应数值卡片，避免把"无权限"显示成"暂无数据"
export function IndGate({ ind, children }: { ind: string; children: ReactNode }) {
  const hidden = useModuleAccess((s) => s.restricted.includes(ind))
  return hidden ? null : <>{children}</>
}
