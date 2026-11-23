// 平台标识占位：单色虚线方块 + 一个字。不画任何平台的商标图形，以后换成各平台官方品牌资源。
import { cn } from '@/lib/utils'

const GLYPH: Record<string, string> = { 'wechat-oa': '公', douyin: '抖', xiaohongshu: '红' }

export function PlatformMark({ platform, size = 'md' }: { platform: string; size?: 'md' | 'sm' }) {
  return (
    <span aria-hidden="true" className={cn('inline-grid shrink-0 place-items-center border border-dashed border-[var(--c-line-strong)] font-semibold leading-none text-ink-2',
      size === 'md' ? 'size-10 rounded-[var(--r-2)] text-[length:var(--fs-md)]' : 'size-5 rounded-[var(--r-1)] text-[length:var(--fs-2xs)]')}>
      {GLYPH[platform] || '·'}
    </span>
  )
}
