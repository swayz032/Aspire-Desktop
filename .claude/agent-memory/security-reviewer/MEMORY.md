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

## Cycle 7 Findings (Skillpacks + Desktop lib/hooks + Supabase RLS) — 2026-03-23

### Skillpacks (`backend/orchestrator/src/aspire_orchestrator/skillpacks/`)
- CRITICAL: `ava_user.py` route_plan fix CONFIRMED — `allow_internal_routing` is now hardcoded `False` (Cycle 4 finding RESOLVED).
- HIGH: `EliInboxSkillPack._execute_office_action()` (eli_inbox.py:226-276) calls `execute_tool()` for `office.create/draft/send` WITHOUT checking `approval_evidence`. Unlike milo/quinn/clara/sarah, Eli does not gate YELLOW-tier execution. Receipt shows `approval_required: True` but status is `ok`. Law #3 + Law #4 violation.
- HIGH: `EnhancedEliInbox.triage_email()` (eli_inbox.py:585-596) injects raw `email_data.get('body', '')[:1000]` directly into LLM prompt — prompt injection surface from external email content.
- HIGH: `MiloPayrollSkillPack._payroll_snapshots` is module-level dict (milo_payroll.py:56). Process-local, not shared across Railway replicas. Multi-process: snapshot from process A not visible to process B. Also: snapshot key `"{suite_id}:{payroll_period}"` does NOT verify that retrieved snapshot's `suite_id` matches context — potential cross-tenant bypass if key collision engineered.
- INFO: `milo_payroll.py` RED-tier gate CORRECTLY implemented — approval_evidence AND presence_evidence required before run_payroll executes.
- INFO: `quinn_invoicing.py`, `teressa_books.py`, `sarah_front_desk.py`, `clara_legal.py` — all correctly implement YELLOW approval gates (return pending without approval_evidence).
- INFO: ElevenLabs Voice IDs hardcoded in eli_inbox.py:556 comment — not secrets, already known in MEMORY.md.

### Desktop lib/security/
- CRITICAL: `lib/security/storage.ts:12-13` falls back to `localStorage` when expo-secure-store unavailable. `lib/security/mfa.ts:18-20` stores TOTP secret via this path. On web: TOTP secret is in cleartext `localStorage`, readable by XSS. MFA bypass if XSS gained.
- MEDIUM: `lib/security/mfa.ts:47-57` — `verifyMfaCode()` is entirely client-side. No server-side TOTP verification call. Attacker with stolen secret computes valid codes offline.
- MEDIUM: `lib/security/mfa.ts:69-76` — `isMfaVerifiedRecently()` reads `lastVerifiedAt` from the same localStorage-backed store. XSS can update this timestamp to bypass recency check.
- MEDIUM: `lib/security/plaidConsent.ts:32-39` — Plaid consent record stored in localStorage on web. XSS can set `consented=true` to bypass consent gate.

### Desktop hooks/
- INFO: `hooks/useOrchestratorChat.ts` — correctly injects Authorization + X-Suite-Id headers. No issues found.
- INFO: `hooks/useRealtimeApprovalRequests.ts` — correctly requires `suiteId` before subscribing. Polling fallback correct. No issues.
- INFO: `hooks/useDeepgramSTT.ts` — Deepgram token fetched from `/api/deepgram/token` with Authorization header. Token not stored client-side beyond the WebSocket subprotocol header. Correct pattern.

### Desktop lib/devLog.ts
- LOW: `devError()` is unconditional (no `isDev` gate). All other devLog functions are dev-only. Production browser console will show `devError()` calls.

### Supabase Migrations (this cycle)
- CRITICAL-RISK: `20260228000001_finance_knowledge_base.sql:126-127` — `finance_chunks_insert_service` policy has `FOR INSERT WITH CHECK (true)` with NO `TO service_role` clause. Any authenticated user can INSERT into this table, poisoning the global finance RAG knowledge base. Same for `finance_sources_insert_service` and update variants.
- HIGH: `20260225000001_incidents_provider_calls.sql:79-80` — `pcl_auth_select` policy `FOR SELECT TO authenticated USING (true)` has NO suite_id filter. Any tenant user reads all provider call logs cross-tenant. Law #6 violation.
- HIGH: `20260318000001_platform_admin_rls.sql:102-104` — `admin_allowlist_select_authenticated` uses `USING (true)`. Any authenticated user enumerates all admin email addresses.
- MEDIUM: `20260228000001_finance_knowledge_base.sql:210-307` — `search_finance_knowledge()` is `SECURITY DEFINER` and accepts caller-controlled `p_suite_id UUID`. No authorization check that caller belongs to the provided suite_id. Any tenant can read another tenant's private finance knowledge chunks.
- INFO: `20260318000001_platform_admin_rls.sql:9` — `app.is_platform_admin()` is `STABLE SECURITY DEFINER SET search_path TO 'public'` — correctly pinned search_path. No mutable search_path risk.
- INFO: `20260210000002_desktop_tables.sql` — all `WITH CHECK (true)` / `USING (true)` patterns in this migration are gated `TO service_role` — correctly scoped. Not a vulnerability.
- INFO: `20260225000001_incidents_provider_calls.sql` — service_role policies for `provider_call_log` and `client_events` are `TO service_role USING (true) WITH CHECK (true)` — correct for service role.

### `bypassPermissions` Status
- NOT FOUND in any Cycle 7 files reviewed.

## Cycle 8 Findings (Backend Routes + Config + Desktop Gateway) — 2026-03-23

### RESOLVED from Prior Cycles (Confirmed Fixed)
- RESOLVED: `PATCH /api/services/:serviceId` — now auth-gated (line 1440 checks `authenticatedSuiteId`)
- RESOLVED: `DELETE /api/services/:serviceId` — now auth-gated (line 1480 checks `authenticatedSuiteId`)
- RESOLVED: `PUT /api/users/:userId/availability` — now auth-gated AND ownership-checked (line 1529-1532)
- RESOLVED: `PUT /api/users/:userId/buffer-settings` — now auth-gated AND ownership-checked (line 1585-1588)
- RESOLVED: `GET /api/users/slug/:slug` — now auth-gated (line 1246 checks `authenticatedSuiteId`)
- RESOLVED: `POST /api/users` — now auth-gated via `authenticatedSuiteId` (no body fallback)
- RESOLVED: `allow_internal_routing` from user payload (Cycle 3/4 finding) — now hardcoded False in ava_user.py

### New Cycle 8 Findings

#### HIGH: `allow_internal_routing` in intents.py gated on presence of x-admin-token but NO validation
- File: `routes/intents.py:344` — `allow_internal_routing = bool(request.headers.get("x-admin-token"))`
- Any caller who can reach port 8000 can send `X-Admin-Token: foo` to activate internal routing
- Port 8000 is supposed to be Gateway-only but no cryptographic enforcement within the route itself
- The `_require_admin()` function (admin.py:237-264) DOES validate the JWT — but it is NOT called here
- Fix: call `_require_admin(request) is not None` instead of bare bool(header.get(...))

#### HIGH: `admin_allowlist_select_authenticated` — any authenticated user reads all admin emails
- File: `supabase/migrations/20260318000001_platform_admin_rls.sql:102-104`
- `FOR SELECT TO authenticated USING (true)` — no condition, any active session reads admin_allowlist
- Confirmed in Cycle 7, documented here for Cycle 8 reference
- Fix: Change to `USING (app.is_platform_admin())` — only admins should read the allowlist

#### HIGH: `pcl_auth_select` — any authenticated user reads all provider call logs cross-tenant
- File: `supabase/migrations/20260225000001_incidents_provider_calls.sql:79-80`
- `FOR SELECT TO authenticated USING (true)` — no suite_id filter
- Confirmed in Cycle 6, still unresolved

#### MEDIUM: `ingest_client_event` leaks store exception message in HTTP response
- File: `routes/admin.py:1202` — `message=f"Client event store error: {exc}"`
- Python exception strings may include table names, column names, SQL constraint details
- Fix: Return generic message; log full exc server-side only

#### MEDIUM: `admin/ops/health/deep` unauthenticated — reveals infrastructure topology
- File: `routes/admin.py:828-875` — `@router.get("/admin/ops/health/deep")` with no auth check
- Returns Redis URL status, n8n URL status, OpenAI config status, Postgres status
- `_check_n8n()` uses N8N_URL env var — degraded/up status reveals n8n presence
- `_check_postgres()` hits Supabase service role key — reveals DB connectivity

#### MEDIUM: `settings.py` credential_strict_mode now defaults True
- File: `config/settings.py:81` — `credential_strict_mode: bool = True`
- This is IMPROVED vs Cycle 3 finding (was False). Now requires `ASPIRE_CREDENTIAL_STRICT_MODE=0` to disable.

#### LOW: Twilio fallback (no SDK) uses SHA-1 HMAC — weaker than SDK path (SHA-1)
- File: `routes/webhooks.py:261` — `hmac.new(..., hashlib.sha1)`
- Twilio spec requires SHA-1, this is correct but worth noting for tracking
- Both paths use `hmac.compare_digest` — timing-safe

### `bypassPermissions` Status
- NOT FOUND in any Cycle 8 files reviewed.

## Cycle 9 Findings (ElevenLabs V1 Hybrid Architecture) — 2026-03-27

### CRITICAL
- None found.

### HIGH

#### HIGH: suite_id extraction mismatch — tool calls will 400 in production
- `elevenlabs-auth.ts:59` reads `suite_id` from `req.body` (request body)
- `setup-elevenlabs-agents.ts:104` puts `suite_id` in the request **header** (`x-suite-id: {{suite_id}}`), NOT the body
- The request body schemas for all 5 tool endpoints only define domain-specific fields (e.g., `query`, `domain`) — `suite_id` is NOT in any body schema
- ElevenLabs injects dynamic variables into the body only when they appear in the request_body_schema
- Result: `req.body.suite_id` is always undefined → every ElevenLabs tool call returns 400 `SCHEMA_VALIDATION_FAILED`
- OR: if ElevenLabs does inject dynamic vars into the body regardless, then `suite_id` IS in the body but is **user-supplied** (from the session's dynamic_variables) not server-derived — this is a documented design constraint, not a bypass since the shared secret gates the endpoint
- Fix: Either add `suite_id` to the request_body_schema for each server tool, OR update the middleware to also accept `suite_id` from the `x-suite-id` header when body field is absent, AND validate it is a UUID format
- Note: The middleware's body-read design is explicitly documented ("ElevenLabs passes it via dynamic variables") — but the setup script doesn't match this design

#### HIGH: `/v1/sessions` mounts elevenlabsToolsRouter without tool-secret middleware
- `server.ts:178` — `app.use('/v1/sessions', standardRateLimiter, elevenlabsToolsRouter)`
- The JWT `authMiddleware` at line 150 applies to all `/v1/*` routes, so `/v1/sessions/signed-url` is JWT-gated — CORRECT
- BUT: the full `elevenlabsToolsRouter` is also mounted here, meaning `/v1/sessions/context`, `/v1/sessions/search`, `/v1/sessions/draft`, `/v1/sessions/approve`, `/v1/sessions/execute` are all accessible via JWT auth instead of the tool secret
- These execution endpoints bypass the ElevenLabs tool secret verification when accessed via `/v1/sessions/` prefix
- An authenticated JWT user can call `/v1/sessions/execute` directly and execute RED-tier actions without going through the ElevenLabs agent flow
- `req.auth` is set by the JWT middleware, providing `suiteId` from a real JWT — so tenant isolation holds, but the full execute/approve/draft chain is now reachable from the web client without a capability token

#### HIGH: `routes.ts:6931` — ElevenLabs error body logged without sanitization
- `logger.error('[AgentSession] ElevenLabs returned ${elResp.status}', { agent, errorBody })`
- `errorBody` is the raw text from ElevenLabs API error response, untruncated, unredacted
- ElevenLabs error responses can include API key validity hints, quota messages, or agent configuration details
- The `agent` value is validated as one of 5 known values — safe
- `errorBody` is not truncated — could be large; no PII scrubbing
- Fix: truncate errorBody to 200 chars and strip any key-like patterns before logging

### MEDIUM

#### MEDIUM: Rate limiter keyed to IP (not suite_id) on /v1/tools path
- `server.ts:109` — `app.use('/v1/tools', standardRateLimiter, elevenlabsToolAuthMiddleware, elevenlabsToolsRouter)`
- Rate limiter runs BEFORE auth middleware, so `req.auth` is undefined at that point
- `suiteKeyGenerator` falls back to IP address when `req.auth?.suiteId` is undefined
- An attacker with multiple IPs can bypass per-suite rate limits on the tool endpoints
- This mirrors the Cycle 3/4 finding on `x-suite-id` header spoofing

#### MEDIUM: Twilio credentials transmitted to ElevenLabs API in cleartext request body (telephony)
- `telephonyEnterpriseRoutes.ts:79-85` — `twilio_account_sid` and `twilio_auth_token` sent to `api.elevenlabs.io/v1/convai/phone-numbers/create`
- These are passed directly from env vars (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`) to a third-party API
- The request is HTTPS so transit is protected, but ElevenLabs now holds Twilio credentials
- If ElevenLabs is compromised, Twilio account is accessible
- No logging of the credentials — safe on that dimension
- This is a design constraint of the ElevenLabs Twilio integration; risk should be documented

#### MEDIUM: /v1/webhooks/elevenlabs accepts suite_id from ElevenLabs metadata with no UUID validation
- `elevenlabs-webhooks.ts:107` — `const suiteId = typeof metadata.suite_id === 'string' ? metadata.suite_id : 'system'`
- `suiteId` is set from the webhook payload's metadata field — this is HMAC-verified (the whole body is signed)
- However, if a valid ElevenLabs agent is configured with a malicious suite_id (e.g., `system` or a fake UUID), that transcript is stored with the wrong tenant context
- The HMAC signature means only legitimate ElevenLabs calls reach this code — not exploitable externally
- Risk is an ElevenLabs platform compromise or misconfigured agent; not currently exploitable

#### MEDIUM: `useElevenLabsAgent.ts:110-113` — raw HTTP error body included in thrown Error message
- Error message: `Agent session request failed: HTTP ${resp.status} — ${body}` (line 112)
- This `Error` is passed to `Sentry.captureException` (line 167) and `onError` callback
- If the server sends a detailed error response, it appears in Sentry telemetry
- `voiceErrorPayload` responses are structured and contain no secrets — risk is LOW for server-to-client
- The raw body path (line 111 `.text()`) could expose any server-side message including internal error details from upstream

#### MEDIUM: Dynamic variable `suite_id` supplied by client in session request (design constraint)
- `useElevenLabsAgent.ts:258` — `suite_id: suiteId || ''` placed in `dynamicVariables` passed to `conversation.startSession()`
- The server's `dynamic_variables` response overrides the client value (`...serverVars` spread at line 265), but if the server returns no `suite_id` in `dynamic_variables` (e.g., profile fetch fails), the client-supplied value is used
- This client-supplied `suite_id` becomes the value ElevenLabs injects into tool calls as a dynamic variable
- The tool secret middleware trusts this body-supplied `suite_id` for tenant routing
- Mitigation: the server ALWAYS includes `suite_id: suiteId` in the dynamic_variables response (routes.ts:6977) where `suiteId` is from the JWT — so the server value wins in normal operation
- Risk materializes if: (a) profile fetch throws and the catch block skips setting suite_id, or (b) dynamicVariables is empty

#### MEDIUM: No receipt emitted for agent session failures (Law #2 gap)
- `routes.ts` agent-session handler catches errors but only calls `captureServerException` and `emitTraceEvent`
- No receipt is written to the database for agent session errors
- The `emitTraceEvent` is an in-memory/log trace, not a governance receipt
- For audit trail completeness, failed agent session requests (especially those that return 401/403) should emit a receipt

### LOW

#### LOW: `useVoice.ts:59` — dynamic require of useElevenLabsAgent silently falls back without alerting
- If `require('@/hooks/useElevenLabsAgent')` throws (e.g., due to a runtime error, not just missing file), the fallback to legacy hook happens silently
- All errors in the require catch block are swallowed — a broken ElevenLabs module would silently revert to legacy
- This is labeled "Law #3: Fail closed" in the comment but the behavior is actually fail-open (falls back to old behavior)

#### LOW: `elevenlabs-agents.ts` EXPO_PUBLIC_ agent IDs exposed at build time
- `EXPO_PUBLIC_ELEVENLABS_AGENT_AVA` etc. are baked into the client bundle
- ElevenLabs agent IDs (e.g., `agent_12345`) are semi-public by design — used to initiate sessions
- However, if an attacker obtains these IDs they can try to initiate sessions against ElevenLabs directly (bypassing the signed URL flow) if they also have an API key
- Since API key is server-side only, direct use of agent IDs without the API key is limited to reading public agent metadata
- Risk: low, but agent IDs should be treated as semi-sensitive and rotatable

#### LOW: `setup-elevenlabs-agents.ts` prints agent IDs to stdout in Railway export format
- Lines 776-783 print `railway variables set ELEVENLABS_AGENT_ID_AVA=<agent_id>` to stdout
- If CI/CD logs are publicly accessible or leaked, agent IDs are exposed
- Not critical (agent IDs are not API keys) but worth noting

### INFO
- `bypassPermissions`: NOT FOUND in any V1 hybrid files reviewed.
- `elevenlabs-auth.ts` timing-safe comparison: CORRECTLY implemented using `crypto.timingSafeEqual` with length pre-check
- HMAC webhook verification in `elevenlabs-webhooks.ts`: CORRECTLY implemented — raw body used for HMAC, timing-safe comparison
- ElevenLabs API key: stays server-side only. Client receives signed URL only. Verified across all files.
- System prompts in setup script contain no secrets — voice IDs are non-sensitive identifiers (already in MEMORY.md)
- `telephonyEnterpriseRoutes.ts` — ELEVENLABS_API_KEY set via `process.env` only, NOT logged
