<template>
  <PageFrame title="题材与涨跌结构" question="当日涨停、跌停、炸板如何分布，连板和题材集中在哪里？" :env="env" :loading="loading" @retry="load" @jump="tradeDate = $event">
    <template #tools><input type="date" v-model="tradeDate" aria-label="交易日" /></template>

    <div class="modules">
      <section id="themes-limit-structure" class="panel mod wide" v-module="'structure'" aria-labelledby="themes-limit-structure-title">
        <h2 id="themes-limit-structure-title">涨停结构<small>涨停、跌停、炸板、封板率、最高连板，附前一日对比与近 10 日走势</small></h2>
        <div v-if="kpis.length" class="kpi-grid">
          <div v-for="k in kpis" :key="k.key" :id="`themes-kpi-${k.key}`" class="stat kpi" v-ind="k.ind">
            <div class="label">{{ k.label }}</div>
            <div class="value">{{ k.text }}</div>
            <div class="sub">{{ k.delta }}</div>
            <div v-if="k.spark" role="img" :aria-label="`${k.label}近 10 日走势，当日${k.text}`">
              <EChart :option="k.spark" height="44px" />
            </div>
            <p v-else class="placeholder">待接入：近 10 日历史（pool-structure · history）</p>
          </div>
        </div>
        <p v-else class="placeholder">待接入：股票池结构（pool-structure · current）当日缺失。</p>
      </section>

      <section id="themes-board-ladder" class="panel mod" v-module="'structure'" aria-labelledby="themes-board-ladder-title">
        <h2 id="themes-board-ladder-title">连板梯队<small>1 板到最高板各有多少家，只计数</small></h2>
        <EChart v-if="tiers.length" :option="ladderOption" height="240px" />
        <p v-else class="placeholder">当日没有连板梯队数据（theme-limit-stats · ladder）。</p>
      </section>

      <section id="themes-theme-limit-up" class="panel mod" v-module="'themes'" aria-labelledby="themes-theme-limit-up-title">
        <h2 id="themes-theme-limit-up-title">题材涨停数<small>涨停只数前 15 的题材</small></h2>
        <EChart v-if="topThemes.length" :option="themeOption" :height="themeHeight" />
        <p v-else class="placeholder">当日没有进入题材榜的行业。</p>
        <p class="note">{{ rule }}</p>
      </section>

      <section id="themes-seal-time" class="panel mod" v-module="'themes'" aria-labelledby="themes-seal-time-title">
        <h2 id="themes-seal-time-title">封板时间分布<small>涨停首次封板所在时段的只数</small></h2>
        <div v-if="env.data?.detail_locked" class="lock-card">封板时间分布属于下钻明细，需要 {{ session.user?.perm_min_role?.['data.detail'] || '更高等级' }}。<router-link v-if="payOn()" to="/plans">查看会员套餐</router-link></div>
        <p v-else class="placeholder">待接入：全市场按时段的涨停只数（theme-limit-stats · seal-time）。现有 seal_time_buckets 只给时段名称；题材行里的时段计数会把同一只股票计入多个题材，不能加总成分布。</p>
      </section>
    </div>
  </PageFrame>
</template>

<script setup>
import { computed, ref } from 'vue'
import PageFrame from '../components/PageFrame.vue'
import EChart from '../components/EChart.vue'
import { fmt } from '../api'
import { useModule } from '../useModule'
import { payOn, session } from '../auth'

const tradeDate = ref('')
const { env, loading, load } = useModule('themes', () => ({ trade_date: tradeDate.value }))
const st = computed(() => env.value.data?.structure || null)
const tiers = computed(() => env.value.data?.board_tiers || [])
const themes = computed(() => env.value.data?.themes || [])
const rule = computed(() => env.value.data?.theme_member_rule || '')

// 历史按交易日升序；前一日取当前交易日的前一条，缺当日记录时不做对比
const hist = computed(() => [...(env.value.data?.history || [])].sort((a, b) => a.trade_date.localeCompare(b.trade_date)))
const recent = computed(() => hist.value.slice(-10))
const prevDay = computed(() => {
  const i = hist.value.findIndex((h) => h.trade_date === env.value.trade_date)
  return i > 0 ? hist.value[i - 1] : null
})

// 连板高度：「3板」→3，「首板」→1；无法解析返回 null
const tierHeight = (label) => {
  const s = String(label ?? '')
  const m = s.match(/\d+/)
  if (m) return Number(m[0])
  return /首/.test(s) ? 1 : null
}
// 封板率 = 涨停 ÷（涨停 + 炸板），与炸板率互补
const sealRate = (limitUp, broken) => {
  if (limitUp == null || broken == null) return null
  const den = limitUp + broken
  return den > 0 ? limitUp / den : null
}
const maxBoard = computed(() => {
  const hs = tiers.value.filter((t) => t.count > 0).map((t) => tierHeight(t.tier)).filter((n) => n != null)
  return hs.length ? Math.max(...hs) : null
})

const sparkOption = (data) => ({
  grid: { left: 2, right: 2, top: 4, bottom: 2 },
  xAxis: { type: 'category', show: false, boundaryGap: false, data: recent.value.map((h) => h.trade_date) },
  yAxis: { type: 'value', show: false, scale: true },
  series: [{ type: 'line', data, symbol: 'none', connectNulls: true, lineStyle: { width: 1.5, color: '#d0342c' } }],
})

const kpis = computed(() => {
  const s = st.value
  if (!s) return []
  const p = prevDay.value
  const hs = recent.value
  const defs = [
    { key: 'limit-up', label: '涨停', ind: 'themes.structure.limit_up_count', kind: 'count',
      cur: s.limit_up_count, prev: p?.limit_up_count, series: hs.map((h) => h.limit_up_count) },
    { key: 'limit-down', label: '跌停', ind: 'themes.structure.limit_down_count', kind: 'count',
      cur: s.limit_down_count, prev: p?.limit_down_count, series: hs.map((h) => h.limit_down_count) },
    { key: 'broken', label: '炸板', ind: 'themes.structure.broken_board_count', kind: 'count',
      cur: s.broken_board_count, prev: p?.broken_board_count, series: hs.map((h) => h.broken_board_count) },
    { key: 'seal-rate', label: '封板率', ind: 'themes.structure.broken_board_rate', kind: 'rate',
      cur: sealRate(s.limit_up_count, s.broken_board_count), prev: sealRate(p?.limit_up_count, p?.broken_board_count),
      series: hs.map((h) => sealRate(h.limit_up_count, h.broken_board_count)) },
    { key: 'max-board', label: '最高连板', ind: 'themes.structure.ladder', kind: 'board',
      cur: maxBoard.value, prev: tierHeight(p?.max_ladder), series: hs.map((h) => tierHeight(h.max_ladder)) },
  ]
  return defs.map((k) => {
    const text = k.cur == null ? '—' : k.kind === 'rate' ? fmt.ratio(k.cur) : k.kind === 'board' ? `${k.cur} 板` : fmt.num(k.cur, 0)
    let delta = '较前一日：—'
    if (k.cur != null && k.prev != null) {
      const d = k.kind === 'rate' ? (k.cur - k.prev) * 100 : k.cur - k.prev
      const unit = k.kind === 'rate' ? ' 个百分点' : k.kind === 'board' ? ' 板' : ''
      delta = `较前一日 ${d > 0 ? '+' : ''}${fmt.num(d, k.kind === 'rate' ? 1 : 0)}${unit}`
    }
    const valid = k.series.filter((v) => v != null).length >= 2
    return { ...k, text, delta, spark: valid ? sparkOption(k.series) : null }
  })
})

const ladderOption = computed(() => ({
  grid: { left: 40, right: 12, top: 16, bottom: 28 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: tiers.value.map((t) => t.tier) },
  yAxis: { type: 'value', minInterval: 1 },
  series: [{ name: '家数', type: 'bar', data: tiers.value.map((t) => t.count), barMaxWidth: 36, itemStyle: { color: '#d0342c' } }],
}))

// 涨停只数为空的题材不入图，避免画成 0
const topThemes = computed(() => themes.value
  .filter((t) => t.up_count != null)
  .sort((a, b) => b.up_count - a.up_count)
  .slice(0, 15))
const themeHeight = computed(() => `${Math.max(topThemes.value.length, 1) * 28 + 40}px`)
const themeOption = computed(() => ({
  grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (ps) => {
      const t = topThemes.value[ps[0].dataIndex]
      return `${t.industry}<br/>涨停 ${t.up_count} 只<br/>最高板 ${t.highest_tier ?? '暂无'}`
    },
  },
  xAxis: { type: 'value', minInterval: 1 },
  yAxis: { type: 'category', inverse: true, data: topThemes.value.map((t) => t.industry) },
  series: [{ name: '涨停只数', type: 'bar', barMaxWidth: 18, data: topThemes.value.map((t) => t.up_count), itemStyle: { color: '#d0342c' } }],
}))
</script>

<style scoped>
.modules { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
.mod.wide { grid-column: 1 / -1; }
.mod h2 small { display: block; font-weight: 400; color: var(--muted); font-size: 12px; margin-top: 2px; }
.kpi-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.kpi .value { font-size: 20px; }
.placeholder { color: var(--muted); font-size: 13px; margin: 8px 0 0; }
@media (max-width: 900px) { .modules { grid-template-columns: minmax(0, 1fr); } }
</style>
