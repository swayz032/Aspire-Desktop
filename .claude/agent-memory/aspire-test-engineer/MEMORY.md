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

## Provider Layer Evil Tests (Cycle 6 — 2026-03-22) — 26/26 PASSING

Key test patterns used:
- `threading.Thread` to simulate sync context (no event loop) for `asyncio.ensure_future()` tests
- `patch("..._request", new=mock_fn)` where `mock_fn(self_arg, req)` to capture `ProviderRequest`
- `ProviderResponse` constructor takes `(status_code, body, success, error_code, error_message, provider_request_id, latency_ms)` — `receipt_data` is a `@property`, NOT a constructor param
- Stripe webhook receipt schema: uses `"status"` not `"outcome"`, reasons in `policy.reasons[]` not top-level `reason_code`
- `get_provider_call_logger` — patch via `aspire_orchestrator.providers.base_client` (imported there), not via `twilio_client` (not imported there — that's BUG-P6-06)

## Test Commands

```bash
# Run all Aspire-desktop unit tests
cd /mnt/c/Users/tonio/Projects/myapp/Aspire-desktop && npx jest --coverage --watchAll=false

# Run hook tests only
cd /mnt/c/Users/tonio/Projects/myapp/Aspire-desktop && npx jest hooks/ --coverage --watchAll=false

# Run with verbose output
cd /mnt/c/Users/tonio/Projects/myapp/Aspire-desktop && npx jest --verbose --watchAll=false
```
