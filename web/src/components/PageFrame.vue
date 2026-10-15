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
      <button class="btn" @click="$emit('retry')">重试</button>
    </div>
    <div v-else-if="env.status === 'empty'" class="empty-state">所选日期没有可用数据。</div>
    <template v-else>
      <slot />
    </template>

    <div v-if="!loading && env.gaps && env.gaps.length" class="panel">
      <h2>未提供或不完整的内容</h2>
      <ul class="gaps">
        <li v-for="g in env.gaps" :key="g.content_id + g.reason">{{ g.content_id }} {{ g.item }}：{{ g.reason }}</li>
      </ul>
    </div>

    <div v-if="!loading && env.sources && env.sources.length" class="panel">
      <h2>数据来源与覆盖</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>服务</th><th>数据日</th><th>快照时间</th><th>覆盖率</th><th class="left">缺失来源</th></tr></thead>
        <tbody>
          <tr v-for="s in env.sources" :key="s.service_key">
            <td>{{ s.service_key }}</td>
            <td>{{ s.source_date || '无该日数据' }}</td>
            <td>{{ s.snapshot_time || '—' }}</td>
            <td>{{ fmt.ratio(s.coverage_ratio) }}</td>
            <td class="left wrap">{{ s.missing_sources?.length ? s.missing_sources.join('、') : '—' }}</td>
          </tr>
        </tbody>
      </table></div>
    </div>

    <footer class="footer">{{ DISCLAIMER }}</footer>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { fmt } from '../api'

const DISCLAIMER = '本平台仅提供证券信息汇总与历史数据统计，不构成任何证券投资建议。'
const props = defineProps({
  title: String,
  question: String,
  env: { type: Object, default: () => ({}) },
  loading: Boolean,
})
defineEmits(['retry'])

const LABELS = {
  ok: '数据完整', partial: '部分缺失', empty: '无数据', not_connected: '数据待接入',
  upstream_error: '数据服务不可用', server_error: '服务错误', unauthorized: '未登录', forbidden: '权限不足',
  rate_limited: '请求过于频繁',
}
const statusLabel = computed(() => LABELS[props.env.status] || props.env.status)
const isError = computed(() => ['upstream_error', 'server_error', 'unauthorized', 'forbidden', 'rate_limited'].includes(props.env.status))
const errorText = computed(() => ({
  upstream_error: '数据服务暂不可用，未展示任何数值。',
  unauthorized: '登录已失效，请重新登录。',
  forbidden: props.env.detail || '当前账号权限不足，该内容需要更高等级。可在“我的账号”使用邀请码升级。',
  rate_limited: props.env.detail || '请求过于频繁，请稍后再试。',
}[props.env.status] || '服务出现错误，未展示任何数值。'))
</script>
