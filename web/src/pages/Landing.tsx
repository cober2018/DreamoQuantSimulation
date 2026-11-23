// 官网首页：首屏星图、历史曲线演示、六个数据页、关注入口。登录前能看，不请求数据接口（只读试用截止日）。
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { BlurFade } from '@/components/fx/blur-fade'
import GlowHover from '@/components/fx/glow-hover'
import { ConstellationGlyph } from '@/components/site/ConstellationGlyph'
import { PlatformMark } from '@/components/site/PlatformMark'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SiteHeader } from '@/components/site/SiteHeader'
import { Sky } from '@/components/site/Sky'
import { SKIP_LINK, WRAP } from '@/components/site/wrap'
import { Button } from '@/components/ui/button'
import { DEMO_HEAD, EXTRA, FOLLOW_STRIP, HERO, INDICATORS, SITE_PAGES, SOCIAL, type TileKey } from '@/intro/content'
import { RANGE, SKY_LABELS } from '@/intro/sample'
import '@/intro/landing.css'

const HistoryDemo = lazy(() => import('@/components/site/HistoryDemo'))
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 图表代码的加载时机：访客开始往下滚之后，第二屏离视口 600px 以内就加载；页面没法滚（窗口很高）时，第二屏真正进入视口再加载。
// 首屏高度接近一屏，若一进页面就按 600px 判断，图表代码会和首屏抢带宽。加载前放固定高度的占位，页面不跳动
function DemoSlot({ flash }: { flash: { key: TileKey; n: number } | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const watch = (margin: string) => {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true) }, { rootMargin: margin })
      io.observe(el)
      return io
    }
    const visible = watch('0px')
    let ahead: IntersectionObserver | null = null
    const onScroll = () => { ahead ??= watch('600px 0px'); cleanup() }
    const cleanup = () => ['scroll', 'wheel', 'touchmove', 'keydown'].forEach((t) => window.removeEventListener(t, onScroll))
    ;['scroll', 'wheel', 'touchmove', 'keydown'].forEach((t) => window.addEventListener(t, onScroll, { passive: true }))
    return () => { visible.disconnect(); ahead?.disconnect(); cleanup() }
  }, [])
  const hold = <div aria-hidden="true" className="h-[560px] rounded-[var(--r-4)] border border-[var(--c-line)] bg-[var(--c-surface)] max-[759px]:h-[760px]" />
  return <div ref={ref}>{near ? <Suspense fallback={hold}><HistoryDemo flash={flash} /></Suspense> : hold}</div>
}

export function Component() {
  const copyRef = useRef<HTMLDivElement>(null)
  const capRef = useRef<HTMLParagraphElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const [flash, setFlash] = useState<{ key: TileKey; n: number } | null>(null)
  const [trial, setTrial] = useState('')

  useEffect(() => {
    // until 是截止日次日 00:00（北京时间），减 1 秒取截止日；取不到就不显示日期
    fetch('/api/v1/meta/trial').then(async (r) => {
      const d = r.ok ? await r.json() : null
      if (d?.until) setTrial(new Date((d.until - 1) * 1000).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }))
    }).catch(() => {})
  }, [])

  const pick = (key: TileKey) => {
    document.getElementById('demo')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' })
    setFlash({ key, n: Date.now() })
  }

  return (
    <div className="landing min-h-screen bg-[var(--c-bg)] text-foreground">
      <a className={SKIP_LINK} href="#main">跳到正文</a>
      <SiteHeader overlay ref={headerRef} />

      <main id="main">
        <section className="hero" aria-labelledby="hero-h">
          <Sky labels={SKY_LABELS} avoid={() => [copyRef.current, capRef.current, headerRef.current]} onPick={pick} />
          <div className={`${WRAP} hero-in`}>
            <div ref={copyRef} className="hero-copy">
              <p className="mb-4 text-[length:var(--fs-xs)] tracking-[var(--tr-caps)] text-[var(--c-accent-ink)]">{HERO.eyebrow}</p>
              <h1 id="hero-h" className="text-[length:var(--fs-display)] font-normal leading-none tracking-[0.04em] max-sm:text-[52px]" style={{ fontFamily: 'var(--font-display)' }}>{HERO.title}</h1>
              <BlurFade delay={0.05}>
                <p className="lead mt-5 text-[clamp(22px,2.4vw,32px)] leading-[1.4] max-sm:text-[22px]" style={{ fontFamily: 'var(--font-display)' }}>
                  {HERO.lead[0]}<br className="br-m" />{HERO.lead[1]}
                </p>
              </BlurFade>
              <BlurFade delay={0.12}>
                <p className="mt-4 max-w-[34em] text-[length:var(--fs-md)] leading-[var(--lh-loose)] text-ink-2 max-sm:text-[15px]">{HERO.desc}</p>
              </BlurFade>
              <BlurFade delay={0.2}>
                <div className="mt-6 flex flex-wrap gap-3 max-sm:[&>a]:flex-1">
                  <Button asChild size="lg" className="h-12 px-6 text-[length:var(--fs-md)] font-semibold"><Link id="hero-register" to="/login?mode=register">免费注册</Link></Button>
                  <Button asChild size="lg" variant="outline" className="h-12 px-6 text-[length:var(--fs-md)]"><Link id="hero-login" to="/login">登录</Link></Button>
                </div>
                <p className="mt-3 text-[length:var(--fs-xs)] text-ink-3">
                  {trial ? `试用期内全部页面可用，至 ${trial}。` : '免费版与会员的区别见 '}
                  <Link to="/pricing" className="text-ink-2 underline underline-offset-4 hover:text-foreground">价格与权益</Link>
                  {!trial && '。'}
                </p>
              </BlurFade>
            </div>
          </div>
          <p ref={capRef} className="caption"><span className="cdot" aria-hidden="true" />星图中每颗星是一项盘后统计，连线表示同属一个数据页；亮星的数值取自 {RANGE.end} 的样例数据。</p>
        </section>

        <section id="demo" className={`${WRAP} pb-[var(--s-8)] pt-[var(--s-9)] max-sm:pt-[var(--s-8)]`} aria-labelledby="demo-h">
          <div className="max-w-[680px]">
            <p className="mb-4 text-[length:var(--fs-xs)] tracking-[var(--tr-caps)] text-[var(--c-accent-ink)]">{DEMO_HEAD.eyebrow}</p>
            <h2 id="demo-h" className="text-[clamp(30px,3.6vw,48px)] font-normal leading-[1.2]" style={{ fontFamily: 'var(--font-display)' }}>{DEMO_HEAD.title[0]}<br />{DEMO_HEAD.title[1]}</h2>
            <p className="mt-4 text-[length:var(--fs-md)] leading-[var(--lh-loose)] text-ink-2">
              平台里的每组指标都这样用：移动日期，当日值一起切过去，曲线上标出它在历史里的位置。下面是 {RANGE.start} 至 {RANGE.end} 的真实数据样例，登录后看到的是最新交易日。
            </p>
          </div>
          <div className="mt-[var(--s-7)]"><DemoSlot flash={flash} /></div>
        </section>

        <section id="pages" className={`${WRAP} pb-[var(--s-8)]`} aria-labelledby="pages-h">
          <h2 id="pages-h" className="text-[clamp(24px,2.6vw,34px)] font-normal leading-[1.2]" style={{ fontFamily: 'var(--font-display)' }}>六个数据页，按交易日更新</h2>
          <GlowHover className="mt-[var(--s-6)] grid grid-cols-3 border-l border-t border-[var(--c-line)] max-[1099px]:grid-cols-2 max-[639px]:grid-cols-1" maskSize={420} glowIntensity={0.08}
            items={SITE_PAGES.map((p, i) => ({
              id: p.key,
              overlayElement: <div />,
              element: (
                <Link to={p.path} className="block min-h-[148px] border-b border-r border-[var(--c-line)] p-5 transition-colors hover:bg-[var(--c-surface)] max-[639px]:min-h-0">
                  <BlurFade inView delay={i * 0.05}>
                    <ConstellationGlyph names={[...INDICATORS[p.key], ...(EXTRA[p.key] || [])].slice(0, INDICATORS[p.key].length)} />
                    <p className="mt-3 text-xs text-ink-3">{p.question}</p>
                    <h3 className="mt-1 text-[length:var(--fs-md)] font-semibold">{p.title}</h3>
                    <p className="mt-2 text-[length:var(--fs-sm)] leading-[1.7] text-ink-2">{p.text}</p>
                  </BlurFade>
                </Link>
              ),
            }))} />
        </section>

        {SOCIAL.length > 0 && (
          <section className={`${WRAP} pb-[var(--s-8)]`} aria-labelledby="fs-h">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[var(--r-3)] border border-[var(--c-line)] bg-[var(--c-surface)] px-5 py-4">
              <h2 id="fs-h" className="text-[length:var(--fs-base)] font-semibold">{FOLLOW_STRIP.title}</h2>
              <p className="text-[length:var(--fs-sm)] text-ink-2">{FOLLOW_STRIP.text}</p>
              <ul className="flex flex-wrap gap-4 text-[length:var(--fs-sm)] text-ink-2">
                {SOCIAL.map((s) => <li key={s.platform} className="inline-flex items-center gap-1.5"><PlatformMark platform={s.platform} size="sm" />{s.platformName}</li>)}
              </ul>
              <Button asChild variant="outline" size="sm" className="ml-auto max-sm:ml-0"><Link id="fs-more" to="/follow">扫码关注</Link></Button>
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
