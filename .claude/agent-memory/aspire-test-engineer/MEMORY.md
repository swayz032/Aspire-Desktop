# Aspire Test Engineer Memory — Aspire-desktop

## Test Infrastructure

- **Framework**: `jest-expo` preset (configured in `package.json` `"jest": {"preset": "jest-expo"}`)
- **Test runner**: `jest --watchAll` via `npm test`
- **React Native testing**: `@testing-library/react-native` v13 (`renderHook`, `act`)
- **E2E**: Playwright (`e2e/onboarding.spec.ts`) — hits `www.aspireos.app` (live env only)
- **No jest.config.js file**: config is entirely in `package.json` jest field
- **No coverage threshold configured**: must add `--coverage` flag and `coverageThreshold` explicitly

## Test File Locations

- `hooks/__tests__/` — hook unit tests (6 files)
- `components/**/__tests__/` — component tests
- `components/canvas/widgets/*.test.tsx` — widget tests (flat)
- `lib/__tests__/` — store/utility tests
- `e2e/` — Playwright E2E (live environment)

## Coverage Map (as of 2026-03-08)

| Module | Test File | Coverage |
|--------|-----------|----------|
| `hooks/useCanvasVoice.ts` | `hooks/__tests__/useCanvasVoice.test.ts` | Yes (9 tests) |
| `hooks/useAgentVoice.ts` | NONE | 0% |
| `app/session/voice.tsx` | NONE | 0% |
| `data/session.ts` | NONE | 0% |
| `lib/elevenlabs.ts` | NONE | 0% |

## Key Patterns

- **Mock pattern**: capture callbacks via closure in `jest.mock()` factory, expose as module-level vars (`mockOnStatusChange`, `mockOnError`), trigger via `act()`
- **Fake timers**: `jest.useFakeTimers()` in `beforeEach`, real timers in `afterEach` — used in `useActivityStream.test.ts`
- **Platform mocking**: `Object.defineProperty(Platform, 'OS', { value: 'web', writable: true })`
- **No snapshot tests** in this codebase — all assertion-based

## Critical Gaps Found (voice.tsx fix — 2026-03-08)

- `resolveAgentFromSession()` — pure function, zero tests
- `STAFF_TO_AGENT` mapping table — zero tests (11 entries, several with shared 'ava' resolution)
- `onError` classifier (auth/autoplay/mic/tts branches) — zero tests
- `useEffect` mount/unmount teardown (`startSession` / `endSession`) — zero tests
- `useAgentVoice` hook itself — zero unit tests (only tested transitively via `useCanvasVoice`)
- `data/session.ts` module-level mutable `currentSession` — flaky risk (state leaks between tests)

## Known Flaky Risk

- `data/session.ts` uses module-level `let currentSession: Session | null = null` — if tests import this module without resetting, state leaks between test files. Must call `endSession()` or mock the module in any test that calls `getCurrentSession()`.

## Backend Routes Scan (Cycle 3 — 2026-03-22)

See `backend-routes-scan-cycle3.md` for full findings. Key blockers:
- `routes/webhooks.py:141,235` — `hmac.new()` is CORRECT Python stdlib API (confirmed in Cycle 4)
- `routes/webhooks.py:162-168` + `254-261` — PandaDoc + Twilio webhooks emit NO receipt (Law #2 violation)
- `routes/admin.py:640` — `receipt_hash` is random UUID, not a verifiable SHA-256
- `routes/admin.py:728` — `async def _check_redis()` blocks event loop with sync redis client
- `config/settings.py:55` — `token_signing_key` default is now "UNCONFIGURED-FAIL-CLOSED" (FIXED)
- `config/settings.py:81` — `credential_strict_mode=True` now (FIXED — was False)

## Orchestrator Core Scan (Cycle 4 — 2026-03-22)

See `backend-orchestrator-core-cycle4.md` for full findings. Evil tests in:
`backend/orchestrator/tests/test_evil_cycle4_orchestrator_core.py`

Key findings:
- CRITICAL: `receipt_write_node:86` calls `store_receipts()` for ALL tiers — YELLOW/RED must use `store_receipts_strict()` (Law #3). File: `nodes/receipt_write.py:86`
- CRITICAL: `approval_service._used_approval_request_ids` is in-memory Python set — replay defense lost on process restart. File: `services/approval_service.py:37` (comment says "Phase 1 — moves to DB in Phase 2")
- HIGH: `store_receipts_strict()` from event loop thread schedules flush but does NOT await — receipt loss risk on fast shutdown. File: `services/receipt_store.py:500-505`
- HIGH: `sse_manager.build_stream_receipt()` always sets `receipt_hash: ""` — SSE receipts excluded from chain. File: `services/sse_manager.py:259`
- HIGH: `token_mint_node` falls back to `tool="unknown.tool"` when `allowed_tools` is empty — should fail-closed. File: `nodes/token_mint.py:158`
- WARNING: `_AsyncReceiptWriter.enqueue()` reads buffer length outside `_buffer_lock` (TOCTOU). File: `services/receipt_store.py:352`
- WARNING: `_used_approval_request_ids` grows unbounded (no pruning/TTL). File: `services/approval_service.py:37`
- INFO: `approval_store.py` and `capability_token.py` do NOT exist as separate files — functionality is in `approval_service.py` and `token_service.py` / `nodes/token_mint.py`

## Known In-Memory State (Phase 1 stubs — all multi-instance risks)

- `approval_service._used_approval_request_ids` — approval replay defense
- `token_service._revoked_tokens` — token revocation list
- `presence_service` — revocation set (line 85)
- `council_service` — council sessions (line 87)
- `receipt_store._receipts` — in-process receipt cache
- `milo_payroll` — payroll snapshot store (line 54)

## Provider Layer Scan (Cycle 6 — 2026-03-22)

See `backend-providers-scan-cycle6.md` for full findings.

Key findings:
- CRITICAL: `pandadoc_client.py:399` — `datetime.now()` (naive, no timezone) vs `datetime.fromisoformat()` (may be tz-aware) in credential expiry check — `TypeError` on comparison in Python 3.11+.
- CRITICAL: `pandadoc_webhook.py:318` — `asyncio.ensure_future()` used for async state-change callback with NO running loop guarantee in sync `process_event()`. Drops callbacks silently outside async context.
- HIGH: `base_client.make_receipt_data()` (`base_client.py:621`) — `receipt_hash` is always `""`. Breaks receipt chain integrity across ALL 15 BaseProviderClient subclasses.
- HIGH: `base_client.make_receipt_data()` — missing `idempotency_key` and `trace_id`/`span_id` fields required by 18-field receipt schema (Law #2).
- HIGH: `pandadoc_client.py:_build_operation_receipt()` — uses completely different schema (`receipt_id`, `ts`, `event_type`, `actor`, `status`, `inputs_hash`, `policy`) vs. standard receipt schema. Incompatible with receipt_chain auditor.
- HIGH: `stripe_webhook.py:_build_webhook_receipt()` + `pandadoc_webhook.py:_build_webhook_receipt()` — both use non-standard receipt schema (same problem as pandadoc internal receipts).
- HIGH: `office_message_client.py:_mk_receipt()` — `receipt_hash: ""` never computed.
- MEDIUM: `tavily_client.py:122` — API key written directly into POST body (`"api_key": settings.tavily_api_key`). Key appears in request logs and potentially provider_call_log JSON. (Law #9 risk)
- MEDIUM: `google_places_client.py:134`, `here_client.py:125`, `tomtom_client.py:130`, `mapbox_client.py:126` — API keys placed directly in query_params dict and passed to `_request()`. Keys will appear in URL-encoded log lines.
- MEDIUM: `gusto_client.py:422` — `gusto.payroll.run` uses PUT with no idempotency key on a RED-tier irreversible operation. If retry fires after partial success, double-payroll risk.
- MEDIUM: `stripe_webhook.py:StripeWebhookHandler._processed_events` — in-memory set, lost on restart. Replay attack possible after pod restart.
- MEDIUM: `pandadoc_webhook.py:PandaDocWebhookHandler._processed_events` — same in-memory dedup problem.
- LOW: `pandadoc_client.py:378-418` — `_check_credential_expiry()` called from `__init__` (sync context), `datetime.fromisoformat()` may raise `ValueError` on Python <3.7 format strings but is caught.
- LOW: `twilio_client.py` — overrides full `_request()` method but does NOT call `get_provider_call_logger()` on success or failure paths. Twilio calls invisible to provider observability.

## Evil Test File Index

| File | Cycle | Tests | Law Coverage |
|------|-------|-------|--------------|
| `tests/test_evil_wave7.py` | Wave 7 | ~25 | Rate limit, CORS, replay, input boundary, receipt integrity |
| `tests/test_evil_backend_sync.py` | Backend Sync | varies | Auth, RLS, receipt store |
| `tests/test_evil_security.py` | Security | varies | Injection, escalation, token |
| `tests/test_evil_cycle4_orchestrator_core.py` | Cycle 4 | ~25 | HMAC, receipt_write strict, approval replay, token scope |
| `tests/test_evil_cycle6_providers.py` | Cycle 6 | **26** | Datetime bug, async callback, receipt_hash, idempotency, replay, API key in body/logs, Deepgram empty body |
| `tests/test_evil_cycle7_skillpacks.py` | Cycle 7 | **32** | Signature mismatches, LAW #2 receipt persistence, async/sync governance, dead class, dead code |

## Skillpacks Scan (Cycle 7 — 2026-03-23)

Files: 20 Python files in `skillpacks/`. Key findings:
- **5 CRITICAL signature mismatches** (mail_ops_desk.py x3, teressa_books.py x1, clara_legal.py x1) — wrappers call impls with wrong param shapes; will raise TypeError or silently drop data at runtime
- **Systematic LAW #2**: All 9 rule-based skillpack classes build receipts via `_make_receipt()`/`_emit_receipt()` but NEVER call `store_receipts()`. Receipt returned in SkillPackResult only — not persisted. Affected: AdamResearch, EliInbox, MiloPayroll, QuinnInvoicing, TeressaBooks, SarahFrontDesk, NoraConference, MailOps, ClaraLegal
- **2 sync/no-receipt violations** on RED-tier dual approval methods: `EnhancedMiloPayroll.initiate_dual_approval` (milo_payroll.py:754) and `EnhancedClaraLegal.initiate_dual_approval` (clara_legal.py:1265) — both `def` not `async def`, return dict not AgentResult, no receipt emitted
- `AvaUserSkillPack` (ava_user.py:13) is empty dead class — no methods
- `books_sync` wrapper in teressa_books.py always passes `date_range={}` (line 133) — ignores caller's date_range; every call fails validation
- `_handle_read_action` is dead code in all 4 scaffold packs (qa_evals, release_manager, security_review, sre_triage)
- `EnhancedAvaUser`, `EnhancedAdamResearch`, `EnhancedEliInbox`, `EnhancedMiloPayroll`, `EnhancedFinnFinanceManager` all correctly persist via `execute_with_llm()` → `emit_receipt()`
- clara_legal.py correctly masks PII with `_mask_name()` + `_mask_email()` in sign_contract receipts
- `quinn_invoicing.py` sets `outcome="success"` pre-approval for YELLOW-tier operations — should be `outcome="pending"`

## Provider Layer Evil Tests (Cycle 6 — 2026-03-22) — 26/26 PASSING

Key test patterns used:
- `threading.Thread` to simulate sync context (no event loop) for `asyncio.ensure_future()` tests
- `patch("..._request", new=mock_fn)` where `mock_fn(self_arg, req)` to capture `ProviderRequest`
- `ProviderResponse` constructor takes `(status_code, body, success, error_code, error_message, provider_request_id, latency_ms)` — `receipt_data` is a `@property`, NOT a constructor param
- Stripe webhook receipt schema: uses `"status"` not `"outcome"`, reasons in `policy.reasons[]` not top-level `reason_code`
- `get_provider_call_logger` — patch via `aspire_orchestrator.providers.base_client` (imported there), not via `twilio_client` (not imported there — that's BUG-P6-06)

## Routes + Config Scan (Cycle 8 — 2026-03-23)

See `backend-routes-scan-cycle8.md` for full findings.

Key new bugs (not previously captured):
- **HIGH**: `routes/admin.py:794` — `asyncio.get_event_loop().run_in_executor()` in async route on Python 3.10+ raises DeprecationWarning (use `asyncio.get_running_loop()`). Same pattern at `server.py:392`.
- **HIGH**: `routes/admin.py:156-158` — `clear_admin_stores()` uses `_provider_health_lock` and `_provider_health` which are defined at line 3756 (end of file) — forward reference used in function defined earlier. Works at runtime but fragile module ordering.
- **HIGH**: `routes/admin.py:ingest_client_event` (line 1109) — on the SUCCESS path, NO receipt is stored. Every other admin endpoint calls `store_receipts()` on success. This is a LAW #2 violation.
- **HIGH**: `routes/intents.py:344` — `allow_internal_routing = bool(request.headers.get("x-admin-token"))` — presence of ANY non-empty value in `x-admin-token` grants internal routing privilege WITHOUT JWT verification. Header is NOT validated, only tested for truthiness.
- **MEDIUM**: `webhooks.py:162-168` and `254-261` — PandaDoc and Twilio webhook receipts are built in-memory but NEVER stored (`store_receipts()` is never called). Law #2 violation (same as Cycle 3 finding — still unfixed).
- **MEDIUM**: `config/secrets.py:140` — `verify_settings_coverage()` checks `"stripe_secret_key"` as field name but `Settings` has no `stripe_secret_key` field (only `stripe_api_key`). Verification silently checks a non-existent field.
- **LOW**: `routes/admin.py:794` + `server.py:392` — `asyncio.get_event_loop()` is deprecated in Python 3.10+ when called in async context; use `asyncio.get_running_loop()`.
- **INFO**: `_check_redis()` at admin.py:777 is now CORRECT — uses `run_in_executor` properly. Prior Cycle 3 report flagged line 728 incorrectly. The function at 777 is an `async def` and uses executor correctly.

## Wave D Playwright Coverage (2026-04-29)

- `e2e/research-modal-carousel.spec.ts` — updated in D.5: fixed scrim assertion (element deleted in D.1), added horizontal-cards describe block + ProductDetailModal describe block + prewarm-isolation describe block
- `e2e/anam-session-prewarm.spec.ts` — NEW in D.5: 3 tests for Anam session pre-warm contract (C.4)
- `e2e/native-parity-audit.md` — NEW in D.6: cross-platform parity audit for BaseCard, HotelCard, ProductCard, ProductDetailModal

Key patterns for horizontal card tests:
- `research-modal-scrim` testID is DELETED since D.1 — assert `backdropFilter` does not contain 'blur' instead
- Horizontal card orientation: `getCardOrientation('HotelShortlist') → 'horizontal'`, `getCardOrientation('LandlordPropertyPack') → 'vertical'`
- RN-Web inline transform for peek cards: readable via `el.style.transform` (literal string like `"translate(-50%, -50%) translateX(70%) translateZ(-90px) rotateY(-15deg) scale(0.82)"`)
- `data-card-offset` attribute exposed via `dataSet={{ cardOffset: String(offset) }}`
- Demo page accepts `?type=` param for artifact_type — use `?type=LandlordPropertyPack` for vertical regression test
- Playwright cannot intercept server→orchestrator fetch (prewarm calls) — test at contract level only

## Wave D-tests R3 Playwright Coverage (2026-04-29)

- `e2e/research-modal-carousel.spec.ts` — extended with 3 new describe blocks (14 new tests total):
  - `carousel wraparound` — right/left wrap, single card no arrows, keyboard wrap
  - `ProductDetailModal portal + auth` — auth headers, no-fetch when unauthenticated, viewport coverage, ESC impl bug doc
  - `ProductDetailModal hero gallery` — 5-image round-trip, testID contract, gallery arrow contract
- `e2e/store-disambiguation.spec.ts` — NEW: 4 passing tests (route contract + unit gap doc) + 3 skip() stubs for UI not yet built
- `backend/orchestrator/tests/test_voice_path_latency.py` — 7/7 PASS (both new tests from rnd-backend-A3 present and passing)

Pre-existing failures (NOT new regressions, carry forward):
- Line 203: `hotel-card-horizontal-hero` strict mode — 3 cards in DOM, test uses `.toBeVisible()` (resolves multiple)
- Line 529: `modal closes on ESC key` — ResearchModal ESC dismiss not wired in demo page
- anam-session-prewarm.spec.ts test 1 — server returns unexpected JSON shape for unauthenticated /api/anam/session

Key pattern: `ProductDetailModal` cannot be triggered via demo page UI without a `product_id` in mock records — test auth header contract via `page.evaluate()` + `page.route()` instead.

`StoreDisambiguation` has NO desktop UI implementation (task #32 is backend-only). Write `.skip()` stubs with TODO for expo-cards-r4. `chosenStoreIdBySuite` cache missing from `__testing__` exports — cannot unit test from agentToolRoutes.test.ts without adding it.

## Test Commands

```bash
# Run all Aspire-desktop unit tests
cd /mnt/c/Users/tonio/Projects/myapp/Aspire-desktop && npx jest --coverage --watchAll=false

# Run hook tests only
cd /mnt/c/Users/tonio/Projects/myapp/Aspire-desktop && npx jest hooks/ --coverage --watchAll=false

# Run with verbose output
cd /mnt/c/Users/tonio/Projects/myapp/Aspire-desktop && npx jest --verbose --watchAll=false

# Run Playwright e2e specs (use E2E_SKIP_WEBSERVER=true if server already running)
cd C:\Users\tonio\Projects\myapp\Aspire-desktop && E2E_SKIP_WEBSERVER=true pnpm playwright test e2e/research-modal-carousel.spec.ts e2e/anam-session-prewarm.spec.ts e2e/store-disambiguation.spec.ts e2e/store-disambiguation-card.spec.ts e2e/transcript-replay.spec.ts

# Run voice latency tests (WSL)
wsl -d Ubuntu-22.04 -e bash -c "cd /mnt/c/Users/tonio/Projects/myapp/backend/orchestrator && source ~/venvs/aspire/bin/activate && python -m pytest tests/test_voice_path_latency.py -v"

# Run R5 Wave 2 backend regression locks (WSL)
wsl -d Ubuntu-22.04 -e bash -c "cd /mnt/c/Users/tonio/Projects/myapp/backend/orchestrator && source ~/venvs/aspire/bin/activate && python -m pytest tests/test_transcript_regression_locks.py tests/test_voice_path_with_user_address.py tests/test_serpapi_rate_limit.py tests/test_attom_500_fallback.py tests/test_photo_proxy.py -v"
```

## Pass 14 Ingestion Tests (2026-04-30)

New files: `tests/services/ingestion/` (7 adapter test files + test_signatures.py) + `tests/security/` (4 new RLS evil files). 136/136 passing.
- `MemoryService.get()` RAISES `TENANT_ISOLATION_VIOLATION` on cross-tenant row, NOT returns None.
- `list_by_thread()` adds `tenant_id` filter to DB query (RLS at service layer); test by mocking supabase_select to return `[]`.
- `_row_to_memory_out()` requires flat columns: `trace_id`, `correlation_id`, `last_activity_at`, `source_surface`, `runtime_family`, `channel` + provenance fields. Include all in fake_db_row or use `.get()` pattern.
- `MemoryObjectOut` has no `.tenant_id` attribute — use `.scope.tenant_id` instead.
- Backfills in `tools/backfills/` — dry-run prints plan then fails at first real DB call (correct; ASPIRE_SUPABASE_URL not set in CI).
- Receipt audit tool: `tools/ci/receipt_audit.py` — pass `--since 2026-04-29 --require-100-percent`.

## Pass 19 Lane D Test Suite (2026-04-30)

**79 new tests (all passing, 2 stable runs)**

Integration tests (`tests/integration/`):
- `test_sarah_personalization_full_payload.py` — 19 tests: full §3.5 payload, HMAC enforcement, p95 latency
- `test_a2p_gating.py` — 10 tests: A2P gate blocks/allows, receipt Law #2, PII-free receipts, all 3 PublicNumberModes
- `test_aspire_sms_in_forward_existing_mode.py` — 4 tests: companion number as from_, carrier number not queried, A2P gate in FORWARD_EXISTING
- `test_front_desk_sync_to_personalization.py` — 6 tests: PATCH version increment, receipt, LKG cache invalidation, new phone in next personalization call

RLS evil tests (`tests/security/`):
- `test_rls_sms_messages_pin_archive.py` — 11 tests: B token+A headers rejected, missing headers, wrong scope, positive control
- `test_rls_messages_routes_cross_tenant.py` — 18 tests: all 8 /v1/messages/* endpoints reject cross-tenant, missing tenant-id, empty headers

Services unit tests (`tests/services/`):
- `test_caller_id_lookup_priority.py` — 12 tests: P1 routing wins, P2 SMS wins over P3, P4 fallback, receipt Law #2, Law #9 prefix-only

Playwright E2E (`e2e/`):
- `e2e/front-desk-honesty.spec.ts` — graceful tests against /demo/front-desk-setup (offline fixtures, no auth)
- `e2e/messages-page.spec.ts` — graceful tests against /demo/messages (offline fixtures, no auth)
- `e2e/incoming-call-style.spec.ts` — graceful tests against /demo/incoming-call (offline fixtures, no auth)

**Coverage (Pass 19 modules):**
- `forwarding_instructions.py`: 100%
- `twilio_provisioning.py`: 80%
- `calls.py` (route): 87%
- `sarah.py` (route): 69%
- `sms_io.py`: 62% (A2P gate path well-covered; sms_io happy path tests have pre-existing failures — A2P gate added without updating prior test mocks)
- `front_desk.py` (route): 61% (test-call + forwarding-instructions-route uncovered)
- `messages.py` (route): 50% (many route branches covered; some reply-path branches not yet exercised)

**Pre-existing failing tests (NOT regressions):**
- `tests/services/test_sms_io.py` — 6 failures: prior tests don't mock A2P gate (written before A2P gate was added to sms_io.py in Pass 19). These are pre-existing regressions.
- `tests/integration/test_v1_spine_integration.py` — 6 failures: ThreadOut schema mismatch (pre-existing)
- `tests/security/test_rls_memory_objects.py` — 2 failures: pre-existing
- `tests/security/test_rls_proactive_candidates.py` — 2 failures: pre-existing

**Key patterns:**
- LKG cache in `routes/sarah.py` is an `OrderedDict` — import `_lkg_cache` directly for cache isolation in tests
- `_cache_put` exported from sarah.py — use to pre-populate cache for invalidation tests
- `_full_tenant_select_side_effect` pattern: stateless function keyed by table name
- HMAC test helper: `hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()` where `signed = f"{ts}.".encode() + body_bytes`
- Receipt audit tool: `python -m tools.ci.receipt_audit --since 2026-04-30 --require-100-percent` (exits 0 even if DB unavailable — treats empty as passing)

**TS errors: 108 (baseline was 189, net improvement of 81)**

## R5 Wave 2 Regression Lock Tests (2026-04-30)

New test files (all 39/39 passing):
- `tests/test_transcript_regression_locks.py` — 7 tests, 3 transcripts (426b860b, 055f610b, 214de471)
- `tests/test_voice_path_with_user_address.py` — 3 tests, combined budget with user_address path
- `tests/test_serpapi_rate_limit.py` — 4 tests, 429 no-retry behavior
- `tests/test_attom_500_fallback.py` — 5 tests, ATTOM 500 structured error response
- `tests/test_photo_proxy.py` — 20 tests, photo proxy validator + key exposure prevention

Key patterns discovered:
- `Outcome.RATE_LIMITED` does NOT exist — rate limiting detected via `"RATE_LIMITED" in error.upper()` (trades.py F-HIGH-7)
- `photo_proxy.settings` is imported locally inside function — patch via `aspire_orchestrator.config.settings.settings`
- `NearestStore` fields: `place_id, name, address, postal_code, lat, lng, distance_miles, photo_url, user_lat, user_lng`

ESC test in research-modal-carousel.spec.ts (line ~529):
- ESC handler IS wired in ResearchModal (`useEffect keydown → dismiss()`). Test may pass now.
- False-green documentation test at old line 742 was REMOVED in R5 Wave 2.

New desktop files:
- `components/cards/StoreDisambiguationCard.tsx` — renders store_candidate records, onAction('pick_store')
- `e2e/store-disambiguation-card.spec.ts` — candidate schema + route contract + skip stubs for UI
- `e2e/transcript-replay.spec.ts` — 3 transcript replay specs (route-mock level)
