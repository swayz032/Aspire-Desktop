---
name: backend-routes-scan-cycle3
description: Backend Code Scanner Cycle 3 findings — routes/, config/, server.py
type: project
---

# Backend Routes Scan — Cycle 3 Findings (2026-03-22)

## Critical Bugs Found

### BUG-1: `hmac.new()` does not exist (BLOCKER)
- **File:** `routes/webhooks.py:141`, `routes/webhooks.py:235`
- **Root cause:** `hmac` module has `hmac.new()` removed since Python 3.0. Correct API is `hmac.HMAC(key, msg, digestmod)` or `hmac.new(key, msg, digestmod)` — BUT `hmac.new` was deprecated and REMOVED. The correct call is the `hmac` module function directly: `hmac.new` WAS valid pre-3.4 but this still compiles. In Python 3.x, `hmac.new` is available as a low-level constructor alias but it's `hmac.new(key, msg, digestmod)`. However `hmac.new(auth_token.encode(), data_to_sign.encode(), hashlib.sha1)` IS valid syntax as it maps to `hmac.HMAC()`. This is a STYLE/COMPAT issue, not runtime crash. MONITOR.

### BUG-2: `clear_admin_stores()` references `_provider_health_lock` before definition (HIGH)
- **File:** `routes/admin.py:154`
- **Root cause:** `_provider_health_lock` and `_provider_health` are defined at line 3690, but `clear_admin_stores()` at line 146 references them via NameError-catching try/except. NameError catch silently swallows the reference failure. Works at runtime because try/except catches NameError, but this is fragile — if the lock IS defined, the clear may happen during live operations.

### BUG-3: `_check_redis()` is `async def` but uses synchronous blocking redis client (HIGH)
- **File:** `routes/admin.py:728-742`
- **Root cause:** `_check_redis()` is declared `async def` but uses `redis_lib.from_url()` (sync redis) with a blocking `r.ping()` call. This blocks the asyncio event loop during deep health checks. Should use `aioredis` or `redis.asyncio`.

### BUG-4: `capability_token_required` set unconditionally inside loop (MEDIUM)
- **File:** `routes/intents.py:439`
- **Root cause:** `capability_token_required = True` is set inside the `for step in routing_plan.steps:` loop but OUTSIDE any conditional. It fires on every loop iteration, making it always True even for GREEN read-only actions. This is semantically correct per Law #5 (tokens always required) but the flag is never False in the "ready" response path — even when `routing_plan.steps` is empty, the flag was initialized to False and never set, which could mislead callers that no token is needed for a zero-step plan.

### BUG-5: `exchange_admin_token` not listed in server.py docstring endpoint inventory (LOW)
- **File:** `routes/admin.py:437` — `/admin/auth/exchange` is a POST endpoint present in admin router but absent from `server.py` docstring (lines 1-41). Low severity; documentation gap only.

### BUG-6: PandaDoc webhook emits NO receipt on success (HIGH — Law #2 violation)
- **File:** `routes/webhooks.py:162-168`
- **Root cause:** On successful PandaDoc webhook processing, the handler returns 200 but emits zero receipts. Stripe and Twilio handlers delegate to `StripeWebhookHandler.process_event()` which presumably handles receipts, but PandaDoc's handler just logs and returns. Missing receipt = Law #2 violation.

### BUG-7: Twilio webhook emits NO receipt on success (HIGH — Law #2 violation)
- **File:** `routes/webhooks.py:254-261`
- **Root cause:** Same as PandaDoc — Twilio handler logs and returns 200 with no receipt emission. The comment says "Phase 2+: Full event processing with receipt emission" — this is a known deferred item but it's a Law #2 violation if in production.

### BUG-8: `settings.py` — `token_signing_key` defaults to `""` without raising (MEDIUM — Law #3)
- **File:** `config/settings.py:55`
- **Root cause:** `token_signing_key: str = ""` silently allows an empty signing key in dev. The verify_settings_coverage() checks it, but settings itself doesn't raise. In production with credential_strict_mode=False (default), an empty signing key would produce unsigned tokens that accept any payload.

### BUG-9: `settings.py` `credential_strict_mode: bool = False` default (MEDIUM — Law #3)
- **File:** `config/settings.py:81`
- **Root cause:** `CREDENTIAL_STRICT_MODE` defaults False. This means the rotation enforcement is off unless explicitly set. Comment says "CREDENTIAL_STRICT_MODE=1 in production" but nothing enforces this at startup — the production gate checks don't include strict_mode verification.

### BUG-10: `_build_access_receipt()` uses `str(uuid.uuid4())` as `receipt_hash` (MEDIUM — Law #2)
- **File:** `routes/admin.py:640`
- **Root cause:** `"receipt_hash": str(uuid.uuid4())` is a random UUID, not an actual cryptographic hash of the receipt content. This makes the receipt hash non-verifiable. Contrast with `intents.py:116-121` which computes a real SHA-256 hash over canonical fields. Admin access receipts are thus unverifiable in the hash chain.

## Config Analysis

### Settings fail-open fields (Law #3 risk):
- `supabase_url: str = ""` — empty allowed, falls through to runtime errors
- `supabase_service_role_key: str = ""` — same
- `openai_api_key: str = ""` — verify_settings_coverage() catches this but doesn't prevent startup in dev
- `token_signing_key: str = ""` — Law #5 violation risk
- `s2s_hmac_secret: str = ""` — empty HMAC secret = effectively no auth for S2S calls

### Settings env_prefix mismatch:
- `settings.py:128` uses `env_prefix = "ASPIRE_"`
- `secrets.py` bridges with `_SETTINGS_PREFIX_MAP` — this works but is fragile; any new field added to settings that isn't in `_SETTINGS_PREFIX_MAP` will silently stay empty after SM load

## Server.py Analysis

- Import order: `load_secrets()` called at module level AFTER router registration (line 237), but before graph build. This is CORRECT sequencing.
- `load_secrets()` at module level means it fires on import during tests — will try AWS unless ASPIRE_ENV != "production" and no AWS creds.
- `_verify_environment_parity()` is a good fail-closed check (lines 242-254)
- Production gate checks for rate limit backend and outbox/A2A backends are solid.
- `probe_models_startup()` is wrapped in `asyncio.get_running_loop()` guard — correct for test environments.

## Good Patterns (No bugs)
- `robots.py`: HMAC uses `hmac_mod` alias to avoid collision with `hmac` module name
- `intents.py`: Full receipt coverage (auth failure, classification failure, routing failure, success)
- `admin.py`: `_require_admin()` fails closed when secret not configured
- `secrets.py`: Thread-safe cache with lock, fail-closed in production
- `logging_config.py`: Clean structured logging, no secrets logged
