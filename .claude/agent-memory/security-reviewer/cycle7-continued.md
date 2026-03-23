---
name: Cycle 7 Continued Findings (Routes + Finance + Contracts + RLS)
description: Security findings from second half of Cycle 7 scan — routes.ts unguarded endpoints, financeRoutes.ts, contract routes, migrations
type: project
---

## Cycle 7 Second Pass — 2026-03-23

### routes.ts NEW FINDINGS (this pass)

- HIGH: `POST /api/bookings/:bookingId/cancel` (line 1669) — NO auth guard. `suiteId` defaults to `|| 'unknown'`. Any unauthenticated caller can cancel any booking by bookingId. Receipt is emitted but with suiteId='unknown'.
- HIGH: `GET /api/contracts/templates` (line 5609) — NO authentication check. Any unauthenticated caller gets the full PandaDoc template list from the workspace.
- HIGH: `POST /api/contracts/templates/:id/preview-session` (line 5741) — NO authentication check. Any unauthenticated caller can create PandaDoc embedded sessions for any template ID.
- HIGH: `POST /api/pandadoc/:documentId/preview` (line 6079) — NO authentication check. Any unauthenticated caller can create a PandaDoc preview session for any document ID.
- HIGH: `GET /api/inbox/items` (line 3420) — NO authentication check, NO tenant filter on SQL query. Cross-tenant inbox exposure: returns all inbox_items ordered by created_at DESC, no WHERE suite_id clause.
- MEDIUM: `/api/sandbox/health` is in PUBLIC_PATHS (line 81 index.ts) — unauthenticated. Returns provider configuration status including which API keys are configured (Stripe sandbox vs live, Plaid, Gusto, ElevenLabs, Deepgram, LiveKit, LIVEKIT_URL). Not keys themselves but reveals infrastructure posture.
- LOW: `POST /api/voice-test/bypass` (line 6324) — sends LLM response text in `responseText` field inside error JSON when ElevenLabs fails (line 6399). The LLM response may contain user-queried sensitive data exposed in a 502 error body.

### financeRoutes.ts

- All endpoints correctly check `authenticatedSuiteId` and return 401 if missing.
- `days` interpolation in `(${days} || ' days')::interval` — `days` is parsed via `parseInt(...) || 30` before use, and passed as a drizzle parameterized value. Safe from SQL injection (PostgreSQL receives it as a bind parameter).
- Authority queue approve/deny endpoints use `event_id AND suite_id AND office_id` in the UPDATE — correct tenant isolation.
- Receipt UPDATE (`UPDATE finance_events SET receipt_id = ...`) on line 441/526 is correct pattern (linking an existing row to a receipt ID, not modifying the receipt itself).

### Migrations (new in this pass)

- `20260318000001_platform_admin_rls.sql:102-104` — CONFIRMED: `admin_allowlist_select_authenticated` policy `FOR SELECT TO authenticated USING (true)` — any authenticated user reads all admin email addresses. This leaks the full list of platform admins.
- `20260228000001_finance_knowledge_base.sql:126-131` — CONFIRMED: `finance_chunks_insert_service` and `finance_chunks_update_service` policies have NO `TO service_role` clause. Any authenticated Supabase client can INSERT or UPDATE finance knowledge chunks, poisoning Finn's RAG knowledge base. Same for `finance_sources_insert_service` and `finance_sources_update_service`.
- `20260228000001_finance_knowledge_base.sql:240` — `search_finance_knowledge()` SECURITY DEFINER accepts caller-controlled `p_suite_id UUID` with no authorization check. Any tenant can query another tenant's private finance knowledge.

### bypassPermissions Status

- NOT FOUND in any files reviewed in this pass.

### CORS/CSP

- Production CORS: correctly restricted to `CORS_ALLOWED_ORIGINS` list (lines 450-452 index.ts).
- CSP: `'unsafe-inline'` in scriptSrc and styleSrc (lines 393-394). Acceptable for Expo web but weakens XSS protection.
- No localhost origins leak to production (CORS_ALLOWED_ORIGINS only applies in production; dev allows all).

### Hardcoded Secrets

- No hardcoded API keys found in backend Python files.
- No hardcoded API keys found in Aspire-desktop TypeScript files.
- `.env` files exist on disk (confirmed in prior cycles) but are gitignored.
- `sentry.ts:31` has a redaction pattern for `sk[-_](?:test|live|prod)[-_]\w+` — correct scrubbing for Sentry.
