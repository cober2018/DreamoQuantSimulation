import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHead } from '@/components/shell/PageHead'
import { Panel } from '@/components/shell/Panel'
import { Disclaimer } from '@/components/shell/Disclaimer'
import { HaloSegmented } from '@/components/fx/halo-segmented'
import { TrendTile } from '@/components/charts/TrendTile'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getModule } from '@/lib/api'
import { useCan } from '@/lib/auth'

const SEL: Record<string, string> = { keep: '保留设计', exclude: '不迁入', pending: '待定' }
const V1: Record<string, string> = { delivered: '已交付', not_connected: '待接入', pending: '待审', excluded: '不提供' }
const FILTERS = [{ value: '', label: '全部' }, ...Object.entries(V1).map(([value, label]) => ({ value, label }))]
const DEFS: [string, string, string][] = [
  ['上涨占比', '上涨家数 ÷（上涨家数 + 下跌家数）', '板块日表'],
  ['板块涨跌幅', '板块指数当日涨跌，上游为小数（0.015 = +1.5%）', '板块日表'],
  ['成交额 / 资金净流入', '单位亿元；净流入口径以数据中台定义为准', '板块日表'],
  ['上涨板块占比', '涨跌幅 > 0 的板块数 ÷ 涨跌幅非空的板块数', '平台计算'],
  ['成交额前十集中度', '成交额最大的 10 个板块之和 ÷ 全部板块成交额之和', '平台计算'],
  ['资金与价格方向背离比例', '1 日净流入与涨跌幅符号相反的板块数 ÷ 两者均非零的板块数', '平台计算'],
  ['相对旋转图坐标', '相对强度、相对动量原始值，参考线 100；不标注象限含义', '板块日表'],
  ['股债收益差', '盈利收益率 − 10 年期国债收益率；分位缺失表示历史样本不足', '市场情绪日表'],
  ['首板溢价', '上游百分数口径的历史观察值（单位待数据中台确认），不代表未来收益', '市场情绪日表'],
  ['市场预期', '第三方发布的经济数据预期值，非本平台预测', '事件日历'],
]

export function Component() {
  const isAdmin = useCan()('admin.console')
  const [filter, setFilter] = useState('')
  const q = useQuery({ queryKey: ['content-scope'], queryFn: () => getModule('meta/content-scope') })
  const items: any[] = useMemo(() => q.data?.items || [], [q.data])
  const shown = filter ? items.filter((i) => i.v1 === filter) : items
  return (
    <section>
      <PageHead title="数据与内容说明" />
      <div className="grid grid-cols-1 gap-4">
        <Panel title="平台定位">
          <p className="mb-2 text-sm leading-relaxed">本平台只提供证券信息汇总与历史数据统计：已发生的行情、成交、资金、估值、衍生品指标及事件日历事实。不提供证券品种选择、买卖时机、仓位配置或其他投资分析预测建议。</p>
          <p className="text-sm leading-relaxed text-ink-3">数据经数据中台只读服务获取，按字段白名单输出；未登记字段不会出现在任何页面或接口中。数据中台维护期间，个别交易日可能暂缺，页面会如实标注“数据暂缺”，不会用其他日期的数据替代。</p>
        </Panel>

        {isAdmin && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(V1).map(([k, l]) => <TrendTile key={k} label={l} value={items.filter((i) => i.v1 === k).length} format={{ maximumFractionDigits: 0 }} />)}
            </div>
            <Panel title={<>内容范围（CNT-001～037）<small className="ml-2 text-xs font-normal text-ink-3">仅管理员可见</small></>}
              action={<HaloSegmented items={FILTERS} value={filter} onValueChange={setFilter} translucent={false} className="[&_button]:whitespace-nowrap" />}>
              {q.isPending ? <p className="text-sm text-ink-3">加载中…</p> : (
                <Table>
                  <TableHeader><TableRow>{['编号', '原位置', '内容', '去留', '首版状态', '新页面', '说明'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>
                    {shown.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="tnum">{i.id}</TableCell><TableCell>{i.source}</TableCell><TableCell className="whitespace-normal">{i.item}</TableCell>
                        <TableCell>{SEL[i.selection]}</TableCell><TableCell>{V1[i.v1]}</TableCell><TableCell>{i.page}</TableCell>
                        <TableCell className="min-w-56 whitespace-normal text-ink-3">{i.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Panel>
          </>
        )}

        <Panel title="统计口径">
          <Table>
            <TableHeader><TableRow>{['指标', '定义', '来源'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {DEFS.map((d) => <TableRow key={d[0]}><TableCell className="whitespace-nowrap">{d[0]}</TableCell><TableCell className="min-w-64 whitespace-normal">{d[1]}</TableCell><TableCell className="whitespace-nowrap">{d[2]}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </Panel>
      </div>
      <Disclaimer text={q.data?.disclaimer} />
    </section>
  )
}
