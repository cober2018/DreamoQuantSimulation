import { Link } from 'react-router'
import { BrandMark } from '@/components/shell/BrandMark'
import { ThemeToggle } from '@/components/shell/ThemeToggle'

// 公开页（登录前也要能看），不带侧栏。文字与旧版 Terms.vue 一致
const SECTIONS: { h: string; p: string[] }[] = [
  { h: '服务性质', p: ['本平台仅提供证券相关信息的汇总与历史数据统计，所有内容均为已发生事实的整理，不构成任何证券投资建议、要约或承诺。投资有风险，决策请自行负责。'] },
  { h: '账号与会员', p: ['账号仅供本人使用，不得转借、出租或共享。', '当前为免费试用，暂未开通付费，本站不收取任何费用。开通付费前会另行公告并更新本条款。'] },
  { h: '数据使用限制', p: ['禁止通过脚本批量抓取、转售、再分发平台数据，或尝试绕过访问控制。系统对异常访问行为会自动限制，并保留审计记录。'] },
  { h: '隐私', p: ['仅收集注册所需的用户名与登录安全信息（密码以不可逆哈希保存）；记录登录与兑换事件用于安全审计，不向第三方出售个人信息。微信登录仅获取用于识别账号的开放标识。'] },
]

export function Component() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[720px] items-center gap-2.5 px-4 pt-6 sm:px-0">
        <BrandMark size={26} />
        <span className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>知数星耀</span>
        <ThemeToggle className="ml-auto !size-8" />
        <Link to="/login" className="text-sm text-primary underline-offset-4 hover:underline">返回登录</Link>
      </div>
      <main className="mx-auto max-w-[720px] px-4 pb-16 pt-6 sm:px-0">
        <h1 className="mb-6 text-[30px] font-normal leading-tight" style={{ fontFamily: 'var(--font-display)' }}>用户协议与隐私政策</h1>
        <div className="rounded-lg border bg-card p-5 shadow-[var(--shadow-1)] sm:p-7">
          {SECTIONS.map((s) => (
            <section key={s.h} className="mb-5 last:mb-0">
              <h2 className="mb-2 text-[15px] font-medium">{s.h}</h2>
              {s.p.map((t) => <p key={t} className="mb-2 text-sm leading-relaxed text-ink-2">{t}</p>)}
            </section>
          ))}
          <p className="mt-6 text-xs text-ink-3">本文为产品内置的简版说明，正式上线前需由主体公司的法务审阅替换。</p>
        </div>
      </main>
    </div>
  )
}
