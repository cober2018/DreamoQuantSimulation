import { reactive } from 'vue'
import HmacSHA256 from 'crypto-js/hmac-sha256'
import { API_BASE } from './config'

export const session = reactive({ user: null, token: '', signKey: '', ready: false })
const RT_KEY = 'insight_rt'

function raw(method, path, data, header = {}) {
  return new Promise((resolve) => {
    uni.request({
      url: API_BASE + path, method, data, header: { 'Content-Type': 'application/json', ...header },
      success: (r) => resolve({ ok: r.statusCode >= 200 && r.statusCode < 300, status: r.statusCode, data: r.data || {} }),
      fail: () => resolve({ ok: false, status: 0, data: { detail: '网络不可用' } }),
    })
  })
}

function adopt(body) {
  session.token = body.access_token
  session.signKey = body.sign_key
  session.user = body.user
  if (body.refresh_token) uni.setStorageSync(RT_KEY, body.refresh_token)
}

export async function restore() {
  const rt = uni.getStorageSync(RT_KEY)
  if (rt) {
    const r = await raw('POST', '/api/v1/auth/refresh', { refresh_token: rt })
    if (r.ok) adopt(r.data)
    else uni.removeStorageSync(RT_KEY)
  }
  session.ready = true
}

async function code() {
  // H5 预览: 构建时注入 VITE_H5_MOCK_CODE (开发网关 INSIGHT_MP_MOCK_LOGIN=1 才接受); 小程序构建不设置, 产物不含该值
  const mock = import.meta.env.VITE_H5_MOCK_CODE
  if (mock) return mock
  return new Promise((resolve, reject) => uni.login({ provider: 'weixin', success: (r) => resolve(r.code), fail: reject }))
}

export async function wechatLogin(acceptTerms) {
  const r = await raw('POST', '/api/v1/auth/wechat', { code: await code(), accept_terms: acceptTerms })
  if (r.ok) adopt(r.data)
  return r
}

// 小程序运行时没有 crypto, crypto-js 的 random 会直接抛错; nonce 只需唯一(防重放), 保密性由 HMAC 签名保证
let nonceSeq = 0
function newNonce() {
  nonceSeq = (nonceSeq + 1) % 0xffffff
  const r = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')
  return `${Date.now().toString(16)}${nonceSeq.toString(16).padStart(6, '0')}${r()}${r()}`
}

export async function signedRequest(method, path, params = {}, body) {
  if (!session.token) return { ok: false, status: 401, data: { detail: '未登录' } }
  const query = Object.keys(params).filter((k) => params[k] !== '' && params[k] != null).sort()
    .map((k) => `${k}=${params[k]}`).join('&')
  const ts = String(Date.now() / 1000)
  const nonce = newNonce()
  const sign = HmacSHA256([method, path, query, ts, nonce].join('\n'), session.signKey).toString()
  const url = query ? `${path}?${query.split('&').map((p) => p.split('=').map(encodeURIComponent).join('=')).join('&')}` : path
  const r = await raw(method, url, body, { Authorization: `Bearer ${session.token}`, 'X-Ts': ts, 'X-Nonce': nonce, 'X-Sign': sign })
  if (r.status === 401 && session.user) {
    const rt = uni.getStorageSync(RT_KEY)
    const f = rt ? await raw('POST', '/api/v1/auth/refresh', { refresh_token: rt }) : { ok: false }
    if (f.ok) { adopt(f.data); return signedRequest(method, path, params, body) }
    session.user = null; session.token = ''
  }
  return r
}

export const get = (path, params) => signedRequest('GET', path, params)
export async function logout() {
  const rt = uni.getStorageSync(RT_KEY)
  if (rt) await raw('POST', '/api/v1/auth/logout', { refresh_token: rt })
  uni.removeStorageSync(RT_KEY)
  session.user = null; session.token = ''; session.signKey = ''
}
export { raw }
