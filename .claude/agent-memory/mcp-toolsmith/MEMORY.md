# MCP Toolsmith Memory

## Agent handoff mirror pattern (2026-04-28)
- See `project_pass7_agent_mirror.md` — Pass 7 Lane B mirror structure, Ava authoring source, _v1_sync block pattern for agent_configs

## Sarah two-agent split — IDs CONFIRMED 2026-04-29 (Pass 9)
- "Aspire Sarah - Receptionist" = agent_6501kp71h69jfqysgd055hemqhrq (external/Twilio, 5-node Workflow, voice DODLEQrClDo8wCz460ld via auto-memory was wrong)
- "Aspire - Sarah Front Desk" = agent_8901kmqdjnrte7psp6en4f85m4kt (internal owner-facing, no Workflow, voice DODLEQrClDo8wCz460ld, created 2026-03-27)
- IDs were swapped in auto-memory (agent_8901 was listed as Receptionist — INCORRECT). Verified via mcp__elevenlabs__list_agents.
- agent_configs corrected: Aspire-Sarah-Receptionist.json = agent_6501, Aspire-Sarah-FrontDesk.json = agent_8901

## Pass 8 skillpack patterns (2026-04-28)
- Skillpacks live in `services/skillpacks/` (created Pass 8)
- `MemorySearchService` is the class name (NOT `MemorySearch`) in `memory_search.py`
- `MemorySearchRequest` uses flat `tenant_id/suite_id/office_id`, NOT a `scope` field; response uses `.items` NOT `.results`
- `MemoryService.list_by_thread` returns `(items, next_cursor)` tuple
- `BriefMaterializer.build_office_brief(office_id, *, scope, refresh)` — office_id positional first
- `supabase_select(table, filters, *, order_by, limit)` — order_by PostgREST format e.g. `"last_activity_at.desc"`; NO `descending` kwarg
- `ProactiveCandidateIn` uses flat tenant_id/suite_id/office_id; required: `why_now`, `confidence`, `risk_tier`

## Pass 9 sync script patterns (2026-04-29)
- EL sync scripts use PATCH /v1/convai/agents/:id (not PUT) — merges only changed fields, preserves workflow nodes
- Receptionist Sarah: ABORT if workflow.nodes count != 5 before or after push — verifyWorkflowIntact() checks both
- Anam Ava: voiceHandoffBrief template var preserved through materializePromptForStateful() — regex excludes it from cleanup
- EL KB endpoint: POST /v1/convai/agents/:id/knowledge-base (not a top-level KB endpoint)
- Tool secret in all EL scripts: defaults to hardcoded SHA if env not set (same value as in Aspire-Ava.json)
- sync-anam-ava-canonical.mjs extended (not replaced): added 3 memory tools + voiceHandoffBrief injection

## Registry count discipline (2026-04-28)
- test_registry.py and test_server_wave6.py have hardcoded counts — must update when adding skill packs
- Pass 8 added 3 new packs (ava_chief_of_staff, nora_orchestration_tools, sarah_frontdesk_tools) → 17→20
- Files to update: test_registry.py (6 assertions) + test_server_wave6.py (3 assertions)

## Pass 10 Lane A — Anam handoff resolution patterns (2026-04-29)
- session_broker handoff resolution lives in `_resolve_anam_handoff()` helper in `routes/memory.py` (not a separate service)
- Filter by correlation_id + memory_type IN (pending_intent,authority_context,handoff_note) + status NOT IN (rejected,superseded)
- Brief ordering: handoff_note → authority_context → pending_intent; capped at 400 chars with word-boundary truncation
- Cross-tenant: check row tenant_id/suite_id vs caller scope — return None → caller raises 403; denial receipt emitted
- Non-existent handoff_id: returns empty dict (degraded mode); session continues; WARN logged with only first 8 chars of UUID
- EL sessions (no runtime_family or runtime_family != 'anam_video') skip the entire handoff block — no supabase_select
- store_receipts call signature: store_receipts([receipt_dict]) — test assertions must unpack the list, not treat it as a dict
- The existing stub handoff block used list_by_entity("handoff", ...) which was WRONG — correct is correlation_id filter

## Service Hub Pass 3.1 — Google API proxy patterns (2026-05-10)
- All 4 Google property clients in `server/serviceHub/property/` use same key via `resolveGooglePlacesApiKey()` from `runtimeGuards.ts`
- `propertyTypes.ts` is the canonical type file — import types from there, not define your own
- `AddressValidationVerdict` uses `city/state/zip` (not locality/region/postal) and requires `fetchedAt: string`
- Client imports+re-exports from `propertyTypes.ts` to avoid drift with the aggregator
- Solar 404 = `status: 'missing'` (rural/unmodelled) — NOT an error; only 5xx = `api_failure`
- Solar roof type: inferred from pitchDegrees avg (<5=flat, 5-20=low-slope, >20=steep) — not in upstream response
- jest.fn() mock.calls tuple TS error fix: `const calls = fetchMock.mock.calls as any[]`
- Test pattern: `__setFetchForTests(mock)` escape hatch, restored in afterEach (same as apifyZillowClient)

## Service Hub Pass 3.1 — Adam HTTP client (2026-05-10)
- Adam endpoint: `POST {ORCHESTRATOR_URL}/v1/agents/invoke` body: `{ agent: "adam", task: "PROPERTY_FACTS_AND_PERMITS", details: { address }, suite_id, office_id, correlation_id }`
- `ORCHESTRATOR_URL` from `process.env.ORCHESTRATOR_URL` (Railway Aspire-Desktop service, verified ✅)
- Default timeout 12s (Adam runs ATTOM + Apify in parallel; Apify actor cold-starts ~10s)
- Photo lane bucketing: `record.photos[].lane` → 'interior' | 'exterior' | 'roof' | anything else → 'uncategorized'
- Lot area units: `lotAreaUnits` (plural, ATTOM canonical); fall back to `lotAreaUnit` (singular, older). Acres × 43560 = sqft.
- ResearchResponse shape: `{ artifact_type, records[{ address, homeType, livingArea, yearBuilt, zoning, lotAreaValue, lotAreaUnits, stories, bedrooms, bathrooms, photos[{ url, caption?, lane }] }], confidence, receipts[], correlation_id }`
- `missing` status when classifyStatus returns missing — attach `error: 'no usable facts in record'` (test expects error defined)
- `receiptsFromAdam` is `undefined` when `response.receipts` is missing/not-array (not empty array) — test checks `toBeUndefined()`
- Address normalization: `streetAddress` preferred over `street`; `zipcode` preferred over `zip`; `formattedAddress` preferred as formatted
- mock.calls TS type: use `const calls = fetchMock.mock.calls as Array<[string, RequestInit]>` to avoid any-cast
