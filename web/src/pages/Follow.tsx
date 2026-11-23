// 关注知数Talk 主理人：卡片数据只来自 intro/content.ts 的 SOCIAL
import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { EmptyState } from '@/components/site/EmptyState'
import { PlatformMark } from '@/components/site/PlatformMark'
import { SiteShell } from '@/components/site/SiteShell'
import { BlurFade } from '@/components/fx/blur-fade'
import { Button } from '@/components/ui/button'
import { FOLLOW, SOCIAL } from '@/intro/content'

export function Component() {
  const { hash } = useLocation()
  // 页脚链接 /follow#douyin：路由不会自己滚到锚点
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'center' })
  }, [hash])
  return (
    <SiteShell>
      <p className="mb-3 text-[length:var(--fs-xs)] tracking-[var(--tr-caps)] text-[var(--c-accent-ink)]">{FOLLOW.eyebrow}</p>
      <h1 className="text-[clamp(32px,4vw,48px)] font-normal leading-[1.15]" style={{ fontFamily: 'var(--font-display)' }}>{FOLLOW.title}</h1>
      <p className="mt-3 max-w-[40em] text-[length:var(--fs-md)] leading-[var(--lh-loose)] text-ink-2">{FOLLOW.sub}</p>

      {SOCIAL.length > 0 ? (
        <ul className="mt-[var(--s-7)] grid grid-cols-3 gap-5 max-[1099px]:max-w-[420px] max-[1099px]:grid-cols-1">
          {SOCIAL.map((s, i) => (
            <li key={s.platform} id={s.platform} className="scroll-mt-24">
              <BlurFade delay={i * 0.08} className="flex flex-col gap-4 rounded-[var(--r-3)] border border-[var(--c-line)] bg-[var(--c-surface)] p-5">
                <div className="flex items-center gap-3">
                  <PlatformMark platform={s.platform} />
                  <div className="min-w-0">
                    <h2 className="text-[length:var(--fs-lg)] font-semibold leading-[1.3]">{s.name}</h2>
                    <p className="text-[length:var(--fs-xs)] text-ink-3">{s.platformName}</p>
                  </div>
                </div>
                <figure className="m-0 flex flex-col items-center gap-2 border-t border-[var(--c-line)] pb-3 pt-5">
                  {/* 码图放在白底容器里（暗色主题也是白底），不加滤镜、不做圆角裁切，否则可能扫不出 */}
                  {s.qr ? (
                    <div className="aspect-square w-[min(300px,100%)] rounded-[var(--r-2)] border border-[var(--c-line)] bg-[var(--c-qr-surface)] p-3">
                      <img src={s.qr} alt={s.qrAlt || `${s.name} ${s.platformName}二维码`} width={276} height={276} loading="lazy" decoding="async" className="block size-full object-contain" />
                    </div>
                  ) : (
                    <div role="img" aria-label={`${s.platformName}二维码待补充`} className="flex size-40 flex-col items-center justify-center gap-2 rounded-[var(--r-2)] border border-dashed border-[var(--c-line-strong)] bg-[var(--c-surface-2)] text-[length:var(--fs-sm)] text-ink-2">
                      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" fill="none" stroke="var(--c-line-strong)" strokeWidth="1.4"><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="36" y="4" width="16" height="16" rx="2" /><rect x="4" y="36" width="16" height="16" rx="2" /><path d="M36 36h6v6h-6zM46 46h6v6h-6zM46 36h6M36 46v6" /></svg>
                      <span>二维码待补充</span>
                    </div>
                  )}
                  <figcaption className="text-[length:var(--fs-xs)] text-ink-3">{s.qr ? `用${s.platformName === '公众号' ? '微信' : s.platformName} App 扫码` : '账号信息确认后放入'}</figcaption>
                </figure>
                {s.url && (
                  <Button asChild variant="outline" size="sm" className="self-start"><a href={s.url} rel="noopener" target="_blank">打开{s.platformName}<span className="sr-only">（在新窗口打开）</span></a></Button>
                )}
              </BlurFade>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="账号信息整理中" desc="公众号、抖音、小红书的账号确认后会放在这里。" />
      )}
    </SiteShell>
  )
}
