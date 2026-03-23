---
name: Cycle 6 Provider Receipt Audit
description: Full audit findings for all providers in backend/orchestrator/src/aspire_orchestrator/providers/ (Cycle 6, 2026-03-22)
type: project
---

# Cycle 6 Provider Receipt Audit — Key Findings

## Audit Date: 2026-03-22
## Scope: All 28 provider files + receipt_store.py

---

## CRITICAL FINDINGS

### FINDING-C6-001 (CRITICAL)
- File: base_client.py line 621
- `make_receipt_data()` always sets `"receipt_hash": ""`
- This is the ONLY receipt factory for 19 providers (stripe_client, quickbooks, gusto, plaid, twilio, livekit, deepgram, elevenlabs, s3). ALL of those receipts have empty receipt_hash.
- Law #2 violated: receipt_hash must be computed

### FINDING-C6-002 (CRITICAL)
- Files: office_message_client.py line 59, polaris_email_client.py line 71
- Both `_mk_receipt()` and `_make_email_receipt()` hardcode `"receipt_hash": ""`
- office_message_client.py covers 4 state-changing operations (create, draft, send)
- polaris_email_client.py covers 3 state-changing operations (send, draft)
- Law #2 violated: no receipt_hash computed for any of these 7 operations

### FINDING-C6-003 (CRITICAL)
- File: pandadoc_client.py lines 1868 and 2039
- `_verify_document_completeness()` and `_autopatch_document()` access `client.api_key` attribute
- PandaDocClient has NO `.api_key` property — it only loads API key inside `_authenticate_headers()` via `settings.pandadoc_api_key`
- This will raise `AttributeError: 'PandaDocClient' object has no attribute 'api_key'` at runtime
- These functions bypass `_request()` and make raw httpx calls with hand-constructed headers
- These internal functions store receipts via `store_receipts()` directly — the receipts use `_build_operation_receipt()` schema (which is DIFFERENT from `make_receipt_data()` schema)

### FINDING-C6-004 (CRITICAL)
- Files: stripe_webhook.py, pandadoc_webhook.py
- All webhook receipts use a CUSTOM non-standard schema: receipt_id/ts/event_type/actor/inputs_hash
- These fields do NOT match what `_map_receipt_to_row()` expects: id/created_at/action_type/actor_id
- When persisted to Supabase, the action column is empty {}, status is always "PENDING", receipt_id is regenerated
- These receipts are functionally orphaned from the trace chain
- Known from Cycles 3+4, still unresolved

---

## HIGH FINDINGS

### FINDING-C6-005 (HIGH)
- Files: ALL providers (base_client.py, calendar_client.py, office_message_client.py, polaris_email_client.py)
- `capability_token_id` is accepted as parameter but always arrives as None from execute_* callers
- No provider validates or enforces that a real capability token was provided for YELLOW/RED operations
- gusto.payroll.run (RED), plaid.transfer.create (RED), pandadoc.contract.sign (RED) all allow None capability_token_id
- Law #5 violated: tokens must be server-verified, tools must reject calls without valid tokens

### FINDING-C6-006 (HIGH)
- Files: stripe_client.py (all execute functions), quickbooks_client.py, gusto_client.py, plaid_client.py, twilio_client.py, livekit_client.py, deepgram_client.py, elevenlabs_client.py, s3_client.py
- Receipts emitted via `make_receipt_data()` NEVER call `store_receipts()` or `store_receipts_strict()` at the provider level
- `receipt_data` is returned inside ToolExecutionResult and the CALLER (tool_executor.py) is responsible for persisting
- If tool_executor.py fails to persist (exception, timeout), the receipt silently drops
- None of these providers use `store_receipts_strict` for YELLOW/RED operations — that responsibility is deferred
- Law #2 says 100% coverage — if executor fails, receipt is lost

### FINDING-C6-007 (HIGH)
- File: gusto_client.py, execute_gusto_payroll_run, line 452
- `binding_fields` added to receipt AFTER `make_receipt_data()` returns (line 452: `receipt["binding_fields"] = {...}`)
- Same pattern in plaid_client.py line 470: `receipt["binding_fields"] = {...}`
- `binding_fields` is not part of the 18-field schema; mutating the receipt dict after creation violates immutability intent
- More importantly: `binding_fields` bypasses `_map_receipt_to_row()` entirely — these RED-tier binding evidence fields are NOT persisted to Supabase
- Law #2 violated for RED-tier evidence fields

### FINDING-C6-008 (HIGH)
- File: pandadoc_client.py — `_build_operation_receipt()` function (lines 129-194)
- Internal operations (verify_completeness, autopatch) use THIS schema, not `make_receipt_data()`
- Schema has: receipt_version, receipt_id, ts, event_type, suite_id, actor, inputs_hash, policy, metadata, redactions
- Missing: action_type, actor_type, actor_id, risk_tier, tool_used, capability_token_id, outcome (uses "status"), reason_code, receipt_type
- These receipts stored via direct `store_receipts()` calls but will fail `_map_receipt_to_row()` in Supabase
- Law #2 violated: minimum required fields missing

### FINDING-C6-009 (HIGH)
- Files: stripe_client.py, quickbooks_client.py, gusto_client.py, plaid_client.py, twilio_client.py
- YELLOW/RED operations never call `store_receipts_strict()` — they return receipt_data to caller
- Law #3 requires fail-closed behavior: for YELLOW/RED, Supabase persistence failure should halt pipeline
- The non-blocking async writer is used for ALL receipt tiers including RED (gusto.payroll.run, plaid.transfer.create)

### FINDING-C6-010 (HIGH)
- File: calendar_client.py, _make_calendar_receipt() function
- Missing fields compared to 18-field schema: `idempotency_key`, `redacted_inputs`, `redacted_outputs`
- receipt_hash IS computed (sha256 of inputs) — this is CORRECT unlike base_client.py
- But `approval_evidence` is absent — for YELLOW calendar.event.create and calendar.event.complete operations
- calendar_client does not use `make_receipt_data()` at all; it has its own receipt builder

---

## MEDIUM FINDINGS

### FINDING-C6-011 (MEDIUM)
- File: stripe_client.py, execute_stripe_invoice_create, lines 369-395
- When line item creation fails AFTER the invoice was created (partial failure), the failure receipt at line 383 does NOT include redacted_outputs
- The invoice_id was successfully created on Stripe but this is not in the failure receipt's redacted_outputs
- This breaks the audit chain: the Stripe-side invoice exists but Aspire's failure receipt has no reference to it

### FINDING-C6-012 (MEDIUM)
- File: plaid_client.py
- access_token (Plaid API credential) is passed directly in the request body via `_inject_auth()`
- Plaid's `_request()` calls the base_client `_request()` which logs the path but not body
- However if a receipt ever included raw inputs, the access_token would appear
- Current receipts from `make_receipt_data()` do NOT include redacted_inputs — but they also don't prove the access_token was redacted (gap: no redacted_inputs field at all)
- Law #9 risk: absence of redacted_inputs means no audit evidence that PII/secrets were handled safely

### FINDING-C6-013 (MEDIUM)
- File: twilio_client.py
- execute_twilio_call_create returns phone numbers (to, from) in success data (lines 397-401): `"from": call.get("from", ""), "to": call.get("to", "")`
- These raw E.164 phone numbers flow back through ToolExecutionResult.data
- If tool_executor logs or stores this data, phone numbers are PII under Law #9
- The receipt itself does NOT redact these — it uses make_receipt_data() with no redacted_inputs

### FINDING-C6-014 (MEDIUM)
- File: pandadoc_client.py — `_resolve_template_for_pandadoc()`
- Template scan requests use hardcoded suite_id="system" and office_id="system" (lines 609, 632)
- These calls to PandaDoc API emit NO receipts
- While template scanning is READ-ONLY, these are external API calls with no audit trail
- Law #2 gap (low-risk but still a gap)

### FINDING-C6-015 (MEDIUM)
- File: pandadoc_client.py — execute_pandadoc_contract_generate (large function ~2720-3506)
- The "smart questions" denial path (fill_rate < 80%) returns a ToolExecutionResult with outcome DENIED
- This uses `make_receipt_data()` correctly BUT the receipt risk_tier may be wrong for a DENIED operation
- The preflight gate itself is not clearly receipted as a distinct "denial" event separate from the eventual submission

### FINDING-C6-016 (MEDIUM)
- File: office_message_client.py
- execute_office_send (lines 342-405): only catches `SupabaseClientError`
- A broader `Exception` in `supabase_update()` would be uncaught and propagate without a failure receipt
- Same pattern in execute_office_create (line 245) and execute_office_draft (line 325)
- Law #3: fail closed requires ALL exception paths to emit failure receipts

### FINDING-C6-017 (MEDIUM)
- File: gusto_client.py, execute_gusto_payroll_run
- risk_tier defaults to "red" correctly
- However no `store_receipts_strict()` is called — receipt is returned in ToolExecutionResult
- For RED-tier (irreversible payroll submission), strict persistence should be mandatory at provider level

---

## LOW FINDINGS

### FINDING-C6-018 (LOW)
- File: calendar_client.py
- execute_calendar_event_list uses risk_tier="green" — correct
- execute_calendar_event_complete uses risk_tier="yellow" — correct
- However `capability_token_id` and `capability_token_hash` are accepted via **kwargs but NOT passed to `_make_calendar_receipt()`
- The receipt for calendar operations will always have capability_token_id=None

### FINDING-C6-019 (LOW)
- File: pandadoc_client.py, `_build_operation_receipt()`, line 170
- Uses "receipt_id" key name (not "id") which is incompatible with `_map_receipt_to_row()`
- `_map_receipt_to_row()` looks for `receipt.get("id")` at line 166 of receipt_store.py
- Consequence: pandadoc verify/autopatch receipts get a NEW random UUID on persistence, breaking dedup

### FINDING-C6-020 (LOW)
- Files: stripe_webhook.py, pandadoc_webhook.py
- Webhook receipts use "ok"/"denied" as status values (line 150 in stripe_webhook.py)
- `_map_receipt_to_row()` only recognizes "success"/"succeeded"/"failed"/"denied"/"pending"
- "ok" maps to status "PENDING" in Supabase, not "SUCCEEDED"
- All successful webhook processing receipts persist as PENDING in the DB

### FINDING-C6-021 (LOW)
- File: livekit_client.py, execute_livekit_room_create
- risk_tier="green" for room creation — DEBATABLE
- Creating a conference room is a state-changing operation (creates external resource)
- Per Law #4: state changes should be YELLOW unless they are retrieval/read-only
- NEEDS VERIFICATION: Check if LiveKit room creation is stateless from Aspire's perspective

### FINDING-C6-022 (LOW)
- File: base_client.py, pandadoc_client.py, office_message_client.py
- None of the receipt builders populate `idempotency_key` in the receipt
- The idempotency_key IS used for the actual API call (stripe, twilio, gusto all set it) but never stored in the receipt
- This makes it impossible to audit idempotency key collisions after the fact

---

## Receipt Schema Divergence Summary (4 different schemas in providers)

| Schema | Used By | Missing Fields |
|--------|---------|---------------|
| make_receipt_data() (base_client.py) | 19 providers | receipt_hash="" (empty), idempotency_key, redacted_inputs, redacted_outputs |
| _make_calendar_receipt() | calendar_client | idempotency_key, redacted_inputs, redacted_outputs, approval_evidence |
| _mk_receipt() | office_message_client | receipt_hash="" (empty), idempotency_key, redacted_inputs, redacted_outputs |
| _make_email_receipt() | polaris_email_client | receipt_hash="" (empty), idempotency_key, redacted_outputs |
| _build_webhook_receipt() | stripe_webhook, pandadoc_webhook | action_type, actor_type, actor_id, risk_tier, tool_used, capability_token_id, outcome, receipt_type |
| _build_operation_receipt() | pandadoc internal | action_type, actor_type, actor_id, risk_tier, tool_used, capability_token_id, receipt_type; uses receipt_id not id |

## receipt_store.py Assessment
- Append-only: CONFIRMED (INSERT with ON CONFLICT DO NOTHING, no UPDATE/DELETE)
- store_receipts_strict: EXISTS and raises ReceiptPersistenceError on failure
- PROBLEM: Providers do NOT call store_receipts_strict directly for YELLOW/RED — they return receipt_data to executor
- Hash chain: receipt_hash column exists in DB but is populated by caller not receipt_store

## Known Unresolved Issues from Prior Cycles
- Stripe webhook schema incompatibility (FINDING-C6-004) — Cycle 3+4 finding confirmed still open
