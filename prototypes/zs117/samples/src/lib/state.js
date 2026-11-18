import { computed } from 'vue'
import { useRoute } from 'vue-router'

// 原型开关：?state=loading|empty|error|forbidden|nodate，五种状态覆盖整页所有模块
export const STATES = [
  { v: '', label: '正常' }, { v: 'loading', label: '加载中' }, { v: 'empty', label: '空' },
  { v: 'error', label: '错误' }, { v: 'forbidden', label: '无权限' }, { v: 'nodate', label: '所选日期无数据' },
]
export function usePreviewState() {
  const route = useRoute()
  return computed(() => (STATES.some((s) => s.v && s.v === route.query.state) ? route.query.state : ''))
}
