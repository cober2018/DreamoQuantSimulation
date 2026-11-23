import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/auth'

// 管理后台读写的公共写法。读：失败抛错，页面显示 error；写：成功后让所有 admin 查询失效重取，并右下角提示结果
export function useAdminQuery<T = any>(key: QueryKey, url: string, enabled = true) {
  return useQuery<T>({
    queryKey: ['admin', ...key], enabled,
    queryFn: async () => {
      const r = await api('GET', url)
      if (!r.ok) throw new Error(r.data.detail || '加载失败')
      return r.data as T
    },
  })
}

export function useAdminAct() {
  const qc = useQueryClient()
  return async (method: string, url: string, body?: unknown, ok?: string | ((data: any) => string)) => {
    const r = await api(method, url, body)
    if (r.ok) {
      if (ok) toast.success(typeof ok === 'function' ? ok(r.data) : ok)
      await qc.invalidateQueries({ queryKey: ['admin'] })
    } else toast.error(r.data.detail || '失败')
    return r
  }
}
