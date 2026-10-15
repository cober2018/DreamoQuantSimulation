| 测试项 | 结果 |
|---|---|
| 注册表 37 条且编号连续 | ✅ |
| 非保留项无一 delivered | ✅ |
| /api/v1/overview 白名单/内容ID/声明/夹具标识 | ✅ |
| /api/v1/participation 白名单/内容ID/声明/夹具标识 | ✅ |
| /api/v1/industries 白名单/内容ID/声明/夹具标识 | ✅ |
| /api/v1/industries?idx_type=概念板块 白名单/内容ID/声明/夹具标识 | ✅ |
| /api/v1/industries/BK1003/series 白名单/内容ID/声明/夹具标识 | ✅ |
| /api/v1/themes 白名单/内容ID/声明/夹具标识 | ✅ |
| /api/v1/history 白名单/内容ID/声明/夹具标识 | ✅ |
| /api/v1/history?period=20d 白名单/内容ID/声明/夹具标识 | ✅ |
| /api/v1/calendar 白名单/内容ID/声明/夹具标识 | ✅ |
| 行业行字段恰为白名单 | ✅ |
| 行业默认按当日涨跌幅降序且不截断 | ✅ |
| 资金排行全量不截断 | ✅ |
| 结构统计含分子分母 | ✅ |
| 日历剔除 fallback 占位事件 | ✅ |
| 7 日序列满额 ok | ✅ |
| 序列不足标 partial 且不插值 | ✅ |
| 未知板块返回 empty | ✅ |
| 非法日期参数 422 | ✅ |
| 非法板块类型 422 | ✅ |
| 历史日期可选 | ✅ |
| 题材页 not_connected 且无内容ID | ✅ |
| 禁止键守卫失败关闭 500 且无数据 | ✅ |
| 上游 5xx → 502 upstream_error 且无数据 | ✅ |
| API Key 只走上游请求头 | ✅ |
| 上游 0 行 → 200 empty | ✅ |
| 上游结构不符 → 502 | ✅ |
| 分页重复 → 去重并 partial | ✅ |
| 交易日取自行而非上游回显 latest | ✅ |
| 坏 JSON 列 → 字段 null + partial | ✅ |
| 配置令牌时无令牌 401 | ✅ |
| 错误令牌 401 | ✅ |
| 正确令牌 200 | ✅ |
| health 免令牌 | ✅ |
| production + fixture 拒绝启动 | ✅ |
| live 无 Key 拒绝启动 | ✅ |
| 与旧平台零代码引用 | ✅ |

38/38 通过
