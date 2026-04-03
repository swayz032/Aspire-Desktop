# Conference Production Redesign — Full Spec

**Date:** 2026-04-03
**Scope:** Complete rebuild of `conference-live.tsx` and supporting components
**SDK:** @zoom/videosdk v2.3.15+
**Goal:** Production-grade video conference with all standard features + Nora AI as full participant

---

## 0. Video & Audio Quality — Maximum Clarity

### Video: 1080p Full HD

**Capture (sending):**
- `stream.startVideo({ fullHd: true, hd: true })` — requests 1080p from camera
- Fallback chain: 1080p → 720p → SDK default (if device/bandwidth can't handle HD)
- Front-facing camera (`facingMode: 'user'`)

**Receive (rendering):**
Adaptive quality based on tile size using Zoom SDK `VideoQuality` enum:
| Context | Quality | Resolution |
|---------|---------|------------|
| Spotlight / active speaker | `Video_1080P` (4) | 1920×1080 |
| Gallery tile (≤6 participants) | `Video_720P` (3) | 1280×720 |
| Gallery tile (7+ participants) | `Video_360P` (2) | 640×360 |
| Filmstrip thumbnail | `Video_180P` (1) | 320×180 |

Use `stream.getMaxRenderableVideos()` to determine optimal quality allocation:
- Return 1: render 1× 720p
- Return 4: render 1× 720p + 3× 360p
- Return 9: render 2× 720p + 7× 180p
- Return 25: render 2× 720p + 23× 180p

### Audio: Crystal Clear

**Capture:**
- `echoCancellation: true` — eliminates echo from speakers
- `noiseSuppression: true` — WebRTC-level noise reduction
- `autoGainControl: true` — normalizes volume levels

**Zoom SDK noise suppression:**
- `stream.enableBackgroundNoiseSuppression(true)` — Zoom's ML-based noise reduction on top of WebRTC
- Enabled automatically on join
- Toggle available in settings

### Canvas Rendering (current approach)
Using `stream.renderVideo(canvas, userId, width, height, x, y, rotation)`:
- Canvas dimensions match tile size for sharp rendering
- Local camera: `rotation=2` for mirror effect
- Remote cameras: `rotation=0`
- Canvas `width`/`height` attributes set to actual pixel dimensions (not CSS size) for crisp rendering on HiDPI displays

### HiDPI / Retina Support
Canvas element uses `devicePixelRatio` for sharp rendering:
```
canvas.width = tileWidth * window.devicePixelRatio;
canvas.height = tileHeight * window.devicePixelRatio;
canvas.style.width = tileWidth + 'px';
canvas.style.height = tileHeight + 'px';
```

---

## 1. Layout Structure

Three-zone layout: Header → Video Grid → Footer Control Bar.

```
┌──────────────────────────────────────────────────────────┐
│ HEADER BAR (56px)                                        │
│ [🔒 E2E] Room Name        3 participants · 04:32  [REC] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  VIDEO GRID (flex: 1, fills remaining space)             │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │   You    │ │  Guest   │ │   Nora   │                  │
│  │  camera  │ │  camera  │ │  AI tile │                  │
│  └──────────┘ └──────────┘ └──────────┘                  │
│                                                          │
│  Adaptive grid: 1→full, 2→side-by-side, 3-4→2x2,        │
│  5-6→2x3, 7-9→3x3, 10+→4x3 with scroll                 │
│                                                          │
│  Speaker view: active speaker spotlight + filmstrip       │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ FOOTER CONTROL BAR (72px)                                │
│ [Mic] [Camera] [Share] [Record] [Chat] [People] [Leave] │
│                  + View toggle (Gallery/Speaker)          │
└──────────────────────────────────────────────────────────┘

Optional right panels (slide over grid, don't resize it):
  - Chat panel (400px)
  - Participants panel (320px)
```

---

## 2. Header Bar

**Component:** `ConferenceHeader`

| Element | Position | Details |
|---------|----------|---------|
| Security badge | Left | Lock icon + "Encrypted" label |
| Room name | Left-center | From topic param, truncated at 40 chars |
| Participant count | Center | "3 participants" with people icon |
| Duration timer | Center-right | MM:SS, starts on join, useRef interval |
| Recording indicator | Right | Red pulsing dot + "REC" when recording active |
| Network quality | Right | Signal bars icon (green/yellow/red) |

**Style:** Semi-transparent dark background (`rgba(10,10,12,0.85)`), blur backdrop, 56px height, sticky top.

---

## 3. Footer Control Bar

**Component:** `ConferenceControlBar`

Centered row of circular buttons (48px each), grouped:

| Button | Icon | Toggle | Action |
|--------|------|--------|--------|
| Microphone | `mic` / `mic-off` | Yes | `stream.muteAudio()` / `stream.unmuteAudio()` |
| Camera | `videocam` / `videocam-off` | Yes | `stream.stopVideo()` / `stream.startVideo()` |
| Screen Share | `share-outline` / `share` | Yes | `stream.startShareScreen()` / `stream.stopShareScreen()` |
| Record | `radio-button-on` (red) | Yes | `client.getRecordingClient().startCloudRecording()` / `.stopCloudRecording()` |
| Chat | `chatbubble` | Yes | Toggle chat panel, badge for unread count |
| Participants | `people` | Yes | Toggle participants panel |
| View Toggle | `grid` / `expand` | Yes | Gallery ↔ Speaker view |
| Leave | `call` (red bg) | No | Confirmation modal → end session |

**Visual states:**
- Default: `rgba(28,28,30,0.9)` bg, white icon
- Active/on: Same as default (mic on = white mic icon)
- Muted/off: `rgba(239,68,68,0.15)` bg, red icon
- Hover: Slight brightness increase + tooltip label
- Screen share active: Blue highlight ring

**Style:** Semi-transparent dark, blur backdrop, 72px height, centered horizontally with 12px gaps.

**Keyboard shortcuts:**
- `Alt+M` — Toggle mic
- `Alt+V` — Toggle camera
- `Alt+S` — Toggle screen share
- `Alt+R` — Toggle recording
- `Alt+H` — Toggle chat (already exists)
- `Alt+P` — Toggle participants
- `Alt+L` — Toggle view layout

---

## 4. Video Grid

**Component:** `ConferenceGrid` (rewrite)

### Gallery View (default)
Adaptive CSS grid that fills available space:

| Participants | Layout | Tile aspect |
|-------------|--------|-------------|
| 1 | 1x1 centered, max 80% viewport | 16:9 |
| 2 | 1x2 side by side | 16:9 |
| 3-4 | 2x2 grid | 16:9 |
| 5-6 | 2x3 grid | 16:9 |
| 7-9 | 3x3 grid | 16:9 |
| 10-12 | 3x4 grid | 16:9 |
| 13+ | 4x4 grid + overflow scroll | 16:9 |

**Nora occupies one grid slot** — same size as any human participant.

### Speaker View
- Active speaker gets 75% of grid area (spotlight)
- Other participants in horizontal filmstrip (120px tall) at bottom
- Nora tile in filmstrip when not speaking, spotlight when speaking
- Smooth transition when speaker changes (300ms crossfade)

### Screen Share View
- Shared screen gets 75% of grid area
- Participants in vertical filmstrip (160px wide) on right
- Sharer has green "Sharing" badge on their tile
- Local user sees "You are sharing" banner at top of screen share area

---

## 5. Nora AI Tile

**Component:** `NoraTile` (new, replaces `NoraTileOverlay`)

Full participant tile in the grid, same size as human tiles. NOT a floating overlay.

**States:**

| State | Visual |
|-------|--------|
| Idle | Dark gradient bg, Nora avatar (Ava logo), "Nora" name label, subtle breathing ring |
| Listening | Blue glow ring, "Listening..." status, inner pulse animation |
| Thinking | Purple glow ring, "Thinking..." status, dot animation |
| Speaking | Green glow ring, "Speaking..." status, audio waveform visualization, speaking border |

**Interaction:** Click tile to toggle Nora voice session (start/stop).

**Name label:** "Nora · AI Assistant" with a small AI badge icon.

**Audio visualization:** When speaking, show a simple 5-bar equalizer animation in the center of the tile below the avatar.

---

## 6. Chat Panel

**Component:** `ConferenceChatPanel` (replaces drawer)

Slides in from right over the video grid (400px wide). Three tabs:

| Tab | Content |
|-----|---------|
| Chat | Room messages + private Ava messages |
| Materials | Shared documents, notes, links with save/download |
| Authority | Pending approvals with approve/deny buttons |

**Chat features:**
- Room messages (visible to all) vs private (only you + Ava)
- Toggle between room/private with segmented control
- Ava thinking indicator (typing dots)
- Timestamp on each message
- Auto-scroll to newest

---

## 7. Participants Panel

**Component:** `ConferenceParticipantsPanel` (new)

Slides in from right (320px wide). Shows:

| Per participant | Details |
|----------------|---------|
| Avatar + name | With "You" badge for local, "AI" badge for Nora |
| Mic status | Green dot = unmuted, red mic-off icon = muted |
| Camera status | Green dot = video on, grey cam-off = off |
| Connection quality | Signal bars (if available from SDK) |
| Role badge | "Host" / "Guest" |

**Actions (host only):**
- Mute participant
- Remove participant
- Spotlight participant

**Footer:** Invite button → opens invite flow (existing room-link / invite-internal endpoints).

---

## 8. Screen Sharing

**Implementation:**
```
stream.startShareScreen({
  displaySurface: 'monitor',  // or 'window', 'browser'
})
```

**UI behavior:**
- When local user shares: grid switches to screen share view, "You are sharing" banner shown
- When remote user shares: grid switches to screen share view, sharer's name shown
- When share stops: grid returns to previous view (gallery/speaker)
- Only one share at a time (Zoom SDK enforced)

**Screen share tile rendering:**
- Uses `stream.startShareView(canvas)` on a dedicated canvas element
- Canvas fills 75% of grid area
- Maintains aspect ratio with letterboxing

---

## 9. Recording

**Implementation:**
```
const recordingClient = client.getRecordingClient();
await recordingClient.startCloudRecording();
await recordingClient.stopCloudRecording();
```

**UI behavior:**
- Record button in footer toggles recording
- Header shows pulsing red "REC" indicator when active
- All participants see recording indicator (SDK sends notification)
- Confirmation dialog before starting: "This session will be recorded. All participants will be notified."
- Receipt generated when recording starts and stops (Law #2)

**Recording events:**
- `recording-change` event from SDK → update UI state
- States: `Recording`, `Paused`, `Stopped`

---

## 10. Network Quality

**Implementation:**
```
client.on('network-quality-change', (payload) => {
  // payload: { level: 0-5, type: 'uplink' | 'downlink' }
});
```

**UI:** Signal bars in header (1-5 bars), color coded:
- 4-5: Green (good)
- 2-3: Yellow (fair)
- 0-1: Red (poor) + toast warning

---

## 11. Virtual Background / Blur

**Implementation:**
```
stream.updateVirtualBackgroundImage(undefined); // blur
stream.updateVirtualBackgroundImage(imageUrl);  // image
```

**UI:** Dropdown from camera button with options:
- None (no background effect)
- Blur (gaussian blur)
- 3-4 preset images (office, nature, abstract)
- Custom upload

---

## 12. Reconnection Handling

**Implementation:**
Listen for `connection-change` events:
- `Reconnecting` → Show "Reconnecting..." overlay with spinner
- `Connected` → Remove overlay, rebuild participant list
- `Closed` / `Fail` → Show error with retry button, auto-retry 3x with exponential backoff (2s, 4s, 8s)

---

## 13. Permission Handling

Before joining, check camera/mic permissions:
```
const result = await navigator.permissions.query({ name: 'camera' });
```

**States:**
- `granted` → proceed normally
- `prompt` → show instruction: "Allow camera and microphone access to join"
- `denied` → show error: "Camera/mic blocked. Check browser settings." + link to settings

---

## 14. File Structure

```
components/session/
  ConferenceHeader.tsx          — header bar (room name, timer, indicators)
  ConferenceControlBar.tsx      — footer controls (mic, camera, share, record, etc.)
  ConferenceGrid.tsx            — adaptive video grid (gallery + speaker views)
  NoraTile.tsx                  — Nora AI full participant tile
  ConferenceParticipantsPanel.tsx — participant list panel
  ConferenceChatPanel.tsx       — chat/materials/authority panel (replaces drawer)
  ConferenceScreenShare.tsx     — screen share canvas + layout
  VirtualBackgroundPicker.tsx   — background blur/image picker dropdown
  ConferenceReconnecting.tsx    — reconnection overlay
  ZoomConferenceProvider.tsx    — (exists, extend with recording + share + quality)
  ZoomVideoTile.tsx             — (exists, no changes needed)

app/session/
  conference-live.tsx           — rewrite: compose above components

hooks/
  useConferenceTimer.ts         — duration timer hook
  useConferenceControls.ts      — mic/camera/share/record toggle state
  useConferenceKeyboard.ts      — keyboard shortcuts
  useNetworkQuality.ts          — network quality from SDK
  useZoomRecording.ts           — recording state management
  useZoomScreenShare.ts         — screen share state management
```

---

## 15. Data Flow

```
conference-live.tsx
  └─ ZoomConferenceProvider (client, stream, participants)
       ├─ ConferenceHeader (timer, participant count, recording, network)
       ├─ ConferenceGrid (participants + NoraTile, gallery/speaker view)
       │    ├─ ZoomVideoTile × N (human participants)
       │    ├─ NoraTile × 1 (AI participant, always present)
       │    └─ ConferenceScreenShare (when someone is sharing)
       ├─ ConferenceControlBar (all toggle actions)
       ├─ ConferenceChatPanel (slides over grid)
       ├─ ConferenceParticipantsPanel (slides over grid)
       └─ VirtualBackgroundPicker (dropdown from camera button)
```

---

## 16. Extend ZoomConferenceProvider

Add to context value:
- `recordingClient` — from `client.getRecordingClient()`
- `isRecording: boolean`
- `networkQuality: { uplink: number; downlink: number }`
- `screenShareActive: boolean`
- `screenShareUserId: number | null`

Add event listeners:
- `recording-change`
- `network-quality-change`
- `active-share-change`
- `share-content-change`
- `passively-stop-share`

---

## 17. Production Quality Checklist

- [ ] All controls have keyboard shortcuts
- [ ] All buttons have accessibility labels and roles
- [ ] Permission denied shows actionable error
- [ ] Reconnection with exponential backoff
- [ ] Recording receipts (Law #2)
- [ ] Tenant isolation on all API calls (Law #6)
- [ ] Error boundaries on every component
- [ ] Toast notifications for state changes
- [ ] Duration timer accurate across tab switches (use Date.now delta, not setInterval counting)
- [ ] Cleanup on unmount (stop video, stop audio, leave, destroy)
- [ ] Screen share cleanup if user navigates away
- [ ] Mobile touch targets ≥ 44px
- [ ] Responsive: footer stacks on narrow screens
