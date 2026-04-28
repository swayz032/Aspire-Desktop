# Aspire-desktop/server/ — Mixed V1 + V2

| File | Status | Purpose |
|------|--------|---------|
| `routes.ts` | `[mixed]` | BFF routes. Hosts `CANONICAL_ANAM_AVA_PERSONA_ID = '58f82b89-...'` (line 22-23) for V2 Anam path. Also forwards V1 ElevenLabs traffic. |
| `agentToolRoutes.ts` | `[v2]` | Anam tool dispatch — normalizes Anam payload nesting (`arguments`, `params`, `input`) and proxies to orchestrator `/v1/agents/invoke`. |
| (other files) | `[shared]` | BFF support. |

## V2 path entry

Anam persona event → `agentToolRoutes.ts` → orchestrator `/v1/intents` → LangGraph 14-node graph.

## V1 path forwarding

V1 ElevenLabs traffic from this BFF goes to `https://www.aspireos.app/v1/tools/*` which hits the gateway (`backend/gateway/src/routes/elevenlabs-tools.ts`).
