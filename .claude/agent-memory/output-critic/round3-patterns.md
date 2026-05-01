---
name: Round 3 false-fix and test-surface patterns
description: Anti-patterns and recurring gaps discovered in Anam Ava Round 3 ship (2026-04-29)
type: project
---

## Recurring issues to watch in future rounds

**Why:** Found in adversarial review of Round 3; several "fixed" bugs were partial or hand-wavy.

**How to apply:** Check these first in any future round review.

1. "Fixed" disambiguation flows that ship backend logic but ZERO desktop UI — the user still sees silent failure. Always verify CardRegistry contains the new artifact type.
2. Haversine path claimed as shipped when office_lat/office_lng are hardcoded None in server.py — the entire branch is dead.
3. Test suites that only validate route mocks (network contract) but never click an actual rendered element. Playwright tests that call page.evaluate(fetch(...)) are not integration tests — they're HTTP contract tests.
4. HotelCard horizontal hero still uses contentFit="cover" when the plan said "contain". Plan vs code divergence found at HotelCard.tsx:118.
5. Cache scope mismatch: chosenStoreIdBySuite is keyed by suiteId (not sessionId). The plan called it "session cache"; the code is a 5-minute cross-session cache per tenant. Behavior difference matters if two users share a suite.
6. TODO comments inside shipped code that block a claimed-fixed bug (server.py:1684 TODO for address_lat/address_lng disables haversine silently).
