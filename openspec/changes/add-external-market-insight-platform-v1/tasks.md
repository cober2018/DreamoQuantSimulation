## 1. 仓库骨架

- [x] 1.1 初始化独立仓库结构（`backend/`、`web/`、`docs/source/`、`scripts/sandbox/`、`.gitignore`、根 README）
- [x] 1.2 冻结两份输入文档副本并记录 SHA-256

## 2. 内容范围（insight-content-scope）

- [x] 2.1 `content_scope.py`：37 条 CNT 注册表（selection / v1_status / page / reason），启动自检
- [x] 2.2 禁止键守卫：递归扫描响应键名，命中即失败关闭
- [x] 2.3 固定免责声明常量

## 3. 数据供应（insight-data-supply）

- [x] 3.1 `config.py`：环境变量（上游地址/Key、数据模式、环境、访问令牌、缓存 TTL），生产 + 夹具拒绝启动
- [x] 3.2 `upstream.py`：records 客户端（超时、错误映射、分页、去重、TTL 缓存）与夹具源
- [x] 3.3 `projection.py`：字段映射与 JSON 路径取值工具
- [x] 3.4 统一信封构造与状态判定
- [x] 3.5 访问令牌中间件（health 放行）
- [x] 3.6 夹具：情绪/前瞻风险真实样本行、行业与日历合成行

## 4. 模块接口（insight-pages API）

- [x] 4.1 `GET /api/v1/overview`
- [x] 4.2 `GET /api/v1/participation`
- [x] 4.3 `GET /api/v1/industries` 与 `/industries/{sector_code}/series`
- [x] 4.4 `GET /api/v1/themes`（not_connected + 字段合同）
- [x] 4.5 `GET /api/v1/history`（资金排行 + 结构统计含分子分母）
- [x] 4.6 `GET /api/v1/calendar`（剔除 fallback 事件）
- [x] 4.7 `GET /api/v1/meta/content-scope`、`GET /api/v1/health`

## 5. 前端（insight-pages UI）

- [x] 5.1 Vite + Vue 3 + vue-router + ECharts 工程，开发代理注入令牌
- [x] 5.2 公共框架：导航、日期选择、状态徽标、夹具横幅、来源表、免责声明、错误重试
- [x] 5.3 市场总览页
- [x] 5.4 参与度与资金环境页
- [x] 5.5 行业比较页（板块类型切换、搜索、排序表、RRG 原始坐标、单板块序列面板）
- [x] 5.6 题材与涨跌结构页（待接入）
- [x] 5.7 历史复盘页（期间切换、全量资金排行、结构统计）
- [x] 5.8 事件日历页
- [x] 5.9 数据与内容说明页

## 6. 验证

- [x] 6.1 `scripts/sandbox/` 验证脚本：注册表完整性、禁止键守卫、投影剔除、状态语义（上游错误/空/分页重复）、令牌、生产夹具拒绝、隔离性 grep
- [x] 6.2 后端夹具模式启动 + 全部接口实测
- [x] 6.3 前端构建 + 浏览器逐页检查（含错误态）
- [x] 6.4 实连数据中台冒烟（本变更当时无 Key 未执行；已由第三期 `integrate-insight-live-api-and-recompose-pages-v1` 4.2 对生产数据中台完成 6/6 页实连冒烟）
- [x] 6.5 更新 README（背景、结构、已完成、TODO、关键决策、依赖与启动）
