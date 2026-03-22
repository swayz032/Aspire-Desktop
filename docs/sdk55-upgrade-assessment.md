# SDK 55 Upgrade Assessment

**Date:** 2026-03-21
**Current:** SDK 54 (React Native 0.81, React 19.1)
**Target:** SDK 55 (React Native 0.83, React 19.2)

## Decision: DO NOT UPGRADE YET

SDK 54 is stable and working. Upgrade should be its own focused PR with full regression testing.

## Key SDK 55 Changes

| Feature | SDK 54 | SDK 55 | Impact |
|---------|--------|--------|--------|
| New Architecture | Optional (`newArchEnabled: true`) | Mandatory (flag removed) | Aspire already enabled — no breaking change |
| React Native | 0.81 | 0.83 | Minor — check changelog |
| React | 19.1 | 19.2 | Minor |
| `/src` folder | Not standard | Convention for app source | Optional migration |
| Native Tabs API | N/A | Built-in native tab navigation | Could replace custom tab bar |
| `eas go` | N/A | Streamlined EAS commands | Nice-to-have |
| `newArchEnabled` flag | Required in app.json | Removed (always on) | Remove from app.json when upgrading |

## Pre-Upgrade Checklist

1. [ ] Remove `newArchEnabled: true` from `app.json` (becomes no-op then error)
2. [ ] Test all 20+ expo packages for SDK 55 compatibility
3. [ ] Check breaking changes in React Native 0.82 and 0.83 changelogs
4. [ ] Verify LiveKit SDK compatibility with RN 0.83
5. [ ] Verify Skia, Reanimated, Gesture Handler compatibility
6. [ ] Full regression test suite (all 102 screens)
7. [ ] Test on web, iOS simulator, Android emulator

## Risk Assessment

- **Low risk:** New Architecture already enabled
- **Medium risk:** Third-party native modules (LiveKit, Skia) may need updates
- **Low risk:** React 19.1 → 19.2 is a patch-level change

## Recommended Timeline

Upgrade as separate PR after v1.2.0 stabilization. Do not bundle with feature work.

## Packages to Verify

All expo-* packages auto-update via `npx expo install`. Third-party packages need manual verification:
- `@livekit/components-react` — check RN 0.83 support
- `@shopify/react-native-skia` — check RN 0.83 support
- `react-native-reanimated` — check compatibility matrix
- `react-native-gesture-handler` — check compatibility matrix
- `@sentry/react-native` — check RN 0.83 support
