## ADDED Requirements

### Requirement: Consistent page order
每个数据页 SHALL 按这个顺序排列：标题和数据日期 → 核心数字卡片 → 主图 → 明细表 → 口径说明 → 数据来源 → 免责声明。口径说明和数据来源 MUST 默认折叠。

#### Scenario: Source table collapsed
- **WHEN** 用户打开任意一个数据页
- **THEN** "数据来源与覆盖"默认折叠，点击可以展开

### Requirement: Friendly states
加载中、空数据、上游不可用、未登录、权限不足、请求太频繁，每种状态 SHALL 用一句白话说明，并给出下一步操作（重试、登录、查看套餐、稍后再试）。页面 MUST NOT 显示原始错误码或内部服务名，服务名改为中文名称。

#### Scenario: Upstream down
- **WHEN** 上游返回 502
- **THEN** 页面显示"数据服务暂时不可用，请稍后重试"和"重试"按钮，不显示任何数值

### Requirement: Per-page audit fixes
实施时 SHALL 逐页检查 Web 7 个页面和小程序 5 个页面，修正发现的逻辑和排版问题（比如数值格式不统一、长列表没有搜索、手机宽度下溢出），每一项写进 `findings.md`。修正 MUST 只调整已审定内容的展示，不新增内容条目，也不加入建议性的表述。

#### Scenario: Audit recorded
- **WHEN** 某页修正了一个问题
- **THEN** `findings.md` 里有这一项的位置、问题和改法

### Requirement: Mobile width
Web 页面在 375px 宽度下 SHALL 没有横向滚动条。宽表格放在可以横向滚动的容器里，侧边栏改成顶部菜单。

#### Scenario: Phone width
- **WHEN** 在 375px 宽度下打开行业页
- **THEN** 页面本身不能横向滚动，表格在自己的容器里横向滚动
