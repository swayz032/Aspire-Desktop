# Native Parity Audit — Wave D Horizontal Cards

**Scope**: `BaseCard.tsx`, `ProductCard.tsx`, `HotelCard.tsx`, `ProductDetailModal.tsx`
**Date**: 2026-04-29
**Auditor**: e2e-tests (aspire-test-engineer)

---

## Summary

| Risk | File | Finding |
|------|------|---------|
| PASS | BaseCard.tsx | No DOM-only APIs |
| PASS | HotelCard.tsx | No DOM-only APIs |
| PASS | ProductCard.tsx | No DOM-only APIs |
| CONDITIONAL | ProductDetailModal.tsx | document.addEventListener — Platform.OS gated |
| CONDITIONAL | ProductDetailModal.tsx | CSS keyframes via className — Platform.OS gated |
| PASS | ProductDetailModal.tsx | expo-image used for all Image rendering |
| PASS | ProductDetailModal.tsx | ESC handler gated by Platform.OS === 'web' |
| PASS | BaseCard.tsx | expo-image NOT used — uses RN Image primitives via heroSlot |
| PASS | All files | Pressable used everywhere — no `<button>` tags, no `onClick` |

---

## Detailed Findings

### BaseCard.tsx

**ScrollView vs FlatList**: Uses `ScrollView` for vertical card body (`contentScroll` style). ScrollView is cross-platform compatible. No FlatList used. PASS.

**expo-image vs Image**: BaseCard does NOT directly render images — it provides `heroSlot` and `children` slots. The images are rendered by the individual card components (HotelCard, ProductCard) which use `expo-image`. PASS.

**Pressable**: No interactive elements in BaseCard itself — interaction is delegated to ResearchModal (peek Pressable) and card components. No `<button>` or `onClick`. PASS.

**DOM-only API**: None. The only web-specific code is:
- `{ boxShadow: '...' }` inline styles gated by `Platform.OS === 'web'` check at module level.
- `{ cursor: 'zoom-in' }` in ProductCard's `horizontalHeroPressable` style — `Platform.OS === 'web'` gated. PASS.

**Reanimated**: Uses `FadeInUp` from `react-native-reanimated`. This is cross-platform compatible. PASS.

---

### HotelCard.tsx

**expo-image**: `import { Image } from 'expo-image'` used for all hero image rendering. PASS.

**Pressable**: `<Pressable>` used for the horizontal hero tap target (`hotel-card-horizontal-hero`). No `<button>` or `onClick`. PASS.

**DOM-only API**: None. Web-specific cursor style `{ cursor: 'zoom-in' }` is inline and gated via `Platform.OS === 'web'` check in the `hHeroStyles` constant. PASS.

**LinearGradient**: `expo-linear-gradient` is cross-platform. PASS.

---

### ProductCard.tsx

**expo-image**: `import { Image } from 'expo-image'` used for all image rendering (horizontal hero and gallery thumbnails). PASS.

**Pressable**: All interactive elements use `<Pressable>`. No `<button>` or `onClick`. PASS.

**DOM-only API**: `{ cursor: 'zoom-in' }` in `horizontalHeroPressable` style is gated by `Platform.OS === 'web'`. PASS.

**Gallery navigation**: Uses `setGalleryIndex` state — no DOM-specific behavior. PASS.

---

### ProductDetailModal.tsx

**expo-image**: `import { Image } from 'expo-image'` used for hero image and thumbnail strip. PASS.

**Pressable**: All interactive elements use `<Pressable>`. No `<button>` or `onClick`. PASS.

**CSS keyframes (shimmer skeleton)**: `className="pdm-shimmer"` is applied to `<Animated.View>`. The class uses `@keyframes pdmShimmer` via `injectModalStyles()` which is wrapped in `if (Platform.OS !== 'web') return;`. On native, the skeleton falls back to Reanimated `withTiming` opacity pulse. PASS (correctly gated).

**document.addEventListener**: The ESC key handler at line 326-332 of ProductDetailModal.tsx uses `document.addEventListener('keydown', handler)`. This is gated by:
```typescript
if (!visible || Platform.OS !== 'web') return;
```
PASS — correctly gated. Native will never reach the `document.addEventListener` call.

**injectModalStyles()**: Called in `useEffect` with `if (Platform.OS === 'web') injectModalStyles();`. PASS — correctly gated.

**ScrollView**: Body uses `<ScrollView>` with `overflowY: 'auto'` style cast applied conditionally via `Platform.OS === 'web'`. Thumbnail strip uses `<ScrollView horizontal>`. Both are cross-platform. PASS.

**ActivityIndicator**: Uses React Native's `ActivityIndicator` — cross-platform. PASS.

---

## Risk Summary

No native blockers found. All DOM-only APIs (`document.addEventListener`, `document.createElement`) are correctly gated by `Platform.OS === 'web'`. CSS keyframe animations fall back to Reanimated on native. expo-image is used for all image rendering.

**Verdict: PASS — safe to ship on native.**

---

## Notes for expo-cards

No implementation bugs found during this audit. All `Platform.OS` guards are in place.
