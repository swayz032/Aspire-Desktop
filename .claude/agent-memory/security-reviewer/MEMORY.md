# Security Reviewer — Persistent Memory

## Key Hotspot Files
- `Aspire-desktop/server/routes.ts` — Bootstrap endpoint, receipt emission, HMAC webhook, rate limiters
- `Aspire-desktop/server/index.ts` — JWT auth middleware, tenant context, S2S bypass gate
- `Aspire-desktop/server/tenantContext.ts` — applyTenantContext (SET LOCAL for RLS Path B)
- `Aspire-desktop/server/db.ts` — drizzle + pg Pool, connects via DATABASE_URL
- `backend/supabase/migrations/20260210000002_desktop_tables.sql` — app.check_suite_access() dual-path RLS
- `backend/supabase/migrations/20260210000001_trust_spine_bundle.sql` — tenant_memberships schema + RLS

## RLS Architecture (Dual-Path)
- Path A (PostgREST/Supabase clients): `app.check_suite_access(suite_id)` → JOIN on `tenant_memberships` via `auth.uid()`
- Path B (Express/raw pg): `current_setting('app.current_suite_id', true)::uuid` set via `set_config(..., false)` (session-level, NOT transaction-local)
- `set_config('app.current_suite_id', suiteId, false)` uses `is_local=false` = session-level setting on the connection. This is a PgBouncer/connection-pool RISK — see patterns.md.

## Bootstrap Endpoint Security Profile (`POST /api/onboarding/bootstrap`)
- Auth: JWT-verified via `supabaseAdmin.auth.getUser(token)` in index.ts middleware
- userId: extracted from Supabase JWT — NOT from request body
- tenantId: deterministic `tenant-${userId.replace(/-/g,'').slice(0,16)}` — NOT user-controllable
- tenant_memberships INSERT: drizzle `sql`` template literal — parameterized — NOT vulnerable to SQL injection
- `::uuid` cast on `userId`: safe — PostgreSQL will reject non-UUID strings with an error, not silently succeed
- `ON CONFLICT DO NOTHING`: safe for idempotency; does NOT allow role escalation because tenantId is server-derived
- db role used: `postgres` superuser via DATABASE_URL (RISK — should be a scoped application role)
- Logger logs `tenantId` and `userId` on membership failure — these are non-PII internal IDs, acceptable

## Confirmed Findings
- CRITICAL: `.env` contains live Supabase service role key, Stripe secret, ElevenLabs key, Google OAuth secret, LiveKit secret, PolarisM credentials, invite code. File is gitignored but exists on disk with cleartext credentials.
- HIGH: `db` (drizzle) connects as Postgres `postgres` superuser, NOT a least-privilege application role. All raw SQL through `db.execute()` bypasses RLS at the DB driver level.
- MEDIUM: `set_config('app.current_suite_id', ..., false)` is session-level, not transaction-local. In connection-pooled environments, session config can bleed across requests if a connection is reused without reset. Should use `is_local=true` (transaction-local).
- MEDIUM: n8n webhook payload (line 803-819) includes `dateOfBirth`, `gender`, `painPoint`, `incomeRange` — PII fields sent to external webhook endpoint. HMAC signature is present but payload is not redacted.
- LOW: Rate limiter stored in process memory (`bootstrapRateLimit` Map). No Redis backing. Multi-process or multi-replica deployments will not share limits.
- LOW: Failure receipt path (lines 860-867) logs to logger only — no DB receipt emitted for bootstrap failures. Violates Law #2 for failure cases when no suiteId exists yet.
- INFO: `bypassPermissions` pattern NOT found in reviewed code.

## Conference Invitation System (Migration 071 / Wave 2E-2F) — 2026-03-07

### Critical Architecture Gaps
- HIGH: `acceptVideoCall()` and `declineVideoCall()` in `lib/incomingVideoCallStore.ts` use bare `fetch()` without Authorization header — the PATCH endpoint relies on cookie-based session auth (Supabase JS client manages cookies) rather than explicit Bearer token. This works IF the supabase anon client sets a session cookie, but is fragile and non-explicit. The POST in `conference.tsx` (line 195) also uses bare `fetch()`.
- HIGH: No rate limiting on `POST /api/conference/invite-internal`. An authenticated attacker can spam any user with invitation popups at unlimited rate. The only rate-limited endpoint is `GET /api/conference/lookup` (10 req/5min).
- HIGH: "Service role full access" RLS policy `FOR ALL USING (true) WITH CHECK (true)` on `conference_invitations` is correct in concept (service role already bypasses RLS), but the explicit permissive policy with `WITH CHECK (true)` means ANY Supabase client authenticated as service role can write any row unconstrained. Only acceptable if service role key is server-side only.
- MEDIUM: No input validation on `room_name` (no length cap, no character allowlist) in the POST invite-internal handler. Other endpoints cap `roomName` at 200 chars. Invite-internal doesn't.
- MEDIUM: No input validation on `invitee_suite_id` or `invitee_user_id` (no UUID format check). The `::uuid` cast in the FK constraint provides DB-level rejection but no early server-side error.
- MEDIUM: Realtime subscription filter `invitee_user_id=eq.${session.user.id}` is client-side filter suggestion. Supabase Realtime enforces RLS on the channel but only the SELECT policy exists. The SELECT policy uses `invitee_user_id = auth.uid()` — this is correct but depends on Supabase Realtime correctly applying RLS. Verified: Supabase Realtime does enforce RLS via auth.uid() on postgres_changes channels.
- LOW: PATCH endpoint update `.eq('id', id)` does not add a second `.eq('invitee_user_id', userId)` filter. The ownership check is done in application code before the UPDATE (line 823), which is correct but one extra `.eq()` would add DB-layer defense-in-depth.
- LOW: `livekit_server_url` is stored in the DB and returned to the Realtime subscriber in the INSERT payload. This exposes the WSS URL to the client before they accept (design decision, acceptable since it's the server URL not a token).
- INFO: LiveKit token is minted AFTER accept (correct — line 894), NOT stored in the invitation row. Token minting is gated on: auth + invitee_user_id match + status==pending + expiry check.
- INFO: Expiry check (line 832) is performed AFTER the ownership check. Correct order: ownership first, then status, then expiry.
- INFO: `bypassPermissions` NOT found in conference invitation code.

### Realtime Security Model
- Client subscribes using anon key + Supabase session (JWT set via `supabase.auth.getSession`)
- Supabase Realtime applies RLS: `invitee_user_id = auth.uid()` — only invitee sees their invitations
- Filter `invitee_user_id=eq.${session.user.id}` is a client hint for performance, NOT the security gate
- The DB-level SELECT policy is the enforcement boundary

### Missing RLS Policies
- No `FOR INSERT` policy for authenticated users (only service role can insert via Supabase client)
- No `FOR UPDATE` policy for invitees (only service role can update)
- This is intentional: all writes go through the Express server using supabaseAdmin (service role)
- Risk: if client-side Supabase calls are ever added, they will fail silently (no insert policy = RLS deny)

## Patterns
- Receipt emission via `emitReceipt()` uses drizzle parameterized sql`` — safe against injection
- `sanitizeText()` strips `<tags>` and `javascript:` — adequate XSS defense for text fields
- `validateEnum()` uses allowlist — safe against injection for enum fields
- `isValidIsoDate()` + `isAdultDate()` validated before use — correct
- HMAC webhook uses `sortKeys()` canonical JSON — correct and matches n8n receiver
- Conference invite: acceptVideoCall/declineVideoCall use bare fetch() (no Bearer header) — pattern to watch

## Cycle 3 Findings (Routes + Server) — 2026-03-22

### Backend Routes (`routes/`)
- HIGH: `POST /v1/intents/classify` trusts `x-suite-id`, `x-office-id`, `x-actor-id` headers with NO cryptographic verification. Any caller that can reach port 8000 can set arbitrary tenant context. Documented as "Gateway enforces auth; orchestrator trusts Gateway" — but if network boundary fails, this is unauthenticated cross-tenant access.
- HIGH: `ASPIRE_ADMIN_JWT_SECRET` is NOT in `secrets.py` KEY_MAP or GROUP_KEY_MAP. It must be manually set as an env var or admin facade goes into fail-closed deny-all mode (which is safe but creates ops risk).
- MEDIUM: Admin facade receipt_hash field uses `str(uuid.uuid4())` (random) instead of a SHA-256 canonical hash like `intents.py` does. This undermines receipt chain integrity for admin receipts.
- MEDIUM: `allow_internal_routing` flag is read from the request payload body (`req.payload.get("allow_internal_routing")`) in `intents.py` line 340. An authenticated user can set this flag to bypass internal-only skill pack routing guards.
- LOW: Admin facade token lifetime is 1 hour (`timedelta(hours=1)`) — exceeds the 60s Law #5 cap for capability tokens. Acceptable for admin session JWTs (not capability tokens), but worth noting.
- LOW: PandaDoc receipt does not emit a receipt on acknowledgment — only logs. Law #2 gap for external webhook events.

### Desktop Server (`Aspire-desktop/server/`)
- MEDIUM: `GET /api/config/public` returns `GOOGLE_MAPS_API_KEY` with no auth, no referrer check in code (relies on GCP console restriction). If GCP referrer restriction misconfigured, key is open.
- MEDIUM: `GET /api/places/` endpoints are in PUBLIC_PATHS (no JWT) with no rate limiting beyond the global 200 req/min. Can be used to proxy unlimited Google Places API requests.
- MEDIUM: `wsTts.ts:75` — `let authenticated = !IS_PRODUCTION` means WebSocket TTS skips auth in all non-production environments including staging. Any user with network access to a staging server gets free ElevenLabs access.
- INFO: DEV_BYPASS_AUTH triple-condition guard (`=== 'true' && !SUPABASE_URL && !== 'production'`) is correctly structured — cannot fire in production.
- INFO: CORS allows all in dev (`true`). Acceptable for dev-only, blocked in production.

### Config (`config/`)
- INFO: `settings.py` defaults `credential_strict_mode: bool = False`. Only set to True when `CREDENTIAL_STRICT_MODE=1`. Production deployments should enforce this.
- INFO: `secrets.py` has correct fail-closed behavior for production + missing AWS creds. 5-min cache TTL with thread-safe invalidation is solid.
- INFO: `logging_config.py` — `JsonFormatter` logs extra fields from `record.__dict__` — if any calling code passes sensitive data as extra kwargs to logger, it will appear in structured logs. No evidence of this in reviewed code but worth ongoing vigilance.

### `bypassPermissions` Status
- NOT FOUND in any file reviewed in Cycle 3.

## Cycle 4 Findings (Orchestrator Core + Services) — 2026-03-22

### graph.py
- MEDIUM: `route_node` (graph.py:522) reads `requested_agent` from `request.payload` without auth verification. In the backwards-compat path (no utterance), `policy_eval` is hit without a classify/route pipeline, so the `allow_internal_routing` guard in SkillRouter is bypassed entirely.
- INFO: `classify_node` preserves explicit `task_type` from client when LLM returns unknown. This is intentional (comment explains it) but means a client-supplied `task_type` value can force a specific policy matrix path if the LLM confidence is low. The guard `policy_result.allowed` must be correct.
- INFO: `_CompiledGraphCompat._normalize_interrupt_result` warns on unexpected interrupt keys but does not deny — logs warning only. Interrupt payload injection is theoretically possible from an untrusted HITL resume callback.
- LOW: Production fail-open: `ASPIRE_ALLOW_MEMORY_CHECKPOINTER_IN_PROD=1` env var allows MemorySaver in production, bypassing the postgres-required guard (graph.py:1024-1025). No capability-security impact but state durability is lost.

### token_mint.py (nodes/)
- MEDIUM: Full capability token (including HMAC signature) stored in `OrchestratorState["capability_token"]` (state.py:71). If state is serialized to LangGraph Postgres checkpointer or logged anywhere, the signed token is durably persisted. Token is short-lived (45s default) so window is narrow, but the signature is a durable signing artifact.
- INFO: Token is correctly scoped (suite_id + office_id + tool + scopes). TTL enforced at 59s max. HMAC-SHA256 with canonical JSON — correct algorithm.
- INFO: `allow_internal_routing` does NOT flow through `route_node` in graph.py — context dict hardcodes only suite_id/office_id/current_agent. Internal pack guard therefore works correctly in the main pipeline.

### ava_user.py (skillpacks/)
- HIGH: `route_plan()` at line 66 passes `allow_internal_routing: bool(params.get('allow_internal_routing', False))` — params come directly from the MCP tool call payload. If a user can invoke the `ava_user` skill pack's `route_plan` action with `allow_internal_routing=true`, they bypass internal-only pack routing guard without admin token. This is a Law #7 violation — a tool is making an access-control decision based on user-supplied input.

### policy_engine.py
- INFO: Fail-closed correctly implemented. Unknown action → deny with YELLOW tier default. No default-allow paths found.
- INFO: `deny_by_default` defaults to `True` from YAML. No override path found.

### receipt_store.py
- INFO: No UPDATE or DELETE operations found. INSERT only with ON CONFLICT DO NOTHING. Law #2 compliant.
- INFO: `_AsyncReceiptWriter` drops OLDEST receipts on buffer overflow (not newest) — correct behavior for audit trail.
- MEDIUM: `store_receipts_strict` (line 501) — when called from the event loop thread, uses `loop.create_task(flush_now())` and logs a WARNING that flush is "not awaited." For YELLOW/RED tier receipts, this means persistence may happen after the pipeline already returns a response. Law #3 compliance is degraded in async execution contexts.

### middleware/correlation.py
- INFO: CRLF injection prevention present (line 121-122). HTTP response splitting mitigated.
- INFO: Traceparent parsing validates length (32/16 chars) but not hex format. Non-hex trace IDs will propagate through the system — low risk.

### middleware/rate_limiter.py
- MEDIUM: `allow_internal_routing` flag NOT the issue here. But `x-suite-id` header is the rate limit key — an attacker who can vary `x-suite-id` on every request gets effectively unlimited rate budget (each unique fake suite_id = fresh counter). IP fallback only applies when header is missing, not when it's spoofed.

### config/secrets.py (backend)
- INFO: Correct fail-closed for production. Thread-safe with `_secrets_lock`. No secrets logged.
- INFO: `_align_settings_prefix(override=True)` called after load — SM values overwrite any manually-set ASPIRE_ env vars. Intentional but could mask manual overrides set for debugging.

### Aspire-desktop/server/tenantContext.ts
- MEDIUM (confirmed from Cycle 1): `set_config(..., false)` is session-level. Pooled connections may bleed suiteId across requests.
- INFO: `suiteId` and `officeId` are passed as parameterized values via drizzle `sql`` template — safe from SQL injection.

### Aspire-desktop/server/secrets.ts
- INFO: No secrets logged. SM secret values injected only into `process.env` — not returned in responses.
- INFO: `SUPABASE_SERVICE_ROLE_KEY` presence used as the sole "critical env var" check for Railway passthrough mode (line 118-120). If SM is unavailable in production AND this key happens to be set (e.g., leaked to env), server starts without other critical secrets. Consider checking more keys.

### `bypassPermissions` Status
- NOT FOUND in any Cycle 4 files reviewed.

## Cycle 6 Findings (Provider Security + API Boundaries + RLS) — 2026-03-22

### Provider Clients (`backend/orchestrator/src/aspire_orchestrator/providers/`)
- HIGH: `plaid_client.py` — `_inject_auth()` inserts `client_id` and `secret` directly into the request body dict (line 99-104). The `base_client.py` `_MAX_LOG_BODY_CHARS = 80` safety constant is set but the log statement at line 337 only logs metadata (provider, method, path, suite_id, corr_id) — NOT the body. Safe. However, `_resolve_stripe_customer` at stripe_client.py line 184 logs `str(search_response.body)[:200]` on Stripe search failure — this body may contain email addresses (PII) sent back by Stripe in error payloads. MEDIUM.
- MEDIUM: `base_client.py` line 547-550 — unexpected exception handler logs `str(e)[:500]`. Python exception strings for HTTP errors can include the request URL (which may contain query params with user-supplied email, e.g., `/customers?email=user@example.com`). This URL is constructed at line 302-305 with unsanitized query_params from ProviderRequest. The `_resolve_stripe_customer` function passes `email` in the query param (line 170), which can appear in exception message logs.
- MEDIUM: `twilio_client.py` — Phone numbers (`to`, `from_number`) appear in the `ToolExecutionResult.data` dict (lines 397-404: `"from": call.get("from", ""), "to": call.get("to", "")`) which is returned to the orchestrator and may flow into receipt `result` fields. Phone numbers are PII (Law #9). The receipt doesn't redact phone numbers.
- LOW: `oauth2_manager.py` line 262 — bare `except Exception as e` catches and re-raises as ProviderError with `message=f"OAuth2 token refresh error: {type(e).__name__}: {e}"`. The `str(e)` of an httpx exception can include the token URL and response body. This error message flows into logs via `gusto_client.py` line 119. The token URL is non-sensitive (public OAuth endpoint) but this pattern could expose more if exception details change.
- INFO: `gusto_client.py` line 234 — `ein` (Employer Identification Number — a federal tax ID, legally equivalent to SSN for businesses) is returned in ToolExecutionResult.data from `execute_gusto_read_company`. This is sensitive financial PII that flows into receipts and LLM context. No redaction applied.
- INFO: `polaris_email_client.py` — email payloads correctly redacted in receipts via `_redact_email_payload()`. DLP implementation is correct.
- INFO: `plaid_client.py` — `access_token` is a user-supplied parameter in the payload for `execute_plaid_accounts_get` and `execute_plaid_transactions_get`. No validation that the access_token belongs to the requesting suite. If an attacker obtains another suite's Plaid access_token, they can use it directly. Token ownership is enforced only at Plaid's side (not server-side).

### routes.ts (Aspire-desktop/server/routes.ts)
- HIGH: `GET /api/users/slug/:slug` (line 1244) — NO authentication check. Any unauthenticated caller can enumerate suite profiles by slug. Returns full profile data including business_name, email, etc.
- HIGH: `PATCH /api/services/:serviceId` (line 1433) — NO authentication or ownership check before the update. `suiteId` defaults to `authenticatedSuiteId || 'unknown'` but the serviceId is not validated against the suiteId. Any authenticated user can update any service by ID.
- HIGH: `DELETE /api/services/:serviceId` (line 1472) — NO authentication check (`authenticatedSuiteId || 'unknown'` only used for receipt, not enforcement). No cross-tenant ownership verification before deletion.
- HIGH: `PUT /api/users/:userId/availability` (line 1521) — NO authentication check. Any unauthenticated caller can write availability slots for any userId.
- HIGH: `PUT /api/users/:userId/buffer-settings` (line 1573) — NO authentication check. Any unauthenticated caller can write buffer settings for any userId.
- MEDIUM: `POST /api/users` (line 1254) — authentication is checked via `authenticatedSuiteId || req.body?.suiteId || 'unknown'`. The fallback to `req.body?.suiteId` means an unauthenticated attacker can create a profile for any suiteId if the suiteId is known or guessed.
- MEDIUM: `GET /api/stripe/publishable-key` (line 280) — NO authentication check. The Stripe publishable key is semi-public by design (client-side), but returning it without any auth guard means it can be scraped freely.
- LOW: Error responses on internal routes (lines 1227, 1241, 1344, 1355, 1468, etc.) use `error instanceof Error ? error.message : 'unknown'` directly. DB error messages from drizzle/pg may leak schema details (table names, column names, constraint names).

### RLS Migrations (082-088)
- HIGH: Migration 082 `client_events` — `client_events_insert_anon` policy (line 124) allows ANY anonymous Supabase client to insert rows with `WITH CHECK (true)` — no tenant_id validation, no rate limiting. Fixed in migration 085, but if 082 is applied without 085, unauthenticated insertion of arbitrary client_events is possible. The fix (085) is present but the ordering dependency is fragile.
- MEDIUM: Migration 084 — `check_failure_rate_alerts()`, `check_dead_table_alerts()`, `check_agent_heartbeat_alerts()` are all `SECURITY DEFINER` functions that query `app.suites LIMIT 1` for the suite_id used in alert receipts (line 16). In a multi-tenant environment, this hardcodes alert receipts to the first suite in the table, which could cross-contaminate alert receipts across tenants.
- MEDIUM: Migration 088 `temporal_task_tokens` — SELECT policy uses `suite_id = (current_setting('app.current_suite_id', true))::TEXT` (line 45). This uses TEXT comparison, not UUID. The `app.current_suite_id` setting is set via the Express tenantContext middleware as session-level (is_local=false). The session-level bleed risk (already confirmed) applies here — a pooled connection could expose another tenant's task tokens.
- MEDIUM: `upsert_workflow_execution()` (migration 087 line 76) is `SECURITY DEFINER` and takes `p_suite_id TEXT DEFAULT NULL`. If called with `p_suite_id = NULL`, the UPDATE WHERE clause `suite_id = p_suite_id` matches nothing (NULL != NULL), and the INSERT would insert a row with `suite_id = NULL`, bypassing tenant isolation on the workflow_executions table.
- LOW: Migration 083 `workflow_executions` SELECT policy uses `app.is_member(tenant_id)` but `tenant_id` on workflow_executions references `public.tenants(tenant_id)` (TEXT), while RLS Path B uses `current_setting('app.current_suite_id')` as UUID. The `is_member()` function is checked — if it uses `auth.uid()` + tenant_memberships, it correctly enforces isolation. If it uses the `app.current_suite_id` setting, the session-bleed risk applies. UNABLE TO VERIFY without reading the is_member() function definition.

### `bypassPermissions` Status
- NOT FOUND in any Cycle 6 files reviewed.
