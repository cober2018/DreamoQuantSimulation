import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import type { EChartsCoreOption } from 'echarts/core'
import { EffectScatterChart, LineChart, ScatterChart, TreemapChart } from 'echarts/charts'
import { GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { registerZxThemes } from '@/lib/zx/echarts-theme.js'
import { useTheme } from '@/stores/theme'

// ECharts 只给旋转图和树图用（Recharts 做不了），按需引入，且只被行业页引用，其他页面不加载
echarts.use([ScatterChart, EffectScatterChart, LineChart, TreemapChart, GridComponent, TooltipComponent, MarkLineComponent, LabelLayout, CanvasRenderer])
registerZxThemes(echarts)

export function EChart({ option, height = 360, className, ariaLabel, onClick }: { option: EChartsCoreOption; height?: number | string; className?: string; ariaLabel?: string; onClick?: (params: any) => void }) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  const latest = useRef(option)
  latest.current = option
  const click = useRef(onClick)
  click.current = onClick
  const mode = useTheme((s) => s.mode)

  // 主题只能在 init 时指定，切换亮暗要重建实例
  useEffect(() => {
    const node = el.current
    if (!node) return
    const c = echarts.init(node, mode === 'dark' ? 'zx-dark' : 'zx-light')
    chart.current = c
    c.setOption(latest.current)
    c.on('click', (p: any) => click.current?.(p))
    const ro = new ResizeObserver(() => c.resize())
    ro.observe(node)
    return () => { ro.disconnect(); c.dispose(); chart.current = null }
  }, [mode])
  // 只替换系列、保留坐标轴：选中等更新不会让坐标轴和整张图重放入场动画
  useEffect(() => { chart.current?.setOption(option, { replaceMerge: ['series'] }) }, [option])

  return <div ref={el} className={className} style={{ height }} role="img" aria-label={ariaLabel} />
}
