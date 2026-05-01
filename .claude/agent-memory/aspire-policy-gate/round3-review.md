---
name: Round 3 Policy Gate Review
description: Adversarial review of Round 3 governance impact — GREEN-tier read-only paths (Adam playbooks, store resolver, ProductDetailModal auth refactor, card wrap-around)
type: project
---

## Key findings (2026-04-29)

### PASS — Capability token (enrich-product)
- `server/routes.ts:7788-7843` — `/api/tools/enrich-product` calls `requireAuth()` first; derives `suiteId` from JWT (server-side). Token minted with `suite_id` bound to JWT-derived tenant. 45s TTL < 60s limit. Token NOT derived from or trusting client-supplied suite_id.

### PASS — Tenant isolation (chosenStoreIdBySuite)
- `server/agentToolRoutes.ts:L872-876` — `safeSuiteId` for the invoke route resolves `suite_id` from the body BUT falls back to `getDefaultSuiteId()` / `DEFAULT_SUITE_ID`. The body `suite_id` is supplied by the ElevenLabs tool call, NOT by the browser client. The route is protected by `verifySecret()`, so only trusted callers (orchestrator via ElevenLabs tool) can supply it.
- `show-cards` and `card-data/:id` enforce `cached.suiteId === suiteId` cross-tenant checks (L1489, L1581).

### FLAG (MEDIUM) — /api/card-data/refetch is unauthenticated
- `agentToolRoutes.ts:1373` — no `verifySecret()` or `requireAuth()` at this endpoint. `suite_id` is accepted from req.body without any auth check. An external caller could supply an arbitrary suite_id and trigger an orchestrator invoke for a foreign tenant's property address. Blocked in practice because it only accepts `PROPERTY_ARTIFACT_TYPES` and requires a valid `seed_record.address`, but the auth gap is real.

### PASS — StoreDisambiguation falls to GenericCard (fail-closed)
- `CardRegistry.ts:87-88` — `resolveCard()` returns `GenericCard` for unknown artifact types. `StoreDisambiguation` is not in KNOWN_TYPES or registered, so it renders a GenericCard (shows name + type label) — not null, not an error, not a dangerous fallback. Law #3 satisfied.

### PASS — Risk tier (all Round 3 paths are GREEN)
- No new state-changing operations introduced. Playbook changes add city→store lookup (read). Store image adds a Places photo URL fetch (read). ProductDetailModal auth refactor changes how the auth token is passed (read path only). Startup preload is read-only initialization. No promotion to YELLOW or RED.

### ADVISORY — Prompt-level rules are advisory only
- `ava_anam_video_prompt.md` browse-mode hardening is enforced only by the LLM personality layer. Ava can still be prompted to interrupt by a sufficiently adversarial user. This is the expected design boundary — server-side policy gates handle what matters; LLM rules govern personality. Not a governance violation.

## Where to look
- Token minting: `server/routes.ts:7788-7843`
- Store cache: `server/agentToolRoutes.ts:35, 969-986`
- Tenant isolation on show-cards: `agentToolRoutes.ts:1489, 1519-1521`
- Tenant isolation on card-data GET: `agentToolRoutes.ts:1581-1583`
- Unauthenticated refetch endpoint: `agentToolRoutes.ts:1373`
- CardRegistry fail-closed: `components/cards/CardRegistry.ts:87-88`
