// 公开站页脚：关注主理人（只列可公开的卡片）、免责声明、隐私、协议、备案号
import { Link } from 'react-router'
import { BrandMark } from '@/components/shell/BrandMark'
import { FOOTER_DISCLAIMER, SOCIAL } from '@/intro/content'
import { PlatformMark } from './PlatformMark'
import { WRAP } from './wrap'

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--c-line)] bg-[var(--c-bg-deep)] pb-5 pt-6 text-[length:var(--fs-xs)] text-ink-3">
      <div className={WRAP}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--c-line)] pb-4">
          <Link to="/" aria-label="知数星耀 首页" className="inline-flex items-center gap-2 text-base text-foreground">
            <BrandMark size={24} /><span style={{ fontFamily: 'var(--font-display)' }}>知数星耀</span>
          </Link>
          {SOCIAL.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <Link id="ft-follow" to="/follow" className="font-medium text-ink-2 hover:text-foreground">关注主理人 →</Link>
              <ul className="flex flex-wrap gap-2">
                {SOCIAL.map((s) => (
                  <li key={s.platform}>
                    <Link to={`/follow#${s.platform}`} className="inline-flex h-7 items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--c-line)] pl-1 pr-2 text-ink-2 transition-colors hover:border-[var(--c-line-strong)] hover:text-foreground">
                      <PlatformMark platform={s.platform} size="sm" />{s.platformName}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <p className="mt-4 max-w-[880px] leading-[1.8]">{FOOTER_DISCLAIMER}</p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 [&_a]:text-ink-2 [&_a:hover]:text-foreground [&_a:hover]:underline">
          <Link to="/privacy">隐私政策</Link>
          <Link to="/terms">用户协议</Link>
          <a href="https://beian.miit.gov.cn/" rel="noopener" target="_blank">浙ICP备2024135110号<span className="sr-only">（在新窗口打开）</span></a>
          <span>© 2026 杭州梦氧科技有限公司</span>
        </p>
      </div>
    </footer>
  )
}
