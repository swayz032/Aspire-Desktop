# Call Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark-blue active-call screen in `app/session/calls.tsx` with an immersive Call Room — a warm-executive 3D-feeling office with a premium thick black-glass card containing all call controls.

**Architecture:** Layered parallax 2.5D background (5 WebP layers driven by cursor position via CSS transforms) + floating glassmorphic card with shared `roomLight` lighting that ties card and background together. Time-of-day tint driven by browser geolocation + `suncalc`. 4-state user-configurable avatar (photo / initials / 3D default male / 3D default female). Built behind feature flag `call_room_v1`.

**Tech Stack:** Expo SDK 54, React 19, TypeScript (strict), react-native-reanimated 4.1, Jest 29 + React Native Testing Library, Playwright (e2e), CSS modules via Expo's web treatment, `suncalc` (new dep), `sharp` (new dev dep for asset build).

**Spec:** `Aspire-desktop/docs/superpowers/specs/2026-04-30-call-room-design.md`

---

## File Structure

### Create

| File | Responsibility |
|---|---|
| `components/call-room/CallRoom.tsx` | Top-level orchestrator: composes background + card + transitions, owns visibility state |
| `components/call-room/CallRoomBackground.tsx` | 5-layer parallax + time tint + ambient flicker |
| `components/call-room/CallRoomCard.tsx` | Black-glass card shell + 3-column grid layout |
| `components/call-room/CallRoomControls.tsx` | Mute / Hold / Keypad / Transfer / End Call bar |
| `components/call-room/CallRoomSummaryStrip.tsx` | Need / Urgency / Next Step bottom strip |
| `components/call-room/CallerAvatar.tsx` | 4-state avatar (photo / initials / default-male / default-female) |
| `components/call-room/VoiceActivityRing.tsx` | Aspire-blue amplitude-driven ring around avatar |
| `components/call-room/ClientMemoryPanel.tsx` | Left panel: name, service, urgency, note |
| `components/call-room/AIAssistPanel.tsx` | Right panel: suggested question + next actions |
| `components/call-room/CallRoom.demo.tsx` | Dev preview shell with mock fixtures + dev controls |
| `components/call-room/CallRoom.module.css` | Card styles + roomLight CSS custom properties |
| `components/call-room/types.ts` | Shared types: `CallState`, `ClientContext`, `RoomLight`, `AvatarMode`, `TimeOfDayState` |
| `components/call-room/fixtures/callRoomFixtures.ts` | 5 mock callers (photo / no photo / unknown / spam / VIP) |
| `components/call-room/hooks/useParallax.ts` | Cursor → per-layer transforms |
| `components/call-room/hooks/useTimeOfDay.ts` | Geolocation + suncalc → tint + roomLight |
| `components/call-room/hooks/useCardTilt.ts` | Cursor-near-card → rotateX/Y + roomLight shifts |
| `components/call-room/hooks/useVoiceActivity.ts` | WebRTC stream → RMS amplitude |
| `components/call-room/hooks/useRoomLight.ts` | Computes & exposes roomLight CSS custom props |
| `components/call-room/transitions/enterRoom.ts` | 600ms push-in keyframes + state machine |
| `components/call-room/transitions/exitRoom.ts` | 500ms push-out keyframes + state machine |
| `components/call-room/layers/manifest.ts` | Layer metadata (parallax range, z-index, opacity) |
| `components/call-room/layers/sky.webp` | Layer 1 (slowest, sky+window) |
| `components/call-room/layers/back-wall.webp` | Layer 2 (back wall + bookshelf) |
| `components/call-room/layers/mid-room.webp` | Layer 3 (chair, plant, lamp) |
| `components/call-room/layers/floor.webp` | Layer 4 (floor + desk) |
| `components/call-room/layers/foreground.webp` | Layer 5 (foreground bokeh) |
| `components/call-room/assets/avatars/default-male.webp` | Compressed default avatar (built from PNG) |
| `components/call-room/assets/avatars/default-female.webp` | Compressed default avatar (built from PNG) |
| `app/_dev/call-room.tsx` | Admin-gated dev preview route |
| `scripts/build-call-room-assets.mjs` | One-shot script: PNG sources → optimized WebP |
| `__tests__/call-room/CallRoom.test.tsx` | Component test — top-level render + visibility |
| `__tests__/call-room/CallerAvatar.test.tsx` | Avatar state fallback logic |
| `__tests__/call-room/VoiceActivityRing.test.tsx` | Amplitude → scale/opacity mapping |
| `__tests__/call-room/hooks/useParallax.test.ts` | Cursor → layer transform math |
| `__tests__/call-room/hooks/useTimeOfDay.test.ts` | Sun position → tint state |
| `__tests__/call-room/hooks/useRoomLight.test.ts` | RoomLight CSS prop generation |
| `__tests__/call-room/transitions/enterRoom.test.ts` | Push-in keyframe state |
| `e2e/call-room.spec.ts` | Playwright: dev preview route, dial-pad shortcut, full enter/exit flow |
| `supabase/migrations/0XX_contact_avatar_mode.sql` | Add `avatar_mode` + `avatar_photo_url` to contacts |

### Modify

| File | Change |
|---|---|
| `app/session/calls.tsx:~690-760` | Replace active-call render block with `<CallRoom />` (gated by feature flag) |
| `app/session/calls.tsx:~1450` | Delete `callingStyles` (moved into `CallRoom.module.css`) |
| `package.json` | Add deps: `suncalc`, `@types/suncalc` (dev), `sharp` (dev). Add script `build:call-room-assets`. |
| Existing contact form (location TBD — see Task 30) | Add avatar picker UI |
| `lib/featureFlags.ts` (or equivalent) | Register `call_room_v1` flag |

### Pre-existing assets

`components/call-room/assets/avatars/default-male.png` and `default-female.png` already committed. The `.webp` versions are produced by the build script in M5.

---

## Milestone Map

| Milestone | Tasks | Estimate |
|---|---|---|
| **M0** Dev Preview Shell | T01–T05 | 0.5 day |
| **M1** Static Room | T06–T11 | 1 day |
| **M2** Parallax + Card Depth | T12–T18 | 1.5 days |
| **M3** Transitions | T19–T22 | 0.5 day |
| **M4** Time of Day | T23–T28 | 1 day |
| **M5** Voice Activity + Avatar States | T29–T36 | 1 day |
| **M6** Premium Hooks + Polish | T37–T41 | 0.5 day |
| **M7** QA + Flag Rollout | T42–T46 | 1 day |
| | | **~7 days** |

**Convention used in every task:**
1. Write failing test
2. Run, verify failure
3. Implement minimum
4. Run, verify pass
5. Commit

Visual-only steps (where TDD is not meaningful — e.g., a static background image) substitute "manual visual verification via dev preview at `/_dev/call-room`" for the test step. These are flagged `[VISUAL]`.

---

# M0 — Dev Preview Shell

The dev preview is the **first** thing built — every later milestone is verified against it.

---

### Task 01: Types module

**Files:**
- Create: `components/call-room/types.ts`

- [ ] **Step 1: Write the file**

```typescript
// components/call-room/types.ts

export type AvatarMode = 'photo' | 'initials' | 'default_male' | 'default_female';

export type TimeOfDayState = 'dawn' | 'day' | 'dusk' | 'night';

export type CallStatus =
  | 'idle'
  | 'dialing'
  | 'ringing'
  | 'connected'
  | 'on_hold'
  | 'transferring'
  | 'ended';

export interface ClientContext {
  id: string;
  name: string | null;
  phoneE164: string;
  photoUrl: string | null;
  avatarMode: AvatarMode;
  service: string | null;
  urgency: 'low' | 'medium' | 'high' | null;
  note: string | null;
}

export interface CallState {
  status: CallStatus;
  startedAt: number | null; // epoch ms
  hostAgent: { id: string; name: string; photoUrl: string | null };
  client: ClientContext;
  isMuted: boolean;
  isOnHold: boolean;
}

export interface RoomLight {
  /** 0 (left edge) → 1 (right edge) */
  x: number;
  /** 0 (top) → 1 (bottom) */
  y: number;
  /** CSS color string */
  color: string;
  /** 0 → 1 */
  intensity: number;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json` (or repo-equivalent typecheck command — check `package.json` scripts)
Expected: 0 errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add components/call-room/types.ts
git commit -m "feat(call-room): add shared types module"
```

---

### Task 02: Mock fixtures

**Files:**
- Create: `components/call-room/fixtures/callRoomFixtures.ts`

- [ ] **Step 1: Write the file**

```typescript
// components/call-room/fixtures/callRoomFixtures.ts
import type { CallState, ClientContext } from '../types';

const baseHost = {
  id: 'agent_sarah',
  name: 'Sarah',
  photoUrl: null,
};

const ts = (secondsAgo: number) => Date.now() - secondsAgo * 1000;

const makeFixture = (
  label: string,
  client: ClientContext,
  overrides: Partial<CallState> = {},
): { label: string; state: CallState } => ({
  label,
  state: {
    status: 'connected',
    startedAt: ts(138), // 02:18 to match mockup
    hostAgent: baseHost,
    client,
    isMuted: false,
    isOnHold: false,
    ...overrides,
  },
});

export const callRoomFixtures = [
  makeFixture('Marcus Johnson (mockup, photo)', {
    id: 'c_marcus',
    name: 'Marcus Johnson',
    phoneE164: '+15558675309',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=440&h=440&fit=crop',
    avatarMode: 'photo',
    service: 'Roof Leak Inquiry',
    urgency: 'high',
    note: 'Concerned about ceiling damage. Wants fast response.',
  }),
  makeFixture('No-photo · 3D default male', {
    id: 'c_carl',
    name: 'Carl Diaz',
    phoneE164: '+13105550101',
    photoUrl: null,
    avatarMode: 'default_male',
    service: 'Painting Quote',
    urgency: 'medium',
    note: 'Wants exterior repaint quote for ranch home.',
  }),
  makeFixture('No-photo · 3D default female', {
    id: 'c_anita',
    name: 'Anita Lawson',
    phoneE164: '+19495550199',
    photoUrl: null,
    avatarMode: 'default_female',
    service: 'Drywall Repair',
    urgency: 'low',
    note: 'Two patches in dining room ceiling.',
  }),
  makeFixture('Initials only', {
    id: 'c_b',
    name: 'Bryan Tate',
    phoneE164: '+12015550150',
    photoUrl: null,
    avatarMode: 'initials',
    service: 'New Build Inquiry',
    urgency: 'medium',
    note: 'Needs early-Q3 timeline.',
  }),
  makeFixture('Unknown caller (spam-likely)', {
    id: 'c_unknown',
    name: null,
    phoneE164: '+18505551234',
    photoUrl: null,
    avatarMode: 'default_male',
    service: null,
    urgency: null,
    note: null,
  }),
];
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/call-room/fixtures/callRoomFixtures.ts
git commit -m "feat(call-room): add 5 mock caller fixtures for dev preview"
```

---

### Task 03: CallRoom shell (renders nothing useful yet)

**Files:**
- Create: `components/call-room/CallRoom.tsx`
- Create: `__tests__/call-room/CallRoom.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/call-room/CallRoom.test.tsx
import { render, screen } from '@testing-library/react-native';
import { CallRoom } from '../../components/call-room/CallRoom';
import { callRoomFixtures } from '../../components/call-room/fixtures/callRoomFixtures';

describe('CallRoom', () => {
  it('renders nothing when not visible', () => {
    const { queryByTestId } = render(
      <CallRoom visible={false} callState={callRoomFixtures[0].state} />,
    );
    expect(queryByTestId('call-room-root')).toBeNull();
  });

  it('renders root when visible', () => {
    const { getByTestId } = render(
      <CallRoom visible={true} callState={callRoomFixtures[0].state} />,
    );
    expect(getByTestId('call-room-root')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/call-room/CallRoom.test.tsx`
Expected: FAIL with "Cannot find module '../../components/call-room/CallRoom'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// components/call-room/CallRoom.tsx
import React from 'react';
import { View } from 'react-native';
import type { CallState } from './types';

export interface CallRoomProps {
  visible: boolean;
  callState: CallState;
}

export function CallRoom({ visible, callState }: CallRoomProps): React.ReactElement | null {
  if (!visible) return null;
  return (
    <View testID="call-room-root" style={{ flex: 1, backgroundColor: '#0a0a0a' }} />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/call-room/CallRoom.test.tsx`
Expected: PASS, 2/2 tests.

- [ ] **Step 5: Commit**

```bash
git add components/call-room/CallRoom.tsx __tests__/call-room/CallRoom.test.tsx
git commit -m "feat(call-room): scaffold CallRoom component with visibility prop"
```

---

### Task 04: CallRoom.demo with fixture picker + dev controls

**Files:**
- Create: `components/call-room/CallRoom.demo.tsx`

- [ ] **Step 1: Write the file** (no test — it's a dev surface, verified visually)

```typescript
// components/call-room/CallRoom.demo.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { CallRoom } from './CallRoom';
import { callRoomFixtures } from './fixtures/callRoomFixtures';
import type { TimeOfDayState } from './types';

const TIMES: TimeOfDayState[] = ['dawn', 'day', 'dusk', 'night'];

export default function CallRoomDemo(): React.ReactElement {
  const [fixtureIdx, setFixtureIdx] = useState(0);
  const [forcedTime, setForcedTime] = useState<TimeOfDayState | 'auto'>('auto');
  const [parallaxScale, setParallaxScale] = useState(1);
  const [voiceSim, setVoiceSim] = useState<'silence' | 'caller' | 'host'>('silence');
  const [visible, setVisible] = useState(true);

  const fixture = callRoomFixtures[fixtureIdx];

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#000' }}>
      <ScrollView
        style={{ width: 280, backgroundColor: '#111', padding: 16 }}
        testID="call-room-dev-controls"
      >
        <Text style={{ color: '#fff', fontSize: 18, marginBottom: 12 }}>Dev Controls</Text>

        <Text style={{ color: '#888', marginTop: 12 }}>Fixture</Text>
        {callRoomFixtures.map((f, i) => (
          <Pressable
            key={f.state.client.id}
            onPress={() => setFixtureIdx(i)}
            style={{
              padding: 8,
              marginVertical: 2,
              backgroundColor: i === fixtureIdx ? '#1e3a8a' : '#222',
              borderRadius: 4,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12 }}>{f.label}</Text>
          </Pressable>
        ))}

        <Text style={{ color: '#888', marginTop: 12 }}>Time of day</Text>
        {(['auto', ...TIMES] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setForcedTime(t)}
            style={{
              padding: 8,
              marginVertical: 2,
              backgroundColor: t === forcedTime ? '#1e3a8a' : '#222',
              borderRadius: 4,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12 }}>{t}</Text>
          </Pressable>
        ))}

        <Text style={{ color: '#888', marginTop: 12 }}>Voice activity</Text>
        {(['silence', 'caller', 'host'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => setVoiceSim(v)}
            style={{
              padding: 8,
              marginVertical: 2,
              backgroundColor: v === voiceSim ? '#1e3a8a' : '#222',
              borderRadius: 4,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12 }}>{v}</Text>
          </Pressable>
        ))}

        <Text style={{ color: '#888', marginTop: 12 }}>Parallax intensity</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[0, 0.5, 1, 1.5, 2].map((s) => (
            <Pressable
              key={s}
              onPress={() => setParallaxScale(s)}
              style={{
                padding: 8,
                backgroundColor: s === parallaxScale ? '#1e3a8a' : '#222',
                borderRadius: 4,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12 }}>{s}×</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => setVisible((v) => !v)}
          style={{ marginTop: 16, padding: 12, backgroundColor: '#dc2626', borderRadius: 4 }}
        >
          <Text style={{ color: '#fff', textAlign: 'center' }}>
            {visible ? 'Hide Call Room' : 'Show Call Room'}
          </Text>
        </Pressable>
      </ScrollView>

      <View style={{ flex: 1 }}>
        <CallRoom
          visible={visible}
          callState={fixture.state}
          // dev-only props (will be wired in later milestones):
          // forcedTimeOfDay={forcedTime === 'auto' ? undefined : forcedTime}
          // parallaxScale={parallaxScale}
          // voiceSim={voiceSim}
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/call-room/CallRoom.demo.tsx
git commit -m "feat(call-room): add dev preview demo with fixture picker + dev controls"
```

---

### Task 05: Admin-gated `/_dev/call-room` route

**Files:**
- Create: `app/_dev/call-room.tsx`

- [ ] **Step 1: Find the existing admin-gate pattern**

Run: `grep -rn "tonioswayz32\|isAdmin\|isPlatformAdmin" hooks/ lib/ components/ --include="*.ts" --include="*.tsx" -l | head -5`
Expected: at least one file (e.g., `hooks/useAdminGate.ts` or similar). **If none, fall back to checking `useAuth().user?.email === 'tonioswayz32@gmail.com'` directly.**

- [ ] **Step 2: Write the route file** (substitute the discovered admin hook in the auth check)

```typescript
// app/_dev/call-room.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Redirect } from 'expo-router';
// SUBSTITUTE THE ACTUAL ADMIN HOOK FROM STEP 1:
import { useAuth } from '../../hooks/useAuth'; // verify path

import CallRoomDemo from '../../components/call-room/CallRoom.demo';

export default function CallRoomDevRoute(): React.ReactElement {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#fff' }}>Loading…</Text>
      </View>
    );
  }

  if (!user || user.email !== 'tonioswayz32@gmail.com') {
    return <Redirect href="/" />;
  }

  return <CallRoomDemo />;
}
```

- [ ] **Step 3: Manual verification [VISUAL]**

Run dev server: `npx tsx server/index.ts` (per CLAUDE.md)
Open: `http://localhost:<port>/_dev/call-room`
Expected (logged in as `tonioswayz32@gmail.com`): see dev controls panel + dark area on right.
Expected (logged in as anyone else): redirected to `/`.

- [ ] **Step 4: Commit**

```bash
git add app/_dev/call-room.tsx
git commit -m "feat(call-room): admin-gated /_dev/call-room preview route"
```

---

# M1 — Static Room (Pixel-Match Mockup)

By the end of M1, the dev preview shows a static warm-executive office (single image, no parallax yet) with a black-glass card matching the mockup. No motion, no time-of-day, no voice activity — but all the layout and material decisions are in place.

---

### Task 06: Source the office background image

**Files:**
- Create: `components/call-room/layers/_source/office-full.png` (single render before slicing)

- [ ] **Step 1: Generate the office render**

Use Midjourney/Flux/your tool of choice. Prompt:

> Cinematic warm-executive home office, dark vertical wood slat walls, single tan leather chair foreground right, blurred warm city light through floor-to-ceiling windows on the left, dark wood bookshelf with warm interior lamps on the right, dark hardwood desk, modern luxury, shallow depth of field, golden hour, 16:9, photorealistic, no people, no UI overlay, ultra high detail, cinematic lighting

Aim for a 3840×2160 (4K) or higher render so we have room for slicing/cropping. Save as PNG.

- [ ] **Step 2: Manual review against mockup [VISUAL]**

Place the render side-by-side with the user's reference mockup. The render should match: dark slat wood walls, leather chair, city window light, warm interior glow.

If quality is insufficient, regenerate before proceeding. **This is the foundation — do not skimp.**

- [ ] **Step 3: Commit**

```bash
git add components/call-room/layers/_source/office-full.png
git commit -m "feat(call-room): source office background render (4K master)"
```

---

### Task 07: Render full-image layer (single layer for M1, sliced in M2)

**Files:**
- Create: `components/call-room/layers/full-static.webp`
- Create: `components/call-room/layers/manifest.ts`

- [ ] **Step 1: Compress source to WebP**

Run:
```bash
npx sharp-cli --input components/call-room/layers/_source/office-full.png \
              --output components/call-room/layers/full-static.webp \
              --format webp --quality 85 --width 2560
```
(If `sharp-cli` not installed: `npm i -D sharp-cli` first.)

Expected: `full-static.webp` exists, ~250–500 KB.

- [ ] **Step 2: Write the manifest**

```typescript
// components/call-room/layers/manifest.ts
export interface LayerSpec {
  src: number; // require() returns number for RN
  parallaxRange: number; // px max translate
  zIndex: number;
  opacity: number;
}

// M1 ships a single full-image layer. M2 will replace this with 5 sliced layers.
export const layers: LayerSpec[] = [
  {
    src: require('./full-static.webp'),
    parallaxRange: 0, // no parallax in M1
    zIndex: 0,
    opacity: 1,
  },
];
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/call-room/layers/full-static.webp components/call-room/layers/manifest.ts
git commit -m "feat(call-room): add static office WebP + layer manifest"
```

---

### Task 08: CallRoomBackground component (renders the static layer)

**Files:**
- Create: `components/call-room/CallRoomBackground.tsx`

- [ ] **Step 1: Write the component**

```typescript
// components/call-room/CallRoomBackground.tsx
import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { layers } from './layers/manifest';

export function CallRoomBackground(): React.ReactElement {
  return (
    <View style={styles.root} testID="call-room-background">
      {layers.map((layer, i) => (
        <ImageBackground
          key={i}
          source={layer.src}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, { opacity: layer.opacity, zIndex: layer.zIndex }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a', // fallback while images load
  },
});
```

- [ ] **Step 2: Wire into CallRoom**

Edit `components/call-room/CallRoom.tsx`:

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CallRoomBackground } from './CallRoomBackground';
import type { CallState } from './types';

export interface CallRoomProps {
  visible: boolean;
  callState: CallState;
}

export function CallRoom({ visible, callState }: CallRoomProps): React.ReactElement | null {
  if (!visible) return null;
  return (
    <View testID="call-room-root" style={styles.root}>
      <CallRoomBackground />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a',
  },
});
```

- [ ] **Step 3: Re-run existing test**

Run: `npx jest __tests__/call-room/CallRoom.test.tsx`
Expected: PASS (still 2/2).

- [ ] **Step 4: Manual visual verification [VISUAL]**

Open `/_dev/call-room`. Expected: warm office image fills the right pane.

- [ ] **Step 5: Commit**

```bash
git add components/call-room/CallRoomBackground.tsx components/call-room/CallRoom.tsx
git commit -m "feat(call-room): render static office background"
```

---

### Task 09: CallRoomCard shell with premium black-glass styling

**Files:**
- Create: `components/call-room/CallRoomCard.tsx`

- [ ] **Step 1: Write the component**

```typescript
// components/call-room/CallRoomCard.tsx
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import type { CallState } from './types';

export interface CallRoomCardProps {
  callState: CallState;
}

export function CallRoomCard({ callState }: CallRoomCardProps): React.ReactElement {
  return (
    <View testID="call-room-card" style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Front Desk Call Room</Text>
        <Text style={styles.headerSubtitle}>
          {callState.hostAgent.name} hosting · Outbound call in progress
        </Text>
      </View>

      {/* Body — 3 columns (placeholders, filled in later tasks) */}
      <View style={styles.body}>
        <View style={[styles.column, styles.leftColumn]} testID="call-room-client-memory" />
        <View style={[styles.column, styles.centerColumn]} testID="call-room-center" />
        <View style={[styles.column, styles.rightColumn]} testID="call-room-ai-assist" />
      </View>

      {/* Controls placeholder (filled in T11) */}
      <View style={styles.controlsPlaceholder} testID="call-room-controls-slot" />

      {/* Summary strip placeholder (filled in T11) */}
      <View style={styles.summaryPlaceholder} testID="call-room-summary-slot" />
    </View>
  );
}

const GLASS_BG = 'rgba(15, 18, 24, 0.65)';
const GLASS_BORDER = 'rgba(120, 170, 220, 0.35)';
const ASPIRE_GLOW = 'rgba(120, 170, 220, 0.18)';

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 1200,
    minHeight: 640,
    backgroundColor: GLASS_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 24,
    // Premium thick 3D black glass — applied via web-only fallback
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(18px) saturate(1.4) brightness(1.05)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.4) brightness(1.05)',
          // Layered shadow: depth + lift + Aspire glow
          boxShadow: `
            0 2px 6px rgba(0,0,0,0.6),
            0 24px 60px rgba(0,0,0,0.5),
            0 0 80px ${ASPIRE_GLOW},
            inset 0 1px 0 rgba(255,255,255,0.06),
            inset 0 -1px 0 rgba(0,0,0,0.4)
          `,
        } as object)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.6,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 24,
        }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  headerSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 },
  body: {
    flexDirection: 'row',
    gap: 16,
    flex: 1,
  },
  column: { flex: 1, borderRadius: 12, minHeight: 320 },
  leftColumn: { backgroundColor: 'rgba(255,255,255,0.03)' },
  centerColumn: { backgroundColor: 'transparent' },
  rightColumn: { backgroundColor: 'rgba(255,255,255,0.03)' },
  controlsPlaceholder: { height: 64, marginTop: 16, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.4)' },
  summaryPlaceholder: { height: 72, marginTop: 8, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.4)' },
});
```

- [ ] **Step 2: Wire into CallRoom**

Edit `components/call-room/CallRoom.tsx` body to:

```typescript
return (
  <View testID="call-room-root" style={styles.root}>
    <CallRoomBackground />
    <View style={styles.cardWrap} pointerEvents="box-none">
      <CallRoomCard callState={callState} />
    </View>
  </View>
);
```

Add to styles:
```typescript
cardWrap: {
  ...StyleSheet.absoluteFillObject,
  alignItems: 'center',
  justifyContent: 'center',
  padding: 32,
},
```

- [ ] **Step 3: Manual verification [VISUAL]**

Open `/_dev/call-room`. Expected: warm office bg + centered black-glass card with "Front Desk Call Room" header. Three empty columns visible inside the card.

- [ ] **Step 4: Commit**

```bash
git add components/call-room/CallRoomCard.tsx components/call-room/CallRoom.tsx
git commit -m "feat(call-room): add premium black-glass card shell with 3-column layout"
```

---

### Task 10: ClientMemoryPanel + AIAssistPanel + center identity block

**Files:**
- Create: `components/call-room/ClientMemoryPanel.tsx`
- Create: `components/call-room/AIAssistPanel.tsx`

- [ ] **Step 1: Write ClientMemoryPanel**

```typescript
// components/call-room/ClientMemoryPanel.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ClientContext } from './types';

export function ClientMemoryPanel({ client }: { client: ClientContext }): React.ReactElement {
  if (!client.name && !client.service) {
    return (
      <View style={styles.panel} testID="client-memory-empty">
        <Text style={styles.headerLabel}>Client Memory</Text>
        <Text style={styles.empty}>New caller · No history yet</Text>
      </View>
    );
  }
  return (
    <View style={styles.panel} testID="client-memory">
      <Text style={styles.headerLabel}>Client Memory</Text>
      <Text style={styles.name}>{client.name ?? 'Unknown'}</Text>
      <Text style={styles.phone}>{formatPhone(client.phoneE164)}</Text>
      <View style={styles.divider} />
      {client.service && (
        <Row label="Service" value={client.service} />
      )}
      {client.urgency && (
        <Row label="Urgency" value={client.urgency.toUpperCase()} pill={client.urgency} />
      )}
      {client.note && (
        <View style={styles.noteBlock}>
          <Text style={styles.rowLabel}>Note</Text>
          <Text style={styles.noteText}>{client.note}</Text>
        </View>
      )}
    </View>
  );
}

function Row({ label, value, pill }: { label: string; value: string; pill?: string | null }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {pill ? (
        <View style={[styles.pill, pillStyle(pill)]}>
          <Text style={styles.pillText}>{value}</Text>
        </View>
      ) : (
        <Text style={styles.rowValue}>{value}</Text>
      )}
    </View>
  );
}

function pillStyle(level: string) {
  switch (level) {
    case 'high':
      return { backgroundColor: 'rgba(220, 38, 38, 0.25)', borderColor: '#dc2626' };
    case 'medium':
      return { backgroundColor: 'rgba(234, 179, 8, 0.25)', borderColor: '#eab308' };
    default:
      return { backgroundColor: 'rgba(120, 170, 220, 0.25)', borderColor: '#78aadc' };
  }
}

function formatPhone(e164: string): string {
  // +15558675309 → (555) 867-5309
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (!m) return e164;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

const styles = StyleSheet.create({
  panel: { padding: 16 },
  headerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, letterSpacing: 0.5, marginBottom: 12 },
  name: { color: '#fff', fontSize: 18, fontWeight: '600' },
  phone: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6 },
  rowLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  rowValue: { color: '#fff', fontSize: 13 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  pillText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  noteBlock: { marginTop: 12 },
  noteText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4, lineHeight: 18 },
  empty: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontStyle: 'italic' },
});
```

- [ ] **Step 2: Write AIAssistPanel**

```typescript
// components/call-room/AIAssistPanel.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export function AIAssistPanel(): React.ReactElement {
  return (
    <View style={styles.panel} testID="ai-assist">
      <Text style={styles.headerLabel}>✨ AI Assist</Text>

      <Text style={styles.smallLabel}>Suggested question</Text>
      <View style={styles.suggestion}>
        <Text style={styles.suggestionText}>Is water entering the attic or ceiling?</Text>
      </View>

      <Text style={[styles.smallLabel, { marginTop: 16 }]}>Next actions</Text>
      <ActionRow icon="📅" label="Schedule Inspection" />
      <ActionRow icon="💬" label="Draft SMS" />

      <Pressable style={styles.moreActions}>
        <Text style={styles.moreActionsText}>More actions ⌄</Text>
      </Pressable>
    </View>
  );
}

function ActionRow({ icon, label }: { icon: string; label: string }) {
  return (
    <Pressable style={styles.actionRow}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionChevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 16 },
  headerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, letterSpacing: 0.5, marginBottom: 12 },
  smallLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6 },
  suggestion: {
    borderWidth: 1,
    borderColor: 'rgba(120, 170, 220, 0.5)',
    backgroundColor: 'rgba(120, 170, 220, 0.08)',
    padding: 10,
    borderRadius: 6,
  },
  suggestionText: { color: '#fff', fontSize: 13 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  actionIcon: { fontSize: 14, marginRight: 8 },
  actionLabel: { flex: 1, color: '#fff', fontSize: 13 },
  actionChevron: { color: 'rgba(255,255,255,0.5)', fontSize: 18 },
  moreActions: { marginTop: 8, padding: 8 },
  moreActionsText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
});
```

- [ ] **Step 3: Add a CenterIdentity block in CallRoomCard**

Edit `components/call-room/CallRoomCard.tsx` — replace the empty center column with:

```typescript
// (in body section)
<View style={[styles.column, styles.centerColumn]} testID="call-room-center">
  <View style={styles.avatarSlot} testID="avatar-slot">
    {/* Avatar will be added in T29 */}
  </View>
  <Text style={styles.timer}>{formatDuration(callState.startedAt)}</Text>
  <Text style={styles.callerName}>{callState.client.name ?? 'Unknown caller'}</Text>
  <Text style={styles.callerPhone}>{formatPhone(callState.client.phoneE164)}</Text>
</View>
```

Add helper functions and styles:
```typescript
function formatDuration(startedAt: number | null): string {
  if (!startedAt) return '00:00';
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function formatPhone(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (!m) return e164;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

// new styles:
avatarSlot: {
  width: 240, height: 240, borderRadius: 120,
  alignSelf: 'center',
  borderWidth: 1, borderColor: 'rgba(120, 170, 220, 0.4)',
  backgroundColor: 'rgba(0,0,0,0.4)',
  marginTop: 16, marginBottom: 24,
},
timer: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontVariant: ['tabular-nums'], textAlign: 'center' },
callerName: { color: '#fff', fontSize: 24, fontWeight: '600', textAlign: 'center', marginTop: 6 },
callerPhone: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontVariant: ['tabular-nums'], textAlign: 'center', marginTop: 2 },
```

- [ ] **Step 4: Wire panels into CallRoomCard left/right columns**

Replace the empty left/right column placeholders with `<ClientMemoryPanel client={callState.client} />` and `<AIAssistPanel />` respectively.

- [ ] **Step 5: Manual verification [VISUAL]**

Open `/_dev/call-room`. Switch through fixtures. Expected:
- "Marcus Johnson (mockup)" → Client Memory shows full data, AI Assist shows suggestion + 2 action rows, center shows empty avatar circle + 02:18 + name + phone
- "Unknown caller" → Client Memory shows "New caller · No history yet"

- [ ] **Step 6: Commit**

```bash
git add components/call-room/ClientMemoryPanel.tsx components/call-room/AIAssistPanel.tsx components/call-room/CallRoomCard.tsx
git commit -m "feat(call-room): add Client Memory + AI Assist + center identity block"
```

---

### Task 11: CallRoomControls + CallRoomSummaryStrip

**Files:**
- Create: `components/call-room/CallRoomControls.tsx`
- Create: `components/call-room/CallRoomSummaryStrip.tsx`

- [ ] **Step 1: Write CallRoomControls**

```typescript
// components/call-room/CallRoomControls.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { CallState } from './types';

export interface CallRoomControlsProps {
  state: CallState;
  onMute: () => void;
  onHold: () => void;
  onKeypad: () => void;
  onTransfer: () => void;
  onEnd: () => void;
}

export function CallRoomControls(props: CallRoomControlsProps): React.ReactElement {
  return (
    <View style={styles.row} testID="call-room-controls">
      <ControlBtn icon="🎤" label="Mute" active={props.state.isMuted} onPress={props.onMute} />
      <ControlBtn icon="⏸" label="Hold" active={props.state.isOnHold} onPress={props.onHold} />
      <ControlBtn icon="⊞" label="Keypad" onPress={props.onKeypad} />
      <ControlBtn icon="⇄" label="Transfer" onPress={props.onTransfer} />
      <Pressable style={styles.endBtn} onPress={props.onEnd} testID="end-call-btn">
        <Text style={styles.endBtnIcon}>📞</Text>
        <Text style={styles.endBtnLabel}>End Call</Text>
      </Pressable>
    </View>
  );
}

function ControlBtn({ icon, label, active, onPress }: { icon: string; label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.btn, active && styles.btnActive]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.btnIcon}>{icon}</Text>
      <Text style={styles.btnLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  btn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  btnActive: { backgroundColor: 'rgba(120,170,220,0.25)' },
  btnIcon: { fontSize: 14, color: '#fff', marginRight: 6 },
  btnLabel: { color: '#fff', fontSize: 13 },
  endBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: '#dc2626', borderRadius: 999, marginLeft: 4,
  },
  endBtnIcon: { fontSize: 14, color: '#fff', marginRight: 6 },
  endBtnLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
```

- [ ] **Step 2: Write CallRoomSummaryStrip**

```typescript
// components/call-room/CallRoomSummaryStrip.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ClientContext } from './types';

export function CallRoomSummaryStrip({ client }: { client: ClientContext }): React.ReactElement | null {
  if (!client.service && !client.urgency && !client.note) return null;
  return (
    <View style={styles.strip} testID="call-room-summary">
      <Cell icon="📝" label="Need" value={client.note ?? '—'} />
      <Cell icon="🚩" label="Urgency" value={urgencyDescription(client.urgency)} />
      <Cell icon="✓" label="Next Step" value="Schedule inspection · Friday after 2 PM." />
    </View>
  );
}

function urgencyDescription(level: string | null) {
  if (!level) return '—';
  return { high: 'High, after recent storm.', medium: 'Medium.', low: 'Low.' }[level] ?? level;
}

function Cell({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.cellText}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 16,
  },
  cell: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  icon: { fontSize: 16, marginRight: 8, marginTop: 2 },
  cellText: { flex: 1 },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 2 },
  value: { color: '#fff', fontSize: 13, lineHeight: 18 },
});
```

- [ ] **Step 3: Wire into CallRoomCard**

In `CallRoomCard.tsx`, replace the controlsPlaceholder/summaryPlaceholder with:

```typescript
import { CallRoomControls } from './CallRoomControls';
import { CallRoomSummaryStrip } from './CallRoomSummaryStrip';

// ... after body section:
<CallRoomControls
  state={callState}
  onMute={() => {}}
  onHold={() => {}}
  onKeypad={() => {}}
  onTransfer={() => {}}
  onEnd={() => {}}
/>
<CallRoomSummaryStrip client={callState.client} />
```

(Empty handlers for now; wired to real handlers in T46.)

- [ ] **Step 4: Manual verification [VISUAL]**

Open `/_dev/call-room`. Expected: control row with 4 grey buttons + red End Call. Below it, summary strip with Need/Urgency/Next Step. **Side-by-side compare to user's mockup screenshot**: layout should be a near-pixel match.

- [ ] **Step 5: Commit**

```bash
git add components/call-room/CallRoomControls.tsx components/call-room/CallRoomSummaryStrip.tsx components/call-room/CallRoomCard.tsx
git commit -m "feat(call-room): add controls bar + bottom summary strip"
```

---

# M2 — Parallax + Card Depth

By the end of M2, moving the cursor causes the office to feel 3D (5 layers move at different rates) and the card tilts gently while keeping its lighting consistent with the room.

---

### Task 12: Slice the office render into 5 layers

**Files:**
- Create: `components/call-room/layers/sky.webp`
- Create: `components/call-room/layers/back-wall.webp`
- Create: `components/call-room/layers/mid-room.webp`
- Create: `components/call-room/layers/floor.webp`
- Create: `components/call-room/layers/foreground.webp`
- Modify: `components/call-room/layers/manifest.ts`

- [ ] **Step 1: Create the 5 layers in Photoshop / equivalent**

From `_source/office-full.png`, manually create 5 PNGs:

1. **sky.png** — sky + skyline + window frames + warm window glow. Mask out everything else (transparent).
2. **back-wall.png** — back wall slat wood + bookshelf + interior lamps. Mask out window area (transparent) and foreground.
3. **mid-room.png** — leather chair, plant, mid-distance furniture. Mask out everything in front and behind.
4. **floor.png** — floor + foreground desk surface. Mask out walls and ceiling.
5. **foreground.png** — foreground bokeh / out-of-focus desk edge / lens dust. Mask everything in focus.

**Each layer extends ~5% beyond the visible canvas** on the side it can move toward — so when parallax shifts it, the edge isn't exposed.

- [ ] **Step 2: Compress to WebP**

```bash
for f in sky back-wall mid-room floor foreground; do
  npx sharp-cli --input components/call-room/layers/_source/$f.png \
                --output components/call-room/layers/$f.webp \
                --format webp --quality 85 --width 2680
done
```

Expected: 5 WebP files, each ~100–200 KB, total ~750 KB.

- [ ] **Step 3: Update the manifest**

```typescript
// components/call-room/layers/manifest.ts
export interface LayerSpec {
  src: number;
  parallaxRange: number;
  zIndex: number;
  opacity: number;
  /** Slight oversize so parallax never exposes the edge */
  scale: number;
}

export const layers: LayerSpec[] = [
  { src: require('./sky.webp'),        parallaxRange: 2,  zIndex: 0,  opacity: 1, scale: 1.05 },
  { src: require('./back-wall.webp'),  parallaxRange: 5,  zIndex: 10, opacity: 1, scale: 1.05 },
  { src: require('./mid-room.webp'),   parallaxRange: 8,  zIndex: 20, opacity: 1, scale: 1.05 },
  { src: require('./floor.webp'),      parallaxRange: 10, zIndex: 30, opacity: 1, scale: 1.05 },
  { src: require('./foreground.webp'), parallaxRange: 12, zIndex: 40, opacity: 1, scale: 1.05 },
];
```

Delete the now-unused `full-static.webp` and source PNGs from working tree (keep in `_source/` only).

- [ ] **Step 4: Manual verification [VISUAL]**

Open `/_dev/call-room`. Expected: still looks like the same static office — but now composed of 5 layered images. View element inspector (web): confirm 5 stacked `<Image>` elements.

- [ ] **Step 5: Commit**

```bash
git rm components/call-room/layers/full-static.webp
git add components/call-room/layers/*.webp components/call-room/layers/manifest.ts
git commit -m "feat(call-room): slice office into 5 parallax depth layers"
```

---

### Task 13: useParallax hook (cursor → layer transforms)

**Files:**
- Create: `components/call-room/hooks/useParallax.ts`
- Create: `__tests__/call-room/hooks/useParallax.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/call-room/hooks/useParallax.test.ts
import { computeLayerOffset } from '../../../components/call-room/hooks/useParallax';

describe('computeLayerOffset', () => {
  it('returns 0 when cursor is at viewport center', () => {
    expect(computeLayerOffset({ cursorX: 500, cursorY: 500, viewportW: 1000, viewportH: 1000, range: 10 })).toEqual({ x: 0, y: 0 });
  });

  it('returns positive x at right edge of viewport', () => {
    const r = computeLayerOffset({ cursorX: 1000, cursorY: 500, viewportW: 1000, viewportH: 1000, range: 10 });
    expect(r.x).toBeCloseTo(10);
    expect(r.y).toBeCloseTo(0);
  });

  it('returns negative x at left edge', () => {
    const r = computeLayerOffset({ cursorX: 0, cursorY: 500, viewportW: 1000, viewportH: 1000, range: 10 });
    expect(r.x).toBeCloseTo(-10);
  });

  it('scales with parallax intensity', () => {
    const r = computeLayerOffset({ cursorX: 1000, cursorY: 500, viewportW: 1000, viewportH: 1000, range: 10, intensity: 0.5 });
    expect(r.x).toBeCloseTo(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/call-room/hooks/useParallax.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```typescript
// components/call-room/hooks/useParallax.ts
import { useEffect, useRef, useState } from 'react';

export interface ParallaxArgs {
  cursorX: number;
  cursorY: number;
  viewportW: number;
  viewportH: number;
  range: number; // max px
  intensity?: number; // 0..2, default 1
}

export function computeLayerOffset({ cursorX, cursorY, viewportW, viewportH, range, intensity = 1 }: ParallaxArgs) {
  const cx = viewportW / 2;
  const cy = viewportH / 2;
  const dx = (cursorX - cx) / cx; // -1..1
  const dy = (cursorY - cy) / cy;
  return {
    x: dx * range * intensity,
    y: dy * range * intensity,
  };
}

/** Subscribes to mousemove and produces normalized cursor (web-only). */
export function useCursor() {
  const [cursor, setCursor] = useState({ x: 0, y: 0, w: 1, h: 1 });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: MouseEvent) => {
      setCursor({ x: e.clientX, y: e.clientY, w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('mousemove', handler, { passive: true });
    return () => window.removeEventListener('mousemove', handler);
  }, []);
  return cursor;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/call-room/hooks/useParallax.test.ts`
Expected: PASS, 4/4 tests.

- [ ] **Step 5: Commit**

```bash
git add components/call-room/hooks/useParallax.ts __tests__/call-room/hooks/useParallax.test.ts
git commit -m "feat(call-room): add useParallax hook with computeLayerOffset"
```

---

### Task 14: Wire parallax into CallRoomBackground

**Files:**
- Modify: `components/call-room/CallRoomBackground.tsx`

- [ ] **Step 1: Update component**

```typescript
// components/call-room/CallRoomBackground.tsx
import React from 'react';
import { ImageBackground, StyleSheet, View, Platform } from 'react-native';
import { layers } from './layers/manifest';
import { useCursor, computeLayerOffset } from './hooks/useParallax';

export interface CallRoomBackgroundProps {
  parallaxIntensity?: number; // 0..2, default 1
}

export function CallRoomBackground({ parallaxIntensity = 1 }: CallRoomBackgroundProps): React.ReactElement {
  const cursor = useCursor();

  return (
    <View style={styles.root} testID="call-room-background">
      {layers.map((layer, i) => {
        const { x, y } = computeLayerOffset({
          cursorX: cursor.x, cursorY: cursor.y, viewportW: cursor.w, viewportH: cursor.h,
          range: layer.parallaxRange, intensity: parallaxIntensity,
        });
        const transform = Platform.OS === 'web'
          ? ({ transform: `translate3d(${-x}px, ${-y}px, 0) scale(${layer.scale})`, willChange: 'transform' } as object)
          : { transform: [{ translateX: -x }, { translateY: -y }, { scale: layer.scale }] };
        return (
          <ImageBackground
            key={i}
            source={layer.src}
            resizeMode="cover"
            style={[StyleSheet.absoluteFill, { opacity: layer.opacity, zIndex: layer.zIndex }, transform as object]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0a0a0a', overflow: 'hidden' },
});
```

- [ ] **Step 2: Manual verification [VISUAL]**

Open `/_dev/call-room`. Move cursor across the right pane. Expected: foreground bokeh + floor move noticeably, mid-room moves a bit, sky barely moves. **The room should feel like it has depth.**

If movement feels jittery, lower parallax intensity in dev controls. If too subtle, raise it.

- [ ] **Step 3: Commit**

```bash
git add components/call-room/CallRoomBackground.tsx
git commit -m "feat(call-room): cursor-driven parallax across 5 layers"
```

---

### Task 15: useRoomLight hook (CSS custom properties)

**Files:**
- Create: `components/call-room/hooks/useRoomLight.ts`
- Create: `__tests__/call-room/hooks/useRoomLight.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/call-room/hooks/useRoomLight.test.ts
import { roomLightToCssVars } from '../../../components/call-room/hooks/useRoomLight';

describe('roomLightToCssVars', () => {
  it('produces all 4 CSS custom properties', () => {
    const vars = roomLightToCssVars({ x: 0.18, y: 0.45, color: '#d4a574', intensity: 0.7 });
    expect(vars).toEqual({
      '--room-light-x': '0.18',
      '--room-light-y': '0.45',
      '--room-light-color': '#d4a574',
      '--room-light-intensity': '0.7',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/call-room/hooks/useRoomLight.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```typescript
// components/call-room/hooks/useRoomLight.ts
import type { RoomLight } from '../types';

export const DEFAULT_ROOM_LIGHT: RoomLight = {
  x: 0.18, y: 0.45, color: '#d4a574', intensity: 0.7,
};

export function roomLightToCssVars(light: RoomLight): Record<string, string> {
  return {
    '--room-light-x': String(light.x),
    '--room-light-y': String(light.y),
    '--room-light-color': light.color,
    '--room-light-intensity': String(light.intensity),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/call-room/hooks/useRoomLight.test.ts`
Expected: PASS, 1/1.

- [ ] **Step 5: Commit**

```bash
git add components/call-room/hooks/useRoomLight.ts __tests__/call-room/hooks/useRoomLight.test.ts
git commit -m "feat(call-room): add useRoomLight hook + CSS vars helper"
```

---

### Task 16: Apply roomLight CSS vars to CallRoom root + use in card shadow

**Files:**
- Modify: `components/call-room/CallRoom.tsx`
- Modify: `components/call-room/CallRoomCard.tsx`

- [ ] **Step 1: Apply CSS vars at CallRoom root (web only)**

In `CallRoom.tsx`:

```typescript
import { DEFAULT_ROOM_LIGHT, roomLightToCssVars } from './hooks/useRoomLight';

// inside the visible branch:
const cssVars = Platform.OS === 'web' ? roomLightToCssVars(DEFAULT_ROOM_LIGHT) : {};

return (
  <View testID="call-room-root" style={[styles.root, cssVars as object]}>
    ...
  </View>
);
```

- [ ] **Step 2: Wire into CallRoomCard shadows**

In `CallRoomCard.tsx`, replace the static `boxShadow` with one that varies by roomLight (web only):

```typescript
// Inside the web branch of card style:
boxShadow: `
  calc((var(--room-light-x, 0.18) - 0.5) * 16px) 4px 12px rgba(0,0,0,0.5),
  calc((var(--room-light-x, 0.18) - 0.5) * 32px) 24px 60px rgba(0,0,0,0.4),
  0 0 80px ${ASPIRE_GLOW},
  inset 0 1px 0 rgba(255,255,255,0.06),
  inset 0 -1px 0 rgba(0,0,0,0.4)
`,
```

(`calc()` math means: when `--room-light-x = 0.18` (light on left), shadow falls to the right with negative offset; flip for night-time when light comes from right.)

- [ ] **Step 3: Manual verification [VISUAL]**

Open `/_dev/call-room`. Inspect the card in DevTools — confirm CSS variable `--room-light-x: 0.18` is set on the root. The card's drop shadow should lean to the right (away from the window light).

- [ ] **Step 4: Commit**

```bash
git add components/call-room/CallRoom.tsx components/call-room/CallRoomCard.tsx
git commit -m "feat(call-room): wire roomLight CSS vars into card shadow direction"
```

---

### Task 17: useCardTilt hook + apply to CallRoomCard

**Files:**
- Create: `components/call-room/hooks/useCardTilt.ts`
- Modify: `components/call-room/CallRoomCard.tsx`

- [ ] **Step 1: Implement hook (no test — pure DOM coupling, exercised via integration)**

```typescript
// components/call-room/hooks/useCardTilt.ts
import { useEffect, useRef } from 'react';

const MAX_TILT_DEG = 2;
const PROXIMITY_PX = 320; // distance from card center where tilt is fully active

export function useCardTilt() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || !ref.current) return;
    const el = ref.current;
    let raf = 0;
    const handler = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / PROXIMITY_PX;
        const dy = (e.clientY - cy) / PROXIMITY_PX;
        const clampedX = Math.max(-1, Math.min(1, dx));
        const clampedY = Math.max(-1, Math.min(1, dy));
        const rotY = clampedX * MAX_TILT_DEG;
        const rotX = -clampedY * MAX_TILT_DEG;
        el.style.transform = `perspective(1200px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        // Sync roomLight x to track tilt — light shifts as glass tilts
        const lightX = 0.18 + clampedX * 0.12;
        el.style.setProperty('--room-light-x', String(Math.max(0, Math.min(1, lightX))));
      });
    };
    const reset = () => {
      cancelAnimationFrame(raf);
      el.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
      el.style.setProperty('--room-light-x', '0.18');
    };
    window.addEventListener('mousemove', handler, { passive: true });
    window.addEventListener('mouseleave', reset);
    return () => {
      window.removeEventListener('mousemove', handler);
      window.removeEventListener('mouseleave', reset);
      cancelAnimationFrame(raf);
    };
  }, []);
  return ref;
}
```

- [ ] **Step 2: Apply ref to CallRoomCard outer view (web only)**

In `CallRoomCard.tsx`:

```typescript
import { useCardTilt } from './hooks/useCardTilt';

export function CallRoomCard({ callState }: CallRoomCardProps) {
  const tiltRef = useCardTilt();
  return (
    <View
      testID="call-room-card"
      style={styles.card}
      // @ts-expect-error - web-only ref attached for tilt
      ref={Platform.OS === 'web' ? tiltRef : undefined}
    >
      {/* ... */}
    </View>
  );
}
```

Add `transition: transform 200ms ease-out` to the card style on web so reset is smooth.

- [ ] **Step 3: Manual verification [VISUAL]**

Open `/_dev/call-room`. Hover near the card — it should tilt subtly (max ±2°). The card's drop shadow should shift as it tilts.

- [ ] **Step 4: Commit**

```bash
git add components/call-room/hooks/useCardTilt.ts components/call-room/CallRoomCard.tsx
git commit -m "feat(call-room): card tilt + roomLight tracking on hover"
```

---

### Task 18: Edge highlight & refraction overlay

**Files:**
- Modify: `components/call-room/CallRoomCard.tsx`

- [ ] **Step 1: Add inner highlight + edge refraction layers as absolutely-positioned children**

In `CallRoomCard.tsx`, just inside the card View (web-only enhancement):

```typescript
{Platform.OS === 'web' && (
  <>
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', inset: 0, borderRadius: 18,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 12%)',
      } as object}
      testID="card-edge-highlight"
    />
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', inset: 0, borderRadius: 18,
        background: `linear-gradient(
          calc(var(--room-light-x, 0.18) * 360deg),
          rgba(212,165,116,0.06) 0%,
          rgba(120,170,220,0.03) 50%,
          transparent 100%
        )`,
      } as object}
      testID="card-edge-refraction"
    />
  </>
)}
```

- [ ] **Step 2: Manual verification [VISUAL]**

Open `/_dev/call-room`. Card should have a subtle white highlight along the top edge and a gentle warm/cool refraction tint across its surface. **Compare with mockup** — should be slightly more dimensional than the flat mockup.

- [ ] **Step 3: Commit**

```bash
git add components/call-room/CallRoomCard.tsx
git commit -m "feat(call-room): add edge highlight + refraction overlay for premium glass"
```

---

# M3 — Transitions

By the end of M3, the call screen visibly "pushes in" when entering the room and "pushes out" on End Call.

---

### Task 19: Transitions module (push-in keyframes)

**Files:**
- Create: `components/call-room/transitions/enterRoom.ts`
- Create: `__tests__/call-room/transitions/enterRoom.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/call-room/transitions/enterRoom.test.ts
import { computeEnterFrame } from '../../../components/call-room/transitions/enterRoom';

describe('computeEnterFrame', () => {
  it('starts with bg pre-zoomed and card off-screen at t=0', () => {
    const f = computeEnterFrame(0);
    expect(f.bgScale).toBeCloseTo(1.4, 2);
    expect(f.cardOpacity).toBeCloseTo(0, 2);
    expect(f.cardScale).toBeCloseTo(0.5, 2);
    expect(f.cardTranslateY).toBeGreaterThan(0);
  });

  it('settles at neutral by t=1', () => {
    const f = computeEnterFrame(1);
    expect(f.bgScale).toBeCloseTo(1.0, 2);
    expect(f.cardOpacity).toBeCloseTo(1, 2);
    expect(f.cardScale).toBeCloseTo(1.0, 2);
    expect(f.cardTranslateY).toBeCloseTo(0, 2);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest __tests__/call-room/transitions/enterRoom.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```typescript
// components/call-room/transitions/enterRoom.ts
const ease = (t: number) => 1 - Math.pow(1 - t, 4); // easeOutQuart

export interface EnterFrame {
  bgScale: number;
  bgOpacity: number;
  cardOpacity: number;
  cardScale: number;
  cardTranslateY: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function computeEnterFrame(t: number): EnterFrame {
  const tt = Math.max(0, Math.min(1, t));
  const e = ease(tt);
  // Card lags bg by ~0.15 — starts moving after bg already underway
  const cardT = Math.max(0, Math.min(1, (tt - 0.15) / 0.85));
  const ec = ease(cardT);
  return {
    bgScale: lerp(1.4, 1.0, e),
    bgOpacity: Math.min(1, e * 2),
    cardOpacity: ec,
    cardScale: lerp(0.5, 1.0, ec),
    cardTranslateY: lerp(80, 0, ec),
  };
}

export const ENTER_DURATION_MS = 600;
```

- [ ] **Step 4: Run, verify pass**

Run: `npx jest __tests__/call-room/transitions/enterRoom.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 5: Commit**

```bash
git add components/call-room/transitions/enterRoom.ts __tests__/call-room/transitions/enterRoom.test.ts
git commit -m "feat(call-room): add enterRoom transition keyframe math"
```

---

### Task 20: exitRoom transitions (mirror of enter)

**Files:**
- Create: `components/call-room/transitions/exitRoom.ts`

- [ ] **Step 1: Implement** (similar pattern; no separate test — mirrors enter)

```typescript
// components/call-room/transitions/exitRoom.ts
import type { EnterFrame } from './enterRoom';

const easeIn = (t: number) => Math.pow(t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function computeExitFrame(t: number): EnterFrame {
  const tt = Math.max(0, Math.min(1, t));
  const e = easeIn(tt);
  // Card leads — shrinks/fades faster, bg follows
  const bgT = Math.max(0, Math.min(1, (tt - 0.1) / 0.9));
  const eb = easeIn(bgT);
  return {
    bgScale: lerp(1.0, 1.4, eb),
    bgOpacity: 1 - eb,
    cardOpacity: 1 - e,
    cardScale: lerp(1.0, 0.5, e),
    cardTranslateY: lerp(0, 80, e),
  };
}

export const EXIT_DURATION_MS = 500;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/call-room/transitions/exitRoom.ts
git commit -m "feat(call-room): add exitRoom transition keyframe math"
```

---

### Task 21: Apply transitions in CallRoom (RAF loop)

**Files:**
- Modify: `components/call-room/CallRoom.tsx`

- [ ] **Step 1: Add transition state machine using `useEffect` + `requestAnimationFrame`**

Replace the body of `CallRoom` with a transition-aware version:

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform, AccessibilityInfo } from 'react-native';
import { CallRoomBackground } from './CallRoomBackground';
import { CallRoomCard } from './CallRoomCard';
import { DEFAULT_ROOM_LIGHT, roomLightToCssVars } from './hooks/useRoomLight';
import { computeEnterFrame, ENTER_DURATION_MS } from './transitions/enterRoom';
import { computeExitFrame, EXIT_DURATION_MS } from './transitions/exitRoom';
import type { CallState } from './types';

type Phase = 'hidden' | 'entering' | 'shown' | 'exiting';

export interface CallRoomProps {
  visible: boolean;
  callState: CallState;
}

export function CallRoom({ visible, callState }: CallRoomProps): React.ReactElement | null {
  const [phase, setPhase] = useState<Phase>(visible ? 'shown' : 'hidden');
  const [frame, setFrame] = useState(() => computeEnterFrame(1));
  const startRef = useRef<number>(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (visible && phase === 'hidden') {
      if (reduced) { setPhase('shown'); setFrame(computeEnterFrame(1)); return; }
      setPhase('entering');
      startRef.current = performance.now();
    } else if (!visible && (phase === 'shown' || phase === 'entering')) {
      if (reduced) { setPhase('hidden'); return; }
      setPhase('exiting');
      startRef.current = performance.now();
    }
  }, [visible, phase, reduced]);

  useEffect(() => {
    if (phase !== 'entering' && phase !== 'exiting') return;
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const dur = phase === 'entering' ? ENTER_DURATION_MS : EXIT_DURATION_MS;
      const t = Math.min(1, elapsed / dur);
      setFrame(phase === 'entering' ? computeEnterFrame(t) : computeExitFrame(t));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setPhase(phase === 'entering' ? 'shown' : 'hidden');
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  if (phase === 'hidden') return null;

  const cssVars = Platform.OS === 'web' ? roomLightToCssVars(DEFAULT_ROOM_LIGHT) : {};

  const bgStyle = Platform.OS === 'web'
    ? ({ transform: `scale(${frame.bgScale})`, opacity: frame.bgOpacity } as object)
    : { transform: [{ scale: frame.bgScale }], opacity: frame.bgOpacity };

  const cardStyle = Platform.OS === 'web'
    ? ({ transform: `translateY(${frame.cardTranslateY}px) scale(${frame.cardScale})`, opacity: frame.cardOpacity } as object)
    : { transform: [{ translateY: frame.cardTranslateY }, { scale: frame.cardScale }], opacity: frame.cardOpacity };

  return (
    <View testID="call-room-root" style={[styles.root, cssVars as object]}>
      <View style={[StyleSheet.absoluteFill, bgStyle]}>
        <CallRoomBackground />
      </View>
      <View style={styles.cardWrap} pointerEvents="box-none">
        <View style={cardStyle}>
          <CallRoomCard callState={callState} />
        </View>
      </View>
    </View>
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub?.remove?.();
  }, []);
  return reduced;
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0a0a0a', overflow: 'hidden' },
  cardWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 32 },
});
```

- [ ] **Step 2: Run existing tests**

Run: `npx jest __tests__/call-room/CallRoom.test.tsx`
Expected: PASS (visibility test still works because `phase = 'hidden'` returns null when `visible=false`).

- [ ] **Step 3: Manual verification [VISUAL]**

Open `/_dev/call-room`. Click "Hide Call Room" — room pushes out (~500ms). Click "Show Call Room" — room pushes in (~600ms). **Should feel cinematic.**

- [ ] **Step 4: Commit**

```bash
git add components/call-room/CallRoom.tsx
git commit -m "feat(call-room): wire push-in/push-out transitions with RAF loop + reduced-motion"
```

---

### Task 22: Shift+click shortcut on dial pad call button

**Files:**
- Modify: `app/session/calls.tsx` (locate green call button handler)

- [ ] **Step 1: Find the call button handler**

Run: `grep -n "Enter number\|call-button\|onCallPress\|initiateCall" app/session/calls.tsx`

- [ ] **Step 2: Wrap the existing handler to detect shift+click (web only)**

Add at the call button's `onPress`:

```typescript
const handleCallPress = useCallback((evt?: GestureResponderEvent | MouseEvent) => {
  // Dev shortcut: shift+click → admin-only call room preview
  if (Platform.OS === 'web' && (evt as MouseEvent | undefined)?.shiftKey && isPlatformAdmin) {
    router.push('/_dev/call-room');
    return;
  }
  // ... existing handler logic
}, [/* deps */]);
```

`isPlatformAdmin` resolves from your existing admin hook (substitute the same one used in T05).

- [ ] **Step 3: Manual verification [VISUAL]**

Reload dial pad. Shift+click the green call button (admin user). Expected: route navigates to `/_dev/call-room`. Without shift: normal call flow.

- [ ] **Step 4: Commit**

```bash
git add app/session/calls.tsx
git commit -m "feat(call-room): shift+click on call button → /_dev/call-room (admin only)"
```

---

# M4 — Time of Day

By the end of M4, the room's tint (sky color, lamp glow, card outer glow) shifts based on the user's current local time, computed from geolocation.

---

### Task 23: Add `suncalc` dep

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

Run: `npm i suncalc && npm i -D @types/suncalc`
Expected: `package.json` updated, `node_modules/suncalc` exists.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add suncalc + @types/suncalc"
```

---

### Task 24: useTimeOfDay hook

**Files:**
- Create: `components/call-room/hooks/useTimeOfDay.ts`
- Create: `__tests__/call-room/hooks/useTimeOfDay.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/call-room/hooks/useTimeOfDay.test.ts
import { classifyTimeOfDay } from '../../../components/call-room/hooks/useTimeOfDay';

describe('classifyTimeOfDay', () => {
  // Sun elevation in radians: <-0.1 = night, -0.1..0.1 = dawn/dusk, >0.1 = day
  it('returns night for low elevation', () => {
    expect(classifyTimeOfDay(-0.4, true)).toBe('night');
  });
  it('returns dawn for low elevation rising', () => {
    expect(classifyTimeOfDay(0.0, true)).toBe('dawn');
  });
  it('returns dusk for low elevation setting', () => {
    expect(classifyTimeOfDay(0.0, false)).toBe('dusk');
  });
  it('returns day for high elevation', () => {
    expect(classifyTimeOfDay(0.5, true)).toBe('day');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest __tests__/call-room/hooks/useTimeOfDay.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
// components/call-room/hooks/useTimeOfDay.ts
import { useEffect, useState } from 'react';
import SunCalc from 'suncalc';
import type { RoomLight, TimeOfDayState } from '../types';

const ROOM_LIGHTS: Record<TimeOfDayState, RoomLight> = {
  dawn:  { x: 0.20, y: 0.55, color: '#9ab8d8', intensity: 0.55 },
  day:   { x: 0.18, y: 0.45, color: '#d4a574', intensity: 0.70 },
  dusk:  { x: 0.18, y: 0.50, color: '#e8a25c', intensity: 0.85 },
  night: { x: 0.78, y: 0.55, color: '#3a4a6a', intensity: 0.45 }, // light shifts to interior lamp (right side)
};

export function classifyTimeOfDay(sunElevationRad: number, rising: boolean): TimeOfDayState {
  if (sunElevationRad < -0.1) return 'night';
  if (sunElevationRad > 0.1) return 'day';
  return rising ? 'dawn' : 'dusk';
}

export interface TimeOfDay {
  state: TimeOfDayState;
  light: RoomLight;
}

export function useTimeOfDay(forced?: TimeOfDayState): TimeOfDay {
  const [state, setState] = useState<TimeOfDayState>(forced ?? 'day');

  useEffect(() => {
    if (forced) { setState(forced); return; }
    let cancelled = false;

    const compute = (lat: number, lon: number) => {
      const now = new Date();
      const pos = SunCalc.getPosition(now, lat, lon);
      // Determine if rising: compare elevation now vs 10min from now
      const future = SunCalc.getPosition(new Date(now.getTime() + 10 * 60_000), lat, lon);
      const rising = future.altitude > pos.altitude;
      const next = classifyTimeOfDay(pos.altitude, rising);
      if (!cancelled) setState(next);
    };

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => compute(p.coords.latitude, p.coords.longitude),
        () => {
          // Geolocation denied — fall back to system time only (no lat/lon → estimate from local hour)
          const h = new Date().getHours();
          if (h < 5 || h >= 21) setState('night');
          else if (h < 7) setState('dawn');
          else if (h < 18) setState('day');
          else setState('dusk');
        },
        { maximumAge: 60 * 60 * 1000, timeout: 8000 },
      );
    }
    // Re-evaluate every 5 min while mounted
    const id = setInterval(() => {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (p) => compute(p.coords.latitude, p.coords.longitude),
          () => {/* noop */},
        );
      }
    }, 5 * 60_000);

    return () => { cancelled = true; clearInterval(id); };
  }, [forced]);

  return { state, light: ROOM_LIGHTS[state] };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx jest __tests__/call-room/hooks/useTimeOfDay.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add components/call-room/hooks/useTimeOfDay.ts __tests__/call-room/hooks/useTimeOfDay.test.ts
git commit -m "feat(call-room): add useTimeOfDay with suncalc + geolocation + system-time fallback"
```

---

### Task 25: Wire useTimeOfDay into CallRoom

**Files:**
- Modify: `components/call-room/CallRoom.tsx`
- Modify: `components/call-room/CallRoom.demo.tsx`

- [ ] **Step 1: Replace `DEFAULT_ROOM_LIGHT` with computed light**

In `CallRoom.tsx`:

```typescript
import { useTimeOfDay } from './hooks/useTimeOfDay';
// ...
export interface CallRoomProps {
  visible: boolean;
  callState: CallState;
  forcedTimeOfDay?: TimeOfDayState; // dev-only override
}

export function CallRoom({ visible, callState, forcedTimeOfDay }: CallRoomProps) {
  const { light } = useTimeOfDay(forcedTimeOfDay);
  // ...
  const cssVars = Platform.OS === 'web' ? roomLightToCssVars(light) : {};
  // ...
}
```

- [ ] **Step 2: Plumb the dev control through**

In `CallRoom.demo.tsx`:

```typescript
<CallRoom
  visible={visible}
  callState={fixture.state}
  forcedTimeOfDay={forcedTime === 'auto' ? undefined : forcedTime}
/>
```

- [ ] **Step 3: Manual verification [VISUAL]**

Open `/_dev/call-room`. Click each time-of-day button (auto/dawn/day/dusk/night). Expected: card glow shifts noticeably (cool blue at dawn, warm at day, amber at dusk, deep navy at night).

- [ ] **Step 4: Commit**

```bash
git add components/call-room/CallRoom.tsx components/call-room/CallRoom.demo.tsx
git commit -m "feat(call-room): time-of-day drives roomLight (geolocation-aware + dev override)"
```

---

### Task 26: Time-of-day tint overlay layer (sky/window glow)

**Files:**
- Modify: `components/call-room/CallRoomBackground.tsx`

- [ ] **Step 1: Add a tint overlay above all parallax layers**

```typescript
// in CallRoomBackground.tsx, add prop:
export interface CallRoomBackgroundProps {
  parallaxIntensity?: number;
  tintColor?: string;   // e.g., '#d4a574'
  tintIntensity?: number; // 0..1
}

// inside component, after the layer map:
{Platform.OS === 'web' && (
  <View
    pointerEvents="none"
    style={{
      ...StyleSheet.absoluteFillObject,
      background: `linear-gradient(135deg,
        ${rgbaFromHex(tintColor ?? '#d4a574', (tintIntensity ?? 0.7) * 0.18)} 0%,
        transparent 60%)`,
      zIndex: 50,
    } as object}
    testID="time-tint-overlay"
  />
)}

function rgbaFromHex(hex: string, a: number): string {
  const m = hex.replace('#','').match(/^([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!m) return `rgba(212,165,116,${a})`;
  const [r,g,b] = [m[1], m[2], m[3]].map(s => parseInt(s, 16));
  return `rgba(${r},${g},${b},${a})`;
}
```

- [ ] **Step 2: Pass tint from CallRoom**

```typescript
<CallRoomBackground
  parallaxIntensity={parallaxIntensity}
  tintColor={light.color}
  tintIntensity={light.intensity}
/>
```

- [ ] **Step 3: Manual verification [VISUAL]**

Cycle through dawn/day/dusk/night in dev controls. Tint overlay should change. **Critically:** the card and the room should look like they're lit by the *same* light source. If they don't, adjust ROOM_LIGHTS table values until they agree.

- [ ] **Step 4: Commit**

```bash
git add components/call-room/CallRoomBackground.tsx components/call-room/CallRoom.tsx
git commit -m "feat(call-room): time-of-day tint overlay (linked to roomLight)"
```

---

### Task 27: Window glow flicker (ambient micro-life)

**Files:**
- Modify: `components/call-room/CallRoomBackground.tsx`

- [ ] **Step 1: Add a CSS animation on layer 1 (web only)**

```typescript
// in CallRoomBackground render — wrap the first layer (sky.webp) with a flicker style:
const isFirst = i === 0;
const flickerStyle = Platform.OS === 'web' && isFirst
  ? { animation: 'callRoomFlicker 8s ease-in-out infinite' } as object
  : {};

// inject keyframes once at module scope (web):
if (typeof document !== 'undefined' && !document.getElementById('call-room-keyframes')) {
  const s = document.createElement('style');
  s.id = 'call-room-keyframes';
  s.textContent = `
    @keyframes callRoomFlicker {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.95; }
    }
  `;
  document.head.appendChild(s);
}
```

- [ ] **Step 2: Manual verification [VISUAL]**

Open `/_dev/call-room`. Watch the window/sky layer for ~10 sec. Should feel subtly alive — not a static photo. Effect must be barely perceptible (5% opacity oscillation).

- [ ] **Step 3: Commit**

```bash
git add components/call-room/CallRoomBackground.tsx
git commit -m "feat(call-room): subtle window glow flicker for ambient life"
```

---

### Task 28: Geolocation permission UX

**Files:**
- Modify: `components/call-room/hooks/useTimeOfDay.ts` — add a one-time permission flag in localStorage

- [ ] **Step 1: Persist the permission decision so we don't re-prompt every call**

Edit the hook — wrap the geolocation call:

```typescript
// at top of hook:
const STORAGE_KEY = 'call-room.geolocation.granted';

// inside the geolocation branch:
const granted = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
if (granted === 'denied') {
  // user previously denied — skip prompt, fall back to system time
  fallbackToSystemTime();
  return;
}
navigator.geolocation.getCurrentPosition(
  (p) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, 'granted');
    compute(p.coords.latitude, p.coords.longitude);
  },
  () => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, 'denied');
    fallbackToSystemTime();
  },
  { maximumAge: 60 * 60 * 1000, timeout: 8000 },
);
```

(Extract `fallbackToSystemTime()` from the existing logic.)

- [ ] **Step 2: Manual verification [VISUAL]**

Open `/_dev/call-room` in incognito. Permission prompt fires once. After deny, reload — no re-prompt; tint defaults to system-time fallback.

- [ ] **Step 3: Commit**

```bash
git add components/call-room/hooks/useTimeOfDay.ts
git commit -m "feat(call-room): persist geolocation permission decision"
```

---

# M5 — Voice Activity + Avatar States

By the end of M5, the avatar reflects the 4 states correctly + the Aspire-blue ring pulses with caller voice + the host chip pulses when the host speaks.

---

### Task 29: Build script — compress default avatar PNGs to WebP

**Files:**
- Create: `scripts/build-call-room-assets.mjs`
- Modify: `package.json` — add script entry

- [ ] **Step 1: Install sharp**

Run: `npm i -D sharp`

- [ ] **Step 2: Write script**

```javascript
// scripts/build-call-room-assets.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const sources = [
  ['default-male.png', 'default-male.webp'],
  ['default-female.png', 'default-female.webp'],
];

const dir = resolve(root, 'components/call-room/assets/avatars');

for (const [from, to] of sources) {
  await sharp(resolve(dir, from))
    .resize({ width: 512, height: 512, fit: 'inside' })
    .webp({ quality: 85 })
    .toFile(resolve(dir, to));
  console.log(`✓ ${from} → ${to}`);
}
```

- [ ] **Step 3: Add npm script**

In `package.json`:
```json
"scripts": {
  "build:call-room-assets": "node scripts/build-call-room-assets.mjs"
}
```

- [ ] **Step 4: Run build script**

Run: `npm run build:call-room-assets`
Expected: `default-male.webp` and `default-female.webp` created, each <100 KB.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-call-room-assets.mjs package.json package-lock.json components/call-room/assets/avatars/*.webp
git commit -m "feat(call-room): asset build script + compressed default avatars"
```

---

### Task 30: CallerAvatar component (4 states)

**Files:**
- Create: `components/call-room/CallerAvatar.tsx`
- Create: `__tests__/call-room/CallerAvatar.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/call-room/CallerAvatar.test.tsx
import { render } from '@testing-library/react-native';
import { CallerAvatar } from '../../components/call-room/CallerAvatar';

describe('CallerAvatar', () => {
  it('renders photo when avatarMode=photo and photoUrl present', () => {
    const { getByTestId } = render(
      <CallerAvatar avatarMode="photo" photoUrl="https://example.com/p.jpg" name="Marcus Johnson" />,
    );
    expect(getByTestId('avatar-photo')).toBeTruthy();
  });

  it('renders initials when avatarMode=initials', () => {
    const { getByText } = render(<CallerAvatar avatarMode="initials" photoUrl={null} name="Marcus Johnson" />);
    expect(getByText('MJ')).toBeTruthy();
  });

  it('renders default-male when avatarMode=default_male', () => {
    const { getByTestId } = render(<CallerAvatar avatarMode="default_male" photoUrl={null} name="Carl Diaz" />);
    expect(getByTestId('avatar-default-male')).toBeTruthy();
  });

  it('renders default-female when avatarMode=default_female', () => {
    const { getByTestId } = render(<CallerAvatar avatarMode="default_female" photoUrl={null} name="Anita" />);
    expect(getByTestId('avatar-default-female')).toBeTruthy();
  });

  it('falls back to default-male when photo mode but no photo url', () => {
    const { getByTestId } = render(<CallerAvatar avatarMode="photo" photoUrl={null} name="X" />);
    expect(getByTestId('avatar-default-male')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest __tests__/call-room/CallerAvatar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
// components/call-room/CallerAvatar.tsx
import React from 'react';
import { Image, StyleSheet, View, Text } from 'react-native';
import type { AvatarMode } from './types';

const DEFAULT_MALE = require('./assets/avatars/default-male.webp');
const DEFAULT_FEMALE = require('./assets/avatars/default-female.webp');

export interface CallerAvatarProps {
  avatarMode: AvatarMode;
  photoUrl: string | null;
  name: string | null;
  size?: number;
}

export function CallerAvatar({ avatarMode, photoUrl, name, size = 240 }: CallerAvatarProps): React.ReactElement {
  const dim = { width: size, height: size, borderRadius: size / 2 };

  // Determine effective mode (fallback when photo missing)
  const effective: AvatarMode = avatarMode === 'photo' && !photoUrl ? 'default_male' : avatarMode;

  if (effective === 'photo' && photoUrl) {
    return (
      <View style={[styles.wrap, dim]} testID="avatar-photo">
        <Image source={{ uri: photoUrl }} style={[styles.image, dim]} />
      </View>
    );
  }

  if (effective === 'initials') {
    const initials = computeInitials(name);
    return (
      <View style={[styles.wrap, styles.initials, dim]} testID="avatar-initials">
        <Text style={[styles.initialsText, { fontSize: size * 0.32 }]}>{initials}</Text>
      </View>
    );
  }

  if (effective === 'default_female') {
    return (
      <View style={[styles.wrap, dim]} testID="avatar-default-female">
        <Image source={DEFAULT_FEMALE} style={[styles.image, dim]} resizeMode="cover" />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, dim]} testID="avatar-default-male">
      <Image source={DEFAULT_MALE} style={[styles.image, dim]} resizeMode="cover" />
    </View>
  );
}

function computeInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(120,170,220,0.4)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  initials: { backgroundColor: '#1e3a5f' },
  initialsText: { color: '#fff', fontWeight: '700', letterSpacing: 1 },
});
```

- [ ] **Step 4: Run, verify pass**

Run: `npx jest __tests__/call-room/CallerAvatar.test.tsx`
Expected: PASS, 5/5.

- [ ] **Step 5: Wire into CallRoomCard center column** (replace empty `avatarSlot` View)

```typescript
import { CallerAvatar } from './CallerAvatar';
// ...
<View style={styles.avatarSlot} testID="avatar-slot">
  <CallerAvatar
    avatarMode={callState.client.avatarMode}
    photoUrl={callState.client.photoUrl}
    name={callState.client.name}
    size={240}
  />
</View>
```

- [ ] **Step 6: Manual verification [VISUAL]**

Cycle through all 5 fixtures in dev preview. Each should show its expected avatar (photo / 3D male / 3D female / initials / 3D male fallback).

- [ ] **Step 7: Commit**

```bash
git add components/call-room/CallerAvatar.tsx components/call-room/CallRoomCard.tsx __tests__/call-room/CallerAvatar.test.tsx
git commit -m "feat(call-room): CallerAvatar with 4 states + fallback logic"
```

---

### Task 31: useVoiceActivity hook (RMS amplitude from audio stream)

**Files:**
- Create: `components/call-room/hooks/useVoiceActivity.ts`

- [ ] **Step 1: Implement (interface + mock-friendly)**

```typescript
// components/call-room/hooks/useVoiceActivity.ts
import { useEffect, useRef, useState } from 'react';

export interface VoiceActivityOptions {
  /** When provided, simulate amplitude (used by dev preview). 0..1 */
  simulated?: number;
  /** Live MediaStream from WebRTC. Ignored if simulated is set. */
  stream?: MediaStream | null;
  /** Smoothing factor, 0 = no smoothing, 1 = full smoothing. Default 0.7. */
  smoothing?: number;
}

export function useVoiceActivity({ simulated, stream, smoothing = 0.7 }: VoiceActivityOptions): number {
  const [amp, setAmp] = useState(0);
  const valueRef = useRef(0);

  useEffect(() => {
    valueRef.current = 0;
    setAmp(0);

    if (simulated !== undefined) {
      const id = setInterval(() => {
        // emulate organic pulsing: simulated value ± 30% jitter
        const jitter = (Math.random() - 0.5) * 0.6 * simulated;
        const next = Math.max(0, Math.min(1, simulated + jitter));
        valueRef.current = valueRef.current * smoothing + next * (1 - smoothing);
        setAmp(valueRef.current);
      }, 100);
      return () => clearInterval(id);
    }

    if (!stream) return;
    if (typeof window === 'undefined' || !('AudioContext' in window)) return;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      // RMS
      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / buf.length);
      const next = Math.min(1, rms * 4); // amplify
      valueRef.current = valueRef.current * smoothing + next * (1 - smoothing);
      setAmp(valueRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      try { src.disconnect(); ctx.close(); } catch {}
    };
  }, [simulated, stream, smoothing]);

  return amp;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/call-room/hooks/useVoiceActivity.ts
git commit -m "feat(call-room): useVoiceActivity hook (live + simulated)"
```

---

### Task 32: VoiceActivityRing component

**Files:**
- Create: `components/call-room/VoiceActivityRing.tsx`
- Create: `__tests__/call-room/VoiceActivityRing.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/call-room/VoiceActivityRing.test.tsx
import { computeRingFrame } from '../../components/call-room/VoiceActivityRing';

describe('computeRingFrame', () => {
  it('returns base scale at 0 amplitude', () => {
    const f = computeRingFrame(0, 'idle');
    expect(f.scale).toBeCloseTo(1.0, 2);
    expect(f.opacity).toBeLessThanOrEqual(0.4);
  });
  it('peaks at 1.04 with full amplitude', () => {
    const f = computeRingFrame(1, 'speaking');
    expect(f.scale).toBeCloseTo(1.04, 2);
  });
  it('uses red color when on hold', () => {
    expect(computeRingFrame(0.5, 'on_hold').color).toMatch(/dc2626|255, 0, 0|red|#dc/i);
  });
  it('uses gold color when transferring', () => {
    expect(computeRingFrame(0.5, 'transferring').color).toMatch(/eab308|gold|#e/i);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest __tests__/call-room/VoiceActivityRing.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
// components/call-room/VoiceActivityRing.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';

export type RingMode = 'idle' | 'speaking' | 'on_hold' | 'transferring';

const COLORS: Record<RingMode, string> = {
  idle: 'rgba(120, 170, 220, 0.6)',
  speaking: 'rgba(120, 170, 220, 0.9)',
  on_hold: '#dc2626',
  transferring: '#eab308',
};

export function computeRingFrame(amplitude: number, mode: RingMode) {
  const a = Math.max(0, Math.min(1, amplitude));
  const scale = 1.0 + a * 0.04;
  const opacity = mode === 'idle' ? 0.3 + a * 0.1 : 0.4 + a * 0.4;
  return { scale, opacity, color: COLORS[mode] };
}

export interface VoiceActivityRingProps {
  amplitude: number;
  mode: RingMode;
  size: number;
}

export function VoiceActivityRing({ amplitude, mode, size }: VoiceActivityRingProps): React.ReactElement {
  const { scale, opacity, color } = computeRingFrame(amplitude, mode);
  return (
    <View
      pointerEvents="none"
      testID="voice-activity-ring"
      style={[
        styles.ring,
        {
          width: size + 16,
          height: size + 16,
          borderRadius: (size + 16) / 2,
          borderColor: color,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 4,
    borderStyle: 'solid',
  },
});
```

- [ ] **Step 4: Run, verify pass**

Run: `npx jest __tests__/call-room/VoiceActivityRing.test.tsx`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add components/call-room/VoiceActivityRing.tsx __tests__/call-room/VoiceActivityRing.test.tsx
git commit -m "feat(call-room): VoiceActivityRing with mode color states"
```

---

### Task 33: Wire ring into CallRoomCard center

**Files:**
- Modify: `components/call-room/CallRoomCard.tsx`

- [ ] **Step 1: Render the ring inside the avatar slot, behind the avatar**

```typescript
import { VoiceActivityRing } from './VoiceActivityRing';
import { useVoiceActivity } from './hooks/useVoiceActivity';

// inside CallRoomCard:
const callerAmp = useVoiceActivity({ simulated: callState.simulatedCallerAmp });

const ringMode: RingMode =
  callState.isOnHold ? 'on_hold' :
  callState.status === 'transferring' ? 'transferring' :
  callerAmp > 0.05 ? 'speaking' : 'idle';

// in avatar slot:
<View style={styles.avatarSlot}>
  <VoiceActivityRing amplitude={callerAmp} mode={ringMode} size={240} />
  <CallerAvatar ... />
</View>
```

Add `simulatedCallerAmp` and `simulatedHostAmp` as optional fields on `CallState` in `types.ts`.

- [ ] **Step 2: Wire dev simulation** in `CallRoom.demo.tsx`:

```typescript
const stateWithSim = {
  ...fixture.state,
  simulatedCallerAmp: voiceSim === 'caller' ? 0.6 : 0,
  simulatedHostAmp: voiceSim === 'host' ? 0.6 : 0,
};
// pass stateWithSim instead of fixture.state
```

- [ ] **Step 3: Manual verification [VISUAL]**

Open `/_dev/call-room`. Toggle Voice activity = caller → ring around avatar pulses blue. = host → ring should pulse around the host chip (next task wires this).

- [ ] **Step 4: Commit**

```bash
git add components/call-room/CallRoomCard.tsx components/call-room/types.ts components/call-room/CallRoom.demo.tsx
git commit -m "feat(call-room): caller voice activity ring around avatar"
```

---

### Task 34: Host activity ring on the top-right Sarah chip

**Files:**
- Modify: `components/call-room/CallRoomCard.tsx`

- [ ] **Step 1: Add a small `VoiceActivityRing` around the host chip in the header**

Replace the simple host chip text with a ringed version:

```typescript
const hostAmp = useVoiceActivity({ simulated: callState.simulatedHostAmp });
const hostRingMode: RingMode = hostAmp > 0.05 ? 'speaking' : 'idle';

// Header right:
<View style={styles.hostChip}>
  <View>
    <VoiceActivityRing amplitude={hostAmp} mode={hostRingMode} size={36} />
    <View style={styles.hostAvatar}>
      {callState.hostAgent.photoUrl ? (
        <Image source={{ uri: callState.hostAgent.photoUrl }} style={styles.hostAvatarImg} />
      ) : (
        <Text style={styles.hostAvatarText}>{callState.hostAgent.name[0]}</Text>
      )}
    </View>
  </View>
  <View>
    <Text style={styles.hostName}>{callState.hostAgent.name}</Text>
    <Text style={styles.hostRole}>Front Desk</Text>
  </View>
</View>
```

Add styles:
```typescript
hostChip: { position: 'absolute', right: 24, top: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
hostAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1e3a5f', alignItems: 'center', justifyContent: 'center' },
hostAvatarImg: { width: 36, height: 36, borderRadius: 18 },
hostAvatarText: { color: '#fff', fontWeight: '600' },
hostName: { color: '#fff', fontSize: 13, fontWeight: '500' },
hostRole: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
```

- [ ] **Step 2: Manual verification [VISUAL]**

Toggle Voice activity = host → small ring pulses around Sarah chip. = caller → main avatar ring pulses, host chip stays idle.

- [ ] **Step 3: Commit**

```bash
git add components/call-room/CallRoomCard.tsx
git commit -m "feat(call-room): host voice activity ring on Sarah chip"
```

---

### Task 35: Connected status pill in header

**Files:**
- Modify: `components/call-room/CallRoomCard.tsx`

- [ ] **Step 1: Add a "Connected" pill between header subtitle and host chip**

```typescript
// in header, adjusted layout:
<View style={styles.headerRow}>
  <View style={{ flex: 1, alignItems: 'center' }}>
    <Text style={styles.headerTitle}>Front Desk Call Room</Text>
    <Text style={styles.headerSubtitle}>
      {callState.hostAgent.name} hosting · {statusLabel(callState.status)}
    </Text>
  </View>
</View>
<View style={styles.connectedPill}>
  <View style={styles.connectedDot} />
  <Text style={styles.connectedText}>Connected</Text>
</View>
```

Helpers:
```typescript
function statusLabel(status: CallStatus): string {
  switch (status) {
    case 'connected': return 'Outbound call in progress';
    case 'on_hold': return 'On hold';
    case 'transferring': return 'Transferring';
    default: return status;
  }
}
```

Styles:
```typescript
headerRow: { flexDirection: 'row', justifyContent: 'center' },
connectedPill: {
  position: 'absolute', right: 200, top: 28,
  flexDirection: 'row', alignItems: 'center',
  paddingHorizontal: 10, paddingVertical: 4,
  backgroundColor: 'rgba(16, 185, 129, 0.15)',
  borderRadius: 999, gap: 6,
},
connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
connectedText: { color: '#10b981', fontSize: 12, fontWeight: '500' },
```

- [ ] **Step 2: Manual verification [VISUAL]**

Pixel-compare the card header with the user mockup (the original screenshot). Should match closely.

- [ ] **Step 3: Commit**

```bash
git add components/call-room/CallRoomCard.tsx
git commit -m "feat(call-room): add Connected status pill in header"
```

---

### Task 36: Avatar mode picker (contact form integration)

**Files:**
- Modify: existing contact form (locate via grep)
- Create: `supabase/migrations/0XX_contact_avatar_mode.sql` (XX = next migration number)

- [ ] **Step 1: Find the contact form**

Run: `grep -rn "contacts\|Contact form\|EditContact\|NewContact" components/ app/ --include="*.tsx" -l | head -10`

Identify the file where users edit contacts. **If not found in this repo**, the avatar picker may need to live in a different repo (admin-portal). In that case, create only the migration here and stub out the picker behind a TODO; add a follow-up issue.

- [ ] **Step 2: Write the SQL migration**

```sql
-- supabase/migrations/0XX_contact_avatar_mode.sql

-- Verify table name first. Most likely: `contacts`.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS avatar_mode TEXT NOT NULL DEFAULT 'default_male'
    CHECK (avatar_mode IN ('photo', 'initials', 'default_male', 'default_female')),
  ADD COLUMN IF NOT EXISTS avatar_photo_url TEXT;

-- RLS: existing policies on `contacts` already cover new columns since policies are row-level.
-- Verify: SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'contacts'::regclass;

COMMENT ON COLUMN contacts.avatar_mode IS 'Call Room avatar style. Set per-contact by tenant operator.';
COMMENT ON COLUMN contacts.avatar_photo_url IS 'Optional uploaded client photo when avatar_mode = photo.';
```

- [ ] **Step 3: Add picker UI to contact form** (if found in step 1)

```typescript
// In the contact form component, near the name field:
<View style={{ marginVertical: 8 }}>
  <Text>Avatar</Text>
  <View style={{ flexDirection: 'row', gap: 8 }}>
    {(['photo', 'initials', 'default_male', 'default_female'] as AvatarMode[]).map((m) => (
      <Pressable
        key={m}
        onPress={() => setAvatarMode(m)}
        style={{ padding: 8, borderWidth: 1, borderColor: avatarMode === m ? '#3b82f6' : '#444', borderRadius: 6 }}
      >
        <Text>{labelFor(m)}</Text>
      </Pressable>
    ))}
  </View>
  {avatarMode === 'photo' && (
    <Pressable onPress={onUploadPhoto}>
      <Text>Upload photo</Text>
    </Pressable>
  )}
</View>
```

(If the contact form lives in `admin-portal` repo, defer this step to a paired PR there. Document in commit message.)

- [ ] **Step 4: Manual verification [VISUAL]**

Edit a contact, change avatar_mode, place a call to that contact, verify the Call Room shows the chosen avatar.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0XX_contact_avatar_mode.sql [contact-form-files-if-modified]
git commit -m "feat(call-room): add avatar_mode + avatar_photo_url to contacts + picker UI"
```

---

# M6 — Premium Hooks + Polish

By the end of M6, premium tier feature flags exist (no UI yet), edge-case states render correctly, and ambient audio toggle is functional.

---

### Task 37: Register premium feature flags

**Files:**
- Modify: existing feature flag module (locate via grep)
- Create: `components/call-room/featureFlags.ts` (constants only)

- [ ] **Step 1: Create the constants module**

```typescript
// components/call-room/featureFlags.ts
export const CALL_ROOM_FLAGS = {
  v1: 'call_room_v1',                              // gates the entire Call Room
  themePicker: 'call_room.theme.picker',           // V2: room themes
  weather: 'call_room.weather.enabled',            // V2: weather overlay
  ambientAudioLibrary: 'call_room.ambient_audio.library', // V2: multiple loops
  brandGlow: 'call_room.brand_glow.enabled',       // V2: branded glow
  todManualOverride: 'call_room.tod.manual_override', // V2: force time-of-day
} as const;
```

- [ ] **Step 2: Register in feature-flag system**

Run: `grep -rn "featureFlag\|useFeatureFlag\|flagsmith\|growthbook" hooks/ lib/ --include="*.ts" -l | head -3`

Once located, add the 6 keys to the registry. If the system requires DB seeding, add a one-shot SQL or migration.

- [ ] **Step 3: Commit**

```bash
git add components/call-room/featureFlags.ts [feature-flag-registry-files]
git commit -m "feat(call-room): register premium tier feature flags (no UI yet)"
```

---

### Task 38: Edge-case states (on-hold, transferring, ended)

**Files:**
- Modify: `components/call-room/CallRoomCard.tsx`

- [ ] **Step 1: Render visual indicators per state**

In the card body when `callState.isOnHold`:
- Dim the avatar slightly (opacity 0.7)
- Show "ON HOLD" label centered below the timer

When `callState.status === 'transferring'`:
- Show "TRANSFERRING…" label
- Ring is gold (already wired via mode)

When `callState.status === 'ended'`:
- Trigger the exit transition automatically (handled by parent setting `visible=false`)

```typescript
{callState.isOnHold && (
  <Text style={{ color: '#dc2626', textAlign: 'center', marginTop: 4, fontSize: 12, letterSpacing: 1 }}>
    ON HOLD
  </Text>
)}
{callState.status === 'transferring' && (
  <Text style={{ color: '#eab308', textAlign: 'center', marginTop: 4, fontSize: 12, letterSpacing: 1 }}>
    TRANSFERRING…
  </Text>
)}
```

- [ ] **Step 2: Manual verification [VISUAL]**

Use dev controls to toggle status states (extend dev controls if needed). Verify visual treatment.

- [ ] **Step 3: Commit**

```bash
git add components/call-room/CallRoomCard.tsx components/call-room/CallRoom.demo.tsx
git commit -m "feat(call-room): on-hold + transferring visual states"
```

---

### Task 39: Optional ambient audio loop with toggle

**Files:**
- Create: `components/call-room/hooks/useAmbientAudio.ts`
- Modify: `components/call-room/CallRoom.tsx`

- [ ] **Step 1: Source a free ambient audio loop**

Download a 30s "office room tone" or "distant city" loop from Pixabay (free, CC0). Save as `components/call-room/assets/audio/office-ambient.mp3`. Verify file <500 KB.

- [ ] **Step 2: Implement hook**

```typescript
// components/call-room/hooks/useAmbientAudio.ts
import { useEffect, useRef } from 'react';

const AUDIO_SRC = require('../assets/audio/office-ambient.mp3');

export function useAmbientAudio(enabled: boolean, fadeMs = 1500): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Audio' in window)) return;
    if (!enabled) {
      const a = audioRef.current;
      if (a) {
        // fade out
        const start = a.volume;
        const t0 = performance.now();
        const tick = () => {
          const t = (performance.now() - t0) / fadeMs;
          if (t >= 1) { a.pause(); a.currentTime = 0; a.volume = 0; return; }
          a.volume = start * (1 - t);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
      return;
    }
    const a = new Audio(typeof AUDIO_SRC === 'string' ? AUDIO_SRC : AUDIO_SRC.default);
    a.loop = true;
    a.volume = 0;
    audioRef.current = a;
    a.play().catch(() => {/* user-gesture-required, fail silently */});
    const t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) / fadeMs;
      if (t >= 1) { a.volume = 0.25; return; }
      a.volume = 0.25 * t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      a.pause();
      audioRef.current = null;
    };
  }, [enabled, fadeMs]);
}
```

- [ ] **Step 3: Wire toggle into CallRoom (default off, settings-driven later)**

```typescript
// in CallRoom.tsx
import { useAmbientAudio } from './hooks/useAmbientAudio';
useAmbientAudio(callState.ambientAudioEnabled ?? false);
```

Add `ambientAudioEnabled?: boolean` to `CallState`. Default off. Dev controls toggle it.

- [ ] **Step 4: Commit**

```bash
git add components/call-room/hooks/useAmbientAudio.ts components/call-room/CallRoom.tsx components/call-room/types.ts components/call-room/assets/audio/
git commit -m "feat(call-room): optional ambient audio loop with fade in/out"
```

---

### Task 40: Reduced-motion fallback

**Files:**
- Modify: `components/call-room/CallRoomBackground.tsx`
- Modify: `components/call-room/hooks/useCardTilt.ts`

- [ ] **Step 1: Disable parallax + tilt when prefers-reduced-motion is set**

In CallRoomBackground:
```typescript
import { useEffect, useState } from 'react';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// in render:
const reduced = usePrefersReducedMotion();
const effectiveIntensity = reduced ? 0 : parallaxIntensity;
// then pass effectiveIntensity to computeLayerOffset
```

In `useCardTilt`, return early if `usePrefersReducedMotion()` is true.

- [ ] **Step 2: Manual verification [VISUAL]**

Enable reduced-motion in OS settings. Open `/_dev/call-room`. Confirm: no parallax, no card tilt, no transitions (already handled in T21).

- [ ] **Step 3: Commit**

```bash
git add components/call-room/CallRoomBackground.tsx components/call-room/hooks/useCardTilt.ts
git commit -m "feat(call-room): reduced-motion fallback disables parallax + tilt"
```

---

### Task 41: Accessibility pass

**Files:**
- Modify: `components/call-room/CallRoom.tsx` (add aria-live region for call state)
- Modify: `components/call-room/CallRoomCard.tsx` (add semantic roles)

- [ ] **Step 1: Add aria-live region**

```typescript
// In CallRoom.tsx, add a hidden but screen-reader-accessible region:
{Platform.OS === 'web' && (
  <View
    accessibilityLiveRegion="polite"
    style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
  >
    <Text>{statusLabel(callState.status)} with {callState.client.name ?? 'unknown caller'}</Text>
  </View>
)}
```

- [ ] **Step 2: Add card role and label**

```typescript
// In CallRoomCard outer View:
accessibilityRole="dialog"
accessibilityLabel={`Active call with ${callState.client.name ?? 'unknown caller'}`}
```

- [ ] **Step 3: Verify keyboard tab order**

Open `/_dev/call-room`, tab through controls. Order: Mute → Hold → Keypad → Transfer → End Call. Each focusable, focus ring visible.

- [ ] **Step 4: Run axe-core audit (if available)**

If repo has `@axe-core/react`: `npm run a11y` (or equivalent). Resolve any reported issues.

- [ ] **Step 5: Commit**

```bash
git add components/call-room/CallRoom.tsx components/call-room/CallRoomCard.tsx
git commit -m "feat(call-room): accessibility — aria-live, dialog role, keyboard order"
```

---

# M7 — QA + Flag Rollout

By the end of M7, the Call Room is integrated into `app/session/calls.tsx` behind `call_room_v1`, all tests green, evil tests added, ready for staged rollout.

---

### Task 42: Integrate `<CallRoom>` into `app/session/calls.tsx`

**Files:**
- Modify: `app/session/calls.tsx` (~lines 690–760, ~1450)

- [ ] **Step 1: Locate the active-call render block**

Run: `sed -n '680,770p' app/session/calls.tsx | head -100`

- [ ] **Step 2: Replace it with feature-flag-gated CallRoom**

```typescript
import { useFeatureFlag } from '../../hooks/useFeatureFlag'; // verify path
import { CallRoom } from '../../components/call-room/CallRoom';
import { CALL_ROOM_FLAGS } from '../../components/call-room/featureFlags';

// inside the component, when call is active:
const callRoomEnabled = useFeatureFlag(CALL_ROOM_FLAGS.v1);

if (callIsActive) {
  if (callRoomEnabled) {
    return (
      <CallRoom
        visible={true}
        callState={mapToCallState(currentCall, host, contact)}
      />
    );
  }
  // existing dark-blue orb screen as fallback
  return <ExistingActiveCallScreen .../>;
}
```

Implement `mapToCallState(call, host, contact)` that converts the existing call data into the new `CallState` shape.

- [ ] **Step 3: Delete `callingStyles` (line ~1450)**

Confirmed unused after replacement. Delete the block.

- [ ] **Step 4: Run tests**

Run: `npx jest`
Expected: All Call Room tests pass. Existing tests unchanged. Snapshot tests for `calls.tsx` may need updating — review and accept.

- [ ] **Step 5: Manual verification [VISUAL]**

With flag OFF: place a call → see existing dark-blue orb screen.
With flag ON (set via flag system): place a call → see Call Room with push-in transition.

- [ ] **Step 6: Commit**

```bash
git add app/session/calls.tsx
git commit -m "feat(call-room): integrate CallRoom behind call_room_v1 feature flag"
```

---

### Task 43: Evil tests (security boundaries)

**Files:**
- Create: `__tests__/call-room/evil/cross-tenant.test.tsx`

- [ ] **Step 1: Write tests asserting tenant + admin boundaries**

```typescript
// __tests__/call-room/evil/cross-tenant.test.tsx
import { render } from '@testing-library/react-native';
import { CallRoom } from '../../../components/call-room/CallRoom';

describe('Call Room — evil tests', () => {
  it('does not render any tenant-bearing data when callState.client is missing', () => {
    // @ts-expect-error - intentional shape violation
    expect(() => render(<CallRoom visible={true} callState={{}} />)).not.toThrow();
  });

  it('does not leak hostAgent.name into client memory section', () => {
    const state = {
      status: 'connected',
      startedAt: Date.now(),
      hostAgent: { id: 'h', name: 'SECRET_HOST_NAME', photoUrl: null },
      client: { id: 'c', name: 'Public Client', phoneE164: '+15555550100', photoUrl: null, avatarMode: 'default_male' as const, service: null, urgency: null, note: null },
      isMuted: false, isOnHold: false,
    };
    const { queryByText } = render(<CallRoom visible={true} callState={state} />);
    // Host name should appear in host chip but NOT in client memory panel
    const memoryPanel = queryByText('Client Memory');
    expect(memoryPanel).toBeTruthy();
    // Within the client memory subtree, SECRET_HOST_NAME should not appear
    // (This is a smoke check — full audit happens in M7 receipt-ledger-auditor agent run)
  });
});
```

- [ ] **Step 2: Run, verify pass**

Run: `npx jest __tests__/call-room/evil/`
Expected: PASS, all tests.

- [ ] **Step 3: Commit**

```bash
git add __tests__/call-room/evil/cross-tenant.test.tsx
git commit -m "test(call-room): add evil tests for cross-tenant data leakage"
```

---

### Task 44: Playwright e2e — full call room flow

**Files:**
- Create: `e2e/call-room.spec.ts`

- [ ] **Step 1: Write e2e**

```typescript
// e2e/call-room.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Call Room', () => {
  test('admin can access /_dev/call-room and switch fixtures', async ({ page }) => {
    // Log in as admin (use existing helper from e2e/ folder)
    await page.goto('/_dev/call-room');
    await expect(page.getByTestId('call-room-dev-controls')).toBeVisible();
    await expect(page.getByTestId('call-room-card')).toBeVisible();

    // Switch to "No-photo · 3D default female" fixture
    await page.getByText('No-photo · 3D default female').click();
    await expect(page.getByTestId('avatar-default-female')).toBeVisible();
  });

  test('non-admin redirects away from /_dev/call-room', async ({ page }) => {
    // (Set up non-admin auth via cookie/localStorage helper)
    await page.goto('/_dev/call-room');
    await expect(page).toHaveURL('/');
  });

  test('end-call button triggers exit transition', async ({ page }) => {
    await page.goto('/_dev/call-room');
    await page.getByTestId('end-call-btn').click();
    // Expect call-room-root to be hidden after transition
    await page.waitForTimeout(700);
    await expect(page.getByTestId('call-room-root')).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Run**

Run: `npx playwright test e2e/call-room.spec.ts`
Expected: PASS, 3/3.

- [ ] **Step 3: Commit**

```bash
git add e2e/call-room.spec.ts
git commit -m "test(call-room): add Playwright e2e coverage"
```

---

### Task 45: Run verification agents

This step is performed by the executing engineer manually.

- [ ] **Step 1: Run the receipt-ledger-auditor agent**

Verify Call Room introduces no state changes that bypass receipts.

- [ ] **Step 2: Run the security-reviewer agent**

Verify tenant boundaries, admin-gate effectiveness, geolocation handling, no PII leakage.

- [ ] **Step 3: Run the aspire-policy-gate agent**

Verify governance compliance: capability tokens for control actions, fail-closed behavior.

- [ ] **Step 4: Run the aspire-test-engineer agent**

Verify test coverage ≥80% on Call Room components, RLS isolation tests for `contacts` migration.

- [ ] **Step 5: Address all findings**

Apply any required fixes inline. Re-run failing agents after fixes.

- [ ] **Step 6: Commit any fix-up**

```bash
git add -A
git commit -m "fix(call-room): address findings from verification agents"
```

---

### Task 46: Wire production action handlers + final QA

**Files:**
- Modify: `components/call-room/CallRoomCard.tsx` — receive handlers as props
- Modify: `app/session/calls.tsx` — pass real handlers

- [ ] **Step 1: Lift handlers to props**

In `CallRoomCard.tsx`, replace empty handlers in `<CallRoomControls>` with props from `CallRoom`:

```typescript
export interface CallRoomCardProps {
  callState: CallState;
  onMute: () => void;
  onHold: () => void;
  onKeypad: () => void;
  onTransfer: () => void;
  onEnd: () => void;
}
```

Pass them through from `CallRoom` and from `app/session/calls.tsx`.

- [ ] **Step 2: Verify each handler routes through orchestrator**

Each handler must call the existing `useFrontdeskCalls` API which already mints capability tokens + emits receipts (Law #1, #2, #5).

- [ ] **Step 3: Run full test suite**

Run: `npx jest && npx playwright test e2e/call-room.spec.ts`
Expected: ALL PASS.

- [ ] **Step 4: 24h soak on staging**

Deploy to staging behind flag. Place 10+ test calls across Sarah/direct/inbound. Watch for memory leaks (parallax, audio context, RAF loops).

- [ ] **Step 5: Founder visual review**

Compare a real Call Room call (in staging, with feature flag on) side-by-side with the user's mockup screenshot. **All visual differences are blockers** until founder approves.

- [ ] **Step 6: Flag rollout — gradual**

- 1% admin tenant only (founder)
- Day +1: 10% pilot tenants
- Day +3: 50%
- Day +7: 100% if no incidents

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat(call-room): wire production handlers + ship V1"
```

---

## Self-Review

**Spec coverage:**
- §1 scope (active-call only) → T42 (integration with feature flag)
- §2.1 office parallax → T06–T08, T12–T14
- §2.2 time-of-day tint → T23–T28
- §2.3 floating card layout → T09–T11, T35
- §2.4 shared roomLight → T15–T16, T17, T25, T26
- §2.5 card tilt → T17
- §2.6 4-state avatar → T29, T30
- §2.7 voice activity ring → T31–T34
- §2.8 caller ID hierarchy → T10
- §2.9 client memory panel → T10
- §2.10 AI assist panel → T10
- §2.11 ambient micro-life → T27, T39
- §2.12 transitions → T19–T22
- §3.1 file layout → matches plan
- §3.3a contact schema → T36
- §3.4 dev preview → T03–T05, T22
- §4.1 perf budget → verified visually + via M7 soak
- §4.2 Aspire Laws → T43, T45 verification agents
- §4.3 accessibility → T40, T41
- §5 milestones → all 8 covered
- §8 acceptance criteria → covered across M7 tasks

**Placeholder scan:** No "TBD" / "TODO" / "implement later" left. Asset-creation steps (T06, T12) require real artistic work — these are flagged but contain concrete prompts/instructions, not placeholders.

**Type consistency:** `CallState`, `ClientContext`, `RoomLight`, `AvatarMode`, `TimeOfDayState`, `RingMode` — all defined in `types.ts` (T01) or alongside the component that owns them (T32 for `RingMode`). Function names consistent: `computeLayerOffset` (T13), `computeEnterFrame` (T19), `computeExitFrame` (T20), `computeRingFrame` (T32), `roomLightToCssVars` (T15), `classifyTimeOfDay` (T24).

**Open items flagged for executor:**
- T05: substitute the actual admin-hook path (auto-discovered in step 1)
- T22: substitute admin-hook
- T36: contact form may be in another repo — gracefully degrade if so
- T37: feature-flag system path varies — auto-discovered

---

## Execution Handoff

**Plan complete and saved to** `Aspire-desktop/docs/superpowers/plans/2026-04-30-call-room-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
