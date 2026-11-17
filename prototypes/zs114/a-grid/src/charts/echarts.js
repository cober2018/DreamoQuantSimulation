// 按需引入，只打包用到的图形与组件
import * as echarts from 'echarts/core'
import { ScatterChart, BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, AriaComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { registerThemes } from './echarts-theme.js'

echarts.use([ScatterChart, BarChart, LineChart, GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, AriaComponent, GraphicComponent, CanvasRenderer])
registerThemes(echarts)
export default echarts
