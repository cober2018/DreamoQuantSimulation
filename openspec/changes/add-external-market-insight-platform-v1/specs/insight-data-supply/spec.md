## ADDED Requirements

### Requirement: Data platform as the only data source
The system SHALL obtain market data only through the DreamO data platform endpoint `GET {INSIGHT_UPSTREAM_BASE_URL}/api/v1/data/apis/{service_key}/records` using services `review-market-sentiment`, `review-industry` and `review-forward-risk`. The system MUST NOT import code from, connect to databases of, or read files of the original DreamO platform.

#### Scenario: Upstream request
- **WHEN** a module needs industry rows for a trade date
- **THEN** the gateway calls `review-industry/records` with `trade_date`, optional `idx_type`, `limit=500` and `offset`, and nothing else

#### Scenario: Code isolation
- **WHEN** the repository is searched for imports of `dreamo_platform`, `domains`, `apps.api` or the original repository path
- **THEN** no match is found

### Requirement: Server-side credential
The data platform API key SHALL be read from `INSIGHT_UPSTREAM_API_KEY` on the server and sent only in the upstream `X-API-Key` header. It MUST NOT appear in any response, log line or frontend bundle.

#### Scenario: Key not exposed
- **WHEN** any endpoint is called
- **THEN** the response body and headers do not contain the API key value

### Requirement: Allow-list projection
For each module the system SHALL copy only fields listed in its projection map (output field ← upstream column or JSON path). JSON string columns MUST be parsed before path selection. Fields not in the map MUST NOT be copied, and missing or unparsable values SHALL become `null` rather than defaults.

#### Scenario: Unlisted upstream columns
- **WHEN** an upstream row contains columns outside the projection map
- **THEN** the projected record contains only the mapped output fields

#### Scenario: Malformed JSON column
- **WHEN** `erp_filter_json` is not valid JSON
- **THEN** the ERP block fields are `null`, the block is reported in `gaps`, and the module status is `partial`

### Requirement: Response envelope and status semantics
Every module endpoint SHALL return the envelope `{module, content_ids, trade_date, status, data_mode, sources, gaps, data, disclaimer}`. `status` MUST be one of `ok`, `partial`, `empty`, `not_connected`, `upstream_error`. `trade_date` SHALL be taken from returned rows, not from the upstream echo.

#### Scenario: Upstream failure
- **WHEN** the upstream times out, returns 5xx, 401 or 403
- **THEN** the gateway returns HTTP 502 with `status=upstream_error` and empty `data`, without substituting any value

#### Scenario: No rows
- **WHEN** the upstream returns zero rows for the requested date
- **THEN** the gateway returns HTTP 200 with `status=empty`

#### Scenario: Latest date resolution
- **WHEN** no `trade_date` is supplied and upstream echoes `latest`
- **THEN** the envelope `trade_date` equals the `trade_date` of the returned rows

### Requirement: Pagination integrity
The client SHALL page with `limit=500` until a page returns fewer than 500 rows, with a cap of 10 pages, and SHALL de-duplicate rows by business key. If duplicates are detected or the page cap is reached, the module status MUST be `partial` with a gap explaining it.

#### Scenario: Duplicate rows across pages
- **WHEN** two pages contain the same `sector_code`
- **THEN** the row appears once and the module status is `partial`

### Requirement: Source freshness reporting
Each envelope SHALL list, per upstream service used, the source date, snapshot time when available, coverage ratio and missing sources as reported upstream.

#### Scenario: Partial upstream coverage
- **WHEN** the sentiment row reports `coverage_ratio=0.83` and `missing_sources=["fund_tide"]`
- **THEN** `sources` contains that service with the same values

### Requirement: Fixture mode
The system SHALL support `INSIGHT_DATA_MODE=fixture`, reading upstream-shaped rows from local fixture files. In fixture mode every envelope MUST carry `data_mode=fixture`. The service MUST refuse to start when `INSIGHT_ENV=production` and fixture mode is enabled.

#### Scenario: Fixture labelling
- **WHEN** fixture mode is on
- **THEN** every module response has `data_mode=fixture`

#### Scenario: Production guard
- **WHEN** `INSIGHT_ENV=production` and `INSIGHT_DATA_MODE=fixture`
- **THEN** application startup fails with a configuration error

### Requirement: Optional access token
When `INSIGHT_ACCESS_TOKEN` is set, all `/api/v1/*` endpoints except `/api/v1/health` SHALL require `Authorization: Bearer <token>` and return 401 otherwise.

#### Scenario: Missing token
- **WHEN** the token is configured and a request has no Authorization header
- **THEN** the response is 401

#### Scenario: Health is open
- **WHEN** `/api/v1/health` is requested without a token
- **THEN** the response is 200
