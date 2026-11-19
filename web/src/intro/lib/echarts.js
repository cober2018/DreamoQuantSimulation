// 按需引入 ECharts，只打包本原型用到的图形和组件；整个模块由 EChart.vue 懒加载
import * as echarts from 'echarts/core'
import { ScatterChart, BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { registerZxThemes } from '../ds/echarts-theme.js'

echarts.use([ScatterChart, BarChart, LineChart, GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, GraphicComponent, CanvasRenderer])
registerZxThemes(echarts)
export default echarts
