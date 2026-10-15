## ADDED Requirements

### Requirement: Market overview page
The overview page (`/overview`, API `GET /api/v1/overview`) SHALL answer "今天市场发生了什么" with: trade date, benchmark index code and change, up/down counts and up ratio, turnover in 亿元, and per-source freshness (CNT-002, CNT-004 raw breadth). It MUST NOT show emotion composite score/state, today's decision, report downloads or stock action lists.

#### Scenario: Overview with full data
- **WHEN** all sources return rows for the date
- **THEN** the page shows date, index change, up/down counts, up ratio = up/(up+down), turnover, and a source table with date/coverage/missing

#### Scenario: Up ratio with zero denominator
- **WHEN** up and down counts are both 0 or null
- **THEN** `up_ratio` is `null` and the page shows "—"

### Requirement: Participation and capital environment page
The page `/participation` (API `GET /api/v1/participation`) SHALL show ERP statistics, valuation-side statistics, limit-up structure statistics and raw derivatives indicators as specified in design D3 (CNT-007, CNT-008, CNT-010). First-board premium MUST be annotated "历史观察值，不代表未来收益". It MUST NOT show position budget, participation tiers, valuation state labels, smart-money composite, style leader or next-state outputs. CNT-006 SHALL be reported as a `not_connected` gap.

#### Scenario: Derivatives table
- **WHEN** `derivatives_matrix_json` contains instruments
- **THEN** one row per instrument is shown with basis, basis z-score, position ratio, PCR, PCR z-score, OI-volume z-score and source dates; composite instrument scores are absent

#### Scenario: Missing ERP history
- **WHEN** ERP percentile fields are null upstream
- **THEN** the page shows "历史样本不足" for those fields instead of a number

### Requirement: Industry comparison page
The page `/industries` (API `GET /api/v1/industries?idx_type=`) SHALL provide a switch among 行业板块/概念板块/地域板块, name/code search, a full sortable table of whitelisted fields, and an RRG scatter of `rs_ratio`/`rs_momentum` with reference lines at 100 (CNT-014, CNT-015, CNT-016). Default sort SHALL be `sector_return` descending; all rows SHALL be shown (paged in the UI, never truncated). Quadrant names, quadrant colours, focus/hold/avoid groups, lifecycle phase and opportunity distribution MUST NOT be shown.

#### Scenario: Board type switch
- **WHEN** the user selects 概念板块
- **THEN** the table and RRG show only rows with `idx_type=概念板块`

#### Scenario: Click a sector
- **WHEN** the user clicks a sector row
- **THEN** a panel shows its 5-trading-day series of return, net flow and RRG coordinates from `GET /api/v1/industries/{sector_code}/series`

### Requirement: Sector series completeness
`GET /api/v1/industries/{sector_code}/series?days=N` (N default 5, max 20) SHALL return up to N most recent trading days with data for that sector, found by walking back calendar days from the end date (max 14 + N lookups). If fewer than N dates are found the status MUST be `partial` and the actual dates listed; values MUST NOT be interpolated (CNT-032).

#### Scenario: Holiday gap
- **WHEN** only 3 trading days are found within the lookup budget
- **THEN** the response has 3 points and `status=partial`

### Requirement: Themes and limit-up structure page
The page `/themes` (API `GET /api/v1/themes`) SHALL return `status=not_connected` in v1 and display the required data contract for CNT-022 (题材涨停/炸板数、最高板、平均涨幅、封板时间、题材归属及分母) and CNT-025 (炸板率、涨跌比、连板/断板历史结构). It MUST NOT show decision scores, actions or representative stocks.

#### Scenario: Not connected page
- **WHEN** the user opens `/themes`
- **THEN** the page shows a "数据待接入" state listing required fields and no market numbers

### Requirement: Historical review page
The page `/history` (API `GET /api/v1/history?trade_date=&idx_type=&period=`) SHALL show the full net-flow ranking for the selected period (1d/5d/20d) in 亿元 without truncation (CNT-029) and the structure statistics with numerator and denominator as defined in design D3 (CNT-030). Open5 statistics (CNT-031) SHALL be a `not_connected` gap. It MUST NOT show next-day guidance, market score, risk level or free-text summaries.

#### Scenario: Structure statistic with denominator
- **WHEN** 90 sectors have non-null `sector_return` and 52 are positive
- **THEN** 上涨板块占比 = 52/90 with numerator 52 and denominator 90 displayed

#### Scenario: Date selection
- **WHEN** the user picks a past trade date
- **THEN** all numbers on the page refer to that date and the page header shows it

### Requirement: Event calendar page
The page `/calendar` (API `GET /api/v1/calendar`) SHALL list calendar events within the upstream window with date, time, country/region, type, title, indicator code, period, unit, publication status, previous value, actual value (or "未公布"), third-party consensus value with fixed label "第三方发布的市场预期，非本平台预测", and source-rated importance (CNT-034, CNT-035). Events SHALL be grouped by date ascending. It MUST NOT show risk curves, Price-In, tail risk, impact text, impact asset or transmission paths.

#### Scenario: Unpublished event
- **WHEN** `actual_value` is empty
- **THEN** the page shows "未公布"

#### Scenario: Incomplete window
- **WHEN** `calendar_window.complete` is false
- **THEN** the page shows a warning that the calendar window is incomplete and still lists available events

### Requirement: About page
The page `/about` SHALL render the content-scope registry (delivered / not connected / pending / excluded counts and per-item table), the statistic definitions from design D3, the data source list, and the disclaimer.

#### Scenario: Registry view
- **WHEN** the user opens `/about`
- **THEN** all 37 CNT items are listed with selection, v1 status and reason

### Requirement: Common page frame
Every page SHALL show the data date, a status badge, a fixture banner when `data_mode=fixture`, and the disclaimer footer. Colour SHALL encode only rise/fall direction (red rise, green fall). Upstream errors SHALL show an error state with retry, never stale or placeholder numbers.

#### Scenario: Upstream error on a page
- **WHEN** the API returns `status=upstream_error`
- **THEN** the page shows "数据服务暂不可用" with a retry button and no numbers
