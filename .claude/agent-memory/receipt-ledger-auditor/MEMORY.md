# Receipt Ledger Auditor Memory

## Key Findings — routes.ts Bootstrap Endpoint (2026-03-06)

### Receipt Infrastructure
- `emitReceipt()` defined at `server/routes.ts:473` — inserts into `receipts` table via raw `db.execute(sql`...`)`
- `receipts` table schema defined in `backend/infrastructure/migrations/trust-spine-bundle.sql:1098`
- Columns written by emitReceipt: receipt_id, receipt_type, status, action (jsonb), result (jsonb), suite_id, tenant_id, correlation_id, actor_type, actor_id, created_at
- MISSING from receipts table schema: `tool_used`, `capability_token_id`, `approval_evidence`, `reason_code`, `office_id` (present in schema but NOT written by emitReceipt)
- Full Trust Spine receipt schema (execution_receipts) lives in trust-spine migrations — it has all Law #2 fields but is NOT the table used by the desktop server

### Bootstrap Endpoint Audit Summary
- File: `Aspire-desktop/server/routes.ts`, handler at line 515
- `receiptId` generated at line 692 — AFTER tenant_memberships INSERT at lines 668-683
- Receipt emitted at line 765 (success path only — covers suite creation + membership + profile collectively)
- CRITICAL GAP: tenant_memberships failure path (lines 674-683) returns HTTP 500 with NO receipt
- CRITICAL GAP: suite creation failure path (lines 660-662) returns HTTP 500 with NO receipt
- CRITICAL GAP: outer catch block (lines 856-868) creates `failReceiptId` variable but NEVER calls `emitReceipt()` — it only logs to logger. The comment says "receipt goes to system log only" which is NOT a receipt.
- MEDIUM: n8n webhook payload (lines 807-808) sends raw `dateOfBirth` and `gender` PII unredacted
- HIGH: Missing fields in emitted receipt — no `tool_used`, `capability_token_id`, `approval_evidence`, `reason_code`, `office_id`

### Receipts Table vs Law #2 Minimum Fields Gap
The production `receipts` table schema is a simplified Trust Spine subset. Missing Law #2 fields:
- `tool_used` → stored in `action` jsonb (partial)
- `capability_token_id` → not stored at all
- `approval_evidence` → not stored
- `reason_code` → not stored
- `office_id` column exists in schema but emitReceipt() does NOT write it

## Stable Patterns

### emitReceipt() call sites in routes.ts
- 19 call sites total (lines 765, 1068, 1081, 1104, 1156, 1173, 1287, 1303, 1326, 1342, 1364, 1380, 1414, 1430, 1460, 1476, 1536, 1552, plus bootstrap success)
- All follow same pattern: inline object with receiptId, receiptType, outcome, suiteId, tenantId, correlationId, actorType, actorId, riskTier

### Common Receipt Gaps Pattern
- Pre-receipt failure exits (before receiptId is generated or before emitReceipt is called) are a systemic risk
- The catch block pattern of "emit failure receipt" often only logs instead of actually calling emitReceipt()
- This is a recurring pattern — audit all catch blocks for this mistake

## Cycle 3 Audit — backend/orchestrator/src/aspire_orchestrator/routes/ (2026-03-22)

### Files Audited
- intents.py — POST /v1/intents/classify (intent classification + routing)
- webhooks.py — POST /api/webhooks/stripe, pandadoc, twilio
- admin.py — 30+ admin endpoints (GET/POST/PUT/SSE)
- robots.py — POST /robots/ingest
- providers/stripe_webhook.py — StripeWebhookHandler

### Receipt Infrastructure (Backend Python)
- `store_receipts()` in `services/receipt_store.py` — dual-write: in-memory + Supabase (append-only confirmed, no UPDATE/DELETE)
- Receipt schema used: dict with id, correlation_id, suite_id, office_id, actor_type, actor_id, action_type, risk_tier, tool_used, outcome, reason_code, created_at, receipt_type, receipt_hash, redacted_inputs, redacted_outputs
- Law #2 field coverage in Python routes is BETTER than the TypeScript routes.ts — most required fields are present
- Missing from most Python receipts: capability_token_id, approval_evidence, timestamps for multi-step (approved_at, executed_at)

### Critical Gaps Found

#### webhooks.py — PandaDoc webhook (lines 110-175)
- CRITICAL: Successful event processing (line 162) returns 200 with NO receipt emitted. Only logs to logger.
- CRITICAL: JSON parse exception path (line 170) returns 500 with NO receipt.
- CRITICAL: All 3 rejection paths (no secret, no signature, signature mismatch, lines 126-149) return 401/403 with NO receipt.

#### webhooks.py — Twilio webhook (lines 183-268)
- CRITICAL: Successful event processing (line 254) returns 200 with NO receipt emitted. Only logs to logger.
- CRITICAL: JSON/form parse exception path (line 263) returns 500 with NO receipt.
- CRITICAL: All rejection paths (no auth, no signature, sig mismatch, lines 200-242) return 401 with NO receipt.

#### admin.py — /admin/ops/voice/tts/stream (line 4281)
- HIGH: Auth denial path (line 4290-4294) returns 401 with NO receipt stored. _sse_auth_deny() is NOT called here; raw JSONResponse returned directly.
- HIGH: JSON body parse failure (line 4298-4303) returns 400 with NO receipt.
- HIGH: Validation error (text empty, line 4307-4313) returns 400 with NO receipt.
- NOTE: Streaming failure path inside audio_generator() (line 4371) logs but does NOT emit a failure receipt.

#### admin.py — /admin/ops/chat (line 4594)
- HIGH: Auth denial (line 4608-4614) returns 401 with NO receipt. Does not call _sse_auth_deny().
- HIGH: JSON body parse failure (line 4619-4625) returns 422 with NO receipt.
- HIGH: Validation errors (lines 4629-4641) return 422 with NO receipt.

#### admin.py — /admin/ops/health-pulse/stream (line 3857)
- MEDIUM: stream exception path (line 3939) logs error but does NOT emit a failure receipt (unlike incidents/providers streams which do emit err_receipt).

#### admin.py — /admin/ops/outbox/stream (line 3961)
- MEDIUM: stream exception path (line 4027) logs error but does NOT emit a failure receipt.

#### admin.py — /admin/ops/incidents/report (line 914)
- MEDIUM: JSON parse failure (line 938-944) returns 400 with NO receipt (denied receipt was stored for auth failure, but subsequent validation failures do not get receipts).
- MEDIUM: validation error for missing title (line 954-961) returns 400 with NO receipt.

#### admin.py — /admin/auth/exchange (line 437)
- MEDIUM: Several early-exit paths (lines 449-473, 501-531) return 401/503 with NO receipt. Only the success path emits a receipt (line 546-561).

#### intents.py — /v1/intents/classify
- MEDIUM: JSON body parse failure (line 191-195) returns 400 with NO receipt.
- MEDIUM: Missing utterance (line 211-216) returns 400 with NO receipt.

#### admin.py — /admin/ops/client-events (line 1052)
- MEDIUM: Auth denial (line 1063-1072) returns 401 with NO receipt.
- MEDIUM: JSON parse / validation failures (lines 1077-1099) return 400-500 with NO receipt.
- MEDIUM: store failure path (lines 1134-1148) returns 500 with NO receipt.

### Schema Divergence — Stripe Webhook Receipt
- stripe_webhook.py _build_webhook_receipt() uses a DIFFERENT schema from all other Python routes
- Uses: receipt_version, receipt_id (not "id"), ts (not "created_at"), event_type (not "action_type"), actor (not "actor_id/actor_type"), policy, inputs_hash, metadata, redactions
- This receipt format will NOT be recognized by query_receipts() or admin facade (which look for "id", "action_type", "created_at", etc.)
- CRITICAL: Stripe receipts are functionally orphaned from the trace chain

### Immutability
- receipt_store.py confirmed append-only — no UPDATE/DELETE found
- admin.py _proposals dict uses direct mutation (line 2677-2680) but that is proposal state, not receipts

### Risk Tier Assessment
- All Python routes default risk_tier to "green" even for state-changing operations
- admin.py approve_proposal overrides receipt risk_tier to match proposal (line 2697) — correct
- intents.py hardcodes risk_tier: "green" in all receipts — MEDIUM (classification is green but the receipt should propagate intent's risk_tier for routing receipts)

### capability_token_id
- NOT present in any Python route receipt — systemic gap across all 30+ endpoints

## Cycle 4 Audit — Orchestrator Core Services (2026-03-22)

Full detail in `cycle4-orchestrator-core-audit.md`. Key findings:

### File Location Facts
- capability_token.py does NOT exist as standalone — token minting is in nodes/token_mint.py, validation in services/token_service.py
- approval_store.py does NOT exist as standalone — approval state managed inline in nodes/approval_check.py + approval_service.py

### Critical Gaps (graph.py + nodes)
- CRITICAL: classify_node money-movement denial (graph.py ~line 449) sets error_code/denied outcome but emits NO receipt
- HIGH: route_node routing denial (graph.py ~line 535) returns ROUTING_DENIED with NO receipt
- HIGH: route_node empty-steps path (graph.py ~line 562) returns EMPTY_ROUTING_STEPS with NO receipt
- HIGH: token_mint_node SUCCESS path (token_mint.py line 185-208) emits NO receipt — only failure path has receipt
- HIGH: skill_router.py SkillRouter.route_multi() emits ZERO receipts for any routing outcome (allow/deny/reroute)
- MEDIUM: classify_node emits no receipt for classification decisions
- MEDIUM: greeting_fast_path_node receipt uses wrong schema (action/result/payload vs action_type/outcome) — will persist with mostly empty columns

### Schema Gaps (ALL orchestrator node receipts)
- inputs_hash: NOT present in any node receipt
- redacted_outputs: NOT present in any node receipt
- capability_token_id: only in execute.py receipts (not in earlier nodes)
- trace_id/span_id/run_id: derived at persist time from middleware context, NOT written to receipt dicts

### receipt_store.py confirmed append-only (SHA-256 hash chain confirmed correct algorithm)

### Stripe Webhook Schema Incompatibility (STILL CRITICAL — same issue as Cycle 3)
- _build_webhook_receipt() uses receipt_id/ts/event_type/actor — receipt_store _map_receipt_to_row() expects id/created_at/action_type/actor_id
- Stripe receipts persist with empty action jsonb, wrong receipt_id (regenerated uuid4), status=PENDING always
- This is a KNOWN OPEN issue from Cycle 3 confirmed still unresolved

## Cycle 6 Audit — All Provider Files (2026-03-22)

Full detail in `cycle6-provider-audit.md`. Key findings:

### Systemic Issue: receipt_hash="" in base_client.py
- `make_receipt_data()` in base_client.py line 621 ALWAYS sets `"receipt_hash": ""`
- This affects ALL 19 providers that use BaseProviderClient (stripe, quickbooks, gusto, plaid, twilio, livekit, deepgram, elevenlabs, s3)
- office_message_client.py and polaris_email_client.py also hardcode `"receipt_hash": ""`
- calendar_client.py is the ONLY provider that correctly computes receipt_hash (sha256 of inputs)

### PandaDoc Critical Bug
- `_verify_document_completeness()` and `_autopatch_document()` access `client.api_key`
- PandaDocClient has NO `.api_key` property — will raise AttributeError at runtime
- These functions also use `_build_operation_receipt()` schema (incompatible with _map_receipt_to_row())

### Provider Receipt Storage Pattern
- Providers return receipt_data INSIDE ToolExecutionResult — they do NOT call store_receipts() directly
- Only pandadoc_client.py (verify/autopatch), stripe_webhook.py, and pandadoc_webhook.py call store_receipts() directly
- This means receipt persistence for all other providers depends entirely on tool_executor.py calling store_receipts()
- store_receipts_strict() is NEVER called at provider level — even for RED-tier (payroll, transfers, contract.sign)

### 6 Schema Variants (4 provider schemas + 2 webhook schemas)
- See cycle6-provider-audit.md for complete schema divergence table
- All webhook receipts (stripe + pandadoc) use non-standard schema → persist incorrectly to Supabase

### capability_token_id
- Accepted as parameter across all providers but NEVER validated at provider level
- All providers allow None capability_token_id even for RED-tier operations
- Systemic gap confirmed across all 3 audited cycles (3, 4, 6)

## Cycle 8 Audit — Routes + Config Focus (2026-03-23)

### Files Audited
- routes/intents.py, routes/robots.py, routes/webhooks.py, routes/admin.py
- services/tool_executor.py, services/policy_engine.py
- middleware/correlation.py, middleware/rate_limiter.py, middleware/exception_handler.py, middleware/chaos.py, middleware/sentry_middleware.py

### NEW FINDINGS vs Cycle 3

#### webhooks.py — Resolved vs Prior Findings
- PandaDoc webhook: receipt is now constructed (lines 165-184) BUT NOT stored (no store_receipts() call) — logger.info only. STILL CRITICAL.
- Twilio webhook: same pattern — receipt constructed but NOT stored — STILL CRITICAL.
- Both webhooks: rejection paths (auth fail, sig fail) still emit NO receipt — STILL CRITICAL (6 missing receipts confirmed).
- Stripe webhook: delegates to StripeWebhookHandler.process_event() — receipt stored there (Cycle 3/4 confirmed). Exception path (line 99-105) still emits NO receipt — CRITICAL.

#### admin.py — RESOLVED FINDINGS (previously MEDIUM, now covered)
- /admin/auth/exchange: ALL denial paths now emit receipts (lines 451-458, 468-475, 484-491, 527-534, 560-567). RESOLVED.
- /admin/ops/incidents/report: auth denial covered (lines 978-985). JSON parse still NO receipt (line 996-1001) — MEDIUM open.
- /admin/ops/client-events: auth denial still NO receipt (lines 1120-1129). MEDIUM open.
- /admin/ops/voice/tts/stream: auth denial NOW receipted (lines 4357-4367). JSON parse STILL NO receipt (lines 4371-4378). Text empty STILL NO receipt (lines 4380-4387). Audio streaming failure STILL NO receipt (line 4445-4446 logs only). MEDIUM open.
- /admin/ops/chat: auth denial NOW receipted (lines 4709-4716). JSON parse STILL NO receipt (lines 4726-4732). Empty message STILL NO receipt (lines 4736-4742). MEDIUM open.
- /admin/ops/health-pulse/stream: exception path (lines 4005-4007) STILL logs only, NO err_receipt — MEDIUM open.
- /admin/ops/outbox/stream: exception path (lines 4093-4094) STILL logs only, NO err_receipt — MEDIUM open.

#### tool_executor.py — NEW CRITICAL FINDING
- execute_tool() lines 964-981: When a LIVE executor raises an uncaught exception, the function RE-RAISES (line 981). There is NO receipt emitted for the unhandled exception path. The PCL is logged but no receipt is stored. The caller (graph.py execute node) may or may not catch and receipt this — CRITICAL for RED-tier tools.
- _make_receipt_data() line 181: `"receipt_hash": ""` — always empty string. Confirms systemic pattern from Cycle 6.
- execute_stub(): always returns Outcome.SUCCESS — stub tools never return DENIED or FAILED, masking policy gaps.

#### policy_engine.py — NO RECEIPTS EMITTED (CONFIRMED)
- PolicyMatrix.evaluate() is a pure function returning PolicyEvalResult. It NEVER calls store_receipts().
- Law #2 step 9 in the module docstring says "Emit policy_decision receipt" but this is NOT implemented.
- The policy evaluation result itself (allow/deny + risk_tier) is never receipted at the policy layer.
- Receipt for policy denial happens upstream in graph.py classify_node (Cycle 4 confirmed gap).

#### middleware/rate_limiter.py — CONFIRMED MISSING RECEIPT
- Lines 197-214: Rate limit exceeded returns 429 JSONResponse with NO receipt stored.
- Law #3 comment in source says "fail-closed on abuse" but there is no Law #2 receipt for the rate limit denial.

#### middleware/exception_handler.py — LARGELY COMPLIANT
- Lines 112-132: receipt IS constructed and stored via store_receipts([receipt]).
- MEDIUM: risk_tier hardcoded to "green" for all unhandled exceptions (line 123).
- MEDIUM: receipt_type is "exception" (non-standard, not in ReceiptType enum).
- MEDIUM: Missing fields: tool_used="http_handler" (not a real tool_id), no capability_token_id.

#### middleware/correlation.py — COMPLIANT
- Correctly sets trace_id, span_id, parent_span_id in contextvars. No receipt needed (infrastructure layer).

#### middleware/chaos.py — MISSING RECEIPT
- Lines 127-134 (connection drop): returns 503 with NO receipt.
- Lines 144-152 (error injection): returns 500 with NO receipt.
- MEDIUM: chaos injections are logged but not receipted. Law #2 comment in module docstring says "Every injection is logged (receipt-level traceability)" — this is inaccurate, logs are NOT receipts.

#### admin.py — /admin/ops/readiness-contract (line 1802)
- Line 1807-1813: Auth denial returns 401 with NO receipt. _build_access_receipt not called. MEDIUM.

#### admin.py — /admin/ops/voice/config (line 1858)
- Line 1863-1869: Auth denial returns 401 with NO receipt. _build_access_receipt not called. MEDIUM.

#### admin.py — /admin/ops/health-pulse (line 2961)
- Line 2993-3007: Internal failure path (result.success == False) returns 500 with NO receipt. MEDIUM.

#### admin.py — /admin/ops/triage/{incident_id} (line 3018)
- Line 3048-3067: Internal failure / 404 paths return errors with NO receipt. MEDIUM.

#### admin.py — /admin/ops/provider-analysis (line 3078)
- Line 3104-3124: Internal failure path returns 500 with NO receipt. MEDIUM.

#### admin.py — /admin/ops/voice/stt (line 4212)
- COMPLIANT: auth denial receipted (4224-4229), success receipted (4255-4262), failure receipted (4275-4283).
- MINOR: empty body check (lines 4239-4244) returns 400 with NO receipt.

#### robots.py — COMPLIANT
- Auth failure (lines 185-193, 197-205): NO receipt. These are pre-parse failures — MEDIUM (consistent with pattern).
- JSON parse failure (lines 210-217): NO receipt — MEDIUM.
- All schema validation failures, failed runs, and success paths: receipts correctly emitted.

### Systemic Confirmed Gaps (All Cycles)
1. capability_token_id missing from ALL route-level receipts (systemic)
2. receipt_hash="" hardcoded in tool_executor._make_receipt_data() and base_client.make_receipt_data()
3. policy_engine.py emits NO receipts for policy decisions
4. webhook handlers (PandaDoc, Twilio) construct but never STORE receipts
5. rate_limiter returns 429 with no receipt
6. Pre-parse/pre-auth failure exits (across all routes) emit no receipts
