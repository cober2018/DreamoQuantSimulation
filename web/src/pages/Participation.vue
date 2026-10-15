<template>
  <PageFrame title="参与度与资金环境" question="参与和资金结构相对历史怎样变化？" :env="env" :loading="loading" @retry="load">
    <template #tools><input type="date" v-model="tradeDate" aria-label="交易日" /></template>

    <div class="panel" v-if="obs">
      <h2>市场参与与卖压<small>原始统计，数据日 {{ obs.trade_date }}</small></h2>
      <div class="grid">
        <div class="stat"><div class="label">全市场成交额</div><div class="value">{{ fmt.num(obs.total_amount_billion, 0) }} 亿元</div><div class="sub">{{ fmt.num(obs.count_stocks, 0) }} 只股票</div></div>
        <div class="stat"><div class="label">成交额 / 前 20 日中位数</div><div class="value">{{ fmt.num(obs.amount_ratio_20d, 2) }} 倍</div></div>
        <div class="stat"><div class="label">成交额分位（60 日）</div><div class="value">{{ fmt.num(obs.participation_pctile_60d, 1) }}</div><div class="sub">0–100，不含当日</div></div>
        <div class="stat"><div class="label">成交额分位（250 日）</div><div class="value">{{ fmt.num(obs.participation_pctile_250d, 1) }}</div></div>
        <div class="stat"><div class="label">低参与连续天数</div><div class="value">{{ fmt.num(obs.low_participation_streak, 0) }}</div></div>
        <div class="stat"><div class="label">主动卖出占比</div><div class="value">{{ fmt.ratio(obs.active_sell_ratio) }}</div></div>
        <div class="stat"><div class="label">卖出占比 1 日变化</div><div class="value">{{ fmt.signed(obs.sell_pressure_change_1d, 3) }}</div></div>
        <div class="stat"><div class="label">卖出占比 3 日趋势</div><div class="value">{{ fmt.signed(obs.sell_pressure_change_3d, 4) }}</div></div>
        <div class="stat"><div class="label">委托失衡</div><div class="value">{{ fmt.signed(obs.order_imbalance, 3) }}</div><div class="sub">1 日变化 {{ fmt.signed(obs.order_imbalance_delta_1d, 3) }}</div></div>
      </div>
      <p class="note">分位为相对此前历史窗口的位置，只描述历史相对水平，不是概率或参与人数比例；数据状态 {{ obs.data_status }}。</p>
    </div>

    <div class="panel">
      <h2>股权风险溢价（ERP）<small>可用 {{ erp.available_count ?? '—' }}/{{ erp.total_count ?? '—' }} 项</small></h2>
      <div class="grid">
        <div class="stat"><div class="label">ERP</div><div class="value">{{ pctPoint(erp.erp_value_pct) }}</div><div class="sub">盈利收益率 − 10 年期国债收益率</div></div>
        <div class="stat"><div class="label">盈利收益率</div><div class="value">{{ fmt.ratio(erp.earnings_yield, 2) }}</div></div>
        <div class="stat"><div class="label">10 年期国债收益率</div><div class="value">{{ pctPoint(erp.yield_10y) }}</div><div class="sub">来源 {{ erp.yield_source_flag || '—' }}</div></div>
        <div class="stat"><div class="label">ERP 5 日变化</div><div class="value">{{ pp(erp.erp_change_5d_pct) }}</div></div>
        <div class="stat"><div class="label">ERP 20 日变化</div><div class="value">{{ pp(erp.erp_change_20d_pct) }}</div></div>
        <div class="stat"><div class="label">近 252 日分位</div><div class="value">{{ pctl(erp.erp_percentile_252d) }}</div></div>
        <div class="stat"><div class="label">近 3 年分位</div><div class="value">{{ pctl(erp.erp_percentile_3y) }}</div></div>
        <div class="stat"><div class="label">近 5 年分位</div><div class="value">{{ pctl(erp.erp_percentile_5y) }}</div></div>
      </div>
    </div>

    <div class="panel">
      <h2>估值端统计<small>可用 {{ val.available_count ?? '—' }}/{{ val.total_count ?? '—' }} 项</small></h2>
      <div class="grid">
        <div class="stat"><div class="label">全市场市盈率中位数</div><div class="value">{{ fmt.num(val.current_pe_median) }}</div></div>
        <div class="stat"><div class="label">近 90 日市盈率中位数</div><div class="value">{{ fmt.num(val.hist_90d_pe_median) }}</div></div>
        <div class="stat"><div class="label">破净股占比</div><div class="value">{{ pctPoint(val.break_ratio_pct) }}</div></div>
        <div class="stat"><div class="label">折价比例</div><div class="value">{{ pctPoint(val.discount_pct) }}</div></div>
      </div>
    </div>

    <div class="panel">
      <h2>涨停结构（当日观察）</h2>
      <div class="grid">
        <div class="stat"><div class="label">封板率</div><div class="value">{{ fmt.ratio(lu.seal_rate) }}</div></div>
        <div class="stat"><div class="label">连板股数</div><div class="value">{{ fmt.num(lu.consecutive_board_count, 0) }}</div></div>
        <div class="stat"><div class="label">最高连板天数</div><div class="value">{{ fmt.num(lu.max_consecutive_days, 0) }}</div></div>
        <div class="stat"><div class="label">首板溢价</div><div :class="['value', fmt.dir(lu.first_board_premium)]">{{ fmt.signed(lu.first_board_premium) }}%</div></div>
        <div class="stat"><div class="label">回封率</div><div class="value">{{ fmt.ratio(lu.broken_repair_rate) }}</div></div>
      </div>
      <p class="note">{{ lu.note }}</p>
    </div>

    <div class="panel">
      <h2>股指衍生品原始指标</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>品种</th><th>基差</th><th>基差 z(60日)</th><th>多空持仓比</th><th>PCR</th><th>PCR z(60日)</th><th>持仓/成交 z(60日)</th><th>数据日</th><th class="left">缺失说明</th></tr></thead>
          <tbody>
            <tr v-for="r in deriv" :key="r.instrument">
              <td>{{ r.instrument }}</td>
              <td>{{ fmt.num(r.basis_value, 3) }}</td>
              <td>{{ fmt.num(r.basis_zscore_60d) }}</td>
              <td>{{ fmt.num(r.position_ratio, 3) }}</td>
              <td>{{ fmt.num(r.pcr_value, 3) }}</td>
              <td>{{ fmt.num(r.pcr_zscore_60d) }}</td>
              <td>{{ fmt.num(r.oi_volume_crowding_zscore_60d) }}</td>
              <td>{{ r.basis_source_date || r.position_source_date || '—' }}</td>
              <td class="left muted">{{ r.missing_reason || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="note">z 分为相对近 60 个交易日的标准化位置，仅描述历史相对水平。</p>
    </div>
  </PageFrame>
</template>

<script setup>
import { computed, ref } from 'vue'
import PageFrame from '../components/PageFrame.vue'
import { fmt } from '../api'
import { useModule } from '../useModule'

const tradeDate = ref('')
const { env, loading, load } = useModule('participation', () => ({ trade_date: tradeDate.value }))
const obs = computed(() => env.value.data?.participation_observation || null)
const erp = computed(() => env.value.data?.erp || {})
const val = computed(() => env.value.data?.valuation || {})
const lu = computed(() => env.value.data?.limit_up_structure || {})
const deriv = computed(() => env.value.data?.derivatives || [])
// 上游 *_pct 字段已是百分数；分位为 0~1 小数，缺失多因历史样本不足
const pctPoint = (v) => (v == null ? '—' : `${Number(v).toFixed(2)}%`)
const pp = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(2)} pp`)
// 上游分位为 0–100 的数值 (如 51.19), 不是 0–1 小数
const pctl = (v) => (v == null ? '历史样本不足' : `${Number(v).toFixed(1)}%`)
</script>
