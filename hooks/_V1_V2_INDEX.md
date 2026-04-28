# Aspire-desktop/hooks/ — V1 ElevenLabs + Shared

| File | Status | Purpose |
|------|--------|---------|
| `useElevenLabsAgent.tsx` | `[v1]` | Wraps `@elevenlabs/react` `useConversation` — drives V1 ElevenLabs agent sessions for Ava-EL, Finn-EL, Eli, Nora, Sarah. |
| `useElevenLabsSTT.ts` | `[v1]` | ElevenLabs STT helper. |
| `useAgentVoice.ts` | `[shared]` | Generic voice-state hook used by both V1 and V2 surfaces. |
| `useCanvasVoice.ts` | `[shared]` | Canvas mode voice integration. |
| `useActivityStream.ts` | `[shared]` | SSE activity stream from orchestrator. |

## V2 hooks

There is no dedicated V2 Anam hook in this directory yet — V2 wiring lives in `server/agentToolRoutes.ts` and the Anam SDK is consumed via the iframe / API at the avatar render layer. When a V2 React hook is added, it lands here as `useAnamPersona.ts` or similar.
