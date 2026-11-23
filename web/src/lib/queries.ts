// 服务端数据缓存（TanStack Query）：同一交易日的补充视图只请求一次，切换日期时自动重取
import { useEffect } from 'react'
import { keepPreviousData, QueryClient, useQuery } from '@tanstack/react-query'
import { getModule } from './api'
import { loadSupplement } from './supplement'
import { useModuleAccess } from '@/stores/moduleAccess'

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: false, refetchOnWindowFocus: false } },
})

export const useSupplementQuery = (name: string, tradeDate?: string, enabled = true) =>
  useQuery({ queryKey: ['supplement', name, tradeDate], enabled, queryFn: () => loadSupplement(name, tradeDate) })

// 页面通用取数：参数变化即重取；错误态由 PageFrame 渲染。
// 同时把后端按角色裁剪后的模块权限写入 moduleAccess，供 ModuleGate / IndGate 使用
export function useModule(path: string, params: Record<string, string | undefined> = {}) {
  const setAccess = useModuleAccess((s) => s.set)
  // 切换日期或周期时保留上一份数据直到新数据到达，页面内的切换控件不会跟着整页闪成「加载中」
  const q = useQuery({ queryKey: ['module', path, params], queryFn: () => getModule(path, params), placeholderData: keepPreviousData })
  useEffect(() => { if (q.data) setAccess(q.data) }, [q.data, setAccess])
  return { env: q.data ?? {}, loading: q.isPending, load: () => q.refetch() }
}

// 两市成交额与参与度页同源（participation_observation.total_amount_billion）。
// 只取观察字段，不走 useModule，避免改动当前页的模块权限状态
export const useParticipationObservation = (tradeDate: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['participation-observation', tradeDate], enabled,
    queryFn: async () => (await getModule('participation', { trade_date: tradeDate }))?.data?.participation_observation ?? null,
  })
