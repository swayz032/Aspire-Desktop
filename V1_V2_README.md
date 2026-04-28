# Aspire-desktop/ — V1 vs V2 Quick Map

> Pair with `myapp/docs/Aspire-System-Map-v2.md` (full map) and `myapp/.claude/workspace.json` (registry).

**The axis:** V1 = ElevenLabs Conversational AI agents (their own LLM decides). V2 = Anam personas with **LangGraph as the brain**. Both currently coexist in this repo — Ava and Finn each have a V1 ElevenLabs agent AND a V2 Anam persona.

## Top-level directories

| Directory | Status | Purpose |
|-----------|--------|---------|
| `app/` | `[shared]` | Expo Router routes. |
| `components/` | `[shared]` | Reusable UI components. |
| `hooks/` | `[mixed]` | `useElevenLabsAgent.tsx`, `useElevenLabsSTT.ts` are `[v1]`. Rest are `[shared]`. |
| `lib/` | `[shared]` | Utilities, clients, transports. |
| `providers/` | `[shared]` | React context providers. |
| `contexts/` | `[shared]` | (consolidation pending — pick one of `providers/` or `contexts/`) |
| `server/` | `[mixed]` | `agentToolRoutes.ts` is `[v2]` Anam dispatch; `routes.ts` handles BOTH paths. |
| `agent_configs/` | `[v1]` | All 5 ElevenLabs agent JSON configs. |
| `test_configs/` | `[shared]` | Test fixtures (will move into `__tests__/fixtures/`). |
| `scripts/` | `[mixed]` | `sync-anam-ava-canonical.mjs` `[v2]`; `update_ava_prompt_v5.js` `[v1]`; `update_prompt_v{2,3,4}.js` `[drifted — superseded]`. |
| `assets/` | `[shared]` | Static images / fonts. |
| `attached_assets/` | `[drifted]` | Duplicate of `assets/` — pending merge. |
| `__tests__/` + `e2e/` | `[shared]` | Tests. |
| `data/` | `[shared]` | Local fixtures / seed. |
| `constants/` | `[shared]` | App-wide constants. |
| `supabase/` | `[shared]` | (no migrations here — false-positive flagged & resolved 2026-04-28) |
| `docs/` | `[shared]` | Component & feature docs. |

## V1 entry points (ElevenLabs path)

- `hooks/useElevenLabsAgent.tsx` — ConversationProvider + `useConversation` hook
- `agent_configs/Aspire-{Ava,Eli,Finn,Nora,Sarah}.json` — agent definitions exported from ElevenLabs dashboard
- `scripts/update_ava_prompt_v5.js` — ElevenLabs prompt sync (current)

## V2 entry points (Anam path)

- `server/agentToolRoutes.ts` — Anam tool dispatch (with payload normalization for `arguments`/`params`/`input` nesting)
- `server/routes.ts:22-23` — `CANONICAL_ANAM_AVA_PERSONA_ID = '58f82b89-8ae7-43cc-930d-be8def14dff3'`
- `scripts/sync-anam-ava-canonical.mjs` — force-reset Ava persona tools to canonical set

## Active agent IDs

| Agent | V1 (ElevenLabs) | V2 (Anam persona) |
|-------|-----------------|--------------------|
| **Ava** | `agent_1201kmqdjgxvfxxteedpkvjej7er` | `58f82b89-8ae7-43cc-930d-be8def14dff3` (Cara avatar, Hope voice) |
| **Finn** | `agent_2201kmqdjjyben0tyg2t5eexnmzg` | `b6852adf-f904-4f61-9731-cf9b7c0ca68b` (Thomas avatar, Jack John voice) |
| **Eli** | `agent_4201kmqdjm1tfhfaggnnfjax3m6d` | `[v2-pending]` |
| **Nora** | `agent_1901kmqdjmwmfqg9rqr5jngfydnw` | `[v2-pending]` |
| **Sarah** | `agent_8901kmqdjnrte7psp6en4f85m4kt` | `[v2-pending]` |

## Pending reorganization

- `attached_assets/` → merge into `assets/` (verify no references first)
- `agent_configs/Aspire-*.json` → `agent_configs/v1-elevenlabs/` (update sync scripts)
- `test_configs/` → `__tests__/fixtures/`
- `scripts/update_prompt_v{2,3,4}.js` → archive (superseded by v5)
- `scripts/sync-anam-*.mjs` → `scripts/v2-anam/`
- `contexts/` vs `providers/` → pick one canonical name
