# Call Room — Design Spec

**Date:** 2026-04-30
**Status:** Brainstorm complete — pending user review
**Owner:** tonioswayz32@gmail.com (founder)
**Repo:** `Aspire-desktop`
**Replaces:** active-call view in `app/session/calls.tsx` (current dark-blue orb screen)

---

## 1 · What we're building

The **Call Room** is the immersive screen the user enters when an outbound call is placed (or an inbound call is accepted). It replaces the current dark-blue orb-on-black active-call screen with a warm-executive office environment containing a premium black-glass floating card that holds all call controls and context.

### Behavior

1. User stays on the existing dial pad / Return Calls dashboard (**unchanged**).
2. Taps the green call button → 600 ms **Camera Push-In** transition.
3. Lands inside the warm-executive office. Premium thick black-glass Call Room card floats in center, lit by the room's window light, with parallax-driven depth response.
4. Conducts the call (Mute / Hold / Keypad / Transfer / End Call).
5. Taps **End Call** → 500 ms symmetric **push-out** transition → returns to dial pad.

### In scope (V1)

- Single universal Call Room (not per-agent)
- Warm-executive office aesthetic, layered parallax 2.5D background
- Premium thick black-glass card with shared lighting from `roomLight`
- Camera push-in / push-out transitions
- Caller avatar (photo / initials / silhouette fallback)
- Voice activity ring (Aspire blue, amplitude-driven)
- Time-of-day tint (4 states, geolocation + `suncalc`)
- Premium tier feature-flag scaffolding (no premium UI in V1)
- Dev preview at `/_dev/call-room` + Shift+click shortcut on dial pad

### Out of scope (deferred)

- Per-agent rooms (Finn's office, Eli's truck, etc.) — defer until customer evidence
- Real 3D scene (Three.js) — defer until "virtual office" becomes core metaphor
- Weather effects (rain on glass, snow, fog) — V2 fast-follow
- Multiple selectable room themes — V2 fast-follow
- Multi-room navigation
- Call recording / transcript surfacing inside Call Room

---

## 2 · Visual System

### 2.1 The Office (background, parallax 2.5D)

A single warm-executive office image (AI-rendered via Midjourney/Flux to match the user's mockup exactly):

- Dark vertical slat wood walls
- Tan leather chair (mid-foreground right)
- Floor-to-ceiling windows with blurred warm city light (left)
- Bookshelves and warm interior lighting (right)
- Black leather sofa edge / coffee table foreground (left)

The single render is sliced into **5 PNG (WebP) depth layers** in Photoshop:

| Layer | Content | Parallax range | Z-index |
|---|---|---|---|
| 1 | Sky + skyline + window frame | ±2 px | 0 |
| 2 | Back wall + bookshelf + back furniture | ±5 px | 10 |
| 3 | Mid-room: chair, plant, lamp, desk | ±8 px | 20 |
| 4 | Floor + foreground desk edge | ±10 px | 30 |
| 5 | Foreground bokeh + lens dust | ±12 px | 40 |

**Implementation:** all transforms via `translate3d(...)` + `will-change: transform`, GPU-accelerated. Cursor position drives per-layer translation, throttled via `requestAnimationFrame`. Sub-1% CPU on a Chromebook. All assets lazy-loaded only when a call starts.

### 2.2 Time-of-day tint

Single semi-transparent gradient overlay above the 5 layers, driven by:

- `navigator.geolocation` (opt-in, browser-permissioned) → `suncalc` npm package → exact local sun azimuth/elevation
- Falls back to system time silently if geolocation denied
- 4 named states with smooth interpolation between adjacent states:

| State | Window | Color cast | Notes |
|---|---|---|---|
| **Dawn** | Sunrise ±90 min | Cool blue, gradient from top-left | Lowest interior glow |
| **Day** | Post-dawn → 1 hr before sunset | Neutral, very low opacity | Default |
| **Dusk** | Sunset ±90 min | Warm amber, raked from window side | Highest emotional warmth |
| **Night** | Post-dusk → pre-dawn | Deep navy + interior lamp glow accent | Window goes dark, interior warm |

### 2.3 Floating Call Room card (the UI surface)

**Layout** (pixel-matches user's reference mockup):

```
┌────────────────────────────────────────────────────────────────────┐
│  Front Desk Call Room                          ● Connected   [👤] │  ← header
│  Sarah hosting · Outbound call in progress                Sarah    │
├──────────────┬──────────────────────────────┬────────────────────┤
│              │                              │                    │
│  Client      │      [  Avatar  ]            │   AI Assist        │
│  Memory      │                              │                    │
│              │      02:18                   │   Suggested        │
│  Marcus      │      Marcus Johnson          │   question         │
│  Johnson     │      (555) 867-5309          │   [ ............ ] │
│  ...         │                              │                    │
│  Service     │      ~~ waveform ~~          │   Next actions     │
│  Urgency     │                              │   [Schedule]       │
│  Note        │                              │   [Draft SMS]      │
│              │                              │   More actions ▾   │
├──────────────┴──────────────────────────────┴────────────────────┤
│  [🎤 Mute]  [⏸ Hold]  [⊞ Keypad]  [⇄ Transfer]  [☎ End Call]    │  ← controls
├──────────────────────────────────────────────────────────────────┤
│  Need: ...           Urgency: ...           Next Step: ...        │  ← summary
└──────────────────────────────────────────────────────────────────┘
```

**Card material — premium thick 3D black glass (5 stacked layers of depth):**

| Layer | Spec |
|---|---|
| 1 · Base | `background: rgba(15, 18, 24, 0.65)` |
| 2 · Backdrop blur | `backdrop-filter: blur(18px) saturate(1.4) brightness(1.05)` |
| 3 · Edge highlight | Inner top edge: 1 px gradient `rgba(255,255,255,0.12) → 0` (light catching from above, brighter on window side) |
| 4 · Bevel | `box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.4)` (thickness) |
| 5 · Layered drop shadow + Aspire glow | `0 2px 6px rgba(0,0,0,.6), 0 24px 60px rgba(0,0,0,.5), 0 0 80px rgba(120,170,220,.18)` |
| 6 · Edge refraction | 3 px gradient overlay along card edges simulating light bending through glass |

Border: 1 px `rgba(120, 170, 220, 0.35)`. Corner radius: 18 px.

### 2.4 Shared lighting (`roomLight`) — the illusion-closing layer

Card and room **must agree** on where the light is coming from, or the illusion fails. The office's primary light source is the window (left, mid-height, warm afternoon city light by default).

A single `roomLight` vector exposed as CSS custom properties at the `<CallRoom>` root, consumed by all card layers:

```css
--room-light-x: 0.18;       /* 0=left edge, 1=right edge */
--room-light-y: 0.45;
--room-light-color: #d4a574; /* warm afternoon (default) */
--room-light-intensity: 0.7;
```

**Behavior:**
- Card edge highlight is **brighter on the window side** (left), dimmer on the right
- Card drop shadow falls to the **right** (light from left)
- Card outer glow leans **cooler** on the shadow side, **warmer** on the lit side
- The Aspire-blue signature glow remains constant *under* the card (signature accent), but directional highlight + shadow follow `roomLight`

**Time-of-day binding:** when the time-of-day state shifts, `roomLight.color` and `roomLight.intensity` interpolate together with the tint overlay. Dusk → amber; night → cool deep blue with warm interior lamp accent. The card's appearance shifts in lockstep with the room.

### 2.5 Card depth response (cursor-driven 3D tilt)

When the cursor moves near the card:
- Card tilts ±2° on `rotateX` and `rotateY` based on cursor distance from card center
- Tilt **drives lighting shifts**, not just rotation: as the card tilts, `--room-light-x` and the highlight/shadow update to simulate real glass catching real light
- Throttled via `requestAnimationFrame`, eased with `cubic-bezier(0.22, 1, 0.36, 1)`
- Returns to neutral when cursor leaves card area (300 ms ease-out)

### 2.6 Caller avatar — 4 states, **user-configurable per contact**

Single `<CallerAvatar>` component. The user (operator) chooses how each client appears via a per-contact `avatar_mode` field on the contact record. **3D defaults are Aspire's signature look** — Pixar-style illustrated characters that match the warm, premium brand. Photos and initials are user opt-ins.

| State | When | Visual |
|---|---|---|
| **`photo`** | User uploaded a real photo for this client | Photo in 220 px circle, 1 px inner border `rgba(120,170,220,0.4)`, soft outer glow tinted by `roomLight` |
| **`initials`** | User selected initials mode | Gradient-filled circle with 2-letter initials, gradient seeded from name hash → consistent color per contact |
| **`default_male`** ⭐ Aspire signature | Default for new contacts (user can swap) | Stylized 3D illustrated male character (`assets/avatars/default-male.png`), transparent BG composited onto roomLight-tinted gradient backdrop |
| **`default_female`** ⭐ Aspire signature | Default for new contacts (user can swap) | Stylized 3D illustrated female character (`assets/avatars/default-female.png`), same compositing as male |

**Default selection at contact creation:**
- New contact, no photo, no gender hint → `default_male` (configurable per-tenant in settings)
- User can override per-contact at any time via avatar picker UI: `[Photo] [Initials] [👨 Male] [👩 Female]`

**`roomLight` integration (avatar feels *in* the room):**
- The 3D character PNG is transparent → composited onto a circular backdrop tinted by the current `roomLight.color`
- A subtle vignette inside the avatar circle picks up the room's directional light (warmer on the window-side edge, cooler on the shadow-side edge)
- This makes the cartoon character feel like it's *lit by the room*, not pasted onto the card

**Asset pipeline (build prep, not runtime cost):**
- Source PNGs: `default-male.png` (5.1 MB), `default-female.png` (4.8 MB) — production-grade renders
- Build step: resize to 512×512 max + convert to WebP @ q=85 → target **~80 KB each**
- Tool: `sharp` CLI (already a likely dep) or one-shot npm script
- Final shipped asset: `default-male.webp`, `default-female.webp` in same directory

**Future fast-follow (not V1):**
- Expand the 3D default library to 8–12 characters (varied ethnicity, age, style) so users have more visual diversity options. V1 ships with 2 (male/female) — proves the pattern, validates demand for more.

### 2.7 Voice activity ring — Aspire blue glow

Soft ring around the avatar that pulses with audio amplitude.

- Stroke: 4 px, base color `rgba(120, 170, 220, 0.6)`, blurred outer halo
- Animation: amplitude-driven scale (1.0 → 1.04) + opacity (0.4 → 0.8), 60 fps, RMS audio analyzer
- **Idle (silence):** subtle 2 s breath at 1.0 → 1.01, very low opacity (life without distraction)
- **Color states:**
  - Aspire blue — normal speech
  - Soft red — on hold
  - Gold — transferring
- **Reciprocal ring on host chip** (top-right Sarah avatar): when the user/host speaks, that chip's ring pulses instead. User always sees who's talking.

Audio source: existing call WebRTC stream → `AudioContext` → `AnalyserNode` → 60 fps RMS values. ~0.5 % CPU.

### 2.8 Caller ID hierarchy

| Position | Content | Type |
|---|---|---|
| Header line 1 (small label) | "Outbound call · in progress" / "Inbound call" / "On hold" | Status, not identity |
| Center, below avatar — line 1 | Name, e.g. "Marcus Johnson" | 24 px, semibold |
| Center, below avatar — line 2 | Number, e.g. "(555) 867-5309" | 14 px, mono, dimmed |
| Center, below avatar — line 3 | Live timer, e.g. "02:18" | 14 px, mono, mid-grey |
| Top-right chip | Hosting agent (Sarah / Ava / direct user) | 14 px + small avatar |

**Inbound from unsaved number:** name field shows carrier-lookup city/state ("Tallahassee, FL · Likely spam") instead of name, same row.

### 2.9 Left panel — Client Memory

Context Aspire already knows about the caller:
- Name + number (header, links to top-center identity)
- **Service** — last service type they called about (from CRM history)
- **Urgency** — Low / Medium / High pill
- **Note** — last meaningful note Sarah/Ava captured

**Empty state** (new caller, no history): panel shows "**New caller · No history yet**" with a CTA to create a contact. RLS-scoped to tenant.

### 2.10 Right panel — AI Assist

Live during the call, all governance-aware:

- **Suggested question** — Ava listens, suggests next question (auto-updates ~every 8 s)
- **Next actions** — context-aware buttons (Schedule Inspection / Draft SMS / Send Quote / Add to Callback Queue)
- **More actions** dropdown — full action palette

All AI Assist output is **read-only proposals**. Clicking any action mints a capability token and routes through the orchestrator (Law #1, Law #5). Every action click → receipt (Law #2).

### 2.11 Ambient micro-life

- **Window glow flicker** — opacity ±5 % over 8 s loop on layer 1 (free, makes room feel inhabited)
- **Optional ambient audio** — 30 s loop (distant city / soft room tone), Pixabay free, fades in 1.5 s after card materializes, fades out on End Call. **Off by default** — user toggle in settings.

### 2.12 Transitions

**Entrance — Camera Push-In (600 ms):**
- Keypad fades out (200 ms)
- Office background fades in pre-zoomed at 1.4× scale
- Office eases to 1.0× scale over 600 ms (`cubic-bezier(0.22, 1, 0.36, 1)`)
- Card rises from 50 % below center, scales 0.5× → 1.0×, opacity 0 → 1, lagging room by 100 ms

**Exit — symmetric Push-Out (500 ms):**
- Card shrinks 1.0× → 0.5×, opacity 1 → 0, drops 50 %
- Office zooms 1.0× → 1.4×, opacity 1 → 0
- Keypad fades back in (200 ms)

Both pure CSS transforms / `keyframes`. GPU-accelerated, frame budget under 16 ms.

---

## 3 · Architecture & Components

### 3.1 File layout (Aspire-desktop repo)

```
components/
  call-room/
    CallRoom.tsx                  ← top-level: orchestrates background + card + transitions
    CallRoomBackground.tsx        ← 5-layer parallax + time tint + ambient flicker
    CallRoomCard.tsx              ← black-glass card shell + 3-column grid
    CallRoomControls.tsx          ← Mute / Hold / Keypad / Transfer / End
    CallRoomSummaryStrip.tsx      ← Need / Urgency / Next Step bottom bar
    CallerAvatar.tsx              ← 3-state avatar (photo / initials / silhouette)
    VoiceActivityRing.tsx         ← Aspire-blue amplitude ring
    ClientMemoryPanel.tsx         ← left panel
    AIAssistPanel.tsx             ← right panel
    CallRoom.demo.tsx             ← dev preview shell, mock fixtures + dev controls
    CallRoom.module.css           ← all card styles + roomLight CSS custom props
    layers/
      sky.webp
      back-wall.webp
      mid-room.webp
      floor.webp
      foreground.webp
      manifest.ts                 ← layer metadata (parallax range, z-index, opacity)
    assets/
      avatars/
        default-male.png          ← source (5.1 MB) — build step compresses
        default-female.png        ← source (4.8 MB) — build step compresses
        default-male.webp         ← shipped (~80 KB) — generated at build time
        default-female.webp       ← shipped (~80 KB) — generated at build time
    hooks/
      useParallax.ts              ← cursor → per-layer transforms
      useTimeOfDay.ts             ← geolocation + suncalc → tint state + roomLight
      useCardTilt.ts              ← cursor → card rotateX/Y + roomLight shifts
      useVoiceActivity.ts         ← WebRTC → amplitude → ring driver
      useRoomLight.ts             ← computes/exposes roomLight CSS custom props
    transitions/
      enterRoom.ts                ← 600 ms push-in keyframes + state machine
      exitRoom.ts                 ← 500 ms push-out keyframes + state machine
    fixtures/
      callRoomFixtures.ts         ← mock callers (photo / no photo / unknown / spam / VIP)
app/
  _dev/
    call-room.tsx                 ← admin-gated dev preview route (Storybook-style)
  session/
    calls.tsx                     ← UPDATED: replaces active-call render block with <CallRoom />
```

### 3.2 Component boundaries

Each component has one job:
- **`CallRoomBackground`** knows the office, time, parallax. Doesn't know about calls.
- **`CallRoomCard`** knows the call data. Doesn't know about backgrounds.
- **`CallRoom`** composes both + handles enter/exit transitions. Single source of truth for "am I visible?".
- **`CallRoom.demo.tsx`** is the same `CallRoom` wrapped with mock fixtures + dev controls. Production code path is identical.

### 3.3 Integration points (existing code)

- **`app/session/calls.tsx`** line ~690 — replace active-call render block with `<CallRoom callState={...} clientContext={...} dev={false} />`
- **`callingStyles`** (line ~1450) — delete; styles move into `CallRoom.module.css` colocated
- **`useFrontdeskCalls`** hook stays unchanged — feeds props in
- **`IncomingCallOverlay.tsx`** stays separate (different surface, before-call UX). May share the `CallerAvatar` and `VoiceActivityRing` components later.

### 3.3a Schema changes (backend-side, required for avatar mode)

A new field is needed on the contact record:

| Field | Type | Default | Notes |
|---|---|---|---|
| `avatar_mode` | enum: `photo` \| `initials` \| `default_male` \| `default_female` | `default_male` (per-tenant configurable) | Drives `<CallerAvatar>` render |
| `avatar_photo_url` | text \| null | null | Only populated if `avatar_mode = photo` |

**Migration:** add columns to existing `contacts` table (or equivalent — verify table name during implementation). RLS policies extend to cover the new fields. Existing contacts default to `default_male`. Per-tenant default avatar gender stored in `tenant_settings.default_avatar_mode`.

**Avatar picker UI:** added to the existing contact form (where users edit name/phone). Renders 4 buttons: `[📷 Upload Photo] [Aa Initials] [👨 Male] [👩 Female]`. Selecting Photo opens file picker → upload → S3 → set `avatar_mode = photo`.

### 3.4 Dev preview entrance (two layers)

**A · `/_dev/call-room` route** (Storybook-style):
- Admin-only (gated by existing `tonioswayz32@gmail.com` admin check)
- Mock fixtures dropdown: 5 caller scenarios (photo / no photo / unknown / inbound spam / VIP)
- **Dev controls panel** (toggle with `?dev=1` query param):
  - Force time-of-day (dawn / day / dusk / night)
  - Force weather state (V2)
  - Toggle ambient audio
  - Force voice activity simulation (caller talking / host talking / silence)
  - Force on-hold / transfer state
  - Adjust parallax intensity (0×–2×) for tuning

**B · Shift+click on dial pad green call button:**
- Hold `Shift` while clicking → enter Call Room in **demo mode** with Marcus Johnson fixture
- Visible only when admin user is logged in (Law #6)
- ~10 lines of code in `app/session/calls.tsx`

### 3.5 Dependencies

**New:**
- `suncalc` (~3 KB) — sun position from lat/lon

**Reused:** existing motion library (verify `framer-motion` or react-native-reanimated equivalent), existing `useFrontdeskCalls`, existing tenant-scoped query hooks.

**No other new packages.**

---

## 4 · Performance & Governance

### 4.1 Performance budget

- 5 WebP layers @ ~150 KB each = **~750 KB total** office asset (lazy-loaded only when a call starts)
- Parallax = pure CSS transforms, GPU layer-promoted, target **<1 % CPU** on a Chromebook
- Tint overlay = single fixed gradient div, ~0 % cost
- Card tilt = throttled to 60 Hz via `requestAnimationFrame`
- Voice activity analyzer = ~0.5 % CPU
- **Total memory footprint: ~3 MB** (vs. 30–60 MB for real 3D — see decision in §6)

### 4.2 Aspire Laws compliance

- **Law #1 (Single Brain):** Call Room is presentation-only. All call actions (`initiate_call`, `mute`, `hold`, `transfer`, `end_call`) flow through orchestrator → tools → receipts. AI Assist suggestions are proposals only.
- **Law #2 (Receipts):** Every action button click mints a capability token, routes through orchestrator, generates a receipt. No silent state changes from the Call Room itself.
- **Law #5 (Capability Tokens):** AI Assist action buttons mint short-lived scoped tokens. No tool call without a token.
- **Law #6 (Tenant Isolation):** Office assets are static, tenant-agnostic. Card content (client name, photo, memory) flows through existing tenant-scoped hooks — RLS unchanged. Dev preview admin-gated.
- **Law #9 (Privacy):** Geolocation is opt-in via browser permission. Lat/lon never leaves the client; only converted locally to sun position. Falls back to system time silently if denied. No PII in office assets, telemetry, or logs.
- **Law #10 (Production Gates):** Receipt coverage unchanged (presentation layer only). Feature flag `call_room_v1` for gated rollout. RLS isolation tests stay green.

### 4.3 Accessibility

- All controls keyboard-reachable (Tab order: Mute → Hold → Keypad → Transfer → End Call)
- Voice activity ring is *decorative* — actual speaking-state announced via `aria-live="polite"` on a hidden region
- Time-of-day tint never reduces card contrast below WCAG AA (audited per state)
- Reduced-motion preference (`prefers-reduced-motion: reduce`) disables parallax, card tilt, push-in transition (replaces with hard fade), keeps content fully functional
- Screen reader: card has `role="dialog"`, `aria-label="Active call with {Name}"`

---

## 5 · Build Plan & Milestones

| # | Milestone | Scope | Estimate |
|---|---|---|---|
| **M0** | **Dev preview shell** | `CallRoom.demo.tsx` + `/_dev/call-room` route + 5 fixtures + dev controls panel. Empty `CallRoom` shell. | 0.5 day |
| **M1** | **Static room** | One static background image (no parallax yet), black-glass card with 3-column layout, mockup-pixel-match. Behind feature flag `call_room_v1`. | 1 day |
| **M2** | **Parallax + card depth** | 5-layer slice, cursor-driven parallax, card tilt, shared `roomLight` lighting system | 1.5 days |
| **M3** | **Transitions** | Push-in entrance + push-out exit + Shift+click shortcut | 0.5 day |
| **M4** | **Time-of-day** | Geolocation + suncalc + 4-state tint + roomLight color binding | 1 day |
| **M5** | **Voice activity + avatar states** | `CallerAvatar` (4 states: photo / initials / default-male / default-female) + per-contact `avatar_mode` field + avatar picker UI in contact form + WebP compression of default PNGs (`sharp` build script) + `VoiceActivityRing` (amplitude-driven, color states) + reciprocal host-chip ring | 1 day |
| **M6** | **Premium hooks + ambient polish** | Feature flag scaffolding for premium tier (no premium UI), window glow flicker, optional ambient audio toggle, edge-case states (incoming, on-hold, transfer in progress), reduced-motion support | 0.5 day |
| **M7** | **QA + flag rollout** | Tests (unit + integration + RLS + evil), accessibility audit, internal dogfood, gradual flag rollout | 1 day |
| | **Total V1** | | **~7 working days** |

### 5.1 Fast-follows (separate spec, not V1)

- **Weather overlay** — rain on glass / snow / fog / clouds, driven by Open-Meteo (free, no key). +1 week.
- **Multiple room themes (Pro tier)** — coastal sunset / Manhattan night / mountain cabin / minimalist white. +3 days per theme.
- **Branded glow ring (Pro tier)** — user's brand color in card outer glow. +0.5 day.
- **Expanded 3D avatar library** — 8–12 default characters (varied ethnicity, age, style) replacing today's 2 (male/female). +2 days curation/generation.
- **Real 3D migration path** — `<RoomScene>` interface lets renderer be swapped from parallax to Three.js without touching card code. Only pursued if Aspire commits to "virtual office" as core product metaphor.

### 5.2 Premium tier scaffolding (built in V1, no UI)

Feature flags created and gated, no premium UI built:

| Feature flag | What it gates (when lit) |
|---|---|
| `call_room.theme.picker` | Multiple room themes |
| `call_room.weather.enabled` | Weather overlay |
| `call_room.ambient_audio.library` | Multi-loop ambient library |
| `call_room.brand_glow.enabled` | Branded glow ring |
| `call_room.tod.manual_override` | Force time-of-day override |

Standard tier ships with: warm-executive room, automatic time-of-day, single optional ambient loop, default Aspire-blue glow.

---

## 6 · Decisions log (the "why")

| Decision | Chosen | Why | Alternatives considered |
|---|---|---|---|
| Aesthetic | Warm Executive | Matches user mockup; warmest "founder's office" mood | Skyline Daylight, Concrete Loft Golden Hour |
| Scope | Active call only | Dial pad / lists are operational, not relational. Room frames the *moment of presence* with a human. | Entire calls page, Active call + dial pad |
| Tech approach | Layered parallax 2.5D | 90 % of immersion for 10 % of cost vs. real 3D. Bulletproof across hardware. Doesn't paint into a corner — `<RoomScene>` interface keeps Three.js migration open. | Static photo, real 3D (Three.js) |
| Rooms | One universal room | "Active call only" already constrained — sprawl into per-agent rooms is V2/V3 territory | Per-agent rooms, user-room-with-guest-agents |
| Entrance | Camera Push-In | Cinematic, walking-in feel, GPU-cheap | Iris/door open, card flip |
| Exit | Symmetric push-out | Symmetry sells premium. Mirrors entrance. | Hard fade |
| Card material | Premium thick 3D black glass + shared `roomLight` | Anchors the foreground, sells the 3D illusion of the background. Shared lighting closes the illusion. | Flat glassmorphism (mockup) — too "pasted on" |
| Time-of-day | Yes, V1 | Cheap (~1 day), high emotional impact, geolocation-aware | Defer to V2 |
| Weather | V2 fast-follow | Validates demand before building +1 week of work | Ship in V1 |
| Avatar default | 3D-illustrated (Pixar-style), male + female options | Aspire signature visual identity. User picks per-contact: photo / initials / 3D male / 3D female. | All-photo (cold), all-initials (corporate), single default (lacks diversity) |

---

## 7 · Open questions / risks

- **Asset production:** the 5 PNG layers depend on either (a) Midjourney/Flux render then Photoshop slicing, or (b) commissioning a 3D artist for a Blender scene we render once. **Recommendation:** start with (a), budget half a day for asset prep. If quality insufficient, pivot to commissioned render (~$150–400, 3-day turnaround).
- **Native Expo (iOS/Android) future:** parallax via CSS transforms is web-only. If the desktop app expands to native, parallax falls back to static image on native. Acceptable per scope.
- **Geolocation UX friction:** browser permission prompt is jarring. **Mitigation:** prompt on first call only, persist consent. Silent fallback to system time if denied.
- **Voice activity accuracy:** WebRTC stream RMS is reliable but consumer-grade. Spurious pulses possible from background noise. Threshold tuning needed during M5.
- **Reduced-motion users:** must remain functional and not feel "broken." Accessibility audit in M7 is a hard gate, not a soft one.
- **Contact table name unverified.** §3.3a assumes a `contacts` table for the new `avatar_mode` field. Verify exact table name + RLS policies during M5 implementation. Likely candidates: `contacts`, `clients`, `crm_contacts`. Resolve before migration is written.
- **Default avatar diversity (V1 limitation).** Shipping with only 2 default characters (one male / one female, both light-skinned, similar age range). This is a known limitation, not a recommendation. Expanded library is the first V2 fast-follow once V1 lands. Document this in product release notes so it doesn't read as the final state.

---

## 8 · Acceptance criteria

V1 ships when:

- [ ] M0–M7 complete, all milestones merged behind `call_room_v1` flag
- [ ] Pixel-match against user mockup approved by founder
- [ ] Parallax + card tilt verified at 60 fps on Chromebook (lowest-tier target)
- [ ] Time-of-day tint cycles correctly across all 4 states (verified via `?dev=1` controls)
- [ ] Voice activity ring responds to real WebRTC audio in dogfood test
- [ ] All 4 caller avatar states render correctly (photo / initials / default-male / default-female) across 5 fixtures
- [ ] Avatar picker in contact form lets user switch modes; default-male/female PNGs ship as compressed WebP <100 KB each
- [ ] Contact migration adds `avatar_mode` + `avatar_photo_url` fields with RLS coverage; existing contacts default to `default_male`
- [ ] All control actions (Mute / Hold / Keypad / Transfer / End Call) generate receipts (Law #2)
- [ ] RLS isolation tests pass (no cross-tenant data in card or fixtures)
- [ ] Evil tests pass (admin gate on `/_dev/call-room`, geolocation denial path, no PII in telemetry)
- [ ] Accessibility audit passes WCAG AA (contrast across all 4 time-of-day states, keyboard nav, reduced-motion, screen reader)
- [ ] 24 h soak test on staging
- [ ] Founder approves visual quality vs. mockup before flag flipped to 100 %

---

## 9 · Next step

After founder reviews and approves this spec → invoke `superpowers:writing-plans` skill to produce the detailed implementation plan (per-file diffs, test outlines, PR-by-PR sequencing).
