<template>
  <div class="landing">
    <header class="top">
      <div class="wrap top-row">
        <span class="logo"><img src="/brand/zhishu-logo-horizontal.png" alt="知数量化" /></span>
        <router-link class="btn" to="/login">登录</router-link>
      </div>
    </header>

    <section class="hero">
      <div class="wrap">
        <h1>知数星耀</h1>
        <p class="lead">A 股盘后数据，按固定页面整理好。</p>
        <p class="desc">每天复盘要翻的数据：指数和涨跌家数、成交和参与度、行业板块、涨停题材、未来事件日程，整理成几张固定的页面。按交易日更新，每页标出数据日期，指标附定义。</p>
        <div class="actions">
          <router-link class="btn primary big" :to="{ path: '/login', query: { mode: 'register' } }">免费注册</router-link>
          <router-link class="btn big" to="/login">已有账号，登录</router-link>
        </div>
        <p v-if="trialDate" class="muted small">试用期内全部页面可用，至 {{ trialDate }}。</p>
      </div>
    </section>

    <section class="wrap block">
      <h2>解决什么问题</h2>
      <div class="cards two">
        <div class="card">
          <h3>复盘省时间</h3>
          <p>不用在多个网站和软件之间来回切换。当天的市场概况、板块表现、涨停结构和事件日程，按固定顺序放在一起。</p>
        </div>
        <div class="card">
          <h3>平台独有的统计口径</h3>
          <p>除常规行情统计外，平台还自行计算一组观察指标：成交参与度历史分位、主动卖出占比、风格强弱分、板块扩散度、开盘五分钟统计、股债收益差观察。每个指标附定义和数据日期，只描述市场状态，不预测涨跌。</p>
        </div>
      </div>
    </section>

    <section class="wrap block">
      <h2>能看到什么</h2>
      <div class="cards three">
        <div class="card" v-for="p in pages" :key="p.title">
          <h3>{{ p.title }}</h3>
          <p>{{ p.text }}</p>
        </div>
      </div>
    </section>

    <section class="wrap block">
      <h2>怎么开始用</h2>
      <ol class="steps">
        <li>注册账号：设置用户名和密码，阅读并同意用户协议与隐私政策。</li>
        <li>登录后从「市场总览」开始，在左侧切换各页。</li>
        <li>每页顶部可以选择交易日。所选日期没有数据时页面会明确提示，不拿其他日期代替。</li>
      </ol>
    </section>

    <section class="wrap block">
      <h2>试用说明</h2>
      <ul class="steps">
        <li>试用期内，注册用户可以使用全部页面<template v-if="trialDate">，截止 {{ trialDate }}</template>。</li>
        <li>试用期结束后的安排会提前在站内公告。</li>
      </ul>
    </section>

    <footer class="foot">
      <div class="wrap">
        <p>本平台提供市场数据与历史统计，仅供研究和学习参考，不构成任何投资建议、证券推荐或交易指令。数据可能存在延迟、缺失或误差，请以交易所及上市公司的官方披露为准。</p>
        <p class="links">
          <router-link to="/terms">用户协议与隐私政策</router-link>
          <a href="https://www.dreamotech.cn/" rel="noopener" target="_blank">梦氧科技官网</a>
          <a href="https://beian.miit.gov.cn/" rel="noopener" target="_blank">浙ICP备2024135110号</a>
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'

const pages = [
  { title: '市场总览', text: '主要指数涨跌、涨跌家数、成交额，以及数据来源与覆盖情况。' },
  { title: '参与度与资金环境', text: '成交参与度分位、主动卖出占比、股债收益差观察、衍生品持仓统计、风格强弱。' },
  { title: '行业比较与轮动', text: '行业、概念、地域板块的涨跌、成交、换手、资金净流入，以及近期序列。' },
  { title: '题材与涨跌结构', text: '涨停和炸板数、连板梯队、首次封板时间分布、股票池计数。' },
  { title: '历史复盘', text: '按日期回看以上数据，以及开盘五分钟统计。' },
  { title: '事件日历', text: '未来两周的宏观数据和事件日程。' },
]

// 试用截止日从网关读取，不写死；接口不可用或试用已结束就不显示日期
const trialDate = ref('')
onMounted(async () => {
  try {
    const r = await fetch('/api/v1/meta/trial')
    const d = r.ok ? await r.json() : null
    // until 是截止日次日 00:00（北京时间），减 1 秒取截止日
    if (d?.until) trialDate.value = new Date((d.until - 1) * 1000).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })
  } catch { /* 不显示日期即可 */ }
})
</script>

<style scoped>
.landing { background: var(--bg); min-height: 100vh; color: var(--text); }
.wrap { max-width: 1040px; margin: 0 auto; padding: 0 16px; }
.top { background: var(--panel); border-bottom: 1px solid var(--line); }
.top-row { display: flex; align-items: center; justify-content: space-between; height: 56px; }
.logo img { height: 28px; display: block; }
.hero { background: var(--panel); border-bottom: 1px solid var(--line); padding: 56px 0 48px; }
.hero h1 { font-size: 32px; margin: 0 0 8px; }
.lead { font-size: 20px; margin: 0 0 16px; font-weight: 500; }
.desc { max-width: 720px; line-height: 1.8; color: var(--muted); margin: 0 0 24px; }
.actions { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
.btn.big { padding: 10px 20px; font-size: 15px; }
.small { font-size: 13px; }
.block { padding: 36px 16px 4px; }
.block h2 { font-size: 20px; margin: 0 0 16px; }
.cards { display: grid; gap: 16px; }
.cards.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cards.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; }
.card h3 { font-size: 16px; margin: 0 0 8px; }
.card p { margin: 0; line-height: 1.7; color: var(--muted); font-size: 14px; }
.steps { margin: 0; padding-left: 20px; line-height: 2; }
.foot { margin-top: 40px; border-top: 1px solid var(--line); background: var(--panel); padding: 24px 0; font-size: 13px; color: var(--muted); }
.foot p { margin: 0 0 8px; line-height: 1.7; }
.links { display: flex; flex-wrap: wrap; gap: 16px; }
@media (max-width: 760px) {
  .hero { padding: 36px 0 32px; }
  .hero h1 { font-size: 26px; }
  .lead { font-size: 17px; }
  .cards.two, .cards.three { grid-template-columns: minmax(0, 1fr); }
}
</style>
