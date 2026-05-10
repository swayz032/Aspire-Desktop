---
name: Aspire-Desktop codebase patterns for proof-artifacts-builder
description: Receipt shapes, test conventions, known gaps, risk tier precedents discovered during Pass 3.1 (2026-05-10)
type: project
---

## Receipt Service

- `createReceipt()` at `server/receiptService.ts` — `CreateReceiptParams` uses `Record<string, unknown>` (correct). Legacy `TrustSpineReceiptParams` interface (lines 20, 21, 58, 59) still has `Record<string, any>` — pre-existing gap, not a Pass 3.1 regression.
- `status` field: `'SUCCEEDED'` default, use `'FAILED'` for runtime exceptions, `'DENIED'` for policy rejections (invalid address, unauthorized).
- `correlationId` field: written to `receipts.correlation_id` column; use a `randomUUID()` per request, forward to downstream services so their receipts can be correlated back.
- Receipt evidence pattern: `outputs.evidence = [{ source: 'desktop_aggregator', correlation_id }, { source: 'adam', correlation_id }]` for cross-system trace chains (Law #2).

## Test Conventions

- All property service clients use a `__setFetchForTests(impl)` / `__setFetchForTests(undefined)` escape hatch pattern — no global fetch monkey-patching.
- `propertyAggregator.test.ts` mocks db, receiptService, and all 4 clients — it is an integration-layer test, not a unit test. Classification matters for PRR.
- Python test results come from WSL2 Ubuntu-22.04 with venv at `~/venvs/aspire`. If Python source not in Windows checkout, mark as [AS-REPORTED].

## Risk Tier Precedents

- New Express endpoints (read-only, data retrieval, no financial ops) → GREEN.
- New Supabase tables → YELLOW (requires DBA sign-off before applying migration to main project, apply to branch first).
- receiptService.ts additive changes (optional params) → GREEN (no existing callers break).

## Known Systemic Gaps (pre-existing, not introduced by Pass 3.1)

- `capability_token_id` is null on all property receipts — V1 arch gap (Law #5). Token minting sprint deferred.
- `_adam_receipt` empty hash chain — Python orchestrator-side gap (Law #2). aspire-backend sprint.
- `Record<string, any>` in legacy `TrustSpineReceiptParams` in `receiptService.ts` — pre-existing `any` usage in non-property code.
- UPDATE RLS policy missing on `property_snapshots` — backstop only; service role bypass covers server-side writes.

## Coverage Baseline

- `__tests__/server/serviceHub/property/` suite: 107 tests across 6 suites as of 2026-05-10. No CI coverage % established yet — must run `pnpm jest --coverage` before production promotion.
- Python: 47 tests across 3 suites as of 2026-05-10 (as-reported).

## Recurring DoD Issues Found

- `sql.raw()` in cache interval query (`propertyAggregator.ts` line 99) flagged by security-reviewer — currently safe (integer), but needs lint rule to prevent future injection drift. Flag in future PRs touching cache queries.
- Rate limiter absent on new endpoints — recurring pattern across codebase. Add to DoD checklist by default for any new Express route.
- Python source not present in local Windows checkout for `backend/orchestrator` — only venv is there. Always mark Python test results as [AS-REPORTED] until CI evidence is produced.
- Cache-hit path intentionally writes no receipt — design decision, not a Law #2 gap (cache read is not a state change). Document as design decision to avoid re-flagging.

## File Paths

- Proof artifacts: `docs/agents/proof-artifacts/` (created in Pass 3.1)
- Runbooks: `docs/runbooks/`
- Property service: `server/serviceHub/property/`
- Property tests: `__tests__/server/serviceHub/property/`
- Verification scripts: `scripts/test-google-maps-apis.mjs`, `scripts/test-apify-token.mjs`
- Migration: `supabase/migrations/20260510170000_property_snapshots.sql`

**Why:** Pass 3.1 was the first proof-artifacts-builder run for the Aspire-Desktop repo. These patterns are stable and will recur in Pass 3.2 and 3.3.
**How to apply:** Use these baselines when building DoD for Pass 3.2 (UI layer) — coverage baseline is now established, systemic gaps are tracked in deferred items.
