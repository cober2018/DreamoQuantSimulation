// 会话与请求签名。访问令牌只放内存; 刷新令牌在 HttpOnly Cookie, 脚本读不到。
import { reactive } from 'vue'

export const session = reactive({ user: null, token: '', signKey: '', ready: false })

const enc = new TextEncoder()
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function hmacHex(key, message) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', k, enc.encode(message)))
}

function nonce() {
  const a = new Uint8Array(12)
  crypto.getRandomValues(a)
  return toHex(a)
}

async function signedHeaders(method, urlStr) {
  const u = new URL(urlStr, window.location.origin)
  const query = [...u.searchParams.entries()].sort((x, y) => (x[0] === y[0] ? (x[1] < y[1] ? -1 : 1) : x[0] < y[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`).join('&')
  const ts = String(Date.now() / 1000)
  const n = nonce()
  const sign = await hmacHex(session.signKey, [method.toUpperCase(), u.pathname, query, ts, n].join('\n'))
  return { Authorization: `Bearer ${session.token}`, 'X-Ts': ts, 'X-Nonce': n, 'X-Sign': sign }
}

function adopt(body) {
  session.token = body.access_token
  session.signKey = body.sign_key
  session.user = body.user
}

export async function restore() {
  try {
    const r = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    if (r.ok) adopt(await r.json())
    else {
      // 开发网关关闭鉴权 (INSIGHT_AUTH_MODE=off) 时 /auth/me 直接返回 dev 身份; 生产禁止该模式
      const me = await fetch('/api/v1/auth/me')
      if (me.ok) {
        const u = await me.json()
        if (u.role === 'dev') session.user = { ...u, role_label: '开发模式', permissions: ['*'], history_days: 250 }
      }
    }
  } catch { /* 未登录 */ }
  session.ready = true
}

async function refreshOnce() {
  const r = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
  if (!r.ok) { session.user = null; session.token = ''; return false }
  adopt(await r.json())
  return true
}

// 带签名的请求; 401 时刷新一次后重试
export async function authedFetch(url, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase()
  const run = async () => fetch(url, { ...opts, method, credentials: 'same-origin',
    headers: { ...(opts.headers || {}), ...(session.token ? await signedHeaders(method, url) : {}) } })
  let resp = await run()
  if (resp.status === 401 && session.user && await refreshOnce()) resp = await run()
  return resp
}

async function postJson(url, body) {
  const r = await fetch(url, { method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  let data = {}
  try { data = await r.json() } catch { /* 空体 */ }
  return { ok: r.ok, status: r.status, data }
}

export async function login(username, password) {
  const res = await postJson('/api/v1/auth/login', { username, password })
  if (res.ok) adopt(res.data)
  return res
}

export const register = (username, password, accept_terms, invite_code) =>
  postJson('/api/v1/auth/register', { username, password, accept_terms, invite_code: invite_code || null })

export async function logout() {
  await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' })
  session.user = null; session.token = ''; session.signKey = ''
}

export async function api(method, url, body) {
  const r = await authedFetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined })
  let data = {}
  try { data = await r.json() } catch { /* 空体 */ }
  return { ok: r.ok, status: r.status, data }
}

export async function reloadMe() {
  const r = await authedFetch('/api/v1/auth/me')
  if (r.ok) session.user = await r.json()
}

export const can = (perm) => !!session.user && ((session.user.permissions || []).includes(perm) || (session.user.permissions || []).includes('*'))
