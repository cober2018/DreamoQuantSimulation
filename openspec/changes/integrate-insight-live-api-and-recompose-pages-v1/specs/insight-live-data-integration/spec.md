## ADDED Requirements

### Requirement: Authenticated upstream only
新平台后端 SHALL 仅通过数据中台已登记且鉴权的 records 服务获取数据；上游 Key MUST 只存在于后端进程环境，不得出现在浏览器可达的代码、响应、日志或仓库中。

#### Scenario: Key is not exposed
- **WHEN** 构建生产前端并检查产物与全部 HTTP 响应
- **THEN** 产物与响应中不含上游 Key 或其前缀

#### Scenario: Missing key in live mode
- **WHEN** 以 live 模式启动但未配置上游 Key
- **THEN** 进程拒绝启动并给出配置错误

### Requirement: Fixture is not a production path
生产环境 SHALL NOT 使用夹具数据；上游不可用时 MUST 显示"数据暂不可用"，不得回退到夹具或旧值。

#### Scenario: Upstream failure
- **WHEN** 上游返回 401、403、5xx 或超时
- **THEN** 对应模块 `availability=unavailable` 并带原因类别，页面显示"数据暂不可用"，不展示过期数值

#### Scenario: ADS row not ready
- **WHEN** 上游响应 `source_mode=ads_not_ready`
- **THEN** 模块按"当日未就绪"处理，不把空值显示为 0

### Requirement: Previously unconnected content is connected
CNT-006、CNT-022、CNT-025、CNT-031 SHALL 接入对应数据中台服务并按字段允许清单投影；接入后注册表状态 MUST 更新为已交付并记录来源服务。

#### Scenario: Theme statistics delivered
- **WHEN** 请求题材模块的某交易日
- **THEN** 响应含题材涨停/炸板数、最高板、平均涨幅、封板时间，来源为题材 ADS 与涨跌停明细服务，且无决策分、动作建议等禁止字段

#### Scenario: Partial detail is labeled
- **WHEN** 明细服务因行数上限只取到部分
- **THEN** 模块标 `partial` 并说明实际行数与总数，不宣称完整

### Requirement: Upstream call budget
后端 SHALL 缓存上游结果：历史交易日长缓存、最新交易日短缓存、未就绪不缓存；多用户访问同一数据 MUST NOT 按用户数放大上游请求。

#### Scenario: Shared cache
- **WHEN** 100 个用户在 1 分钟内打开同一页面的同一交易日
- **THEN** 每个上游服务对该参数组合只被请求一次

### Requirement: Forbidden-key guard stays fail-closed
任何模块响应在返回前 SHALL 经禁止键守卫；守卫发现禁止键时 MUST 返回 500，不得放行或静默删除。

#### Scenario: Forbidden key detected
- **WHEN** 上游返回的行含禁止键且被投影遗漏
- **THEN** 守卫使该请求返回 500 并记录模块名
