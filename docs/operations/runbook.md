# Aspire Desktop Server — Incident Runbook

## Service Overview

| Property | Value |
|----------|-------|
| Service | aspire-desktop (Express + TypeScript) |
| Port | 5000 (local), 3100 (Railway production gateway) |
| Entry point | `server/index.ts` via `npx tsx server/index.ts` |
| Health endpoint | GET /api/health |
| Circuit breakers | cockatiel (`server/circuitBreaker.ts`) |
| Logs | Structured JSON via `server/logger.ts` |
| Deployment | Railway (`swayz032/Aspire-Desktop`) |
| Production URL | https://www.aspireos.app |

## Dependency Map

| Dependency | Circuit Breaker | Impact if Down |
|------------|-----------------|----------------|
| Backend orchestrator (port 8000) | 5 failures / 30s → open 30s | Ava voice, governance operations blocked |
| Supabase (pooler :6543) | 5 failures / 30s → open 30s | Auth, RLS, data queries blocked |
| Stripe webhooks | 3 failures / 120s → open 120s | Subscription and billing events lost |
| Plaid | 3 failures / 120s → open 120s | Bank connection features degraded |
| QuickBooks | 3 failures / 120s → open 120s | Accounting sync blocked |
| Gusto | 3 failures / 120s → open 120s | Payroll features blocked |

All circuit breaker names and thresholds are defined in `server/circuitBreaker.ts` (cockatiel library).

## Quick Diagnosis Commands

```bash
# Health check (local)
curl -s http://localhost:5000/api/health | jq .

# Health check (production via Railway)
curl -s https://www.aspireos.app/api/health | jq .

# Circuit breaker states
# (logged on break/reset — search logs for "Circuit OPEN:")
railway logs --tail 50 | grep "Circuit"

# Railway production logs
railway logs --service aspire-desktop --tail 100

# Local process check
ps aux | grep tsx | grep server
```

---

## Failure Mode 1: Express Server Crash / Restart

### Symptoms
- `curl http://localhost:5000/api/health` returns connection refused
- Railway service shows restart loop or unhealthy status
- All users are affected — no API responses
- Prometheus alert `DesktopServerDown` fires

### Diagnosis

```bash
# 1. Check if process is running (local)
ps aux | grep "tsx server" | grep -v grep

# 2. Check Railway service status
railway status --service aspire-desktop

# 3. Get crash logs
railway logs --service aspire-desktop --tail 100

# 4. Look for startup errors — missing env vars are the most common cause
railway logs --service aspire-desktop | grep -E "(ERROR|FATAL|Cannot find|Missing)"
```

### Common Crash Causes

| Cause | Log Pattern | Fix |
|-------|-------------|-----|
| Missing env var | `Cannot read properties of undefined` | Set missing var in Railway service config |
| Port already in use | `EADDRINUSE :5000` | `pkill -f tsx` then restart |
| Supabase client init fail | `CRITICAL: Supabase admin client unavailable` | Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |
| DB migration fail | `Migration failed` | Check Supabase migration state via Supabase dashboard |
| Module not found | `Cannot find module` | Run `pnpm install` and rebuild |

### Resolution

```bash
# Local restart
pkill -f "tsx server" || true
sleep 2
cd /mnt/c/Users/tonio/Projects/myapp/Aspire-desktop
npx tsx server/index.ts

# Railway redeploy (production)
railway redeploy --service aspire-desktop

# Verify recovery
curl -s http://localhost:5000/api/health | jq .status
```

### Escalation
- P0 if production: All users blocked. Redeploy immediately. Page if redeploy fails.

---

## Failure Mode 2: Backend Proxy Failures (Circuit Breaker Open)

### Symptoms
- Requests to `/api/orchestrator/*` return 503 or circuit-open error
- Circuit breaker log: `Circuit OPEN: backend`
- Ava voice responses blocked
- Governance operations (intent submission) failing

### Diagnosis

```bash
# 1. Check circuit breaker state in logs
railway logs --service aspire-desktop | grep "Circuit"

# 2. Check if orchestrator is alive
curl -s http://localhost:8000/healthz | jq .status

# 3. Check backend logs for error pattern
railway logs --service aspire-backend | grep -E "(ERROR|5[0-9][0-9])" | tail -20

# 4. Check the specific route that is failing
# Intent proxy: POST /api/orchestrator/intent
# S2S auth: S2S_HMAC_SECRET_ACTIVE env var
```

### Resolution

```bash
# 1. Fix the upstream issue first (see backend runbook.md)

# 2. Circuit breaker auto-recovers after 30s (half-open probe)
# Wait 30 seconds, then test a single probe request
curl -s -X POST http://localhost:5000/api/orchestrator/intent \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"action_type": "health_check"}'

# 3. If the breaker is permanently stuck (should not happen with cockatiel):
# Restart the desktop server process — breakers reset on startup
pkill -f "tsx server"
npx tsx server/index.ts
```

### Escalation
- P1 if orchestrator is also down — dual-service outage. Both services need recovery before users can operate.

---

## Failure Mode 3: Stripe Webhook Processing Failures

### Symptoms
- Stripe dashboard shows webhook delivery failures (3xx/4xx/5xx responses)
- Subscription state in Supabase not updating after Stripe events
- `STRIPE_WEBHOOK_ERROR` in server logs
- Billing events are lost

### Diagnosis

```bash
# 1. Check webhook logs
railway logs --service aspire-desktop | grep -i "stripe\|webhook" | tail -30

# 2. Verify webhook secret is set
# Webhook secret is loaded via server/secrets.ts -> AWS Secrets Manager
# Check the secret is present in the running environment
railway variables --service aspire-desktop | grep STRIPE

# 3. Test Stripe signature validation manually
# The endpoint is: POST /api/stripe/webhook (no JWT — signature-validated only)
# Check PUBLIC_PATHS in server/index.ts — this path skips JWT auth

# 4. Check Stripe dashboard webhook event log
# https://dashboard.stripe.com/webhooks
# Look for failed deliveries and their HTTP status codes

# 5. Common: webhook secret mismatch between Railway env and Stripe dashboard
```

### Resolution

```bash
# 1. Verify STRIPE_WEBHOOK_SECRET matches the Stripe dashboard endpoint secret
# Rotate if compromised: new secret in Stripe dashboard -> update AWS Secrets Manager -> redeploy

# 2. If secret was recently rotated and webhooks are failing:
# Old: AWS Secrets Manager aspire/dev/stripe -> check secret_string for webhook_secret field
aws secretsmanager get-secret-value --secret-id aspire/dev/stripe --region us-east-1

# 3. Replay missed Stripe events from Stripe dashboard
# Stripe Dashboard -> Webhooks -> [endpoint] -> Event deliveries -> Resend

# 4. Emergency: Disable Stripe webhook processing temporarily
# Comment out WebhookHandlers in server/index.ts and redeploy
# WARNING: Subscription events will be lost during this window
```

### Escalation
- P1 if webhooks have been failing for > 30 minutes — subscription state is desynchronized from Stripe. Manual reconciliation required.

---

## Failure Mode 4: Supabase Connection Issues

### Symptoms
- Authenticated requests return 503 `AUTH_UNAVAILABLE`
- Server log: `CRITICAL: Supabase admin client unavailable`
- JWT verification failing — all authenticated routes blocked
- `/api/health` may still return 200 but authenticated routes fail

### Diagnosis

```bash
# 1. Check if supabaseAdmin is null (startup log)
railway logs --service aspire-desktop | grep "Supabase admin initialized"
# Expected: {"initialized": true}
# Failure: {"initialized": false}

# 2. Verify env vars
railway variables --service aspire-desktop | grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE"

# 3. Test Supabase pooler reachability
# Pooler: aws-1-us-east-1.pooler.supabase.com:6543
# NOTE: Direct host (aws-0-*) is IPv6 only and fails on Railway — always use aws-1- pooler

# 4. Check Supabase project status
# https://status.supabase.com
# https://supabase.com/dashboard/project/qtuehjqlcmfcascqjjhc
```

### Resolution

```bash
# 1. If env vars are missing: Set them in Railway service config
railway variables set SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key>
railway redeploy --service aspire-desktop

# 2. If Supabase is down (provider incident): Wait for recovery
# In the interim — server returns AUTH_UNAVAILABLE (Law #3: fail closed) — this is correct behavior
# Do NOT disable auth checks during a Supabase outage

# 3. If service role key is expired: Rotate via AWS Secrets Manager
# See: docs/operations/credential-rotation.md
```

### Escalation
- P1 if production: All authenticated requests blocked. Every user session is broken.

---

## Failure Mode 5: Memory Leaks / High CPU

### Symptoms
- Railway shows increasing memory usage over time without a ceiling
- Response latency increasing as memory pressure grows
- OOM kills in Railway logs: `Container killed — memory limit exceeded`
- Prometheus `HighMemoryUsage` alert fires (> 512MB)

### Diagnosis

```bash
# 1. Check Railway metrics (memory and CPU graphs in Railway dashboard)
# https://railway.app/project/<project-id>/service/<service-id>

# 2. Check process memory locally
# Local server process
ps aux | grep tsx | awk '{print $6}'  # RSS in KB

# 3. Check for WebSocket connection leaks (wsTts.ts)
# TTS WebSocket connections should close after each session
railway logs --service aspire-desktop | grep -c "WS connection"
railway logs --service aspire-desktop | grep -c "WS closed"

# 4. Check connection pool stats
# Drizzle ORM uses a pg pool — check pool.totalCount vs pool.idleCount
# Add logging to server/db.ts if pool stats are not already emitted
```

### Resolution

```bash
# 1. Immediate: Restart service to reclaim memory (temporary fix)
railway redeploy --service aspire-desktop

# 2. Identify the leak source:
#    - WebSocket connections: Check server/wsTts.ts — ensure ws.close() called in cleanup
#    - Database connections: Check server/db.ts pool configuration
#    - Event listeners: Look for accumulating listeners without removeListener calls
#    - Large in-memory state: Check server/tokenStore.ts and server/financeTokenStore.ts for unbounded growth

# 3. Adjust Railway memory limit if genuinely higher usage is expected
# Current baseline: 512MB alert threshold
```

### Escalation
- P2: Memory leak. Schedule fix within 48 hours. Add daily restarts as temporary mitigation.
- P1: If OOM kills are causing service restarts, treat as server crash (Failure Mode 1).

---

## Correlation ID Tracing

Every request through the desktop server propagates `x-correlation-id` and `x-trace-id`. These are set in `server/index.ts` middleware and forwarded to all backend proxy requests.

```bash
# Trace a specific request through the full stack
# 1. Get correlation ID from response headers
curl -v http://localhost:5000/api/orchestrator/intent 2>&1 | grep -i "x-correlation-id"

# 2. Search desktop server logs for that correlation ID
railway logs --service aspire-desktop | grep "<correlation-id>"

# 3. Search backend orchestrator logs for the same ID
railway logs --service aspire-backend | grep "<correlation-id>"
```

## DEV_BYPASS_AUTH Warning

`DEV_BYPASS_AUTH=true` skips JWT verification. This flag is guarded to only activate when `NODE_ENV !== 'production'` and `SUPABASE_URL` is absent. Confirm production deployments never have this set:

```bash
railway variables --service aspire-desktop | grep DEV_BYPASS_AUTH
# Must return empty or "false" for production
```

---

## Scaling Note: In-Memory Rate Limiters

### Current State

The desktop server uses in-memory `Map` objects for rate limiting on several routes in `server/routes.ts`:

| Line | Map Name | Purpose |
|------|----------|---------|
| ~425 | `inviteCodeRateLimit` | 5 attempts/min per IP — invite code validation |
| ~476 | `signupRateLimit` | Signup brute-force protection |
| ~589 | `bootstrapRateLimit` | 3 requests/60s per user — onboarding bootstrap |
| ~4204 | `onboardingRateMap` | 5 starts/min per suite — onboarding |
| ~4288 | `calendarRateMap` | 10 creates/min per suite — calendar events |
| ~6123 | `signingRateLimiter` | 20 req/min per IP — public signing route |

Additionally, `server/routes/livekit.ts` (~line 242) has a rate limit cleanup timer for conference join limits.

### Why This Works Today

Railway runs a **single instance** of the desktop server. All requests hit the same process, so in-memory Maps provide correct rate limiting with zero infrastructure overhead.

### Horizontal Scaling Impact (Phase 9+)

If the desktop server scales to multiple Railway instances (or any multi-process deployment):

- Each instance maintains its own independent Map — a client hitting different instances gets N times the intended rate limit
- Rate limiting becomes ineffective for brute-force prevention on auth routes
- The fix is to move rate limit state to **Redis** (already deployed on port 6379) using atomic `INCR` + `EXPIRE` commands
- Libraries: `rate-limiter-flexible` (npm, Redis-backed) is a drop-in replacement
- No code changes are needed until multi-instance scaling is planned

### Action Required

**None at this time.** This is a documentation note for future scaling work. The current single-instance Railway deployment is correctly protected by in-memory rate limiters.
