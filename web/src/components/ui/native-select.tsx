import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 管理后台表单里的下拉：用原生 select（可访问、手机上体验好），样式和 Input 一致
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select {...props} className={cn('h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50', className)} />
}
