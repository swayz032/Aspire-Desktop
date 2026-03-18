# Expo App Engineer Memory

## Observability
- Error reporter: `lib/errorReporter.ts` — standalone POST to `/admin/ops/incidents/report`, rate-limited 5/60s
- Provider error reporter: `lib/providerErrorReporter.ts` — dual rate limit (3/provider + 10 total per 60s)
- Page error boundary: `components/PageErrorBoundary.tsx` — per-page React error boundary with incident reporting
- Global error boundary: `app/_layout.tsx` GlobalErrorBoundary — reports sev1 via reportError
- Pages wrapped: voice, conference-lobby, conference-live, calls, finance-hub
- Providers instrumented: ElevenLabs (speakText, streamSpeak), Deepgram STT (start, ws_error, reconnect), Anam (session, connect, bind, stream)
- authenticatedFetch is a HOOK (useAuthFetch) — standalone code uses plain fetch with relative URLs (same-origin)

## Project Structure
- Design tokens: `constants/tokens.ts` (Colors, Spacing, BorderRadius, Typography, Shadows, Canvas)
- Card patterns: `constants/cardPatterns.ts` (CARD_BG=#1C1C1E, CARD_BORDER, SVG patterns)
- Finance components: `components/finance/documents/` (barrel export via index.ts)
- Server routes: `server/routes.ts` (5000+ lines, PandaDoc at ~L5170)
- Static assets: `public/templates/*.png` served via express.static in server/index.ts

## Design Token Conventions
- Colors.background: primary=#0a0a0a, secondary=#0d0d0d, tertiary=#0f0f0f, elevated=#141414
- Colors.surface.card=#1C1C1E (same as CARD_BG)
- Colors.accent.cyan=#3B82F6 (primary brand accent)
- Colors.text: primary=#fff, secondary=#d1d1d6, tertiary=#a1a1a6, muted=#6e6e73, disabled=#48484a
- Risk tier colors: green=#34c759, yellow=#f59e0b, red=#ff3b30

## Component Patterns
- Web-only CSS: use `Platform.OS === 'web' ? {...} as any : {}` pattern
- Hover/pressed states: `({ hovered, pressed }: any) => [...]` in Pressable style callback
- Keyframe injection: idempotent via `document.getElementById(styleId)` check
- Image fade-in: `opacity: imageLoaded ? 1 : 0` + `transition: 'opacity 0.3s ease'`
- Shimmer loading: CSS gradient animation, separate `@keyframes` per component
- Modal pattern: Pressable backdrop (click-to-close) + inner Pressable (stopPropagation)
- Accessibility: buttons need accessibilityRole="button" + accessibilityLabel

## Common Bugs Found (Review Checklist)
- Pressable wrapper: closing tag must match opening (`</Pressable>` not `</View>`)
- Style references: if style callback uses `styles.fooPressed`, define it in StyleSheet
- stopPropagation: nested Pressable inside Pressable needs `e.stopPropagation()` on inner press
- displayName: PandaDoc keys are `pandadoc_{uuid}` -- key-based name parsing yields gibberish; use description
- Duplicate types: export shared types (RiskTier, RISK_COLORS) from single source, import elsewhere
- Hardcoded colors: replace with tokens where match exists (elevated, primary, etc.)
- Iframe crossfade: use opacity transition + pointerEvents:'none' instead of conditional rendering for smooth transition

## Server Route Patterns
- PandaDoc API key: `process.env.ASPIRE_PANDADOC_API_KEY`
- Template ID validation: `/^[A-Za-z0-9]{10,30}$/` (base62-like alphanumeric)
- Express params type: use `as string` assertion for `req.params.id`
- Auth: routes under /api/ are JWT-gated unless listed in PUBLIC_PATHS
- Thumbnail resolution: UUID map > name-based fallback > PandaDoc API image

## TypeScript Notes
- Pre-existing TS errors in codebase (CelebrationModal, canvas widgets, mailRoutes) -- not our concern
- No `any` types needed in our components except for web-only CSS properties cast
- `as any` required for web CSS properties not in RN types (boxShadow, transition, etc.)

## LiveKit Conference Integration
- Base CSS: `lib/livekit-styles.ts` — ~21KB structural + Aspire dark theme overrides
- CSS injection: `injectLiveKitStyles()` — module-level `injected` flag + `getElementById` guard
- Guest join page: `app/join/[code].tsx` — public route, no auth required
- LiveKit provider: `components/session/LiveKitConferenceProvider.tsx` (NOT in providers/)
- Internal conference: `app/session/conference-live.tsx`
- Server routes: `server/routes/livekit.ts` (NOT routes.ts)
- PUBLIC_PATHS: `/api/conference/join/` is exempted from JWT auth in `server/index.ts:59`
- Auth gate: `segments[0] === 'join'` in _layout.tsx line 164 exempts /join from auth redirect
- Join layout: `app/join/_layout.tsx` — minimal dark layout, headerShown=false
- PreJoin type: `LocalUserChoices` from `@livekit/components-core` (username, audioEnabled, videoEnabled, audioDeviceId, videoDeviceId)
- LiveKitRoom callbacks: onConnected, onDisconnected(DisconnectReason), onError(Error), onMediaDeviceFailure(MediaDeviceFailure)
- DisconnectReason: from `@livekit/protocol`, re-exported via `livekit-client` — PARTICIPANT_REMOVED(4), ROOM_DELETED(5), STATE_MISMATCH(6), JOIN_FAILURE(7)
- MediaDeviceFailure: from `livekit-client/room/errors`, re-exported via `export * from './room/errors'`
- Guest page states: loading, prejoin, connecting, active, disconnected, expired, invalid, error
- Device selections: PreJoin choices must be passed to LiveKitRoom options (audioDeviceId, videoDeviceId, audioEnabled, videoEnabled)
- Join code: CR-XXXXXX format, 60m TTL, stored in Supabase `conference_join_codes` table
