---
name: Playwright clicks on perspective-transformed RN-Web Pressables
description: When testing RN-Web Pressables that have CSS perspective/translateZ transforms applied, page.click() may target the wrong element due to bounding-box hit-testing — use dispatchEvent('click') instead.
type: feedback
---

When an RN `<Pressable>` has inline CSS `transform: translate(-50%, -50%) translateX(±N%) translateZ(-Npx) rotateY(±Ndeg) scale(N)` (3D perspective layout, e.g., side-peek carousel cards), Playwright's `page.click()` and `locator.click()` flake.

Reason: Playwright targets the testID's bounding box and dispatches mousedown/mouseup at a position inside it. With perspective transforms, the rendered DOM may sit underneath another element's hit area (especially if the higher-z-index sibling has overlapping bounding-box DOM coordinates from `getBoundingClientRect()`). Even with `force: true`, the synthetic mouse events fire at viewport coordinates that may resolve to the wrong target.

**Symptoms:**
- The Pressable's `accessibilityRole="button"` shows in the snapshot (so element renders correctly).
- After click, state doesn't change (onPress never fires).
- "subtree intercepts pointer events" warning may appear before retries.

**Fix in tests:**
Use `locator.dispatchEvent('click')` to fire a synthetic click directly on the targeted DOM node:

```ts
await page.getByTestId('peek-card').dispatchEvent('click');
```

This bypasses Playwright's hit-test entirely and guarantees the click event lands on the testID's element. RN-Web Pressable's `onPress` handler responds correctly to native `click` events.

**Real users are unaffected** — the browser hit-tests rendered (transformed) DOM properly. This is a Playwright vs. CSS perspective interaction quirk only.

**Layout note:** ensure neighbor cards don't visually overlap the active card's DOM bounding box. With CARD_WIDTH=500 and active scale 1.0, `translateX(±70%)` (per a stale spec) causes ~115px overlap with the active card's DOM. Bump to `translateX(±88%)` or higher to keep peeks clickable in non-Playwright environments.

**Where this came up:** Wave 4.3 ResearchModal carousel (commit 5efdfe9 on Aspire-Desktop), 2026-04-28.
