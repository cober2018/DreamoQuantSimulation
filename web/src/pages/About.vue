<template>
  <section>
    <header class="page-head"><h1>数据与内容说明</h1></header>
    <div class="panel">
      <h2>平台定位</h2>
      <p>本平台只提供证券信息汇总与历史数据统计：已发生的行情、成交、资金、估值、衍生品指标及事件日历事实。
        不提供证券品种选择、买卖时机、仓位配置或其他投资分析预测建议。</p>
      <p class="muted">数据经 DreamO 数据中台只读服务获取，网关按字段白名单投影后输出；未登记字段不会出现在任何页面或接口中。</p>
    </div>

    <div class="grid" style="margin-bottom:16px">
      <div class="stat" v-for="s in summary" :key="s.k"><div class="label">{{ s.l }}</div><div class="value">{{ s.n }}</div></div>
    </div>

    <div class="panel">
      <h2>内容范围（CNT-001～037）</h2>
      <div class="toolbar">
        <div class="seg">
          <button v-for="f in FILTERS" :key="f.v" :class="{ on: filter === f.v }" @click="filter = f.v">{{ f.l }}</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th class="left">编号</th><th class="left">原位置</th><th class="left">内容</th><th class="left">去留</th><th class="left">首版状态</th><th class="left">新页面</th><th class="left">说明</th></tr></thead>
          <tbody>
            <tr v-for="i in shown" :key="i.id">
              <td class="left">{{ i.id }}</td><td class="left">{{ i.source }}</td><td class="left">{{ i.item }}</td>
              <td class="left">{{ SEL[i.selection] }}</td><td class="left">{{ V1[i.v1] }}</td>
              <td class="left">{{ i.page }}</td><td class="left muted" style="white-space:normal">{{ i.reason }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <h2>统计口径</h2>
      <table>
        <thead><tr><th class="left">指标</th><th class="left">定义</th><th class="left">来源</th></tr></thead>
        <tbody>
          <tr v-for="d in DEFS" :key="d[0]"><td class="left">{{ d[0] }}</td><td class="left" style="white-space:normal">{{ d[1] }}</td><td class="left">{{ d[2] }}</td></tr>
        </tbody>
      </table>
    </div>
    <footer class="footer">{{ disclaimer }}</footer>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { getModule } from '../api'

const SEL = { keep: '保留设计', exclude: '不迁入', pending: '待定' }
const V1 = { delivered: '已交付', not_connected: '待接入', pending: '待审', excluded: '不提供' }
const FILTERS = [{ v: '', l: '全部' }, { v: 'delivered', l: '已交付' }, { v: 'not_connected', l: '待接入' }, { v: 'pending', l: '待审' }, { v: 'excluded', l: '不提供' }]
const DEFS = [
  ['上涨占比', '上涨家数 ÷（上涨家数 + 下跌家数）', 'review-industry 大盘上下文列'],
  ['板块涨跌幅', '板块指数当日涨跌，上游为小数（0.015 = +1.5%）', 'review-industry'],
  ['成交额 / 资金净流入', '单位亿元；净流入口径以数据中台定义为准', 'review-industry'],
  ['上涨板块占比', '涨跌幅 > 0 的板块数 ÷ 涨跌幅非空的板块数', '网关计算'],
  ['成交额前十集中度', '成交额最大的 10 个板块之和 ÷ 全部板块成交额之和', '网关计算'],
  ['资金与价格方向背离比例', '1 日净流入与涨跌幅符号相反的板块数 ÷ 两者均非零的板块数', '网关计算'],
  ['RRG 坐标', 'RS-Ratio / RS-Momentum 原始值，参考线 100；不标注象限含义', 'review-industry'],
  ['ERP', '盈利收益率 − 10 年期国债收益率；分位缺失表示历史样本不足', 'review-market-sentiment'],
  ['首板溢价', '上游百分数口径的历史观察值（单位待数据中台确认），不代表未来收益', 'review-market-sentiment'],
  ['市场预期', '第三方发布的经济数据预期值，非本平台预测', 'review-forward-risk 日历'],
]

const items = ref([])
const disclaimer = ref('')
const filter = ref('')
getModule('meta/content-scope').then((b) => { items.value = b.items || []; disclaimer.value = b.disclaimer || '' })
const shown = computed(() => (filter.value ? items.value.filter((i) => i.v1 === filter.value) : items.value))
const summary = computed(() => ['delivered', 'not_connected', 'pending', 'excluded'].map((k) => ({
  k, l: V1[k], n: items.value.filter((i) => i.v1 === k).length,
})))
</script>
