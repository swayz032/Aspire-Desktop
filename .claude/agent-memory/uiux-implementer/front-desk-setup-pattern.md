---
name: Front Desk Setup Pattern (Pass 10 Lane B)
description: Numbered-section panel system with AvaOrbVideo hero used by app/session/calls/setup.tsx
type: project
---

# Front Desk Setup Pattern

Established 2026-04-28 in Pass 10 Lane B (plan `the-image-was-off-calm-lynx`).

**Why:** The redesigned Front Desk Setup page introduced a reusable numbered-section panel system + AvaOrbVideo ambient hero pattern that applies to any future "configuration" page (Receipts settings, Inbox setup, etc.).

**How to apply:** When building a multi-section settings/onboarding page in this codebase, reach for these patterns first.

## Files
- `Aspire-desktop/components/calls/setup/SectionPanel.tsx` — internal shared shell (numbered "step" badge + title + headerRight + content). Supports `enterIndex` for staggered fade-up entrance.
- `Aspire-desktop/components/calls/setup/FrontDeskSetupHero.tsx` — full-width hero with `AvaOrbVideo` 520x520 backdrop (opacity 0.30, offset right) + BlurView intensity 50 + blue tint + vertical legibility gradient. Foreground has small 64x64 AvaOrbVideo + glowing pill + title 32/700/-0.5 + Test/Save buttons.
- 5 numbered section components (`PublicNumberSection`, `CatchCallsSection`, `BusinessHoursSection`, `RoutingContactsSection`, `BusyModeSection`) each accept `enterIndex` and forward to SectionPanel.
- `SarahStatusRail.tsx` — composes 3 stacked rail cards (Status / Summary / Verification). Verification card is mode-aware.

## Visual language tokens used
- Card bg `#101012`, border `1px rgba(255,255,255,0.07)`, shadow `0 1px 3px rgba(0,0,0,0.4) + 0 8px 24px rgba(0,0,0,0.20) + inset 0 1px 0 rgba(255,255,255,0.025)`.
- Numbered step badge: 30x30 round, `rgba(59,130,246,0.14)` bg + `rgba(59,130,246,0.40)` border + 4px outer halo + cyan 700 numeral.
- Selected radio cards: `rgba(59,130,246,0.07)` bg + `rgba(59,130,246,0.45)` border + `0 0 0 1px rgba(59,130,246,0.25), 0 0 24px rgba(59,130,246,0.15)` glow shadow.

## Motion patterns (web)
- Section entrance: `@keyframes fds-section-fade-up` (380ms `cubic-bezier(0.16, 1, 0.3, 1)`, 60ms stagger via `animationDelay`). Respects `prefers-reduced-motion`.
- Hero entrance: same easing curve, 380ms.
- Subform reveal (Aspire-number sub-form): 280ms same easing.
- Modal pop: 220ms `scale(0.96) → scale(1)` + opacity.
- Card hover lift: `translateY(-1px)` to `translateY(-2px)` 160-200ms ease-out.

## A11y baselines
- All radio rows `accessibilityRole="radio"`, `accessibilityState={{ checked }}`.
- Checkboxes `accessibilityRole="checkbox"`.
- Switch toggles `accessibilityRole="switch"`.
- All buttons `accessibilityRole="button"` + `accessibilityLabel`.
- Decorative orbs / icons `accessibilityElementsHidden + importantForAccessibility="no-hide-descendants"`.
- Modal escape key handler on web.
- ≥44pt tap target on every interactive (rows have `minHeight: 60`, buttons `minHeight: 44`).

## API hydration pattern
- `hydrateFromLegacy()` in `app/session/calls/setup.tsx` maps the legacy `/api/frontdesk/setup` payload into the new `FrontDeskConfig` shape.
- `onSave` writes back the legacy server shape so the existing PATCH endpoint keeps working through cutover.
- This mapping pattern (legacy ↔ new types) is reusable any time a UI gets refactored ahead of the backend.

## Demo hub
- `app/demo/front-desk-setup.tsx` — DesktopShell + tab row cycling through all 7 component demos.
- Each `.demo.tsx` ships at least 2-3 prop permutations.
