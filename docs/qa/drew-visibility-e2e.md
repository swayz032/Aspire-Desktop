# Drew Visibility (DV) — End-to-End QA Verification

## Why this verification matters

G-DV4 is the only gate that proves we shipped. G1–G3 are visual gates (tier dots,
routing badges, drawer chrome render correctly given fixture data). Without G-DV4,
those gates ONLY prove the UI accepts the schema — not that production Drew is
actually emitting tier / routing / receipt signals on real blueprints. A
backend that returns a uniform default-YELLOW for every sheet would still pass
G1–G3 and ship a decoration layer. G-DV4 forces the canary to confirm:

1. Tier distribution is **non-uniform** across a freshly-uploaded blueprint
   (proves the backend SEE stage is classifying, not defaulting).
2. Receipt drawer loads under 500 ms p95 (proves the per-sheet receipt endpoint
   is wired and indexed, not 404-ing into the error fallback).
3. At least one `BOUND_MATERIAL` instance renders in MaterialStoryPanel (proves
   the material story pipeline made it from extraction → resolution → UI).

If any one of these three fails, the wave is NOT shipped — regardless of how
clean the visual layer looks.

---

## Manual canary checklist (Pop's tenant, live deploy)

### 0. Pre-flight

1. Confirm the backend lead has merged §α.5 production wiring on
   `swayz032/aspire-backend` — `services/blueprint/` SEE stage emits per-sheet
   `extraction_receipts` rows with `tier`, `routing_action`, `disqualifier_codes`,
   `evidence_ocr_tokens`, IoU/recall/precision metrics, `cost_usd`, `runtime_ms`.
   - **Expected:** PR landed on `main`, Railway `Ava-Brain` redeployed, the
     receipt endpoint `/v1/blueprints/:projectId/receipts/:sheetId` returns 200
     with a populated payload on at least one test project.
   - **If unmet:** STOP. Pop will see uniform default-YELLOW on every sheet and
     receipt drawer will 404 into the error fallback. Block G-DV4 acceptance.

### 1. Upload a fresh blueprint on Pop's tenant

2. Log into Pop's tenant (`tonioscott58@yahoo.com`) on the live Aspire desktop
   build.
3. Open **Service Hub → Estimate Studio → Plans & Photos**.
4. Drag-drop a fresh blueprint PDF (use `gavnn_addendum_1.pdf` from the canon
   blueprint set if Pop doesn't have a project handy).
   - **Expected:** Upload begins immediately, no UploadDropZone flash on
     successful start.

### 2. Ripple loader continuity

5. Watch the ripple loader during ingest.
   - **Expected:** Loader stays continuously animated from upload start until
     the first sheet renders into the canvas. No mid-stream flash back to the
     empty UploadDropZone state. (If you see it bounce, log a P1 visual
     regression — this was fixed in DV Pass 0.)

### 3. Story Mode entry

6. Click **Scope** in the Estimate Studio tab strip.
7. Click the **Story Mode** chip.
   - **Expected:** StoryPanelV2 mounts with the chapter strip across the
     bottom. First chapter is auto-selected (active).

### 4. Chapter card affordances (chapter strip)

8. For each chapter card on the bottom strip, verify:
   - **Tier dot** (top-left of the thumbnail) renders in GREEN / YELLOW / RED.
     Element testID: `chapter-card-{key}-tier-dot`.
   - **Routing summary badge** in card meta reads `"AUTO N · TIM N · BLOCK N"`.
     (TIM = Service Hub Manager helper assistant; routes here wait for
     Tim review. Tim is not yet built — the label forward-declares the
     destination so the wiring is correct when Tim ships. Not "AVA" —
     Ava is the frontstage receptionist, NOT part of Estimate Studio.)
     Element testID: `chapter-card-{key}-routing-summary`.
   - **Both omitted** on any chapter without `confidence_tier` (legacy data
     shape — the badge area collapses cleanly with no visible gap).
   - **Expected:** Tier distribution across cards is **non-uniform** — at least
     one GREEN and at least one YELLOW or RED. If every dot is the same color,
     STOP — backend is defaulting (G-DV4 fail).

### 5. Sheet tab tier-tint + disqualifier badge

9. Click into a chapter, then click a sheet tab in the right pane.
   - **Expected:** Active-tab bottom bar is **tier-tinted** to GREEN / YELLOW /
     RED (matching the sheet's confidence tier — NOT amber). Inactive tabs keep
     the amber resting bar.
10. Click any sheet tab that has `disqualifier_codes` populated.
    - **Expected:** Red count badge in the tab's top-right corner displays the
      number of disqualifier codes (testID
      `sheet-tab-disqualifier-{sheet_code}`).

### 6. SheetReceiptDrawer

11. Tap the SheetReceiptDrawer chevron / row (bottom of the right pane) to
    expand.
    - **Expected compact row:** Tier chip + routing chip + first 2 disqualifier
      chips (or 0 chips if `disqualifier_codes` is empty).
    - **Expected on expand:**
      - **EVIDENCE** section: 5 OCR token chips (`text`, confidence shown).
      - **METRICS** section: IoU, primitive recall, primitive precision, cost
        (USD), runtime (ms).
      - **RECEIPT** section: copyable `receipt_id`, `audit_trail` S3 URL.
12. Pick a sheet with 4+ disqualifier codes (e.g. P-301 in the canonical RED
    fixture).
    - **Expected:** First 2 chips render individually, then a single `"+N more"`
      overflow chip (testID `sheet-receipt-drawer-disqualifier-overflow`).
13. Time the receipt expand-to-render latency on the canary tenant.
    - **Expected:** ≤ 500 ms p95. The HUD (step 14 below) will show this number
      live. If > 500 ms p95, STOP — backend endpoint latency fails G-DV4.

### 7. MaterialStoryPanel (SheetView mode)

14. Switch the left pane to Sheet view (📄 Sheet toggle, or click a sheet tab
    in the right pane).
15. Scroll the left pane between **WHAT TO BUY** and **WATCH OUT FOR**.
    - **Expected:** `MaterialStoryPanel` mounts with eyebrow text
      `"MATERIALS ON THIS SHEET · N items"` (singular `"1 item"` when N=1).
16. For each `MaterialInstanceCard` row, verify:
    - Legend label badge (e.g. `S1`, `R-32`) on the left.
    - Symbol name (e.g. "Single-pole switch").
    - Spec text (e.g. "Hubbell HBL5301WSP, 20A, white").
    - `×instance_count` count chip on the right.
    - Left border tinted by tier (GREEN / YELLOW / RED).
    - `resolution_source` chip (e.g. `topology_match`, `ava_review`,
      `legend_anchor`).
    - `receipt_id` chip.
17. Tap the receipt chip on any row.
    - **Expected:** No crash. (`onReceiptClick` is currently undefined-safe —
      the chip is a visible affordance with no handler wired yet.)

### 8. Fixture-state rendering coverage

18. Walk all 4 canonical chapter states across Pop's project (or use the
    `_fixtures/tieredChapters` synthetic set if a single real blueprint doesn't
    cover all):
    - **GREEN chapter** — all sheets `tier='GREEN'`, no badges show RED count.
    - **YELLOW chapter** — mixed `tier` values, ≥ 1 sheet shows disqualifier
      badge.
    - **RED chapter** — majority `tier='RED'`, multiple disqualifier badges.
    - **Tierless chapter** — legacy `confidence_tier` undefined, NO tier dot
      and NO routing summary badge rendered (silent omit, not a placeholder).

### 9. DV HUD (`?dv=1`)

19. Append `?dv=1` to the URL and reload.
    - **Expected:** HUD floats bottom-right with live counts:
      - Tier distribution histogram (GREEN / YELLOW / RED counts).
      - Receipt drawer p95 latency in ms.
      - Material instance count (BOUND_MATERIAL vs UNKNOWN_REVIEW split).

### 10. G-DV4 gate confirmation

20. Confirm all three production-wiring gates pass simultaneously:
    - **Tier distribution non-uniform** — HUD histogram shows ≥ 2 distinct
      tiers across the canary blueprint.
    - **Receipt drawer p95 ≤ 500 ms** — HUD latency reading.
    - **≥ 1 BOUND_MATERIAL instance renders** in MaterialStoryPanel on the
      sheet with the schedule / plan content.

If all three pass → G-DV4 PASS → wave ships.
If any one fails → G-DV4 FAIL → block release, escalate to backend lead for
α.5 wiring fix.

---

## Rollback procedure

PRs #82 – #85 and this Pass 5 PR are **additive** — each can be reverted
independently without breaking adjacent passes:

- **PR #82** (tier dot + routing summary on chapter strip) — revert removes
  the badges; chapter strip still renders.
- **PR #83** (sheet tab tier-tint + disqualifier badge) — revert restores the
  amber active bar; tabs still render.
- **PR #84** (SheetReceiptDrawer) — revert removes the drawer slot; right pane
  still renders without it.
- **PR #85** (MaterialStoryPanel) — revert removes the materials zone from
  SheetView; the rest of the sheet story still renders.
- **This PR (Pass 5)** — adds the HUD + this QA doc + e2e snapshot test only.
  Revert is purely cosmetic; nothing else depends on it.

**Block G-DV4 acceptance on backend α.5 wiring landing.** Do NOT mark the wave
shipped without confirming the three production-wiring gates above. A clean
visual layer over a defaulted backend ships nothing — it ships a decoration.
