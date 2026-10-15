import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get, session, restore } from './auth'

// 页面通用取数: 返回信封; 未登录/无权限/不可用由页面渲染对应提示
export function useData(path, params = {}) {
  const env = ref(null)
  const state = ref('loading') // loading | login | forbidden | error | ready
  const detail = ref('')
  async function load() {
    state.value = 'loading'
    if (!session.ready) await restore()
    if (!session.user) { state.value = 'login'; return }
    const r = await get(path, params)
    if (r.status === 401) { state.value = 'login'; return }
    if (r.status === 403 || r.status === 429) { state.value = 'forbidden'; detail.value = r.data.detail || ''; return }
    if (!r.ok) { state.value = 'error'; detail.value = r.data.detail || '数据服务暂不可用'; return }
    env.value = r.data
    state.value = 'ready'
  }
  onShow(load)
  return { env, state, detail, load }
}
