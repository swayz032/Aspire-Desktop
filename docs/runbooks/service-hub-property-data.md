# Runbook: Service Hub — Property Data Endpoint

**Service:** Aspire-Desktop
**Endpoint:** `POST /api/service-hub/property-data`
**Introduced:** Pass 3.1 — 2026-05-10
**Risk Tier:** GREEN
**On-call escalation:** Check receipts → check Railway logs → check provider dashboards

---

## How the Endpoint Works

### Request
```
POST /api/service-hub/property-data
Authorization: Bearer <supabase_jwt>
Content-Type: application/json

{
  "address": "1234 Industrial Way, Austin, TX 78758",
  "forceRefresh": false
}
```

- `address`: Required, 1–200 chars, printable ASCII only.
- `forceRefresh`: Optional boolean. When `true`, skips the 24h cache and forces a fresh upstream fetch.

### Processing pipeline (3 stages)

**Stage 0 — Cache lookup (24h TTL)**
Queries `public.property_snapshots WHERE suite_id = <tenant> AND address = <address> AND fetched_at > now() - interval '24 hours'`.
Cache hit → returns in <100ms, no upstream calls.

**Stage 1 — Address Validation gate (blocking)**
Calls Google Address Validation API. If the address is `invalid` → returns 422, no downstream calls.
If `needs_correction` → returns 200 with `suggestedAddress + propertyData:null`.
If `valid`, `unconfirmed`, or `api_failure` → proceeds to Stage 2.

**Stage 2 — Parallel fan-out (Promise.allSettled, 8s timeout each, 25s for Adam)**
Fires three requests in parallel:
- Adam research call → `POST {ORCHESTRATOR_URL}/v1/agents/invoke` with `task=PROPERTY_FACTS_AND_PERMITS`. Adam runs ATTOM + Apify Zillow scraper in parallel internally.
- Google Geocoding (only if Validation didn't return coords).
- Google Solar (requires coords).

**Stage 3 — Heuristics (synchronous)**
`materialSignalsHeuristic`: maps ATTOM property type + Solar roof type to material packages.
`costBandHeuristic`: maps sqft × $/sqft table to a `{low, high, currency}` band.

**Persist + Receipt**
Writes result to `property_snapshots` (24h TTL).
Writes receipt to `receipts` table with `action_type='compute_snapshot'`, `correlation_id` linking to Adam's playbook receipt.

### Response shapes

**200 — Full PropertyData:**
```json
{
  "address": { "formatted": "...", "street": "...", "city": "...", "state": "...", "zip": "..." },
  "coords": { "lat": 30.4, "lng": -97.7 },
  "hero": { "streetViewProxyUrl": "/api/places/streetview?address=..." },
  "facts": { "sqft": 12000, "yearBuilt": 1998, "zoning": "I-1", "propertyType": "WAREHOUSE" },
  "photos": {
    "interior": { "count": 3, "photos": [...] },
    "exterior": { "count": 8, "photos": [...] },
    "roof": { "count": 2, "photos": [...] },
    "streetView": { "count": 1, "photos": [...] }
  },
  "signals": { "materials": [...], "roofType": "TPO_MEMBRANE", "accessRisk": "low" },
  "costBand": { "low": 45000, "high": 120000, "currency": "USD" },
  "evidenceGaps": [],
  "fetchedAt": "2026-05-10T17:00:00.000Z",
  "sources": [
    { "name": "addressValidation", "status": "ok", "confidence": "high", "fetchedAt": "..." },
    { "name": "adam", "status": "ok", "confidence": "high", "fetchedAt": "..." },
    { "name": "solar", "status": "ok", "confidence": "high", "fetchedAt": "..." },
    { "name": "streetView", "status": "ok", "fetchedAt": "..." }
  ]
}
```

**200 — Correction needed (address was fuzzy):**
```json
{
  "suggestedAddress": "1234 Industrial Way, Austin, TX 78758",
  "components": { "street": "1234 Industrial Way", "city": "Austin", "state": "TX", "zip": "78758" },
  "propertyData": null
}
```

**400 — Bad request:**
- `ADDRESS_REQUIRED`: Empty address field.
- `ADDRESS_TOO_LONG`: Address exceeds 200 chars.

**401 — Auth required:**
- `AUTH_REQUIRED`: No authenticated suite context (JWT missing or invalid).

**422 — Address invalid:**
- `ADDRESS_INVALID`: Google Address Validation rejected the address as undeliverable.

**500 — Aggregator failed:**
- `AGGREGATOR_FAILED`: Unexpected exception in the aggregation pipeline. A FAILED receipt is written.

---

## How to Debug a Slow Property Fetch

**Symptoms:** User sees Visuals tab spinning >3s, or fetch times out.

**Step 1 — Check Railway logs (Aspire-Desktop service):**
```
[propertyAggregator] cache hit   ← fast path, <100ms
[AdamResearch] fetch failed      ← Adam timeout or network error
[propertyAggregator] cache write failed  ← non-fatal; watch for Supabase issues
```

**Step 2 — Is it a cache miss on a cold address?**
Expected behavior: first fetch for an address takes 10–25s (Apify cold-start inside Adam).
Second fetch should be <100ms (cache hit). Confirm via `cacheHit: true` in Railway logs.

**Step 3 — Is Adam timing out?**
`ADAM_TIMEOUT_MS = 25,000ms`. If logs show Adam timing out consistently:
- Check Ava-Brain orchestrator health on Railway.
- Check Apify actor status at `https://console.apify.com/actors/`.
- Check ATTOM API entitlement at `https://api.developer.attomdata.com/`.

**Step 4 — Check receipts for the request:**
Use the `correlation_id` from the server log or from the response-level log entry:
```sql
SELECT receipt_id, status, inputs->>'address', outputs, created_at
FROM receipts
WHERE correlation_id = '<correlation_id>'
ORDER BY created_at;
```

**Step 5 — Check Apify quota:**
```bash
railway run --service Ava-Brain node scripts/test-apify-token.mjs
```
FREE plan: 1,388 calls/month. If quota is exhausted, Apify calls return 402. Adam degrades to ATTOM-only (photos missing, facts present).

---

## How to Verify Google Cloud Key Health

Run the verification script against all 9 endpoints:
```bash
railway run --service Aspire-Desktop node scripts/test-google-maps-apis.mjs
```

Expected output: all 9 lines showing status 200.
Any `❌` line indicates the specific API is disabled on the Cloud Console for the key.

**How to fix a disabled API:**
1. Go to Google Cloud Console → APIs & Services → Library.
2. Search for the failing API (e.g., "Address Validation API").
3. Enable it and wait ~2 minutes.
4. Re-run the verification script.

**How to detect Apify token rotation needed:**
1. Run: `railway run --service Ava-Brain node scripts/test-apify-token.mjs`
2. If output shows `unauthorized` or `forbidden`, the token has been revoked.
3. Generate a new token at `https://console.apify.com/account/integrations`.
4. Update `ASPIRE_APIFY_API_KEY` in Railway Ava-Brain service environment.
5. Re-run the script to confirm.

---

## How to Clear Cache for a Tenant

**Clear a specific address:**
```sql
DELETE FROM public.property_snapshots
WHERE suite_id = '<suite_uuid>'::uuid
  AND address = '<exact_address_string>';
```

**Clear all cache for a tenant:**
```sql
DELETE FROM public.property_snapshots
WHERE suite_id = '<suite_uuid>'::uuid;
```

**Clear expired cache globally (maintenance):**
```sql
DELETE FROM public.property_snapshots
WHERE expires_at < now();
```

**Force a fresh fetch without clearing cache (preferred):**
Send `forceRefresh: true` in the request body. Cache is bypassed for this request but not deleted — the new result will overwrite via a new INSERT row (older rows age out naturally via `expires_at`).

---

## How to Verify Receipt Chain for a Request

Every successful, failed, or denied property data fetch writes a receipt to the `receipts` table.

**Query by correlation_id (from response logs or Railway output):**
```sql
SELECT
  receipt_id,
  status,
  action_type,
  inputs->>'address' AS address,
  inputs->>'correlation_id' AS desktop_correlation_id,
  outputs->'evidence' AS chain_evidence,
  outputs->>'outcome' AS outcome,
  created_at
FROM receipts
WHERE correlation_id = '<correlation_id>'
ORDER BY created_at;
```

**Query recent property data receipts for a tenant:**
```sql
SELECT
  receipt_id,
  status,
  inputs->>'address' AS address,
  outputs->>'outcome' AS outcome,
  created_at
FROM receipts
WHERE suite_id = '<suite_uuid>'::uuid
  AND action_type = 'compute_snapshot'
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```

**Expected chain:** One receipt per aggregator invocation. `outputs.evidence` array will contain:
```json
[
  { "source": "desktop_aggregator", "correlation_id": "<uuid>" },
  { "source": "adam", "correlation_id": "<adam_correlation_id>" }
]
```
If `source: adam` is missing from evidence, Adam either failed or returned no `receiptsFromAdam`. Check Adam's own receipt store using the `correlation_id` (it is forwarded to Adam in the request body).

---

## Known Limits and Soft Caps

| Provider | Limit | Threshold / Action |
|----------|-------|-------------------|
| **Apify (FREE plan)** | 1,388 actor calls/month | Monitor via Apify console. Upgrade to STARTER ($49/mo, 100k calls) if Visuals tab adoption grows. |
| **ATTOM** | Per contract entitlement | Check ATTOM developer dashboard if facts consistently return empty. |
| **Google Address Validation** | Per project quota | Default 1,000 QPM. Increase in Cloud Console if needed. |
| **Google Solar** | Per project quota | Default 300 QPD per key. May need increase for high-volume use. |
| **property_snapshots table** | No hard limit | 24h TTL self-cleans. Add pg_cron job to purge `WHERE expires_at < now()` if table grows large. |

---

## Failure Modes

| Failure | Symptoms | Diagnosis | Remediation |
|---------|----------|-----------|-------------|
| Apify quota exhausted | Photos missing, facts present, `sources[adam].status='partial'` | Run `test-apify-token.mjs`, check Apify console quota usage | Upgrade Apify plan or wait for monthly reset |
| ATTOM entitlement expired | Both facts and photos missing, `sources[adam].status='missing'` | Check ATTOM dashboard, check Adam logs on Ava-Brain | Renew ATTOM subscription or switch to backup data source |
| ORCHESTRATOR_URL misconfigured | `sources[adam].status='api_failure'`, Railway logs: `[AdamResearch] ORCHESTRATOR_URL not configured` | Check Railway Aspire-Desktop env for `ORCHESTRATOR_URL` | Set `ORCHESTRATOR_URL` in Railway env; redeploy |
| Cache poisoned (stale data) | User reports wrong address data on re-fetch | Query `property_snapshots` for the address | DELETE the poisoned row; user sends request with `forceRefresh: true` |
| Google API key disabled | Address validation returns `api_failure`, 422s spike | Run `test-google-maps-apis.mjs` | Enable the disabled API in Cloud Console |
| Supabase connection pool exhausted | Cache reads fail, receipt writes fail (both non-fatal), all fetches hit upstream | Check Supabase dashboard for connection count | Increase pool size or reduce max connections in `server/db.ts` |

---

## Monitoring Additions (Recommended — not yet configured)

| Metric / Alert | Threshold | Escalation |
|----------------|-----------|-----------|
| `receipts WHERE action_type='compute_snapshot' AND status='FAILED'` count per hour | >5 | Page on-call |
| `receipts WHERE action_type='compute_snapshot' AND status='DENIED'` rate | >20% of requests | Check address validation API health |
| `property_snapshots` row count | >500k | Schedule purge job |
| Adam response time P95 | >20s | Check Apify cold-start / ATTOM latency |

---

*Runbook maintained by: release-sre / proof-artifacts-builder*
*Last updated: 2026-05-10 (Pass 3.1 initial)*
