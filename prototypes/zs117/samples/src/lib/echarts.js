// 按需引入 ECharts，只打包两页用到的图形和组件；整个模块由 EChart.vue 懒加载
import * as echarts from 'echarts/core'
import { ScatterChart, BarChart, LineChart, HeatmapChart, TreemapChart, CustomChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, GraphicComponent, VisualMapComponent, LegendComponent } from 'echarts/components'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { registerZxThemes } from '@ds/echarts-theme.js'

echarts.use([ScatterChart, BarChart, LineChart, HeatmapChart, TreemapChart, CustomChart, GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, GraphicComponent, VisualMapComponent, LegendComponent, LabelLayout, CanvasRenderer])
registerZxThemes(echarts)
export default echarts
