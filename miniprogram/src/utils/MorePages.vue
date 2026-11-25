<template>
  <view class="card" v-if="session.user">
    <view class="card-title">{{ all ? '全部页面' : '更多数据' }}</view>
    <view class="more">
      <view v-for="p in list" :key="p.url" class="more-item" @click="go(p)">
        <view class="more-name">{{ p.name }}<text v-if="!can(p.perm)" class="lock"> 🔒 {{ need(p.perm) }}</text></view>
        <view class="muted sub">{{ p.desc }}</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { session } from './auth'

// 入口只负责导航与锁定提示；能否看到数据由服务端按角色权限判断
const PAGES = [
  { name: '市场总览', url: '/pages/index/index', perm: 'page.overview', tab: true, desc: '大盘、涨跌家数与成交' },
  { name: '参与度与资金环境', url: '/pages/mood/index', perm: 'page.participation', tab: true, desc: '参与度、股债收益差、涨停结构' },
  { name: '行业比较与轮动', url: '/pages/industry/index', perm: 'page.industries', tab: true, desc: '行业涨跌、资金与序列' },
  { name: '题材与涨跌结构', url: '/pages/theme/index', perm: 'page.themes', tab: true, desc: '题材统计、梯队与封板时间' },
  { name: '开盘五分钟与板块统计', url: '/pages/history/index', perm: 'page.history', desc: '开盘五分钟统计、板块结构、资金全量排行' },
  { name: '事件日历', url: '/pages/calendar/index', perm: 'page.calendar', desc: '宏观事件、前值与公布值' },
]
const props = defineProps({ all: Boolean })
const list = computed(() => (props.all ? PAGES : PAGES.filter((p) => !p.tab)))
const can = (perm) => (session.user?.permissions || []).includes(perm) || (session.user?.permissions || []).includes('*')
const need = (perm) => session.user?.perm_min_role?.[perm] || '会员'
const go = (p) => (p.tab ? uni.switchTab({ url: p.url }) : uni.navigateTo({ url: p.url }))
</script>

<style>
.more { display: flex; flex-wrap: wrap; }
.more-item { width: 50%; padding: 12rpx 0; }
.more-name { font-weight: 600; }
.lock { color: #8a5a00; font-size: 22rpx; font-weight: 400; }
.sub { font-size: 22rpx; }
</style>
