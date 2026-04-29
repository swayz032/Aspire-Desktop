---
subsystem: Office Memory Engine + Coordination Spine V1
version: v1.0
pass: 12 (Pass 12 — Production Gates + Cutover)
authored: 2026-04-28
owner: release-sre
---

# Office Memory Engine — Operations Runbook

## What This Subsystem Is

The Office Memory Engine is Aspire's unified memory layer for all voice and video agents. It replaces the per-agent `agent_episodes` and `agent_semantic_memory` tables with a single coordination spine accessible by all agents through `MemoryService`.

### Service Boundary (text diagram)

```
Voice agents (ElevenLabs)  ──┐
Video agents (Anam)          │   Routes: /v1/memory-events
Email / meeting events       ├──>  memory.py  ──> MemoryService ──> memory_objects (Postgres)
Finance events               │   Routes: /v1/briefs/*
Canvas / Service Lab         ─┘     memory_pages.py ──> BriefMaterializer ──> *_brief_cache

TranscriptEventRefinery  ──> memory_event_inbox ──> (Temporal) ──> ProactiveCandidateEngine
SessionBroker (start)    ──> assembles dynamic_variables + brief for agent init
MemorySearchService      ──> hybrid tsv + pgvector search via search_memory_objects() RPC

Spine tables (Postgres):
  public.threads
  public.memory_objects
  public.proactive_candidates
  public.approval_links
  public.receipt_memory_links
  public.memory_event_inbox
  public.office_brief_cache
  public.finance_brief_cache
  public.thread_brief_cache

Frontend: Aspire-desktop app/office-memory/* (4 routes, 14 components)
Backend services: memory_service.py, transcript_event_refinery.py,
                  proactive_candidate_engine.py, brief_materializer.py,
                  memory_search.py, routes/memory.py, routes/memory_pages.py
```

All agents read and write exclusively through `MemoryService`. No agent has raw DB access.

---

## Dual-Read Shadow Mode

The system currently runs in dual-read shadow mode:
- `agent_episodes` + `agent_semantic_memory` remain live (legacy, untouched).
- New writes go to `memory_objects` (migration 100 backfills historical records).
- Both read paths are active until 7-day parity is confirmed.

Shadow mode is controlled by the environment variable:

```
ASPIRE_MEMORY_DUAL_READ_ENABLED=true   # current production state
ASPIRE_MEMORY_DUAL_READ_ENABLED=false  # disables dual-read; all reads from memory_objects only
```

To disable dual-read (after parity confirmed):
1. Set `ASPIRE_MEMORY_DUAL_READ_ENABLED=false` in Railway environment variables.
2. Deploy. No migration needed.
3. Verify via `GET /readyz` that status is still healthy.
4. Monitor for 30 minutes. If any agent returns empty memory, re-enable and investigate.

---

## Rollback Procedures (from Plan §17)

| Failure Point | Rollback Action |
|---|---|
| Migrations 095–098 break | `mcp__supabase__execute_sql` DROP new tables; `agent_episodes` is untouched and still live. |
| Migration 100 backfill bug | Set `memory_objects.status = 'superseded'` on all backfilled rows (`WHERE idempotency_key LIKE 'episode:%'`); agents continue reading `agent_episodes` directly. |
| New service crash (memory.py / memory_pages.py) | Remove or comment out the two `app.include_router(...)` lines in `server.py` (lines ~241-243). Redeploy. Existing finance/email gateway is untouched. |
| Frontend sidebar regression | Revert the single `navItem` insertion in `Aspire-desktop/components/desktop/DesktopSidebar.tsx`. Memory Engine routes return 404 (acceptable until fixed). |
| ElevenLabs prompt push regression | Each sync script is idempotent. Re-run prior version's script (versioned in `agent_configs/`). ElevenLabs "Enable Versioning" also allows prompt rollback via the ElevenLabs dashboard. Command: `npm run sync-agents` |
| Anam persona regression | Re-run prior `sync-anam-*.mjs` script; Anam REST overwrites in place. Command: `npm run sync-anam` |
| Migration 101 cutover regression (future) | View shims keep `agent_episodes` selectable; flip `ASPIRE_MEMORY_DUAL_READ_ENABLED=false` back to `true` to re-enable dual-read. |

### Rollback to Pass-7 State (Pre-Service Code)

If all new memory services need to be rolled back before migrations are dropped:

1. In `backend/orchestrator/src/aspire_orchestrator/server.py`, comment out:
   ```python
   # from aspire_orchestrator.routes import memory as memory_router_mod
   # from aspire_orchestrator.routes import memory_pages as memory_pages_router_mod
   # app.include_router(memory_router_mod.router, ...)
   # app.include_router(memory_pages_router_mod.router, ...)
   ```
2. Deploy via Railway: `railway up` in `backend/orchestrator/`.
3. Verify `/healthz` returns `{"status": "ok"}`.
4. Verify no `MemoryService` import errors in startup logs.

DB tables remain in place; they are isolated and do not affect legacy code paths.

---

## How to Replay a Dead-Lettered memory_event_inbox Row

When a row in `memory_event_inbox` has `status = 'dead_letter'`, the Temporal worker has stopped processing it. To replay:

1. Identify the dead-lettered row:
   ```sql
   SELECT id, event_type, created_at, error_detail
   FROM public.memory_event_inbox
   WHERE status = 'dead_letter'
   ORDER BY created_at DESC
   LIMIT 20;
   ```

2. Reset the row status back to `pending` (service_role only):
   ```sql
   UPDATE public.memory_event_inbox
   SET status = 'pending',
       error_detail = NULL,
       updated_at = now()
   WHERE id = '<uuid>';
   ```

3. The Temporal `MemorySyncWorkflow` picks up pending rows on its next sweep (poll interval: 60s).

4. If the row dead-letters again, inspect `error_detail` for the root cause. Common causes:
   - Unknown `event_type` — fix the event producer, not this table.
   - Embedding API failure — check OpenAI key validity in Railway secrets.
   - Tenant isolation violation — the event's `tenant_id` doesn't match the caller's scope; reject and audit.

5. Rows with `status = 'dead_letter'` and age > 30 days are pruned by the pg_cron job `prune_memory_event_inbox_ttl` (runs daily at 03:00 UTC, defined in migration 097).

---

## How to Re-sync ElevenLabs / Anam After a Deploy Regresses Prompts

If a deploy overwrites or corrupts agent prompts/tools/KB on ElevenLabs or Anam:

### ElevenLabs agents (Ava, Finn, Eli, Nora, Receptionist Sarah, Front Desk Sarah)

```bash
cd backend/orchestrator
npm run sync-agents
# This runs all 6 agent sync scripts in sequence (idempotent).
# Each script reads from agent_configs/<agent_name>/ and pushes via ElevenLabs API.
# Dry-run first: npm run sync-agents -- --dry-run
```

Agent config files are versioned in `backend/orchestrator/agent_configs/`. Each directory contains:
- `prompt.txt` — system prompt
- `tools.json` — tool definitions
- `kb/` — knowledge base documents

ElevenLabs also maintains prompt versioning natively ("Enable Versioning" in dashboard). If needed, roll back via the ElevenLabs dashboard to the previous version.

### Anam personas (Ava video, Finn video)

```bash
cd backend/orchestrator
npm run sync-anam
# Pushes Ava and Finn persona configs to Anam REST API.
# Anam overwrites in place — always idempotent.
```

Persona IDs are stable environment variables:
- `ANAM_FINN_PERSONA_ID` — Finn video persona
- `ANAM_AVA_PERSONA_ID` — Ava video persona (single persona, per plan §7)

---

## Observability Reference

- Structured logs: every memory write includes `trace_id`, `tenant_id`, `memory_type`, `idempotency_key`.
- Receipt coverage: every `MemoryService.write`, `MemoryService.update_status`, `ProactiveCandidateEngine.create_candidate`, and `ProactiveCandidateEngine.transition` emits a receipt via `receipt_store.store_receipts`.
- Dead-letter path: `TranscriptEventRefinery._dead_letter()` calls `store_receipts` with an incident receipt, then calls `incident_writer.report_incident`.
- Health probe: `GET /readyz` — checks signing key, graph, DLP, receipt store, Redis. Memory spine tables not yet in health probe (tracked as Pass 12 conditional item).
- pg_cron job: `prune_memory_event_inbox_ttl` — daily TTL pruning of dead-lettered inbox rows.

---

## 7-Day Shadow-Mode Parity Schedule

Migration 101 (cleanup: rename `agent_episodes` to deprecated, install view shims) MUST NOT run until parity is confirmed.

| Day | Action |
|---|---|
| Day 0 (ship date) | Deploy V1. Monitor memory_write receipt counts vs agent_episodes INSERT rate. |
| Day 1–3 | Compare `memory_objects` row counts per tenant vs `agent_episodes` backfill baseline. Alert if delta > 5%. |
| Day 4 | Run cross-read parity check: sample 100 random `agent_episodes` rows; verify each has a matching `memory_objects` row with same `tenant_id` + `external_session_id`. |
| Day 5 | Confirm all 6 ElevenLabs agents are writing new sessions exclusively to `memory_objects` (not `agent_episodes`). |
| Day 6 | Run RLS evil tests one final time against production-like data snapshot. |
| Day 7 | If parity green: run migration 101 in a maintenance window (estimated 5 minutes; table rename + view creation). If not green: extend window, investigate, do not run. |
