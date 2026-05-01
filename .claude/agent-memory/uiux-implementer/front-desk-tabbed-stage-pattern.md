---
name: Front Desk Tabbed Center-Stage Pattern (Pass 16 UI)
description: Hero + 5-step tab nav + center-stage section + sticky right rail layout for multi-section settings pages
type: project
---

# Front Desk Tabbed Center-Stage Pattern

Established 2026-04-29 in Pass 16 UI of plan `the-image-was-off-calm-lynx`. Supersedes the Pass 10 "stack everything" scroll layout for multi-section settings pages.

**Why:** A single page that scrolls through 5 stacked sections felt cramped — sections fought for attention and the right rail repeated. Tabbed center-stage gives each section the canvas it deserves while keeping the rail sticky alongside.

**How to apply:** When a settings/onboarding page has 4+ logical sections that don't need to be visible simultaneously, reach for this pattern instead of stacking.

## Files
- `components/calls/setup/FrontDeskSetupTabs.tsx` — 5-step segmented control. Numbered circles + animated underline (web). Cmd/Ctrl + 1..5 shortcuts. Dirty-tab indicator dots.
- `components/calls/setup/AspireNumberPickerSheet.tsx` — full-screen modal sheet for Twilio number search/purchase. Glassmorphism backdrop (BlurView 30 + rgba 0.62 + backdrop-filter blur 24px). Yellow-tier confirm dialog before purchase.
- `app/session/calls/setup.tsx` — page shell. `dirtyTabs` derived via per-slice JSON diff, key={tab} on the stage forces section entrance animation.
- `components/calls/setup/FrontDeskSetupHero.tsx` — forest-photo hero with radial-gradient fallback (3 layered gradients evoke pre-dawn mist + ridge + ground fog). Drop `assets/images/front-desk-setup-hero.jpg` and uncomment require() to swap photo in.

## Layout
- Hero (full width)
- Tab strip with sliding underline + dirty-dot indicators
- Body grid: `flex 7 / flex 3` split, centerStage `maxWidth: 880, marginHorizontal: auto, paddingX: 8` for breathing room
- Right rail `position: sticky, top: 96` (web only)
- `key={\`stage-${activeTab}\`}` on the center stage triggers reflow + entrance animation per tab swap

## Sliding underline pattern (web)
- Web: ref each tab, measure `getBoundingClientRect()` on activeTab change, set `underlineLeft` + `underlineWidth` state, render absolutely-positioned `webUnderline` View with CSS transition `left/width 220ms cubic-bezier(0.16,1,0.3,1)`
- Native: each active tab renders its own `nativeUnderline` static line — no animation
- Falls back to no underline pre-measurement (initial render frame)

## Modal sheet pattern (AspireNumberPickerSheet)
- Web: `position: fixed` overlay + Pressable backdrop dismiss + BlurView intensity 30 + sheet card with `backdrop-filter: blur(24px) saturate(140%)`
- Native: React Native `<Modal transparent animationType="fade">` with same Pressable backdrop pattern
- Escape key handler (web) closes confirm dialog first, then sheet
- Skeleton grid (6 cards, shimmer keyframe `background-position` -200% to 200% on 1.4s loop)
- 4 body states: initial prompt / searching / empty / error / results — never blank
- Yellow-tier confirm dialog floats above sheet at z:1100 (sheet at z:1000)
- Idempotency key generated client-side via `crypto.randomUUID()` (with date+random fallback)

## Pass-17-ready API stub pattern
When backend module isn't shipped yet but UI must wire to known endpoints, define local `fetchX()` / `patchX()` helpers in the page file that call the real URLs. Document at the top of the file: "When `lib/api/X.ts` lands in Pass N, swap these for `getX()` / `patchX()`." Keep response shapes flexible (`Record<string, any>` typed payloads) so the swap is one-line per call site.

## Dirty-tab diff pattern
```ts
function diffDirtyTabs(current: Config, original: Config): Set<TabId> {
  const dirty = new Set<TabId>();
  const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (!eq(current.sliceA, original.sliceA)) dirty.add('tab-a');
  // ...
  return dirty;
}
```
Pass `dirtyTabs` into both the tab strip (for indicator dots) and Save button enablement.

## Hero photo swap-in pattern
- Metro evaluates `require()` statically. Cannot wrap in try/catch.
- Default ship: `const HERO_PHOTO: ImageSourcePropType | null = null;` + radial-gradient fallback
- User drops file: change one line to `const HERO_PHOTO = require('@/assets/images/x.jpg');` — JSX already wired
- Always provide non-broken fallback so the layout doesn't depend on the asset existing
