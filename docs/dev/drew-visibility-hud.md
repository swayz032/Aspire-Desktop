# Drew Visibility HUD

Dev-only floating overlay used to QA the Drew Visibility (DV) canary rollout on
Pop's tenant. Surfaces the signals the contractor never sees: story freshness,
confidence-tier distribution, routing rollup, material binding counts, and
receipt-fetch latency percentiles.

## What it shows

Floating bottom-right card on the Scope route. Five sections:

- **Story** — chapter count, sheet count, and the relative age of
  `story.updated_at` (`just now` / `Nm ago` / `Nh ago` / `Nd ago` / `—`).
- **Tier distribution** — counts of chapters by `confidence_tier`. Chapters
  with no tier bucket under `—`.
- **Routing rollup** — sum of `routing_summary.{auto, review, open}` across
  chapters. Labeled `AUTO / TIM / BLOCK` to mirror the routing language
  used in the chapter pane. **TIM** is the Service Hub Manager helper
  assistant Drew routes pending-review work to. Tim is not yet built;
  the label forward-declares the destination so the UI is correct once
  Tim ships. Do not relabel as AVA — Ava is the frontstage receptionist,
  not part of Estimate Studio.
- **Materials** — total `MaterialInstance` count + how many are bound
  (`tier === 'GREEN'`) + how many remain unresolved
  (`resolution_source === 'unknown'`).
- **Receipt fetch p50/p95** — percentile latencies (ms) over the last 100
  samples of `useExtractionReceipt` fetches, with the sample count.

## How to enable

The HUD is gated by a query-string parameter. Only renders when:

1. `Platform.OS === 'web'` (returns null on native).
2. `window.location.search` contains `dv=1`.
3. The session has not dismissed the HUD via the `×` button.

Open any Scope-tab URL with `?dv=1` appended:

```
http://localhost:8081/service-hub/estimate-studio/scope?dv=1
http://localhost:8081/service-hub/estimate-studio/scope?chapter=power&dv=1
```

The dismiss state persists in `sessionStorage` (key
`drew-visibility-hud-dismissed`). A fresh page load with `?dv=1` re-enables it
in a new tab; clear the storage key or close the tab to reset within the same
tab.

## Where to mount additional metrics in future

The HUD reads three inputs:

- `story: BlueprintStoryV2 | null` — passed from `ScopeTab` via
  `useBlueprintStory(projectId).storyV2`.
- `materialsBySheet?: Map<string, MaterialInstance[]>` — passed via
  `useMaterialStory(projectId).materialsBySheet`.
- `receiptFetchLatenciesMs?: number[]` — pulled from
  `hooks/__internal/receiptLatencyLog`.

To add a new metric:

1. Pick the cheapest data source. If the signal is already in `storyV2` or
   `materialsBySheet`, add a `compute*` pure helper to
   `DrewVisibilityHUD.tsx` (mirror the existing `computeTierDistribution` /
   `computeRoutingRollup` shape) and consume it in `useMemo`.
2. If the signal lives in a hook fetch (like latency), add a sibling module
   to `hooks/__internal/` modeled on `receiptLatencyLog.ts`: append-on-event,
   capped FIFO, `__DEV__`-gated push site at the hook, snapshot getter for
   the HUD.
3. Render one `<Text style={styles.section}>` / `<Text style={styles.line}>`
   pair inside the existing `<ScrollView>`. Card grows up to `maxHeight:
   240px`; past that the scroll handles it.

Never call data hooks inside `DrewVisibilityHUD` itself unless they're
guaranteed-cheap (the existing `useMaterialStory` integration is owned by
`ScopeTab`, not the HUD).

## Why it's dev-only

This is a debug aid for the DV rollout, not a production-visible surface. It
intentionally exposes pipeline internals (routing actions, binding tiers,
fetch latencies) that contractors are not supposed to read or reason about.
The query-param gate is belt-and-suspenders alongside `__DEV__` log
suppression — Metro strips the `console.log` call sites at minify time, and
the gate prevents the overlay from ever rendering even if a build slips
without minification.

The latency-log push in `useExtractionReceipt` is wrapped in `if (__DEV__)`
for the same reason: production bundles must not carry a per-fetch
side-effect that could grow memory unbounded over a long session.

## Files

- `components/dev/DrewVisibilityHUD.tsx` — the component.
- `hooks/__internal/receiptLatencyLog.ts` — the latency FIFO.
- `components/service-hub/estimate-studio/scope/ScopeTab.tsx` — mount point.
- `__tests__/dev/DrewVisibilityHUD.test.tsx` — unit tests.
