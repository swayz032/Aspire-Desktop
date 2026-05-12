# Visuals Tab — Design Lock v1.0

**Tag:** `visuals-tab-v1.0` (commit `438cf10` on `dev-sandbox`)
**Locked:** 2026-05-12
**Scope:** `app/service-hub/estimate-studio/visuals.tsx` + everything it transitively renders, plus the server-side property data pipeline.

This document is **load-bearing**. If a future agent or refactor wants to revert any decision below, they MUST update this doc in the same PR with a documented reason. The regression test at `__tests__/visuals/regression-lock.test.ts` enforces the file-level invariants.

---

## What's locked

### 1. House Inspector — single right-side D-pad cluster
**File:** `components/service-hub/estimate-studio/visuals/HouseInspectorControls.tsx`
**Anti-pattern locked out:** A second "VIEW FROM" preset cluster at bottom-left.
**Why:** Two clusters confused non-technical users. The `onPreset` prop is API-only — UI never re-exposes it. The doc comment is the ONLY place "VIEW FROM" may appear.

### 2. Street View Pano initial zoom = 2
**File:** `components/service-hub/estimate-studio/visuals/LiveStreetViewHero.tsx`
**Anti-pattern locked out:** `zoom: 1`. At zoom 1 Google serves 832×832 tiles and frames the camera back at the road, making the house small and soft. Zoom 2 → 1664×1664 tiles, house framed close.

### 3. Roof Canvas chooses Solar vs interactive Pano server-side
**Files:** `server/serviceHub/property/propertyAggregator.ts`, `components/service-hub/estimate-studio/visuals/HeroSwitcher.tsx`
**Rule:** `roofImagery: 'solar' | 'streetview'` decided by **MEDIUM-tier Solar preflight**.
**Anti-pattern locked out:** Falling back to the **Street View Static API** (640×640 max) when Solar is missing. Static is blurry at canvas size. The interactive Pano (`LiveStreetViewHero`) is the fallback — same 4K experience as the Street View card.

### 4. Solar dataLayers tier walk for the roof endpoint
**File:** `server/serviceHub/property/googleSolarClient.ts`, `roofAerialRoute.ts`
**Rule:** Endpoint walks **HIGH → MEDIUM → LOW** when serving the aerial image. First tier with a valid `rgbUrl` wins.
**Anti-pattern locked out:** Hardcoded `requiredQuality=HIGH` (was rejecting LOW-only addresses like 2934 Bicycle Rd).
**Aggregator preflight = MEDIUM only:** broader walks blew past the 30s client timeout.

### 5. Solar coord validation = numeric range only
**File:** `server/serviceHub/property/googleSolarClient.ts` — `sanitizeCoords`
**Anti-pattern locked out:** Regex on coord string repr that capped at 8 decimals. Google Geocoder returns IEEE-754 doubles like `-84.34383699999999` (14 decimals) and the regex was rejecting them as invalid → `api_failure` before any network call.

### 6. Photo classifier — caption-driven, idx 0 = exterior, default = interior
**File:** `server/serviceHub/property/adamResearchClient.ts` — `normalizePhotos`
**Anti-pattern locked out:** Positional heuristic that forced idx 0/1/N-1/N-2 into exterior/roof regardless of content. The bug forced ~80% of mid-listing shots into wrong lanes.
**Rule:** Caption regex wins. No caption → idx 0 → exterior, all others → interior. Roof lane is owned by Google Solar 4K; Apify Zillow doesn't get to populate it.

### 7. Aerial 3D thumbnail = Google Static Maps satellite (zoom 20, scale 2)
**File:** `server/serviceHub/property/aerialThumbRoute.ts`
**Anti-pattern locked out:** Generic map-outline icon as the Aerial 3D tile thumbnail. The card's big canvas is Cesium 3D Tiles — the tile should preview a real top-down satellite.

### 8. Property cache — only write when Adam status = ok/partial AND facts populated
**File:** `server/serviceHub/property/propertyAggregator.ts`
**Anti-pattern locked out:** Persisting failed/timed-out Adam responses to `public.property_snapshots`. The 24h TTL means a single bad write poisons every page load for that address for a day. The guard requires `adamResult.status === 'ok' | 'partial'` AND `facts.sqft != null && facts.yearBuilt != null` before any cache write.

### 9. Adam timeout = 60s end-to-end
**File:** `server/serviceHub/property/propertyAggregator.ts` — `ADAM_TIMEOUT_MS`
**Anti-pattern locked out:** 25s timeout that misfired on cold-start (ATTOM fan-out + Apify Zillow scrape can take 40-50s).

### 10. Backend slim payload INCLUDES permits + AVM precision
**File:** `aspire-backend/orchestrator/src/aspire_orchestrator/server.py` — `_HEAVY_STRIP_FIELDS`
**Anti-pattern locked out:** Stripping `permit_signals`, `avm_fsd`, `avm_date` from the desktop response. These are tiny scalars/short arrays that the Context tab renders. The strip set was tuned for old LLM-context pressure that no longer applies under 200K tokens.
**Cap:** `permit_signals[:20]` covers heavy-renovation properties.

### 11. PropertyData.facts has 45 typed fields (was 19)
**Files:** `services/serviceHub/propertyDataApi.ts`, `server/serviceHub/property/adamResearchClient.ts`, `propertyAggregator.ts`
**Locked surface:** All 45 fields documented in the type. Adding a new ATTOM field MUST extend the type AND the extraction in adamResearchClient AND the passthrough in propertyAggregator — no silent drops.

### 12. Premium Context-tab design language
**File:** `components/service-hub/estimate-studio/tim-rail/PropertySummaryCard.tsx`
- Marquee numbers (AVM, Last Sale, Available Equity, LTV) → **stat cards**, not label/value rows
- Boolean flags (owner-occupied, absentee, homestead, arm's-length) → **colored chips**, not rows
- Permits → **per-permit cards** with status chip + contractor chips (not factRow — those truncate)
- Section dividers = hairline + 24px breathing room
- `tabular-nums` everywhere a number appears
- Appreciation % goes gold when positive

---

## Why these decisions stick

Most of the bugs above came back **multiple times** during the same dev session. Root causes were:
1. **Uncommitted edits dying on branch swaps** — fixed by committing immediately, never letting work sit in working tree.
2. **20+ zombie branches** holding old code that any `git checkout` could restore — deleted in one sweep.
3. **Stale `dist/` bundle** serving May 4 JS to the browser even though source was fresh — fixed by clearing dist + Metro cache before every restart.
4. **Stale Supabase cache** serving bug-era empty rows for 24h — cache-write guard now blocks bad writes at the source.

The `regression-lock.test.ts` enforces invariants 1–7 by reading file content. CI gate prevents merging a PR that reintroduces any locked anti-pattern.

---

## Rollback point

If anything in Visuals breaks and we need to triage from a known-good state:

```bash
git checkout visuals-tab-v1.0     # tag at commit 438cf10
```

This snapshot has every fix from the 2026-05-11 → 2026-05-12 hardening pass.
