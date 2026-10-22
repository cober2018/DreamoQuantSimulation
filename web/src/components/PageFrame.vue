<template>
  <section>
    <header class="page-head">
      <h1>{{ title }}</h1>
      <span v-if="env.trade_date" class="muted">数据日期 {{ env.trade_date }}</span>
      <span v-if="env.status" :class="['badge', env.status]">{{ statusLabel }}</span>
      <slot name="tools" />
      <div class="question">{{ question }}</div>
    </header>

    <div v-if="env.data_mode === 'fixture'" class="banner fixture">
      开发夹具数据，非实时行情。部分数值为合成样本，仅用于演示页面结构。
    </div>

    <div v-if="loading" class="empty-state">加载中…</div>
    <div v-else-if="isError" class="banner error">
      <span>{{ errorText }}</span>
      <router-link v-if="env.status === 'forbidden'" class="btn" to="/plans">查看会员套餐</router-link>
      <router-link v-else-if="env.status === 'unauthorized'" class="btn" to="/login">重新登录</router-link>
      <button v-else class="btn" @click="$emit('retry')">重试</button>
    </div>
    <div v-else-if="env.status === 'empty'" class="empty-state">
      <p>{{ env.trade_date ? `${env.trade_date} 的数据暂缺（上游数据维护中）` : '暂无可用数据（上游数据维护中）' }}</p>
      <button v-if="canJump" class="btn" @click="$emit('jump', env.latest_available_date)">
        查看最近有数据的交易日 {{ env.latest_available_date }}
      </button>
    </div>
    <template v-else>
      <div v-if="env.status === 'partial' && gapItems.length" class="banner fixture">部分内容暂缺：{{ gapItems.join('、') }}。其余内容正常展示。</div>
      <slot />
    </template>

    <details v-if="!loading && env.gaps && env.gaps.length" class="panel fold">
      <summary>未提供或不完整的内容（{{ env.gaps.length }}）</summary>
      <ul class="gaps">
        <li v-for="(g, i) in env.gaps" :key="i">{{ g.item }}：{{ g.reason }}</li>
      </ul>
    </details>

    <details v-if="!loading && env.sources && env.sources.length" class="panel fold">
      <summary>数据来源与覆盖</summary>
      <div class="table-wrap"><table>
        <thead><tr><th class="left">数据</th><th>数据日</th><th>快照时间</th><th>覆盖率</th><th class="left">缺失来源</th></tr></thead>
        <tbody>
          <tr v-for="s in env.sources" :key="s.service_key">
            <td class="left">{{ SERVICE_NAMES[s.service_key] || '其他数据' }}</td>
            <td>{{ s.source_date || '无该日数据' }}</td>
            <td>{{ s.snapshot_time || '—' }}</td>
            <td>{{ fmt.ratio(s.coverage_ratio) }}</td>
            <td class="left wrap">{{ s.missing_sources?.length ? s.missing_sources.join('、') : '—' }}</td>
          </tr>
        </tbody>
      </table></div>
    </details>

    <footer class="footer">{{ DISCLAIMER }}</footer>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { fmt, SERVICE_NAMES } from '../api'

const DISCLAIMER = '本平台仅提供证券信息汇总与历史数据统计，不构成任何证券投资建议。'
const props = defineProps({
  title: String,
  question: String,
  env: { type: Object, default: () => ({}) },
  loading: Boolean,
})
defineEmits(['retry', 'jump'])

const LABELS = {
  ok: '数据完整', partial: '部分缺失', empty: '数据暂缺', not_connected: '数据待接入',
  upstream_error: '数据服务不可用', server_error: '服务错误', unauthorized: '未登录', forbidden: '权限不足',
  rate_limited: '请求过于频繁',
}
const statusLabel = computed(() => LABELS[props.env.status] || props.env.status)
const isError = computed(() => ['upstream_error', 'server_error', 'unauthorized', 'forbidden', 'rate_limited'].includes(props.env.status))
const errorText = computed(() => ({
  upstream_error: '数据服务暂时不可用，请稍后重试。',
  unauthorized: '登录已失效，请重新登录。',
  forbidden: props.env.detail || '当前等级无法查看该内容。',
  rate_limited: '请求过于频繁，请稍后再试。',
}[props.env.status] || '服务出现错误，请稍后重试。'))
const canJump = computed(() => props.env.latest_available_date && props.env.latest_available_date !== props.env.trade_date)
const gapItems = computed(() => [...new Set((props.env.gaps || []).map((g) => g.item).filter(Boolean))])
</script>
