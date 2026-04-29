---
name: BaseCard fixed 580px height contract
description: Cards in Aspire-desktop use a fixed-height + internal-scroll pattern, NOT min-height + content growth. Wave 4.1 of the Anam-Ava polish plan.
type: project
---

The Ava Presents card system (`components/cards/BaseCard.tsx`) uses a **fixed-height container with internal ScrollView** for content overflow.

**Why:** The user reported (session `1b6bd562`) inconsistent card sizes in the carousel and "cards opening by themselves." Both reports trace to the wrong size primitive: `minHeight: 580` + content-driven growth. Cards with dense data grew taller than cards with sparse data, which created a visually inconsistent stack. The bigger card "looked opened" -- that misperception was the second report.

The fix replaces the size primitive: `height: 580` + `maxHeight: 580` + `overflow: hidden` + a content `ScrollView` with `flex: 1`. Cards never grow. Overflow scrolls inside. The constant is exported as `CARD_HEIGHT = 580` for any consumer that needs to mirror the value (e.g., the carousel slide wrapper).

**How to apply:**
- ALL artifact-type cards (HotelCard, ProductCard, PropertyCard, BusinessCard, GenericCard) MUST go through BaseCard. Do not bypass it.
- Card body content goes inside `BaseCard`'s `children` -- it lands in the internal ScrollView automatically.
- Hero (top, fixed via `heroStyle`) and actionSlot (bottom, fixed) sit outside the scroll surface so they always show.
- DO NOT add per-card `minHeight` or placeholder-filler views to "balance" sizes -- they were a workaround for the prior bug and are anti-patterns now. HotelCard had one (`placeholderSection` + `placeholderText`); it was removed in commit 9f82025.
- Carousel-level wrappers (e.g., `ResearchModal.cardSlide`) should NOT also enforce minHeight. If they do, change to `height: 580` (matching CARD_HEIGHT) or remove the constraint.
- The closing-gate test is `__tests__/components/cards/BaseCard.fixed-height.test.tsx` -- 10 tests covering sparse + dense + all 5 artifact types. Don't break it.

**Native parity:** `ScrollView` is from `react-native` (works on Expo iOS/Android/web). The `overflowY: auto / overflowX: hidden` web override is platform-gated via `Platform.OS === 'web'`.
