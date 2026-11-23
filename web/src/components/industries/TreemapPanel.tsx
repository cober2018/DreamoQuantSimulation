import { Panel } from '@/components/shell/Panel'
import { EChart } from '@/components/charts/EChart'
import { CHART_H } from '@/components/industries/RrgChart'
import { fmt } from '@/lib/api'
import { isPending } from '@/lib/industryPending'
import { withAlpha } from '@/lib/rrg'
import { useTokens } from '@/lib/useTokens'

// 面积为成交额；红涨绿跌，涨跌幅绝对值越大颜色越深（0 到 3% 对应透明度 0.35 到 1）
export function TreemapPanel({ items, day, selected, onSelect }: { items: any[]; day: string; selected: string; onSelect: (code: string) => void }) {
  const t = useTokens()
  const shown = items.filter((r) => r.amount > 0 && !isPending('amount', r, day))
  const total = shown.reduce((a, r) => a + r.amount, 0)
  const nodes = shown.map((r) => {
    const base = r.sector_return == null ? t['viz-5'] : r.sector_return >= 0 ? t.up : t.down
    const strength = r.sector_return == null ? 0.5 : 0.35 + 0.65 * Math.min(Math.abs(r.sector_return) / 0.03, 1)
    const isSel = r.sector_code === selected
    // 有选中时，其余块的透明度乘 0.4；选中块加墨色描边
    const alpha = selected && !isSel ? strength * 0.4 : strength
    return {
      name: r.sector_name, code: r.sector_code, value: r.amount, ret: r.sector_return,
      itemStyle: { color: withAlpha(base, alpha), ...(isSel ? { borderColor: t.ink, borderWidth: 3 } : {}) },
      // 色块太小就不写字，免得满图都是截断的「示…」：占比 0.9% 以上写名称和涨跌幅，0.35% 以上只写名称，再小不写（悬停可看）
      label: { color: alpha < 0.7 ? t.ink : '#fff', show: r.amount / total >= 0.0035, formatter: r.amount / total >= 0.009 ? `${r.sector_name}\n${fmt.pct(r.sector_return)}` : r.sector_name },
    }
  })
  const option = {
    animationDuration: 700,
    tooltip: { formatter: (p: any) => `${p.name}<br/>成交额 ${fmt.num(p.value, 1)} 亿元<br/>涨跌幅 ${fmt.pct(p.data.ret)}` },
    series: [{
      // 新版 ECharts 树图自带边距，再写 width/height 100% 会整体偏移、右下被裁掉；四边贴满容器
      type: 'treemap', roam: false, nodeClick: false, breadcrumb: { show: false }, left: 0, top: 0, right: 0, bottom: 0, data: nodes,
      label: { show: true, fontSize: 12, overflow: 'truncate' },
      itemStyle: { borderColor: t.surface, borderWidth: 2, gapWidth: 2 }, levels: [],
    }],
  }
  return (
    <Panel title="涨跌与成交地图" hint="面积为成交额，颜色为涨跌（红涨绿跌），点击色块选中行业" className="h-full">
      {nodes.length === 0 ? <div role="status" className="py-16 text-center text-sm text-ink-3">数据待更新</div> : <EChart option={option} height={CHART_H} ariaLabel="涨跌与成交地图" onClick={(p) => p.data?.code && onSelect(p.data.code)} />}
      <p className="mt-3 text-[11px] leading-relaxed text-ink-3">成交额早于 2026-09-18 或为空的行业不计入面积，显示「数据待更新」，不以 0 计。已计入 {nodes.length} 个行业，待更新 {items.length - nodes.length} 个。</p>
    </Panel>
  )
}
