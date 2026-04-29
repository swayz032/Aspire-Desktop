# Ava Tools Contract v1

## Objective

Define the 10 server-side tools Claude Code must implement for Ava (Chief of Staff). These are the minimal required tools; no tool beyond this list is in scope for V1.

## Tooling principles

1. Server tools only — no client-side state mutation.
2. Tenant, suite, and office scoped on every call (enforced by middleware).
3. All tools fail closed — missing token or scope = deny, not degrade.
4. Memory writes are idempotent on `idempotency_key`.
5. Every write produces a receipt via `receipt_store.store_receipts`.
6. Structured errors with `correlation_id` are mandatory on every response.

## Required shared request context

Every tool call must carry or derive:

| Field | Source |
|---|---|
| `tenant_id` | Session token (injected by ElevenLabs dynamic variable or capability token) |
| `suite_id` | Dynamic variable `suite_id` |
| `office_id` | Dynamic variable `office_id` |
| `actor_id` | Session user (injected by session broker) |
| `actor_role` | `"ava_chief_of_staff"` |
| `correlation_id` | Generated per-call (UUID v4) |
| `capability_scope` | Validated server-side before execution |

---

## Tool 1: `get_memory_brief`

### Purpose
Load the office brief at session start. Returns the office brief cache content including due-now candidates, open approvals, recent receipts, and risk summary. Maps directly to `GET /v1/briefs/office/{office_id}` in the memory routes.

### Backend implementation
Wraps `BriefMaterializer.build_office_brief()`. Returns cached result from `office_brief_cache` unless `force_refresh=true`. Freshness determined by `freshness_seq`.

### Inputs

| Field | Type | Required | Description |
|---|---|---|---|
| `suite_id` | string | yes | Scoping key (from dynamic variable) |
| `office_id` | string | yes | Scoping key (from dynamic variable) |
| `force_refresh` | boolean | no | Default false. Set true to bypass cache. |

### Returns

```json
{
  "office_brief": "string — narrative summary of recent office activity",
  "due_now_candidates": "ProactiveCandidate[] — items needing action today",
  "open_approvals": "ApprovalLink[] — approvals waiting on owner",
  "recent_receipts": "ReceiptLink[] — last N receipt summaries",
  "risk_summary": "string — risk flag narrative",
  "freshness_at": "ISO timestamp of brief build",
  "correlation_id": "uuid"
}
```

### Error handling
- Missing scope: `TENANT_ISOLATION_VIOLATION` → deny
- Brief not yet built: return empty brief with `freshness_at=null`, do not block session
- Stale brief (beyond TTL): return with `stale=true` flag; Ava surfaces a soft warning to owner

---

## Tool 2: `search_memory`

### Purpose
Hybrid keyword + vector search across `memory_objects` for the current tenant/suite/office. Used when the owner asks about a past meeting, call, document, client, or decision. Maps to `POST /v1/memory/search`.

### Backend implementation
Wraps `MemorySearch.search()`. Applies the ranking pipeline: entity match → thread match → approval/receipt relevance → recency → freshness → confidence. `include_raw` defaults to false (no raw transcripts unless explicitly permitted by policy).

### Inputs

| Field | Type | Required | Description |
|---|---|---|---|
| `suite_id` | string | yes | Scoping key |
| `query` | string | yes | Natural language search query |
| `memory_types` | string[] | no | Filter by type (meeting, call, note, contract, etc.) |
| `entity_id` | string | no | Pin search to a specific entity thread |
| `date_from` | string | no | ISO date lower bound |
| `date_to` | string | no | ISO date upper bound |
| `limit` | integer | no | Default 10, max 20 |

### Returns

```json
{
  "results": "MemoryObject[] — ranked list of matching memory objects",
  "total": "integer — total matching count",
  "correlation_id": "uuid"
}
```

### Error handling
- Empty results: return `{ results: [], total: 0 }` — not an error
- Provider unavailable: `PROVIDER_UNAVAILABLE` → surface to Ava as tool error, do not fabricate results

---

## Tool 3: `get_thread_memory`

### Purpose
Load the thread brief for a specific entity (client, project, job). Used when the owner references a known entity and Ava needs the full thread context. Maps to `GET /v1/briefs/thread/{thread_id}`.

### Backend implementation
Wraps `BriefMaterializer.build_thread_brief()`. Resolves thread via `EntityThreadResolver.resolve()` if only entity name is provided.

### Inputs

| Field | Type | Required | Description |
|---|---|---|---|
| `suite_id` | string | yes | Scoping key |
| `entity_type` | string | yes | canonical entity type (e.g., contact, company, job) |
| `entity_id` | string | no | UUID if known |
| `entity_name` | string | no | Name if ID is not known (resolver will fuzzy-match) |

### Returns

```json
{
  "thread_id": "uuid",
  "entity_type": "string",
  "entity_name": "string",
  "thread_brief": "string — narrative summary of this entity's history",
  "last_activity_at": "ISO timestamp",
  "open_items": "MemoryObject[] — unresolved items for this entity",
  "correlation_id": "uuid"
}
```

### Error handling
- Thread not found: `RESOURCE_NOT_FOUND` → Ava acknowledges, does not block
- Ambiguous entity name: return top 3 candidates; Ava asks owner to confirm

---

## Tool 4: `create_handoff_note`

### Purpose
Write three coordinated memory objects before routing to a specialist or ending a session that will continue in video mode. The three objects (`pending_intent`, `authority_context`, `handoff_note`) all share one `correlation_id`. This is the atomic handoff primitive.

Anchored to: §4.1 Ava adapter Egress contract + §7 Anam video handoff backend.

### Backend implementation
Single transactional write in `MemoryService.write` (3 objects, same `correlation_id`). Maps to `POST /v1/memory-events` (batch). Cuts a `memory_write` receipt for each object.

### Inputs

| Field | Type | Required | Description |
|---|---|---|---|
| `suite_id` | string | yes | Scoping key |
| `pending_intent` | string | yes | What the owner wants to accomplish |
| `authority_context` | string | yes | Risk tier, escalation context, any approval requirements |
| `handoff_note` | string | yes | One-paragraph normalized summary the receiving agent reads first |
| `receiving_agent` | string | yes | Target agent: eli, nora, finn, sarah, anam_video |
| `entity_id` | string | no | Entity this handoff is about |
| `risk_tier` | string | no | GREEN / YELLOW / RED. Default GREEN. |

### Returns

```json
{
  "handoff_id": "uuid — the shared correlation_id for all three objects",
  "pending_intent_id": "uuid — memory_id of pending_intent object",
  "authority_context_id": "uuid — memory_id of authority_context object",
  "handoff_note_id": "uuid — memory_id of handoff_note object",
  "receipt_ids": "uuid[] — one receipt per object",
  "correlation_id": "uuid"
}
```

### Error handling
- Partial write failure: roll back all three objects, return `PROVIDER_INTERNAL_ERROR`
- Missing required fields: `INVALID_INPUT` → Ava surfaces as tool error, does not route

---

## Tool 5: `save_session_summary`

### Purpose
Write a `session_summary` memory object at the end of every Ava session. Maps to `POST /v1/memory-events`.

### Backend implementation
Wraps `MemoryService.write` with `memory_type='session_summary'`. Idempotent on `idempotency_key = 'session:' + session_id`.

### Inputs

| Field | Type | Required | Description |
|---|---|---|---|
| `suite_id` | string | yes | Scoping key |
| `session_id` | string | yes | ElevenLabs conversation_id |
| `summary` | string | yes | Narrative summary of the session |
| `decisions` | string[] | no | Key decisions made |
| `open_items` | string[] | no | Unresolved items to surface next session |
| `routed_to` | string[] | no | Agents Ava routed to this session |

### Returns

```json
{
  "memory_id": "uuid",
  "receipt_id": "uuid",
  "correlation_id": "uuid"
}
```

### Error handling
- Duplicate session_id: idempotent replay — return cached result, `idempotency_replay=true`

---

## Tool 6: `promote_artifact`

### Purpose
Elevate a memory object to `status='pinned'` so it surfaces prominently in future briefs. Used when a session produces a high-value artifact (signed contract reference, key strategic decision, approved action).

### Backend implementation
Wraps `MemoryService.update_status(memory_id, 'pinned')`. Cuts a `memory_promotion` receipt.

### Inputs

| Field | Type | Required | Description |
|---|---|---|---|
| `suite_id` | string | yes | Scoping key |
| `memory_id` | string | yes | UUID of the memory object to pin |
| `reason` | string | yes | Why this artifact is being promoted |

### Returns

```json
{
  "memory_id": "uuid",
  "status": "pinned",
  "receipt_id": "uuid",
  "correlation_id": "uuid"
}
```

### Error handling
- Memory not found or wrong tenant: `RESOURCE_NOT_FOUND` or `TENANT_ISOLATION_VIOLATION`
- Already pinned: idempotent no-op, return current status

---

## Tool 7: `route_to_eli`

### Purpose
Signal intent to route the owner to Eli (inbox specialist). Creates a `proactive_candidate` with `recommended_action='route_to_agent'` and `owner_agent='eli'`. Does not perform the ElevenLabs transfer — that is handled by the built-in `transfer_to_agent` system tool. This tool writes the governance record.

### Backend implementation
Wraps `ProactiveCandidateEngine.create_candidate()`. Requires prior `create_handoff_note` call; `handoff_id` should be passed as `linked_handoff_id`.

### Inputs

| Field | Type | Required | Description |
|---|---|---|---|
| `suite_id` | string | yes | Scoping key |
| `handoff_id` | string | yes | correlation_id from preceding create_handoff_note |
| `intent_summary` | string | yes | One-line summary of what owner needs from Eli |

### Returns

```json
{
  "candidate_id": "uuid",
  "receipt_id": "uuid",
  "correlation_id": "uuid"
}
```

---

## Tool 8: `route_to_nora`

Identical contract to `route_to_eli` with `owner_agent='nora'`. Used when owner needs meeting scheduling, calendar, or conference intelligence.

### Inputs / Returns
Same schema as `route_to_eli`, with `owner_agent='nora'` set server-side.

---

## Tool 9: `route_to_finn`

Identical contract to `route_to_eli` with `owner_agent='finn'`. Used when owner needs financial analysis, cash review, books, or invoice detail.

### Inputs / Returns
Same schema as `route_to_eli`, with `owner_agent='finn'` set server-side.

---

## Tool 10: `route_to_sarah`

Identical contract to `route_to_eli` with `owner_agent='sarah'`. Used when owner needs phone routing, call screening, or callback queue management.

### Inputs / Returns
Same schema as `route_to_eli`, with `owner_agent='sarah'` set server-side.

---

## All tools registered in

- `backend/orchestrator/src/aspire_orchestrator/services/tool_types.py` — capability scope: `ava.memory.read`, `ava.memory.write`, `ava.routing.create`
- `backend/orchestrator/src/aspire_orchestrator/services/registry.py` — agent owner: `ava`, risk_tier per tool (memory reads = GREEN, writes = GREEN, route tools = GREEN)
- `backend/orchestrator/src/aspire_orchestrator/services/skillpacks/ava_chief_of_staff.py` — full implementation

## Governance invariants

- Every write tool produces a receipt. No exceptions (Law #2).
- Token validation happens before any tool execution. Fail closed (Law #3, Law #5).
- Tenant isolation enforced via RLS + suite_id/office_id on every query (Law #6).
- Ava tools never retry themselves. They return structured errors; the orchestrator decides recovery (Law #1, Law #7).
- PII is redacted from all receipts and logs using Presidio DLP before persistence (Law #9).
