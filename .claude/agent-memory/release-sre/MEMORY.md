# Release SRE — Institutional Memory

## Round 7 Review (2026-04-30)
- See `round7-prr.md` — trades multi-store + briefing enrichment + Anam prompt polish

## Key Infrastructure Facts
- Desktop health endpoint: `GET /api/health` — checks DB + Supabase admin + circuit breakers + pool stats. Does NOT check briefing query or multi-store branch specifically.
- Backend test dir: `backend/orchestrator/tests/` — pytest. No jest.config in backend.
- Desktop test runner: jest-expo preset in package.json `"jest": { "preset": "jest-expo" }`. Picks up `*.test.ts` anywhere in Aspire-desktop.
- Diagnostic log B.2 is env-gated `LOG_TOOL_INVOKE_DIAG=true`, placed AFTER verifySecret (post-hotfix R-001 fix).
- `_emit_playbook_receipt` in trades.py is best-effort — receipt failures are logged and swallowed, never blocking user response.
- Capability token: stored on PlaybookContext as optional fields, NOT minted per-call (Law #5 pre-existing gap, carry to R8).
- SerpApi circuit breaker: NOT implemented. Degradation via retry+fail only.
- `HD_TOO_FAR_MILES = 25.0` — tuneable constant.
- `_SHOPPING_RETRY_MAX_ATTEMPTS = 2`, `_SHOPPING_RETRY_BASE_MS = (250, 500)` with 0-100ms jitter.
- Rollback commit hashes: R6 = 008ce56 + 6de97bd.
- Anam sync script: `railway run -s Aspire-Desktop node scripts/sync-anam-ava-canonical.mjs` — MUST run after every push.

## Recurring Operational Gaps
- No per-round runbook document for invoke_adam failures (only postmortem template exists)
- Backend Round 7 test files (D.3/D.5) not physically present — test-engineer committed desktop tests, backend pytest files were not committed
- Law #5 capability token gap is pre-existing across ALL playbooks, carry-forward to R8
- Health check at `/api/health` does not probe the multi-store branch or briefing query path
