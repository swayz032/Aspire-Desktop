---
name: Pass 7 Lane B — Agent Handoff Mirror + Ava Authoring
description: Mirror structure for 6 ElevenLabs handoff docs into repo, Ava prompt authoring from coordination spine §4.1, _v1_sync block pattern
type: project
---

## Fact
Pass 7 Lane B (2026-04-28) mirrors V1 ElevenLabs agent handoff docs into `Aspire-desktop/docs/agents/` and authors Ava V1 prompt from coordination spine §4.1. No agents pushed in this pass — Pass 9 handles deployment.

**Why:** Plan `the-image-was-off-calm-lynx.md` §9 requires canonical docs to exist in repo before sync scripts run.

**How to apply:** Pass 9 sync scripts reference `_v1_sync.prompt_path`, `_v1_sync.kb_paths`, `_v1_sync.tools_contract_path` from each `Aspire-{Agent}.json` to know what to push.

## Mirror structure (file counts verified)

| Agent dir | Files | Source |
|---|---|---|
| `docs/agents/ava/` | 5 | Authored from coordination spine §4.1 |
| `docs/agents/finn/` | 11 | FINN_FINANCE_HUB_ELEVENLABS_PRODUCTION_HANDOFF_v1 (inner subfolder) |
| `docs/agents/eli/` | 12 | ELI_EMAIL_SPECIALIST_PRODUCTION_HANDOFF_v1 (flat) |
| `docs/agents/nora/` | 19 | NORA_CONFERENCE_ASSISTANT_PRODUCTION_HANDOFF_v1/nora_handoff/ |
| `docs/agents/sarah-receptionist/` | 14 | RECEPTIONIST_SARAH_PRODUCTION_HANDOFF_v2 (flat) |
| `docs/agents/sarah-frontdesk/` | 14 | FRONT_DESK_SARAH_PRODUCTION_HANDOFF_v1 (flat) |
| `docs/agents/coordination-spine/` | 10 | aspire_contract_pack_handoff_v1/aspire_contract_pack_handoff/ |

## _v1_sync block pattern

All 5 existing agent_configs got a `_v1_sync` block added at the top (non-destructive — full EL config preserved). Two new files created: `Aspire-Sarah-Receptionist.json` (index only) and `Aspire-Sarah-FrontDesk.json` (index only, agent_id null).

## Ava §4.1 adapter test results (all pass)

Reads: office_brief, get_memory_brief, get_thread_memory, open_approvals, due_now_candidates — all present in prompt.
Writes: session_summary, handoff_note, pending_intent, authority_context — all present in prompt. timeline_event is in manifest memory_writes (internal side effect of save_session_summary, not a direct tool call).
Role: chief of staff, routing, briefing, approval, escalation — all present.

## Sarah agent_id ambiguity (Pass 9 open question)

agent_8901kmqdjnrte7psp6en4f85m4kt — from MEMORY.md auto-memory
agent_6501kp71h69jfqysgd055hemqhrq — from screenshot (has Workflow tab)
Both recorded in Aspire-Sarah-Receptionist.json. Pass 9 resolves active agent via mcp__elevenlabs__list_agents.

## Ava files authored

- `01_AVA_SYSTEM_PROMPT.md` — full EL voice prompt, 10 tools, routing rules, memory protocol
- `02_AVA_TOOLS_CONTRACT.md` — 10 tools (6 memory + 4 routing), full contract per Finn pattern
- `03_AVA_KB_OFFICE_BRIEF.md` — brief reading protocol, surface vs suppress rules, voice rules
- `04_AVA_KB_HANDOFF_PROTOCOL.md` — 3-object pattern (pending_intent + authority_context + handoff_note), correlation_id, voice→video flow
- `05_HANDOFF_MANIFEST.json` — manifest with all tool names, dynamic variables, authoring source noted
