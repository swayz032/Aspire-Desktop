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
