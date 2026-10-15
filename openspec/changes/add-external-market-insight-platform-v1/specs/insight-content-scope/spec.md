## ADDED Requirements

### Requirement: Content scope registry
The system SHALL maintain a machine-readable registry of all 37 content items CNT-001～CNT-037 from `EXTERNAL_ANALYTICS_CONTENT_SCOPE.md` V0.3. Each entry MUST record: content ID, original source page, content selection (`keep` 保留设计 / `exclude` 不迁入 / `pending` 待定), v1 delivery status (`delivered` / `not_connected` / `pending` / `excluded`), target page in the new product, and reason. The registry SHALL be exposed read-only at `GET /api/v1/meta/content-scope`.

#### Scenario: Registry completeness
- **WHEN** a client requests `GET /api/v1/meta/content-scope`
- **THEN** the response contains exactly 37 entries with IDs CNT-001 through CNT-037, each with non-empty selection, v1 status and reason

#### Scenario: Excluded items are never delivered
- **WHEN** the registry is loaded at startup
- **THEN** no entry with selection `exclude` or `pending` has v1 status `delivered`, otherwise the service MUST refuse to start

### Requirement: Only kept items are delivered
The system SHALL deliver to external users only content items whose selection is `keep` and whose data is supplied by an existing data platform service. Every module response MUST list the content IDs it carries in `content_ids`, and every listed ID MUST have v1 status `delivered`. Kept items that cannot be supplied SHALL be listed in `gaps`, never in `content_ids`.

#### Scenario: Module declares its content
- **WHEN** a client requests any module endpoint whose status is not `not_connected`
- **THEN** the envelope `content_ids` is non-empty and every ID is `delivered` in the registry

#### Scenario: Not connected module declares nothing
- **WHEN** a module has no data source in v1
- **THEN** the envelope `content_ids` is empty and every kept item appears in `gaps`

#### Scenario: Kept item without data source
- **WHEN** a kept item has no data platform service (e.g. CNT-022 题材统计)
- **THEN** its v1 status is `not_connected` and the corresponding module returns `status=not_connected` with the required business field contract instead of any data

### Requirement: Advisory content exclusion
The system MUST NOT output position guidance, position budgets, risk directives, operation reasons, industry focus/hold/avoid grouping, lifecycle phase or opportunity ratings, signal priority, individual-stock actions or decision scores, next-day guidance, forward risk curves, Price-In or tail-risk scores, event impact or A-share transmission paths, or any renamed equivalent of these.

#### Scenario: Original advisory columns present upstream
- **WHEN** an upstream row contains `opportunity_tags`, `review_group`, `signal_priority_group`, `next_state_json` or `short_term_risk_budget_json`
- **THEN** none of those values, nor values derived from them, appear in any response

#### Scenario: Fallback placeholder events
- **WHEN** an upstream calendar event has `source=fallback_contract`
- **THEN** the event is dropped from the calendar response

### Requirement: Forbidden key guard fails closed
Before sending any module response, the system SHALL recursively scan all keys in the response body against the forbidden key patterns (`action, suggest, guidance, budget, next_state, signal_priority, opportunity, review_group, lifecycle_phase, decision, recommend, target_price, risk_badge, pricing_degree, price_in, risk_score, transmission, scenario, impact, focus, avoid`). On any match the system MUST return HTTP 500 with a guard error and MUST NOT return the data.

#### Scenario: Projection bug leaks a forbidden key
- **WHEN** a projection accidentally includes a key `active_suggest_action`
- **THEN** the response is HTTP 500 `content_guard_violation` and contains no module data

#### Scenario: Clean response passes
- **WHEN** a response contains only whitelisted keys
- **THEN** the guard passes and the response is returned unchanged

### Requirement: Non-advice disclaimer
Every module response SHALL carry the disclaimer text "本平台仅提供证券信息汇总与历史数据统计，不构成任何证券投资建议。" and every page SHALL display it.

#### Scenario: Disclaimer present
- **WHEN** any module endpoint returns, including error and not_connected states
- **THEN** the envelope `disclaimer` field equals the fixed text
