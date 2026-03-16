# Aspire Test Engineer Memory — Aspire-desktop

## Test Infrastructure

- **Framework**: `jest-expo` preset (configured in `package.json` `"jest": {"preset": "jest-expo"}`)
- **Test runner**: `jest --watchAll` via `npm test`
- **React Native testing**: `@testing-library/react-native` v13 (`renderHook`, `act`)
- **E2E**: Playwright (`e2e/onboarding.spec.ts`) — hits `www.aspireos.app` (live env only)
- **No jest.config.js file**: config is entirely in `package.json` jest field
- **No coverage threshold configured**: must add `--coverage` flag and `coverageThreshold` explicitly

## Test File Locations

- `hooks/__tests__/` — hook unit tests (6 files)
- `components/**/__tests__/` — component tests
- `components/canvas/widgets/*.test.tsx` — widget tests (flat)
- `lib/__tests__/` — store/utility tests
- `e2e/` — Playwright E2E (live environment)

## Coverage Map (as of 2026-03-08)

| Module | Test File | Coverage |
|--------|-----------|----------|
| `hooks/useCanvasVoice.ts` | `hooks/__tests__/useCanvasVoice.test.ts` | Yes (9 tests) |
| `hooks/useAgentVoice.ts` | NONE | 0% |
| `app/session/voice.tsx` | NONE | 0% |
| `data/session.ts` | NONE | 0% |
| `lib/elevenlabs.ts` | NONE | 0% |

## Key Patterns

- **Mock pattern**: capture callbacks via closure in `jest.mock()` factory, expose as module-level vars (`mockOnStatusChange`, `mockOnError`), trigger via `act()`
- **Fake timers**: `jest.useFakeTimers()` in `beforeEach`, real timers in `afterEach` — used in `useActivityStream.test.ts`
- **Platform mocking**: `Object.defineProperty(Platform, 'OS', { value: 'web', writable: true })`
- **No snapshot tests** in this codebase — all assertion-based

## Critical Gaps Found (voice.tsx fix — 2026-03-08)

- `resolveAgentFromSession()` — pure function, zero tests
- `STAFF_TO_AGENT` mapping table — zero tests (11 entries, several with shared 'ava' resolution)
- `onError` classifier (auth/autoplay/mic/tts branches) — zero tests
- `useEffect` mount/unmount teardown (`startSession` / `endSession`) — zero tests
- `useAgentVoice` hook itself — zero unit tests (only tested transitively via `useCanvasVoice`)
- `data/session.ts` module-level mutable `currentSession` — flaky risk (state leaks between tests)

## Known Flaky Risk

- `data/session.ts` uses module-level `let currentSession: Session | null = null` — if tests import this module without resetting, state leaks between test files. Must call `endSession()` or mock the module in any test that calls `getCurrentSession()`.

## Test Commands

```bash
# Run all Aspire-desktop unit tests
cd /mnt/c/Users/tonio/Projects/myapp/Aspire-desktop && npx jest --coverage --watchAll=false

# Run hook tests only
cd /mnt/c/Users/tonio/Projects/myapp/Aspire-desktop && npx jest hooks/ --coverage --watchAll=false

# Run with verbose output
cd /mnt/c/Users/tonio/Projects/myapp/Aspire-desktop && npx jest --verbose --watchAll=false
```
