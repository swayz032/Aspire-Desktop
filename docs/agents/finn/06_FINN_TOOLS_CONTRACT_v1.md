# Finn Tools Contract v1

## Objective

Define the minimum server-side tools Claude Code should implement for Finn.

## Tooling principles

1. Server tools only.
2. Tenant and office scoped on every request.
3. No client-side direct finance mutation.
4. Mutating operations require idempotency keys.
5. Preview before apply.
6. Receipt after state change.
7. Structured errors and correlation IDs are mandatory.

## Required shared request context

Every tool call must carry or derive:
- `tenant_id`
- `suite_id`
- `office_id`
- `actor_id`
- `actor_role`
- `correlation_id`
- `capability_scope`

## Required tool set

### 1. `finn_get_context`

#### Purpose
Get business context, provider state, freshness, and selected Finance Hub surface.

#### Returns
- current date/time
- business identity
- connected providers
- provider freshness
- coverage/confidence summary
- current Finance Hub surface if available
- any degraded banner conditions

#### Use cases
- executive brief
- opening a finance conversation
- stale-data checks

### 2. `finn_get_overview`

#### Purpose
Get executive financial picture and books health summary.

#### Returns
- books health
- cash position summary
- needs review count
- close readiness
- top changes since last visit
- top priority actions
- recent receipts summary

### 3. `finn_get_cash_truth`

#### Purpose
Answer usable-cash and pressure questions.

#### Returns
- usable cash
- current bank-backed liquidity summary
- upcoming outflows
- incoming pressure
- overdue invoice exposure
- forecast confidence / coverage

### 4. `finn_get_review_queue`

#### Purpose
Load review and categorization backlog.

#### Returns
- queue items
- confidence per recommendation
- impact ranking
- merchant ambiguity markers
- receipt mismatch markers
- suggested batch groups

### 5. `finn_get_reconciliation_queue`

#### Purpose
Load mismatch and reconciliation blockers.

#### Returns
- mismatch candidates
- duplicate candidates
- transfer pair candidates
- missing-match issues
- stale-provider warnings
- recommended next workspace state

### 6. `finn_get_reports_summary`

#### Purpose
Provide plain-language summaries over finance reports.

#### Returns
- selected report summary
- trend direction
- meaningful deltas
- freshness
- top drivers
- drilldown targets

### 7. `finn_get_ar_aging`

#### Purpose
Explain receivables, collections pressure, and overdue risk.

#### Returns
- AR aging buckets
- top overdue invoices
- top customers at risk
- cash impact estimate
- collections priority order

### 8. `finn_get_rules`

#### Purpose
Inspect rules and automation behavior.

#### Returns
- rule list
- rule state
- hit counts
- confidence
- false-positive risk
- last-edited metadata

### 9. `finn_simulate_rule`

#### Purpose
Preview a rule before creation or change.

#### Returns
- projected matches
- projected misses
- false-positive risk
- sample affected transactions
- policy requirement for approval

### 10. `finn_preview_writeback`

#### Purpose
Preview a categorization/reconciliation/write-back mutation.

#### Returns
- proposed before/after state
- target provider
- expected impact
- required approval state
- preview artifact id

### 11. `finn_apply_writeback`

#### Purpose
Apply a governed write-back after policy conditions are met.

#### Requirements
- idempotency key
- approval evidence when required
- correlation id

#### Returns
- applied result
- receipt id
- downstream provider status
- failure details if not applied

### 12. `finn_get_money_trail`

#### Purpose
Load proof and audit history.

#### Returns
- receipt summaries
- before/after state
- actor
- time
- event type
- linked preview/apply chain

### 13. `finn_save_finance_memory`

#### Purpose
Persist durable office-scoped finance summaries.

#### Allowed memory artifact types
- weekly_finance_brief
- what_changed_summary
- cleanup_snapshot
- collections_pressure_summary
- tax_readiness_summary
- receipt_explanation

## Mapping to existing backend pack

The uploaded backend execution pack already includes these mergeable primitives:
- classification queue
- classification recommend
- classification approve batch
- reconciliation queue
- write-back preview
- write-back apply
- receipts
- idempotency
- tenant isolation scaffolding

### Existing route contracts already present
- `GET /finance/classification/queue`
- `POST /finance/classification/recommend`
- `POST /finance/classification/approve-batch`
- `GET /finance/reconciliation/queue`
- `POST /finance/writeback/preview`
- `POST /finance/writeback/apply`

Claude Code should use those as the base substrate and add Finn-facing wrappers rather than inventing an unrelated finance tool surface.

## Error contract

Every tool must return structured errors.

### Minimum structured error fields
- `code`
- `message`
- `correlation_id`
- `retryable`
- `provider` when relevant
- `tenant_id`
- `office_id`

### Required behaviors
- stale data must be distinguishable from hard failure
- partial coverage must be distinguishable from empty result
- permission denied must be explicit
- cross-tenant leakage must fail closed

## Observability requirements

Every tool call should emit:
- `correlation_id`
- `tenant_id`
- `suite_id`
- `office_id`
- `actor_id`
- `tool_name`
- `provider`
- `idempotency_key` when mutating
- `result_status`
- latency metrics

## Security requirements

- capability tokens server-side only
- deny by default on finance routes
- provider credentials outside client boundary
- redacted logs
- receipts for every state change
- safe retry path for mutating calls
