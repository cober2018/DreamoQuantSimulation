import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { login, register, sendRegisterCode } from '@/lib/auth'
import { BrandMark } from '@/components/shell/BrandMark'
import { ThemeToggle } from '@/components/shell/ThemeToggle'
import BorderBeam from '@/components/fx/border-beam'
import { BlurFade } from '@/components/fx/blur-fade'
import { HaloSegmented } from '@/components/fx/halo-segmented'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Mode = 'login' | 'register'
const MODES = [{ value: 'login', label: '登录' }, { value: 'register', label: '注册' }]

export function Component() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : 'login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  const [terms, setTerms] = useState(false)
  const [email, setEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailVerify, setEmailVerify] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    // 网络失败时不显示验证码栏，注册按后端规则处理
    fetch('/api/v1/meta/trial').then(async (r) => { if (r.ok) setEmailVerify(!!(await r.json()).email_verify) }).catch(() => {})
    return () => clearInterval(timer.current)
  }, [])

  async function sendCode() {
    setError('')
    const r = await sendRegisterCode(email.trim())
    if (!r.ok) { setError(r.data.detail || '验证码发送失败'); return }
    setCooldown(60)
    clearInterval(timer.current)
    timer.current = setInterval(() => setCooldown((c) => { if (c <= 1) clearInterval(timer.current); return Math.max(0, c - 1) }), 1000)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const name = username.trim()
      if (mode === 'register') {
        const r = await register(name, password, terms, invite.trim(), email.trim(), emailCode.trim())
        if (!r.ok) { setError(r.data.detail || '注册失败'); return }
      }
      const r = await login(name, password)
      if (!r.ok) { setError(r.data.detail || '登录失败'); return }
      nav(r.data.user.must_change_password ? '/account' : (params.get('next') || '/overview'), { replace: true })
    } finally {
      setBusy(false)
    }
  }

  const isReg = mode === 'register'
  return (
    <div className="dot-field grid min-h-screen place-items-center bg-background px-4 py-10">
      <ThemeToggle className="!fixed right-4 top-4 !z-10 bg-card" />
      <BlurFade className="w-full max-w-[400px]" duration={0.5}>
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <BrandMark size={34} />
          <span className="text-2xl" style={{ fontFamily: 'var(--font-display)' }}>知数星耀</span>
        </div>
        <BorderBeam radius={20} duration={9} size={72}>
          <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-2)] sm:p-8">
            <HaloSegmented items={MODES} value={mode} onValueChange={(v) => { setMode(v as Mode); setError('') }} translucent={false} className="flex w-full [&>div:last-child]:w-full" />
            <h1 className="mt-6 text-[26px] font-normal leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{isReg ? '创建账号' : '欢迎回来'}</h1>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-3">市场事实与历史统计，不构成投资建议</p>

            <form onSubmit={submit} className="mt-6 grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="username">用户名</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required minLength={3} maxLength={32} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">密码</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isReg ? 'new-password' : 'current-password'} required />
              </div>
              <AnimatePresence initial={false}>
                {isReg && (
                  <motion.div key="reg" className="grid gap-4 overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
                    {emailVerify && (
                      <>
                        <div className="grid gap-1.5">
                          <Label htmlFor="email">邮箱</Label>
                          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="email-code">邮箱验证码</Label>
                          <div className="flex gap-2">
                            <Input id="email-code" value={emailCode} onChange={(e) => setEmailCode(e.target.value)} inputMode="numeric" maxLength={6} required className="tnum flex-1" />
                            <Button type="button" variant="outline" disabled={cooldown > 0 || busy} onClick={sendCode}>{cooldown > 0 ? `${cooldown} 秒后重发` : '获取验证码'}</Button>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="grid gap-1.5">
                      <Label htmlFor="invite">邀请码（选填）</Label>
                      <Input id="invite" value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="XXXX-XXXX-XXXX" className="tnum" />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-ink-2">
                      <Checkbox id="terms" checked={terms} onCheckedChange={(v) => setTerms(v === true)} />
                      <label htmlFor="terms">我已阅读并同意</label>
                      <span className="-ml-1"><Link to="/terms" className="text-primary underline-offset-4 hover:underline">《用户协议》</Link>和<Link to="/privacy" className="text-primary underline-offset-4 hover:underline">《隐私政策》</Link></span>
                    </div>
                    <p className="text-xs leading-relaxed text-ink-3">密码至少 10 位，需包含大小写字母与数字中的至少两类。</p>
                  </motion.div>
                )}
              </AnimatePresence>
              {!isReg && <p className="text-xs leading-relaxed text-ink-3">忘记密码请发邮件到 business@dreamotech.cn，我们核实后为你重置。</p>}
              {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{error}</p>}
              <Button type="submit" size="lg" disabled={busy} className="mt-1 w-full">{isReg ? '注册并登录' : '登录'}</Button>
            </form>
          </div>
        </BorderBeam>
        <p className="mt-6 text-center text-xs text-ink-3">知数星耀量化平台 · <Link to="/" className="hover:text-foreground">返回首页</Link></p>
      </BlurFade>
    </div>
  )
}
