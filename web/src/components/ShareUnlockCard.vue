<template>
  <details class="unlock-card">
    <summary>
      <strong>{{ item.display_title || '限售股解禁' }}</strong>
      <span class="badge">{{ item.publication_status_label || '—' }}</span>
      <span class="muted">{{ item.event_date }}</span>
    </summary>
    <dl class="unlock-facts">
      <div><dt>解禁股票</dt><dd>{{ fmt.num(item.stock_count, 0) }} 只</dd></div>
      <div><dt>解禁股数</dt><dd>{{ item.total_float_shares == null ? '—' : fmt.num(item.total_float_shares / 10000, 2) + ' 万股' }}</dd></div>
      <div>
        <dt>参考市值</dt>
        <dd>{{ item.total_float_value_ref == null ? '—' : fmt.num(item.total_float_value_ref / 1e8, 2) + ' 亿元' }}
          <span class="muted note-inline">按 {{ item.ref_close_date || '—' }} 收盘价估算</span></dd>
      </div>
    </dl>
    <table v-if="(item.top_stocks || []).length" class="calendar-table">
      <thead><tr><th class="left">代码</th><th class="left">名称</th><th>解禁股数（万股）</th><th>占总股本（%）</th><th>参考市值（亿元）</th></tr></thead>
      <tbody>
        <tr v-for="s in item.top_stocks.slice(0, 5)" :key="s.stock_code">
          <td class="left">{{ s.stock_code }}</td>
          <td class="left">{{ s.stock_name }}</td>
          <td>{{ s.float_shares == null ? '—' : fmt.num(s.float_shares / 10000, 2) }}</td>
          <td>{{ s.float_ratio_pct == null ? '—' : fmt.num(s.float_ratio_pct, 2) }}</td>
          <td>{{ s.float_value_ref == null ? '—' : fmt.num(s.float_value_ref / 1e8, 2) }}</td>
        </tr>
      </tbody>
    </table>
    <p class="note">只列事实：解禁日期、股数、占比和估算市值。不代表对股价的判断。</p>
  </details>
</template>

<script setup>
import { fmt } from '../api'
defineProps({ item: { type: Object, required: true } })
</script>

<style scoped>
.unlock-card { border: 1px solid var(--line); border-radius: var(--radius); padding: 10px 12px; margin-bottom: 8px; background: var(--panel); }
.unlock-card summary { cursor: pointer; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.unlock-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; margin: 10px 0; }
.unlock-facts dt { color: var(--muted); font-size: 12px; }
.unlock-facts dd { margin: 2px 0 0; font-variant-numeric: tabular-nums; }
.note-inline { font-size: 12px; margin-left: 6px; }
</style>
