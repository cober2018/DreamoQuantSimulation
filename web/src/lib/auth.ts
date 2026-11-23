// 会话与请求签名。访问令牌只放内存; 刷新令牌在 HttpOnly Cookie, 脚本读不到。
// 签名算法与旧版 web/src/auth.js 完全一致（服务端按同一规则验签），改动前先对照网关 auth 代码。
import { create } from 'zustand'

export interface SessionUser {
  username: string
  role: string
  role_label?: string
  permissions?: string[]
  perm_min_role?: Record<string, string>
  history_days?: number
  must_change_password?: boolean
  payment_enabled?: boolean
  member_expires_at?: number
  trial?: { until: number }
  [k: string]: unknown
}

interface Session { user: SessionUser | null; token: string; signKey: string; ready: boolean }
export const useSession = create<Session>(() => ({ user: null, token: '', signKey: '', ready: false }))
const set = useSession.setState
const get = useSession.getState

const enc = new TextEncoder()
const toHex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function hmacHex(key: string, message: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', k, enc.encode(message)))
}

function nonce() {
  const a = new Uint8Array(12)
  crypto.getRandomValues(a)
  return toHex(a)
}

async function signedHeaders(method: string, urlStr: string) {
  const u = new URL(urlStr, window.location.origin)
  const query = [...u.searchParams.entries()].sort((x, y) => (x[0] === y[0] ? (x[1] < y[1] ? -1 : 1) : x[0] < y[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`).join('&')
  const ts = String(Date.now() / 1000)
  const n = nonce()
  const { token, signKey } = get()
  const sign = await hmacHex(signKey, [method.toUpperCase(), u.pathname, query, ts, n].join('\n'))
  return { Authorization: `Bearer ${token}`, 'X-Ts': ts, 'X-Nonce': n, 'X-Sign': sign }
}

interface TokenBody { access_token: string; sign_key: string; user: SessionUser }
function adopt(body: TokenBody) {
  set({ token: body.access_token, signKey: body.sign_key, user: body.user })
}

// 刷新令牌是一次性的：网关见到已用过的令牌会判定被盗并吊销该用户全部会话。
// 所以同一时刻只能有一个刷新请求在途，并发的调用方共用同一个结果（开发模式的 StrictMode 双调用、
// 多个请求同时遇到 401 都会触发并发刷新）。
let refreshing: Promise<boolean> | null = null
function refreshOnce(): Promise<boolean> {
  refreshing ??= (async () => {
    const r = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    if (!r.ok) { set({ user: null, token: '' }); return false }
    adopt(await r.json())
    return true
  })().finally(() => { refreshing = null })
  return refreshing
}

let restoring: Promise<void> | null = null
export function restore(): Promise<void> {
  restoring ??= (async () => {
    try {
      if (!(await refreshOnce())) {
        // 开发网关关闭鉴权 (INSIGHT_AUTH_MODE=off) 时 /auth/me 直接返回 dev 身份; 生产禁止该模式
        const me = await fetch('/api/v1/auth/me')
        if (me.ok) {
          const u = await me.json()
          if (u.role === 'dev') set({ user: { ...u, role_label: '开发模式', permissions: ['*'], history_days: 250 } })
        }
      }
    } catch { /* 未登录 */ }
    set({ ready: true })
  })()
  return restoring
}

// 带签名的请求; 401 时刷新一次后重试
export async function authedFetch(url: string, opts: RequestInit = {}) {
  const method = (opts.method || 'GET').toUpperCase()
  const run = async () => fetch(url, {
    ...opts, method, credentials: 'same-origin',
    headers: { ...(opts.headers as Record<string, string> | undefined), ...(get().token ? await signedHeaders(method, url) : {}) },
  })
  let resp = await run()
  if (resp.status === 401 && get().user && await refreshOnce()) resp = await run()
  return resp
}

export interface Result<T = any> { ok: boolean; status: number; data: T }

async function postJson(url: string, body: unknown): Promise<Result> {
  const r = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  let data: any = {}
  try { data = await r.json() } catch { /* 空体 */ }
  return { ok: r.ok, status: r.status, data }
}

export async function login(username: string, password: string) {
  const res = await postJson('/api/v1/auth/login', { username, password })
  if (res.ok) adopt(res.data)
  return res
}

export const register = (username: string, password: string, accept_terms: boolean, invite_code?: string, email?: string, email_code?: string) =>
  postJson('/api/v1/auth/register', { username, password, accept_terms, invite_code: invite_code || null, email: email || null, email_code: email_code || null })

export const sendRegisterCode = (email: string) => postJson('/api/v1/auth/register/code', { email })

export async function logout() {
  await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' })
  set({ user: null, token: '', signKey: '' })
}

export async function api(method: string, url: string, body?: unknown): Promise<Result> {
  const r = await authedFetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  let data: any = {}
  try { data = await r.json() } catch { /* 空体 */ }
  return { ok: r.ok, status: r.status, data }
}

export async function reloadMe() {
  const r = await authedFetch('/api/v1/auth/me')
  if (r.ok) set({ user: await r.json() })
}

const hasPerm = (user: SessionUser | null, perm: string) =>
  !!user && ((user.permissions || []).includes(perm) || (user.permissions || []).includes('*'))
/** 非组件场景（路由守卫）用 */
export const can = (perm: string) => hasPerm(get().user, perm)
/** 组件里用，会随会话刷新 */
export const useCan = () => { const user = useSession((s) => s.user); return (perm: string) => hasPerm(user, perm) }

// DK2：付费入口由服务端开关控制（me.payment_enabled），试用信息来自 me.trial
export const payOn = () => !!get().user?.payment_enabled
export const trialText = (user: SessionUser | null) => {
  const t = user?.trial
  // until 是截止日次日 00:00（北京时间），减 1 秒取截止日
  return t ? `免费试用中（至 ${new Date((t.until - 1) * 1000).toLocaleDateString('zh-CN')}）` : ''
}
