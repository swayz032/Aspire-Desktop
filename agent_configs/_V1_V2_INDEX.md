# Agent Configs — All V1 ElevenLabs

> Every JSON in this directory is an ElevenLabs Conversational AI agent export.
> All `[v1]`. The V2 path uses Anam personas configured via `myapp/backend/scripts/setup-anam-personas.ts` and `myapp/Aspire-desktop/scripts/sync-anam-ava-canonical.mjs` — NOT files in this directory.

| File | Status | Agent ID | Voice ID | Tool count |
|------|--------|----------|----------|------------|
| `Aspire-Ava.json` | `[v1]` | `agent_1201kmqdjgxvfxxteedpkvjej7er` | `uYXf8XasLslADfZ2MB4u` | 10 |
| `Aspire-Finn.json` | `[v1]` | `agent_2201kmqdjjyben0tyg2t5eexnmzg` | `s3TPKV1kjDlVtZbl4Ksh` | 5 |
| `Aspire-Eli.json` | `[v1]` | `agent_4201kmqdjm1tfhfaggnnfjax3m6d` | `c6kFzbpMaJ8UMD5P6l72` | 4 |
| `Aspire-Nora.json` | `[v1]` | `agent_1901kmqdjmwmfqg9rqr5jngfydnw` | `6aDn1KB0hjpdcocrUkmq` | 4 |
| `Aspire-Sarah.json` | `[v1]` | `agent_8901kmqdjnrte7psp6en4f85m4kt` | `DODLEQrClDo8wCz460ld` | 4 (+ Twilio init webhook) |

## Migration plan

These configs will be moved into a `v1-elevenlabs/` subfolder so the V1 boundary is structurally explicit. Sync scripts that reference these paths (`scripts/update_ava_prompt_v5.js` etc.) will be updated in the same change.
