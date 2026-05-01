---
name: Round 5 production readiness audit patterns
description: Architectural fragilities, false-green tests, and untested edges found in the Round 5 sweep (2026-04-29)
type: project
---

## Key findings from the Round 5 audit

**Why:** Comprehensive read-only audit of backend orchestrator + desktop server after 4 rounds of bug fixes. Recurring regression discovery.

**How to apply:** Check these first in any future round review.

1. PROMPT FILES ARE BYTE-IDENTICAL (confirmed). No drift found between canonical and bundled as of Round 5.

2. sync-anam-ava-canonical.mjs reads the CANONICAL prompt from a relative path (`../../backend/orchestrator/.../ava_anam_video_prompt.md`) computed from `process.cwd()/../backend/...`. This ONLY works when the script is executed from the Aspire-desktop directory. If run from any other CWD, loadAvaPromptTemplate() silently returns null and the prompt sync is skipped. No error is thrown; the script continues with "SYNC_ANAM_PROMPT=true but prompt template file was not found; continuing with existing systemPrompt." — meaning the Anam persona retains whatever was last synced, which could be stale.

3. voice_path auto-detection bug (agentToolRoutes.ts): user_address is passed through to orchestrator but voice_path is NOT included in the invoke payload when voice_path is not explicitly set in the request body. Orchestrator auto-detects voice_path as True when no zip/city/store_id — but after Round 4, the nearest-HD resolver sets zip_code from postal_code, so voice_path auto-detects as False. This causes the 3-attempt text-path loop to fire after the nearest-store resolver, adding latency. The 12.6s probe latency from Round 4 is explained here.

4. test_voice_path_latency.py patches at the wrong import level: patches `aspire_orchestrator.services.adam.hd_store_resolver.resolve_store_async` and `aspire_orchestrator.providers.serpapi_homedepot_client.execute_serpapi_homedepot_search` — but inside trades.py, the calls go through local imports in the nested `_resolve_and_search_hd()` coroutine. The hd_store_resolver patch targets the module directly which IS correct (imported at function body), but the serpapi patch targets the client module — also correct. However, find_nearest_home_depot_by_address is NOT patched in the latency tests, meaning the test depends on settings.google_maps_api_key being empty (which returns None quickly). If a key is set in CI, the test behavior changes.

5. Disambiguation artifact shape mismatch: StoreDisambiguation extra.candidates is not exposed at the top-level of the response. The store-disambiguation.spec.ts test mocks candidates at root level (`result.body.candidates`) but `_build_store_disambiguation_response` puts them in `extra: {"candidates": ..., "query": ...}`. The backend serializes this into `data.extra.candidates` on the response, but the test mocks `body.candidates` at the root. This means the store-disambiguation route tests validate against an incorrect shape — candidates won't be at root level in production.

6. No test for user_address="" (empty string after strip) flowing into `find_nearest_home_depot_by_address` from the server.py passthrough — the server passes body.get("user_address") and the playbook guards `if user_address and user_address.strip()` correctly, but no regression test pins this path.

7. Gallery tests in research-modal-carousel.spec.ts are HTTP contract tests only, not rendered-element tests. They prove the route mock roundtrips correctly but don't verify arrows/thumbnails are visible in the DOM. The comment inside explicitly says "requires a ProductCard demo page variant (follow-up task)" — this is a known gap documented as a TODO.

8. The ESC-key test at line 529 ("modal closes on ESC key") is documented as FAILING due to a known impl bug (dismiss handler not connected to keydown). The duplicate test at line 742 explicitly does `expect(true).toBe(true)` to always pass — this is a false green masking a known regression.

9. chosenStoreIdBySuite is NOT in __testing__ exports. Three unit tests for cache seeding, cache read, and TTL expiry are explicitly documented as missing in store-disambiguation.spec.ts but have not been added.

10. The `hd_store_directory.py` data file is at `src/aspire_orchestrator/services/adam/data/home_depot_stores_us.json` (Path relative to the module). The hd_store_resolver.py looks for the file at `config/hd_stores_us.json` (three levels up from services/adam/ to reach config/). These are DIFFERENT paths — if both files are present this is fine, but if only one exists there's a mismatch that would silently return an empty store list from one module.

11. Voice path latency test `test_voice_path_end_to_end_under_4500ms_with_resolver_and_serpapi` budget is 4.5s. But production budget is 5s end-to-end for the entire request including network overhead. The 4.5s budget only covers orchestrator-internal time — desktop-to-orchestrator network round trip is not included. A 12.6s probe suggests the actual budget must account for network transit, not just internal time.
