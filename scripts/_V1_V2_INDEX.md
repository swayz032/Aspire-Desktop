# Aspire-desktop/scripts/ — V1 + V2 sync scripts

| File | Status | Purpose |
|------|--------|---------|
| `sync-anam-ava-canonical.mjs` | `[v2]` | Force-reset Anam Ava persona tools to canonical set. Default persona ID: `58f82b89-...`. |
| `update_ava_prompt_v5.js` | `[v1]` | Current ElevenLabs Ava prompt sync script. |
| `update_prompt_v2.js` | `[drifted — superseded]` | Replaced by v5. Pending archive. |
| `update_prompt_v3.js` | `[drifted — superseded]` | Replaced by v5. Pending archive. |
| `update_prompt_v4.js` | `[drifted — superseded]` | Replaced by v5. Pending archive. |
| `add_show_cards_tool.js` | `[v1]` | One-shot ElevenLabs tool injector. |
| (other scripts) | `[shared]` | Build / EAS / deploy ops. |

## Migration plan

- Move `sync-anam-*.mjs` into `scripts/v2-anam/`.
- Archive `update_prompt_v{2,3,4}.js` (zero-risk — superseded).
- Keep `update_ava_prompt_v5.js` in place; add file-header `[STATUS: v1]` tag.
