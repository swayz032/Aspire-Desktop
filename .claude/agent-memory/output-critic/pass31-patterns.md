---
name: Pass 3.1 patterns
description: Anti-patterns, gaps, and verified findings from the Pass 3.1 Wave 1 adversarial review (property aggregator + Adam research client)
type: project
---

# Pass 3.1 Patterns (2026-05-10)

## Confirmed Working
- `withTimeout` wrapper resolves undefined on both timeout and rejection — safe fan-out.
- `classifyStatus()` three-tier (ok/partial/missing) logic is correct.
- `asyncio.gather(return_exceptions=True)` pattern in trades.py correctly isolates ATTOM history failure from Apify failure.
- Roof-first keyword priority in zillow_photo_normalizer.py is correct and tested.
- Law #9 compliance at address sanitization layer: key scrubbed from error messages, address truncated in logs.

## Critical Issues Found

### BLOCKER-1: Cache read/write key mismatch (permanent cache miss)
- readCache() at propertyAggregator.ts:279 uses `cleanAddress` (raw user input)
- writeCache() at line:512 uses `formattedAddress` (Google-normalized)
- These strings never match → 24h cache is 100% non-functional → every request burns Apify credits
- Pattern: agent wrote the cache logic in two separate places and forgot to unify the key.

### BLOCKER-2: Double timeout kills Adam cold-start (12s vs 25s design intent)
- ADAM_TIMEOUT_MS = 12_000 in aggregator overrides DEFAULT_TIMEOUT_MS = 25_000 in adamResearchClient
- The 25s constant has a comment explaining it's needed for Apify cold-start (~15s)
- The aggregator silently passes 12s via timeoutMs override, guaranteeing cold-start api_failure
- Pattern: two files each document their timeout intent, but the caller overrides without noticing the discrepancy.

### BLOCKER-3: Apify client-side timeout (15s) conflicts with server-side timeout param (120s)
- timeout_seconds = 15.0 kills the HTTP connection before Apify's 120s bound can apply
- Cold-start actors take 10s+ → near-certain network timeout → photos always missing on cold start

### HIGH-1: `propertyStatus: "FOR_SALE"` kills photos for commercial/industrial (Aspire's primary market)
- Default is FOR_SALE; commercial buildings are almost never for-sale
- trades.py never passes property_status override → always uses default
- Effect: Apify returns empty items → status=missing → zero photos in Visuals tab for real job sites

### HIGH-2: Null Island coords — `{lat:0, lng:0}` returned when all geo fails
- propertyAggregator.ts:474 falls back to {lat:0,lng:0} — renders Gulf of Guinea in Street View hero
- No user-visible error, no evidenceGap for coords

### HIGH-3: Wrong receipt status for needs_correction (writes 'api_failure', should be 'partial')
- propertyAggregator.ts:302 — successful Google call that returned a correction is logged as api_failure
- Corrupts receipt ledger audit stats

### HIGH-4: No per-tenant Apify usage counter or budget circuit breaker
- Plan documents the cap (1,388 lookups/month free plan) but nothing was built to enforce it
- 429s degrade silently to status='api_failure' with no alerting

## Medium Issues
- Address sanitizer regex /^[A-Za-z0-9\s,.\-#'/]+$/ rejects valid addresses with '&', accents, em-dashes
- street_number + route combination in extractComponents() has implicit ordering dependency
- Migration comment still references deleted Static Maps client and "Apify Zillow" as desktop client

## Recurring Anti-Pattern (confirmed again)
- Cache key asymmetry: read path uses one form of the key, write path uses another normalized form.
  This is a variant of the "two sources of truth" bug. Always verify that the SELECT key and INSERT key
  are built from the same expression, or use a shared normalizer function.
- Timeout constant duplication across files: when caller passes timeoutMs override to a client that has
  its own DEFAULT_TIMEOUT_MS, the override silently wins. Keep timeout as a single constant defined once.
