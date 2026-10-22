<template>
  <PageFrame title="事件日历" question="哪些事件已公布、将公布，事实是什么？" :env="env" :loading="loading" @retry="load" @jump="tradeDate = $event">
    <template #tools><input type="date" v-model="tradeDate" aria-label="数据日" /></template>

    <div v-if="win.complete === false" class="banner fixture">日历窗口不完整，以下仅列出已取得的事件。</div>
    <div class="panel">
      <h2>事件列表<small>窗口 {{ win.start_date || '—' }} 至 {{ win.end_date || '—' }}</small></h2>
      <div v-if="!events.length" class="empty-state">窗口内暂无已登记事件。</div>
      <div v-for="(list, day) in grouped" :key="day" style="margin-bottom:14px">
        <h3 style="font-size:14px;margin:10px 0 6px">{{ day }}</h3>
        <div class="table-wrap">
          <table class="calendar-table">
            <colgroup><col style="width:70px"><col style="width:90px"><col><col style="width:130px"><col style="width:80px"><col style="width:90px"><col style="width:80px"><col style="width:70px"><col style="width:90px"></colgroup>
            <thead><tr><th class="left">时间</th><th class="left">国家/地区</th><th class="left">事件</th><th class="left">周期 · 单位</th><th>前值</th><th>市场预期*</th><th>公布值</th><th class="left">状态</th><th>来源重要性</th></tr></thead>
            <tbody>
              <tr v-for="e in list" :key="e.event_id">
                <td class="left">{{ e.event_time || '待定' }}</td>
                <td class="left">{{ e.country || '—' }}</td>
                <td class="left wrap"><strong>{{ e.title }}</strong> <span class="muted" v-if="e.indicator_code && e.indicator_code !== 'UNKNOWN'">{{ e.event_type_label }} {{ e.indicator_code }}</span><span class="muted" v-else-if="e.event_type_label">{{ e.event_type_label }}</span></td>
                <td class="left">{{ [e.period, e.unit].filter(Boolean).join(' · ') || '—' }}</td>
                <td>{{ e.previous_value || '—' }}</td>
                <td>{{ e.consensus_value || '—' }}</td>
                <td><strong>{{ e.actual_value || '未公布' }}</strong></td>
                <td class="left">{{ PUB[e.publication_status] || e.publication_status || '—' }}</td>
                <td>{{ e.source_importance != null ? '★'.repeat(Number(e.source_importance)) || '—' : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p class="note">* {{ env.data?.consensus_label }}；来源重要性为数据源自身评级。</p>
    </div>
  </PageFrame>
</template>

<script setup>
import { computed, ref } from 'vue'
import PageFrame from '../components/PageFrame.vue'
import { useModule } from '../useModule'

const PUB = { published: '已公布', scheduled: '待公布', revised: '已修正', delayed: '延期' }
const tradeDate = ref('')
const { env, loading, load } = useModule('calendar', () => ({ trade_date: tradeDate.value }))
const win = computed(() => env.value.data?.window || {})
const events = computed(() => env.value.data?.events || [])
const grouped = computed(() => events.value.reduce((acc, e) => {
  (acc[e.event_date || '日期未定'] ||= []).push(e)
  return acc
}, {}))
</script>
