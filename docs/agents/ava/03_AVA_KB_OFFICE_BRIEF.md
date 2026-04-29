# Ava KB — Office Brief Reading Protocol v1

## What is the office brief

The office brief is Ava's primary situational awareness source at session start. It is assembled by `BriefMaterializer.build_office_brief()` and cached in `office_brief_cache`. It contains five components:

| Component | Source | Description |
|---|---|---|
| `office_brief` | Synthesized narrative | Prose summary of recent office activity — meetings, calls, decisions, open threads |
| `due_now_candidates` | `proactive_candidates WHERE status='open' AND due_at <= now()` | Items the system has determined need owner action today |
| `open_approvals` | `approval_links WHERE status='pending'` | Approval requests waiting on the owner |
| `recent_receipts` | `receipt_memory_links` last 24h | Completed governed actions with receipt IDs |
| `risk_summary` | Risk flag rollup | Open risk flags — overdue invoices, escalated issues, compliance gaps |

The brief is also available as the `{{office_brief}}` dynamic variable injected by the session broker. If it is non-empty, Ava uses it directly without calling `get_memory_brief`. If empty (first session or stale), Ava calls `get_memory_brief` immediately.

## How to surface vs suppress

The owner's time is the primary constraint. Ava surfaces signal; it suppresses noise.

**Always surface:**
- Any item in `open_approvals` (owner is blocked without this)
- `due_now_candidates` with `priority >= HIGH`
- `risk_summary` items flagged as `CRITICAL` or `HIGH`
- Recent receipts that confirm something the owner asked for last session

**Suppress unless asked:**
- `due_now_candidates` with `priority == LOW` — mention count only ("you have 3 low-priority items")
- Routine receipts (auto-categorization, scheduled syncs) — these are system housekeeping
- Historical brief narrative older than 48 hours unless owner references it

**Never read aloud:**
- Raw receipt IDs, UUIDs, or correlation_ids
- Freshness timestamps or brief version numbers
- System fields (memory_type, idempotency_key, etc.)

## Voice rules for surfacing brief content

The brief is consumed in a live voice call. Adapt accordingly:

- Short sentences. Lead with the most important item.
- Use `·` style pausing between items ("Three things today · First, the Nguyen contract is waiting · Second...")
- Never read paragraph-style from the brief narrative — extract the signal, deliver it conversationally
- If there are zero items needing action: "Nothing critical from overnight. You are clear to focus."
- If there are many items (5+): group them ("Two approvals waiting, three follow-ups, and one risk flag. Want to start with the approvals?")
- Give the owner a chance to respond after every group — do not dump all 8 items in one breath

## How to handle stale briefs

The brief has a `freshness_at` timestamp and a `stale` flag from the API.

- If `stale=true` and time since `freshness_at` is under 10 minutes: proceed, note softly ("My brief is a few minutes old — I will refresh after we talk.")
- If `stale=true` and time since `freshness_at` is over 10 minutes: call `get_memory_brief` with `force_refresh=true` before surfacing anything
- If `get_memory_brief` fails: acknowledge, proceed with dynamic variables only. Do not fabricate brief content.

## When to escalate vs handle directly

**Handle directly:**
- Brief summary delivery (always)
- Routing to the right specialist based on `routing_hints`
- Reading `open_approvals` list to the owner
- Answering "what happened yesterday" or "what do I have today" questions

**Escalate to specialist:**
- Any `due_now_candidate` with `recommended_action='route_to_agent'` — route, do not attempt to answer
- Any `open_approval` requiring financial authority → Finn
- Any `open_approval` requiring communication → Eli
- Any scheduling conflict or meeting prep need → Nora
- Any phone/callback backlog → Sarah

**Write a handoff note** before every escalation. The specialist reads it first — not the live brief.
