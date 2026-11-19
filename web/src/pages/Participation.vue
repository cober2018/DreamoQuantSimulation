<template>
  <PageFrame title="参与度与资金环境" question="参与和资金结构相对历史怎样变化？" :env="env" :loading="loading" @retry="load" @jump="tradeDate = $event">
    <template #tools><input type="date" v-model="tradeDate" aria-label="交易日" /></template>

    <div class="mods">
      <section id="participation-heat" class="panel mod wide" v-module="'observation'" aria-labelledby="participation-heat-title">
        <h2 id="participation-heat-title">参与热度与成交<small>参与是在升温还是降温，低参与持续了几天</small><DateTag :date="obs.trade_date" :page-date="env.trade_date" /></h2>
        <div class="grid">
          <div class="stat" v-ind="'participation.observation.total_amount_billion'"><div class="label">全市场成交额</div><div class="value">{{ fmt.num(obs.total_amount_billion, 0) }} 亿元</div><div class="sub">{{ fmt.num(obs.count_stocks, 0) }} 只股票 · 与总览同一口径</div></div>
          <div class="stat" v-ind="'participation.observation.amount_ratio_20d'"><div class="label">成交额 / 前 20 日中位数</div><div class="value">{{ fmt.num(obs.amount_ratio_20d, 2) }} 倍</div></div>
          <div class="stat" v-ind="'participation.observation.participation_pctile_60d'"><div class="label">成交额分位（60 日）</div><div class="value">{{ fmt.num(obs.participation_pctile_60d, 1) }}</div><div class="sub">0–100，不含当日</div></div>
          <div class="stat" v-ind="'participation.observation.low_participation_streak'"><div class="label">低参与连续天数</div><div class="value">{{ fmt.num(obs.low_participation_streak, 0) }} 交易日</div></div>
        </div>
      </section>

      <section id="participation-pressure" class="panel mod" v-module="'observation'" aria-labelledby="participation-pressure-title">
        <h2 id="participation-pressure-title">卖压相对强度<small>抛售压力在高位还是低位，最近是增强还是缓和</small></h2>
        <div class="grid one">
          <div class="stat" v-ind="'participation.observation.active_sell_ratio'"><div class="label">主动卖出占比</div><div class="value">{{ fmt.ratio(obs.active_sell_ratio) }}</div></div>
          <div class="stat" v-ind="'participation.observation.sell_pressure_change_1d'"><div class="label">卖压缓和程度（1 日变化，正值为缓和）</div><div class="value">{{ fmt.signed(obs.sell_pressure_change_1d, 3) }}</div></div>
          <div class="stat" v-ind="'participation.observation.sell_pressure_change_3d'"><div class="label">近 3 日卖压趋势（斜率，正值为缓和）</div><div class="value">{{ fmt.signed(obs.sell_pressure_change_3d, 4) }}</div></div>
        </div>
      </section>

      <section id="participation-erp" class="panel mod" v-module="'erp'" aria-labelledby="participation-erp-title">
        <h2 id="participation-erp-title">股债收益差<small>股票相对债券的收益补偿处在历史什么位置<span v-if="openText('erp')">{{ openText('erp') }}</span></small></h2>
        <div class="grid one">
          <div class="stat" v-ind="'participation.erp.erp_value_pct'"><div class="label">股债收益差</div><div class="value">{{ pctPoint(erp.erp_value_pct) }}</div><div class="sub">盈利收益率 {{ fmt.ratio(erp.earnings_yield, 2) }} · 10 年期国债 {{ pctPoint(erp.yield_10y) }}</div></div>
          <div class="stat" v-ind="'participation.erp.erp_change_5d_pct'"><div class="label">5 日变化</div><div class="value">{{ pp(erp.erp_change_5d_pct) }}</div></div>
          <div class="stat" v-ind="'participation.erp.erp_change_20d_pct'"><div class="label">20 日变化</div><div class="value">{{ pp(erp.erp_change_20d_pct) }}</div></div>
        </div>
        <div class="band" aria-label="股债收益差历史位置">
          <div class="band-row" v-for="b in bandRows" :key="b.key" :id="`${b.key}-band`">
            <span class="band-label">{{ b.label }}</span>
            <div class="track" aria-hidden="true">
              <i v-if="b.pos != null" class="dot" :style="{ left: b.pos + '%' }" />
            </div>
            <b class="band-value" v-ind="`participation.erp.${b.key}`">{{ pctl(b.value) }}</b>
          </div>
          <p class="note">历史位置为近各窗口内的分位（0 最低，100 最高），只描述历史相对水平。</p>
        </div>
      </section>

      <section id="participation-derivatives" class="panel mod wide" v-module="'derivatives'" aria-labelledby="participation-derivatives-title">
        <h2 id="participation-derivatives-title">衍生品标准分矩阵<small>哪个品种偏离常态；颜色只表示偏离方向和幅度，不代表好坏</small></h2>
        <div class="table-wrap">
          <table class="heat" aria-describedby="participation-derivatives-note">
            <thead><tr><th class="left">品种</th><th v-for="c in MATRIX_COLS" :key="c.key">{{ c.label }}</th></tr></thead>
            <tbody>
              <tr v-for="row in matrix" :key="row.instrument">
                <td class="left">{{ row.label }}</td>
                <td v-for="cell in row.cells" :key="cell.key" :class="{ na: cell.value == null }" :style="{ background: zTone(cell.value) }" :title="cell.value == null ? (row.missing_reason || '上游未提供该值') : ''">{{ zText(cell.value) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!matrix.length" class="placeholder">当日衍生品标准分暂缺（数据待更新）。</p>
        <ul v-if="matrixGaps.length" class="gaps">
          <li v-for="g in matrixGaps" :key="g.instrument">{{ g.label }}：{{ g.missing_reason }}</li>
        </ul>
        <p id="participation-derivatives-note" class="note">标准分为 60 日标准分，0 为均值；缺值显示「数据待更新」，不按 0 处理。蓝色为偏低，橙色为偏高。</p>

        <h3 class="sub-title">近 60 个交易日标准分</h3>
        <div class="seg" style="margin-bottom:10px">
          <button v-for="m in DH_METRICS" :key="m.key" :class="{ on: dhMetric === m.key }" @click="dhMetric = m.key">{{ m.label }}</button>
        </div>
        <div class="table-wrap">
          <table class="deriv-heat">
            <thead><tr><th class="left">品种</th><th v-for="d in dhDates" :key="d">{{ d.slice(5) }}</th></tr></thead>
            <tbody>
              <tr v-for="ins in dhInstruments" :key="ins">
                <td class="left">{{ INST_LABEL[ins] || ins }}</td>
                <td v-for="d in dhDates" :key="d" :class="dhCellClass(ins, d)" :title="dhCellTitle(ins, d)">{{ dhCellText(ins, d) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="note">STAR50 基差为代理值，不显示。</p>
      </section>

      <section id="participation-style" class="panel mod wide" v-module="'style'" aria-labelledby="participation-style-title">
        <h2 id="participation-style-title">风格强弱<small>成长、红利、大盘三类风格谁强谁弱，近期怎么变<DateTag v-if="styleCamps[0]?.source_date" :date="styleCamps[0]?.source_date" :page-date="env.trade_date" /></small></h2>
        <template v-if="styleCamps.length">
          <div class="grid">
            <div class="stat" v-for="c in styleCamps" :key="c.key">
              <div class="label">{{ c.label }}<span v-if="c.index_name" class="muted"> · {{ c.index_name }}</span></div>
              <div class="value">{{ fmt.num(c.strength_score, 1) }}</div>
              <div class="sub">z 分（20 日） {{ fmt.signed(c.z_score, 3) }}</div>
            </div>
          </div>
          <EChart v-if="styleCamps.some((c) => c.strength_series?.length)" :option="styleOption" height="240px" />
        </template>
        <p class="note">{{ styleData?.definition || '强度分为阵营指数相对强度的历史评分（0–100）' }}；横轴为观测序号，当前为近 20 个观测；按固定阵营顺序展示，不按强度排序，不提供 leader/signal 结论。</p>
      </section>
    </div>
    <div class="panel" v-if="partHist?.rows?.length" v-module="'observation'">
      <h2>参与热度与成交<small>近 60 个交易日 · 原始统计</small></h2>
      <EChart :option="heatOption" height="260px" />
    </div>
    <div class="panel" v-if="partHist?.rows?.length" v-module="'observation'">
      <h2>卖压相对强度<small>近 60 个交易日 · 数值越高压力越强</small></h2>
      <EChart :option="pressOption" height="220px" />
    </div>
    <div class="panel" v-if="compHist?.rows?.length" v-module="'erp'">
      <h2>股权风险补偿（逐日）<small>盈利收益率 − 10 年期国债收益率</small></h2>
      <EChart :option="compOption" height="220px" />
    </div>
    <div class="panel" v-if="valHasData" v-module="'valuation'">
      <h2>估值端统计<small>原始统计</small></h2>
      <div class="grid">
        <div class="stat"><div class="label">全市场市盈率中位数</div><div class="value">{{ fmt.num(val.current_pe_median) }}</div></div>
        <div class="stat"><div class="label">近 90 日市盈率中位数</div><div class="value">{{ fmt.num(val.hist_90d_pe_median) }}</div></div>
        <div class="stat"><div class="label">破净股占比</div><div class="value">{{ val.break_ratio_pct == null ? '数据待更新' : fmt.num(val.break_ratio_pct, 2) + '%' }}</div></div>
        <div class="stat"><div class="label">折价比例</div><div class="value">{{ val.discount_pct == null ? '数据待更新' : fmt.num(val.discount_pct, 2) + '%' }}</div></div>
      </div>
    </div>
    <div class="panel" v-if="bc" v-module="'bottom'">
      <h2>底部条件观察<small>原始统计 · 样本 {{ fmt.num(bc.history_obs, 0) }} 个交易日</small></h2>
      <div class="grid">
        <div class="stat" v-for="c in bc.conditions" :key="c.key">
          <div class="label">{{ c.label }}</div>
          <div class="value">{{ fmt.num(c.value, 1) }} <span class="muted">/ 阈值 {{ fmt.num(c.threshold, 1) }}</span></div>
        </div>
      </div>
      <p class="note">{{ bc.note }}</p>
    </div>
    <div class="panel" v-if="deriv.length" v-module="'derivatives'">
      <h2>股指衍生品原始指标<small>原始值与标准分，缺失显示「数据待更新」</small></h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th class="left">品种</th><th>基差</th><th>基差标准分（60 日）</th><th>持仓比</th><th>认沽认购比</th><th>认沽认购比标准分（60 日）</th><th>成交持仓比标准分（60 日）</th><th class="left">数据日</th></tr></thead>
          <tbody>
            <tr v-for="r in deriv" :key="r.instrument">
              <td class="left">{{ INST_LABEL[r.instrument] || r.instrument }}</td>
              <td>{{ r.basis_value == null ? '数据待更新' : fmt.num(r.basis_value, 3) }}</td>
              <td>{{ r.basis_zscore_60d == null ? '数据待更新' : fmt.num(r.basis_zscore_60d, 2) }}</td>
              <td>{{ r.position_ratio == null ? '数据待更新' : fmt.num(r.position_ratio, 3) }}</td>
              <td>{{ r.pcr_value == null ? '数据待更新' : fmt.num(r.pcr_value, 3) }}</td>
              <td>{{ r.pcr_zscore_60d == null ? '数据待更新' : fmt.num(r.pcr_zscore_60d, 2) }}</td>
              <td>{{ r.oi_volume_crowding_zscore_60d == null ? '数据待更新' : fmt.num(r.oi_volume_crowding_zscore_60d, 2) }}</td>
              <td class="left">{{ r.basis_source_date || r.position_source_date || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="note">z 分为相对近 60 个交易日的标准化位置，仅描述历史相对水平。</p>
    </div>
  </PageFrame>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { loadSupplement } from '../supplement'
import PageFrame from '../components/PageFrame.vue'
import EChart from '../components/EChart.vue'
import DateTag from '../components/DateTag.vue'
import { fmt } from '../api'
import { openText, useModule } from '../useModule'

const tradeDate = ref('')
const { env, loading, load } = useModule('participation', () => ({ trade_date: tradeDate.value }))
const obs = computed(() => env.value.data?.participation_observation || {})
const erp = computed(() => env.value.data?.erp || {})
const deriv = computed(() => env.value.data?.derivatives || [])
const val = computed(() => env.value.data?.valuation || {})
const valHasData = computed(() => Object.values(val.value).some((v) => v != null))
const bc = computed(() => env.value.data?.bottom_conditions || null)
const partHist = ref(null)
const compHist = ref(null)
async function loadHist() {
  const td = env.value.trade_date || undefined
  ;[partHist.value, compHist.value] = await Promise.all([loadSupplement('participation_history', td), loadSupplement('compensation_history', td)])
}
watch(() => env.value.trade_date, loadHist)
onMounted(loadHist)
const heatOption = computed(() => {
  const rows = partHist.value?.rows || []
  return { grid: { left: 44, right: 16, top: 30, bottom: 24 }, tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: rows.map((r) => r.date) },
    yAxis: { type: 'value', name: '亿元' },
    series: [{ name: '市场总成交额', type: 'bar', data: rows.map((r) => r.turnover) }] }
})
const pressOption = computed(() => {
  const rows = partHist.value?.rows || []
  return { grid: { left: 44, right: 16, top: 16, bottom: 24 }, tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: rows.map((r) => r.date) }, yAxis: { type: 'value', min: 0, max: 100, name: '卖压相对强度' },
    series: [{ name: '卖压相对强度', type: 'line', data: rows.map((r) => r.selling_pressure_pct) }] }
})
const compOption = computed(() => {
  const rows = compHist.value?.rows || []
  return { grid: { left: 44, right: 16, top: 16, bottom: 24 }, tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: rows.map((r) => r.date) }, yAxis: { type: 'value', name: '%' },
    series: [{ name: '股权风险补偿', type: 'line', data: rows.map((r) => r.compensation_pct) }] }
})
const dhRows = computed(() => env.value.data?.derivatives_history || [])
const styleData = computed(() => env.value.data?.style_strength || null)
const styleCamps = computed(() => styleData.value?.camps || [])

// 上游 *_pct 字段已是百分数；分位为 0–100 的数值，缺失多因历史样本不足
const num = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const pctPoint = (v) => (num(v) == null ? '—' : `${num(v).toFixed(2)}%`)
const pp = (v) => (num(v) == null ? '—' : `${num(v) > 0 ? '+' : ''}${num(v).toFixed(2)} pp`)
const pctl = (v) => (num(v) == null ? '数据待更新' :`${num(v).toFixed(1)}%`)

const bandRows = computed(() => [
  { key: 'erp_percentile_252d', label: '近 252 日', value: erp.value.erp_percentile_252d },
  { key: 'erp_percentile_3y', label: '近 3 年', value: erp.value.erp_percentile_3y },
  { key: 'erp_percentile_5y', label: '近 5 年', value: erp.value.erp_percentile_5y },
].map((b) => ({ ...b, pos: num(b.value) == null ? null : Math.min(Math.max(num(b.value), 0), 100) })))

// 标准分矩阵：当日各品种的 60 日标准分；颜色用蓝橙，不用涨跌色（标准分不代表涨跌）
const MATRIX_COLS = [
  { key: 'basis_zscore_60d', label: '基差标准分' },
  { key: 'pcr_zscore_60d', label: '认沽认购比标准分' },
  { key: 'oi_volume_crowding_zscore_60d', label: '成交持仓比标准分' },
]
const INST_LABEL = { HS300: '沪深300', CSI500: '中证500', SSE50: '上证50', CSI1000: '中证1000', STAR50: '科创50' }
const matrix = computed(() => deriv.value.map((r) => ({
  instrument: r.instrument,
  label: INST_LABEL[r.instrument] || r.instrument || '—',
  missing_reason: r.missing_reason || null,
  cells: MATRIX_COLS.map((c) => ({ key: c.key, value: num(r[c.key]) })),
})))
const matrixGaps = computed(() => matrix.value.filter((row) => row.missing_reason))
const zText = (v) => (v == null ? '数据待更新' :`${v > 0 ? '+' : ''}${v.toFixed(2)}`)
const zTone = (v) => {
  if (v == null) return ''
  const a = (Math.min(Math.abs(v) / 3, 1) * 0.5).toFixed(2)
  return v >= 0 ? `hsl(28 85% 50% / ${a})` : `hsl(214 70% 48% / ${a})`
}

// 近 60 日标准分历史（已上线，保留）
const DH_METRICS = [
  { key: 'basis_zscore_60d', label: '基差标准分' },
  { key: 'pcr_zscore_60d', label: '认沽认购比标准分' },
  { key: 'oi_volume_ratio_zscore_60d', label: '成交持仓比标准分' },
]
const dhMetric = ref('basis_zscore_60d')
const dhDates = computed(() => [...new Set(dhRows.value.map((r) => r.trade_date))].sort())
const dhInstruments = computed(() => ['HS300', 'SSE50', 'CSI500', 'CSI1000', 'STAR50'].filter((i) => dhRows.value.some((r) => r.instrument === i)))
const dhCell = (ins, d) => dhRows.value.find((r) => r.instrument === ins && r.trade_date === d) || null
const dhValue = (ins, d) => num(dhCell(ins, d)?.[dhMetric.value])
const dhCellText = (ins, d) => zText(dhValue(ins, d))
const dhCellTitle = (ins, d) => { const r = dhCell(ins, d); return r?.missing_reason ? `原因：${r.missing_reason}` : '' }
const dhCellClass = (ins, d) => (dhValue(ins, d) == null ? 'muted' : '')

const styleOption = computed(() => {
  const first = styleCamps.value.find((c) => c.strength_series?.length)
  const n = first ? first.strength_series.length : 0
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: styleCamps.value.map((c) => c.label) },
    grid: { left: 44, right: 16, top: 34, bottom: 26 },
    xAxis: { type: 'category', data: Array.from({ length: n }, (_, i) => `#${i + 1}`) },
    yAxis: { type: 'value', scale: true },
    series: styleCamps.value
      .filter((c) => c.strength_series?.length)
      .map((c) => ({ name: c.label, type: 'line', data: c.strength_series, showSymbol: false })),
  }
})
</script>

<style scoped>
.mods { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.mod { margin-bottom: 0; min-width: 0; }
.mod.wide { grid-column: 1 / -1; }
.mod h2 small { display: block; font-weight: 400; color: var(--muted); font-size: 12px; margin-top: 2px; }
.mod h2 small .date-tag { margin-left: 8px; }
.grid.one { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.sub-title { font-size: 14px; font-weight: 600; margin: 20px 0 8px; }
.placeholder { border: 1px dashed var(--line); border-radius: var(--radius); color: var(--muted); font-size: 13px; line-height: 1.6; padding: 12px 14px; margin: 12px 0 0; }
.band { margin-top: 12px; display: grid; gap: 8px; }
.band-row { display: grid; grid-template-columns: 72px minmax(0, 1fr) 96px; align-items: center; gap: 8px; font-size: 13px; }
.band-label { color: var(--muted); }
.track { position: relative; height: 8px; border-radius: 4px; background: linear-gradient(90deg, hsl(214 40% 88%), hsl(28 50% 88%)); }
.dot { position: absolute; top: 50%; width: 12px; height: 12px; border-radius: 50%; background: var(--accent); border: 2px solid var(--panel); transform: translate(-50%, -50%); }
.band-value { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
.gaps { font-size: 12px; color: var(--muted); padding-left: 18px; margin: 8px 0 0; }
table.heat { table-layout: fixed; }
table.heat th, table.heat td { text-align: center; font-variant-numeric: tabular-nums; padding: 8px 6px; }
table.heat th { white-space: normal; line-height: 1.3; font-size: 12px; }
table.heat td.na { color: var(--muted); background: transparent; }
@media (max-width: 900px) { .mods { grid-template-columns: minmax(0, 1fr); } }
</style>
